import Phaser from 'phaser';
import { loadRoom } from '../sim/room.ts';
import { newSession, step, PH_CLEAR, PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { TUNING, assistTuning, SUB } from '../sim/constants.ts';
import { hashSession } from '../sim/hash.ts';
import { solutionMasks } from '../sim/replay.ts';
import type { Room } from '../sim/types.ts';
import { ROOMS } from '../rooms/index.ts';
import { bakeRoom } from '../render/terrain.ts';
import { ObjectLayer } from '../render/objectLayer.ts';
import { Backdrop } from '../render/backdrop.ts';
import { Door } from '../render/door.ts';
import { themeOf } from '../rooms/themes.ts';
import { SelfLayer, LiveSprite } from '../render/actorLayer.ts';
import { img, res } from '../render/sprites.ts';
import { Prompt } from '../render/prompt.ts';
import { Hud } from '../render/hud.ts';
import { fitCamera, textRes } from '../meta/screen.ts';
import { useCursor, setCursorMode } from '../meta/pointer.ts';
import { MONO, CSS } from '../render/palette.ts';
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
  objects!: ObjectLayer;
  selves!: SelfLayer;
  live!: LiveSprite;
  prompt!: Prompt;
  backdrop!: Backdrop;
  door!: Door;
  dark: Phaser.GameObjects.Image | null = null;
  gDyn!: Phaser.GameObjects.Graphics;
  hud!: Hud;
  flow!: RoomFlow;
  music = new Music();
  recorder = new Recorder();
  debugText!: Phaser.GameObjects.Text;
  frameMs = 16.7;
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
    fitCamera(this);
    useCursor(this, 'play');
    const json = ROOMS[this.index];
    this.room = loadRoom(json);
    const st = settings();
    const tun = st.assistTiming ? assistTuning(TUNING) : TUNING;
    this.s = newSession(this.room, tun, st.assistTrack ? 1 : 0);
    const theme = themeOf(json);
    img(this, theme === 'night' ? 'paper_night' : 'paper', 0, 0, -5);
    this.backdrop = new Backdrop(this, theme, -4);
    bakeRoom(this, this.room);
    this.objects = new ObjectLayer(this, this.s, 3);
    this.selves = new SelfLayer(this, 6);
    this.live = new LiveSprite(this, 7);
    this.gDyn = this.add.graphics().setDepth(8.5);
    this.dark = null;
    const radius = json.dark ?? 0;
    // In the night rooms the door glows through the dark, except where the light is at its smallest.
    this.door = new Door(this, this.room.out.x / SUB, this.room.out.y / SUB, radius > 60 ? 5.8 : 2);
    if (radius > 0) {
      // Night chapter: only a pool of light round you; your selves, beams and (mostly) the Out glow through.
      this.dark = img(this, 'dark', 0, 0, 5.5).setOrigin(0.5).setScale(radius / 50 / res(this, 'dark'));
      for (const b of this.objects.beams) { b.on.setDepth(5.8); b.off.setDepth(5.8); }
    }
    this.hud = new Hud(this);
    const p = json.par.drones + json.par.loops;
    const parTxt = p === 0 ? STR.parNone : [json.par.drones && `${json.par.drones}D`, json.par.loops && `${json.par.loops}L`].filter(Boolean).join('+');
    const k = (a: Action) => keyLabel(input.keys[a][0] ?? '');
    const keys = [`${k('drone')} drone`, this.room.loopsOk ? `${k('loop')} loop` : '', `${k('erase')} erase`, `${k('retry')} retry`].filter(Boolean).join('   ');
    this.hud.setRoom(Number(json.id.slice(1)), json.name, STR.par(parTxt, this.s.cap), keys);
    this.debugText = this.add.text(4, 4, '', { fontFamily: MONO, fontSize: '8px', color: CSS.ink, backgroundColor: '#F4EDE0CC', resolution: textRes() }).setDepth(50).setVisible(false);
    this.flow = new RoomFlow(this);
    this.flow.fx.attach(this, 8);
    this.prompt = new Prompt(this, 9);
    this.px = this.s.live.x;
    this.py = this.s.live.y;
    input.clear();
    this.flow.start();
    this.events.once('shutdown', () => { this.music.stop(); this.recorder.stop(); });
    if (theme === 'night') this.cameras.main.fadeIn(180, 20, 18, 37);
    else this.cameras.main.fadeIn(180, 244, 237, 224);
    if (!settings().reducedMotion) {
      const z = this.cameras.main.zoom;
      this.cameras.main.setZoom(z * 1.04);
      this.tweens.add({ targets: this.cameras.main, zoom: z, duration: 420, ease: 'Cubic.easeOut' });
    }
    const f1 = () => { this.debug = !this.debug; this.debugText.setVisible(this.debug); };
    this.input.keyboard?.on('keydown-F1', f1);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-F1', f1));
  }

  // One fixed sim step with interpolation bookkeeping.
  stepOnce(mask: number): void {
    const s = this.s;
    const takes = s.takes;
    const preT = s.phase === PH_COUNTIN ? 0 : s.t;
    this.px = s.live.x;
    this.py = s.live.y;
    this.flow.preVy = s.live.vy;
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
    this.frameMs = delta;
    if (!this.scripted) { this.flow.update(delta); this.music.update(this.s, this.ff, delta); }
    this.advance(delta);
    this.backdrop.update(delta, (this.pb ?? this.s).live.x / SUB, settings().reducedMotion);
    this.door.update(delta, settings().reducedMotion);
    setCursorMode(this.flow.blocking() ? 'menu' : 'play');
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
    this.objects.update(s, now);
    this.selves.update(s, running);
    this.live.im.setVisible(this.flow.liveVisible());
    if (this.flow.liveVisible()) {
      const lx = (this.px + (s.live.x - this.px) * a) / SUB;
      const ly = (this.py + (s.live.y - this.py) * a) / SUB;
      this.live.show(lx, ly, this.flow.pose(s), s.live.vy, s.live.ground);
      // pulled into the open door after a clear, until Playback takes over
      const pull = this.pb ? 0 : this.flow.pull();
      this.live.im.setAlpha(1 - pull);
      if (pull > 0) this.live.im.setPosition(lx + 9 + (this.door.cx - lx - 9) * pull, ly + 20 + (this.door.cy + 18 - ly - 20) * pull).setScale(this.live.im.scaleX * (1 - 0.7 * pull), this.live.im.scaleY * (1 - 0.7 * pull));
      this.dark?.setPosition(lx + 9, ly + 10);
    }
    this.flow.drawFx(g);
    this.prompt.show(this.pb ? null : this.flow.cue(s, this.frameMs), now, settings().reducedMotion);
    this.hud.draw(s, input.wipeProgress, this.ff, now);
    if (this.debug) this.drawDebug();
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
