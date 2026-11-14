import Phaser from 'phaser';
import { loadRoom } from '../sim/room.ts';
import { newSession, step, PH_CLEAR, PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { TUNING, assistTuning, SUB } from '../sim/constants.ts';
import { hashSession } from '../sim/hash.ts';
import type { Room } from '../sim/types.ts';
import { ROOMS } from '../rooms/index.ts';
import { drawPaper, drawTerrain } from '../render/terrain.ts';
import { drawObjects, drawDrone, drawLoop, drawLoopPath, drawLive, loopPos } from '../render/actors.ts';
import { Hud, VIEW_W, VIEW_H } from '../render/hud.ts';
import { MONO, CSS } from '../render/palette.ts';
import { input, settings } from '../meta/game.ts';
import { STR } from '../meta/strings.ts';
import { RoomFlow } from './roomFlow.ts';

const STEP_MS = 1000 / 60;

export class RoomScene extends Phaser.Scene {
  index = 0;
  room!: Room;
  s!: Session;
  gStatic!: Phaser.GameObjects.Graphics;
  gDyn!: Phaser.GameObjects.Graphics;
  hud!: Hud;
  flow!: RoomFlow;
  debugText!: Phaser.GameObjects.Text;
  debug = false;
  acc = 0;
  ff = false;
  px = 0;
  py = 0;
  scripted: number[] | null = null;
  ticks = 0;
  frames = 0;
  fpsT = 0;
  fps = 60;

  constructor() {
    super('room');
  }

  init(data: { index?: number }): void {
    this.index = data.index ?? 0;
  }

  create(): void {
    this.cameras.main.setZoom(2).centerOn(VIEW_W / 2, VIEW_H / 2);
    const json = ROOMS[this.index];
    this.room = loadRoom(json);
    const st = settings();
    const tun = st.assistTiming ? assistTuning(TUNING) : TUNING;
    this.s = newSession(this.room, tun, st.assistTrack ? 1 : 0);
    this.gStatic = this.add.graphics();
    drawPaper(this.gStatic, VIEW_W, VIEW_H);
    drawTerrain(this.gStatic, this.room);
    this.gDyn = this.add.graphics().setDepth(5);
    this.hud = new Hud(this);
    const p = json.par.drones + json.par.loops;
    const parTxt = p === 0 ? STR.parNone : [json.par.drones && `${json.par.drones}D`, json.par.loops && `${json.par.loops}L`].filter(Boolean).join('+');
    this.hud.setRoom(Number(json.id.slice(1)), json.name, STR.par(parTxt, this.s.cap), this.room.loopsOk ? STR.keysAll : STR.keysCh1);
    this.debugText = this.add.text(4, 4, '', { fontFamily: MONO, fontSize: '8px', color: CSS.ink, backgroundColor: '#F4EDE0CC', resolution: 3 }).setDepth(50).setVisible(false);
    this.flow = new RoomFlow(this);
    this.px = this.s.live.x;
    this.py = this.s.live.y;
    input.clear();
    this.input.keyboard?.on('keydown-F1', () => { this.debug = !this.debug; this.debugText.setVisible(this.debug); });
  }

  // One fixed sim step with interpolation bookkeeping.
  stepOnce(mask: number): void {
    const s = this.s;
    const takes = s.takes;
    this.px = s.live.x;
    this.py = s.live.y;
    step(s, mask);
    this.ticks++;
    if (s.takes !== takes || s.phase === PH_COUNTIN) { this.px = s.live.x; this.py = s.live.y; }
    this.flow.onEvents(s.ev);
  }

  // Runs as many fixed steps as the elapsed time allows. Shared by play and the e2e pacing test.
  advance(deltaMs: number): void {
    const speed = settings().assistSpeed / 100;
    this.acc += Math.min(deltaMs, 250) * speed;
    let n = 0;
    while (this.acc >= STEP_MS && n < 5) {
      this.acc -= STEP_MS;
      n++;
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
      for (let r = 0; r < reps && this.s.phase !== PH_CLEAR; r++) this.stepOnce(input.simMask(this.ff));
    }
    if (n === 5) this.acc = Math.min(this.acc, STEP_MS);
  }

  update(time: number, delta: number): void {
    if (!this.scripted) this.flow.update(delta);
    this.advance(delta);
    this.frames++;
    if (time - this.fpsT > 500) { this.fps = (this.frames * 1000) / (time - this.fpsT); this.frames = 0; this.fpsT = time; }
    this.render(time);
  }

  render(now: number): void {
    const s = this.s;
    const g = this.gDyn;
    const a = Math.max(0, Math.min(1, this.acc / STEP_MS));
    const running = s.phase !== PH_COUNTIN;
    g.clear();
    drawObjects(g, s, now);
    s.tracks.forEach((tr, i) => {
      if (tr.kind === 1) drawLoopPath(g, tr);
      else drawDrone(g, tr.x / SUB, tr.y / SUB, i + 1);
    });
    s.tracks.forEach((tr, i) => {
      if (tr.kind !== 1) return;
      const [x, y] = loopPos(tr, s.t, running);
      drawLoop(g, x, y, i + 1);
    });
    if (this.flow.liveVisible()) {
      const lx = (this.px + (s.live.x - this.px) * a) / SUB;
      const ly = (this.py + (s.live.y - this.py) * a) / SUB;
      drawLive(g, lx, ly, this.flow.pose(s));
    }
    this.flow.drawFx(g, now);
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
