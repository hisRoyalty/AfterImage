import Phaser from 'phaser';
import { loadRoom } from '../sim/room.ts';
import { newSession, step, PH_CLEAR, PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { TUNING, assistTuning, SUB } from '../sim/constants.ts';
import { hashSession } from '../sim/hash.ts';
import { solutionMasks } from '../sim/replay.ts';
import type { Room } from '../sim/types.ts';
import { ROOMS } from '../rooms/index.ts';
import { drawPaper, drawTerrain } from '../render/terrain.ts';
import { drawObjects, drawLoopPath, loopPos } from '../render/actors.ts';
import { bakeActors, bakeImage, actorImage, RES, SPR_OX, SPR_OY, SPR_W, SPR_H } from '../render/bake.ts';
import { Hud, VIEW_W, VIEW_H } from '../render/hud.ts';
import { MONO, CSS, PAL } from '../render/palette.ts';
import { input, settings } from '../meta/game.ts';
import { STR } from '../meta/strings.ts';
import { keyLabel } from '../meta/input.ts';
import type { Action } from '../meta/input.ts';
import { initAudio } from '../audio/engine.ts';
import { RoomFlow } from './roomFlow.ts';
import { Music } from '../audio/music.ts';
import { Recorder } from '../meta/record.ts';

const STEP_MS = 1000 / 60;

export class RoomScene extends Phaser.Scene {
  index = 0;
  room!: Room;
  s!: Session;
  selfImgs: Phaser.GameObjects.Image[] = [];
  liveImg!: Phaser.GameObjects.Image;
  paths: Phaser.GameObjects.RenderTexture | null = null;
  pathKey = '';
  gDyn!: Phaser.GameObjects.Graphics;
  hud!: Hud;
  flow!: RoomFlow;
  music = new Music();
  recorder = new Recorder();
  debugText!: Phaser.GameObjects.Text;
  cueText!: Phaser.GameObjects.Text;
  debug = false;
  acc = 0;
  ff = false;
  px = 0;
  py = 0;
  scripted: number[] | null = null;
  pb: Session | null = null;
  pbMasks: number[] = [];
  pbAt = 0;
  pbKept = 0;
  pbRate = [4, 1];
  ticks = 0;
  frames = 0;
  fpsT = 0;
  fps = 60;
  lastNow = 0;

  constructor() {
    super('room');
  }

  init(data: { index?: number }): void {
    this.index = data.index ?? 0;
  }

  create(): void {
    this.acc = 0;
    this.lastNow = 0;
    this.ff = false;
    this.pb = null;
    this.cameras.main.setZoom(2).centerOn(VIEW_W / 2, VIEW_H / 2);
    const json = ROOMS[this.index];
    this.room = loadRoom(json);
    const st = settings();
    const tun = st.assistTiming ? assistTuning(TUNING) : TUNING;
    this.s = newSession(this.room, tun, st.assistTrack ? 1 : 0);
    bakeActors(this);
    bakeImage(this, VIEW_W, VIEW_H, (g) => { drawPaper(g, VIEW_W, VIEW_H); drawTerrain(g, this.room); });
    this.gDyn = this.add.graphics().setDepth(5);
    this.selfImgs = [0, 1, 2, 3].map(() => actorImage(this, 'drone_1', 6));
    this.liveImg = actorImage(this, 'live_r', 7).setOrigin((SPR_OX + 9) / SPR_W, (SPR_OY + 20) / SPR_H);
    this.pathKey = '';
    this.paths = null;
    this.hud = new Hud(this);
    const p = json.par.drones + json.par.loops;
    const parTxt = p === 0 ? STR.parNone : [json.par.drones && `${json.par.drones}D`, json.par.loops && `${json.par.loops}L`].filter(Boolean).join('+');
    const k = (a: Action) => keyLabel(input.keys[a][0] ?? '');
    const keys = [`${k('drone')} drone`, this.room.loopsOk ? `${k('loop')} loop` : '', `${k('erase')} erase`, `${k('retry')} retry`].filter(Boolean).join('   ');
    this.hud.setRoom(Number(json.id.slice(1)), json.name, STR.par(parTxt, this.s.cap), keys);
    this.debugText = this.add.text(4, 4, '', { fontFamily: MONO, fontSize: '8px', color: CSS.ink, backgroundColor: '#F4EDE0CC', resolution: 3 }).setDepth(50).setVisible(false);
    this.flow = new RoomFlow(this);
    this.cueText = this.add.text(0, 0, '', { fontFamily: MONO, fontSize: '9px', color: CSS.ink, resolution: 3 }).setOrigin(0.5).setDepth(9).setVisible(false);
    this.px = this.s.live.x;
    this.py = this.s.live.y;
    input.clear();
    this.flow.start();
    this.events.once('shutdown', () => { this.music.stop(); this.recorder.stop(); });
    this.cameras.main.fadeIn(180, 244, 237, 224);
    if (!settings().reducedMotion) { this.cameras.main.setZoom(2.08); this.tweens.add({ targets: this.cameras.main, zoom: 2, duration: 420, ease: 'Cubic.easeOut' }); }
    this.input.keyboard?.on('keydown-F1', () => { this.debug = !this.debug; this.debugText.setVisible(this.debug); });
  }

  // One fixed sim step with interpolation bookkeeping.
  stepOnce(mask: number): void {
    const s = this.s;
    const takes = s.takes;
    const preT = s.phase === PH_COUNTIN ? 0 : s.t;
    this.px = s.live.x;
    this.py = s.live.y;
    step(s, mask);
    this.ticks++;
    if (s.takes !== takes || s.phase === PH_COUNTIN) { this.px = s.live.x; this.py = s.live.y; }
    this.flow.onEvents(s, s.ev, preT);
    if (!this.scripted) this.music.onStep(s);
  }

  // Runs as many fixed steps as the elapsed time allows. Shared by play and the e2e pacing test.
  advance(deltaMs: number): void {
    const speed = settings().assistSpeed / 100;
    this.acc += Math.min(deltaMs, 250) * speed;
    let n = 0;
    while (this.acc >= STEP_MS && n < 5) {
      this.acc -= STEP_MS;
      n++;
      if (this.pb) { this.stepPlayback(); continue; }
      if (this.scripted) {
        const m = this.scripted.shift();
        if (m === undefined) { this.scripted = null; break; }
        if (this.s.phase !== PH_CLEAR) this.stepOnce(m);
        continue;
      }
      if (this.s.phase === PH_CLEAR) continue;
      if (this.flow.blocking()) continue;
      this.ff = input.held('ff') && this.s.phase !== PH_CLEAR;
      const reps = this.ff ? 4 : 1;
      for (let r = 0; r < reps && this.s.phase !== PH_CLEAR; r++) {
        const m = input.simMask(this.ff);
        if (m) { this.flow.booth.input(); initAudio(); }
        this.stepOnce(m);
      }
    }
    if (n === 5) this.acc = Math.min(this.acc, STEP_MS);
  }

  update(time: number): void {
    const now = performance.now();
    const delta = this.lastNow ? Math.min(250, now - this.lastNow) : 16.7;
    this.lastNow = now;
    if (!this.scripted) { this.flow.update(delta); this.music.update(this.s, this.ff, delta); }
    this.advance(delta);
    this.frames++;
    if (time - this.fpsT > 500) { this.fps = (this.frames * 1000) / (time - this.fpsT); this.frames = 0; this.fpsT = time; }
    this.render(time);
  }

  // Playback after a clear: kept takes at 4x, then the clearing take with every self, 8 s at most.
  startPlayback(): void {
    const s = this.s;
    if (!s.clearLog) return;
    this.pbMasks = solutionMasks(s.logs.concat([s.clearLog]));
    this.pbKept = solutionMasks(s.logs).length;
    const frames = this.pbKept / 4 + (this.pbMasks.length - this.pbKept);
    const k = Math.max(1, frames / 480);
    this.pbRate = [Math.ceil(4 * k), Math.ceil(k)];
    this.pb = newSession(this.room, s.tun, s.cap - this.room.json.tracks);
    this.pbAt = 0;
    this.recorder.start(this.game.canvas);
  }

  stepPlayback(): void {
    const pb = this.pb as Session;
    const n = this.pbAt < this.pbKept ? this.pbRate[0] : this.pbRate[1];
    for (let k = 0; k < n && this.pbAt < this.pbMasks.length; k++) step(pb, this.pbMasks[this.pbAt++]);
    if (this.pbAt >= this.pbMasks.length && this.pbAt++ === this.pbMasks.length + 45) this.recorder.stop();
    this.px = pb.live.x;
    this.py = pb.live.y;
  }

  render(now: number): void {
    const s = this.pb ?? this.s;
    const g = this.gDyn;
    const a = Math.max(0, Math.min(1, this.acc / STEP_MS));
    const running = s.phase !== PH_COUNTIN;
    g.clear();
    drawObjects(g, s, now);
    this.syncPaths(s);
    this.selfImgs.forEach((img, i) => {
      const tr = s.tracks[i];
      img.setVisible(!!tr);
      if (!tr) return;
      img.setTexture(`${tr.kind === 0 ? 'drone' : 'loop'}_${i + 1}`);
      if (tr.kind === 0) img.setPosition(tr.x / SUB, tr.y / SUB);
      else { const [x, y] = loopPos(tr, s.t, running); img.setPosition(x, y); }
    });
    this.liveImg.setVisible(this.flow.liveVisible());
    if (this.flow.liveVisible()) {
      const lx = (this.px + (s.live.x - this.px) * a) / SUB;
      const ly = (this.py + (s.live.y - this.py) * a) / SUB;
      const p = this.flow.pose(s);
      this.liveImg.setTexture(p.blink ? 'live_b' : p.face < 0 ? 'live_l' : 'live_r').setPosition(lx + 9, ly + 20).setScale(p.sx / RES, p.sy / RES);
    }
    this.flow.drawFx(g);
    const cue = this.pb ? null : this.flow.cue(s);
    this.cueText.setVisible(!!cue);
    if (cue) {
      const bob = Math.sin(now / 220) * 1.5;
      const w = Math.max(14, cue.key.length * 6 + 6);
      g.fillStyle(PAL.paper, 1);
      g.fillRoundedRect(cue.x - w / 2, cue.y - 7 + bob, w, 14, 3);
      g.lineStyle(1.5, PAL.ink, 0.8);
      g.strokeRoundedRect(cue.x - w / 2, cue.y - 7 + bob, w, 14, 3);
      this.cueText.setText(cue.key).setPosition(cue.x, cue.y + bob);
    }
    this.hud.draw(s, input.wipeProgress, this.ff, now);
    if (this.debug) this.drawDebug();
  }

  // Loop paths only change when tracks do, so they live in their own baked layer.
  syncPaths(s: Session): void {
    const key = s.tracks.map((t) => (t.kind === 1 ? `L${t.n}:${t.xs[0]}` : 'D')).join(',');
    if (key === this.pathKey) return;
    this.pathKey = key;
    this.paths?.destroy();
    this.paths = s.loops.length ? bakeImage(this, VIEW_W, 360, (g) => s.loops.forEach((l) => drawLoopPath(g, l)), 4) : null;
  }

  drawDebug(): void {
    const s = this.s, l = s.live;
    const f = (v: number) => (v / SUB).toFixed(2);
    this.debugText.setText([
      `room ${this.room.json.id}  tick ${s.t}  take ${s.takes}  phase ${s.phase}  fps ${this.fps.toFixed(0)}`,
      `x ${f(l.x)} y ${f(l.y)}  vx ${f(l.vx * 60)} vy ${f(l.vy * 60)} px/s`,
      `ground ${l.ground} coyote ${l.coyote} buf ${l.buf} jumpT ${l.jumpT} bounce ${l.bouncing}`,
      `switches ${[...s.pressed].join('')}  gates ${[...s.gateOpen].join('')}  tracks ${s.tracks.length}/${s.cap}`,
      `hash ${hashSession(s).toString(16)}`,
    ]);
  }

  // e2e: feed recorded masks through the real fixed-step loop at a given frame pacing.
  driveScripted(masks: number[], frameMs: number): number {
    this.scripted = masks.slice();
    let guard = 0;
    while (this.scripted && guard++ < 200000) this.advance(frameMs);
    return hashSession(this.s);
  }
}
