import Phaser from 'phaser';
import { ROOMS } from '../rooms/index.ts';
import { loadRoom } from '../sim/room.ts';
import { replay } from '../sim/replay.ts';
import { step, PH_RUN } from '../sim/step.ts';
import { decode } from '../sim/rle.ts';
import { SUB } from '../sim/constants.ts';
import type { Room, TakeLog, Self } from '../sim/types.ts';
import { load, room as roomSave, save } from '../meta/save.ts';
import { input } from '../meta/game.ts';
import { STR } from '../meta/strings.ts';
import { LINES } from '../narrator/lines.ts';
import { drawPaper, drawTerrain } from '../render/terrain.ts';
import { drawDrone, drawLoop, drawLive, dashedRect, loopPos } from '../render/actors.ts';
import { PAL, CSS } from '../render/palette.ts';
import { text } from './ui.ts';
import { bakeImage } from '../render/bake.ts';
import { sfx } from '../audio/sfx.ts';
import { voice, midiHz } from '../audio/engine.ts';

const PER_ROOM = 1300;
const INTRO = 3600;

interface Reel { room: Room; live: number[]; ghosts: number[][]; tracks: Self[]; len: number }

// Positions (px pairs) of the Live through one take, after replaying the given tracks.
function trace(room: Room, prior: TakeLog[], masks: number[]): { pts: number[]; tracks: Self[] } {
  const s = replay(room, prior).session;
  const pts: number[] = [];
  for (const m of masks) {
    step(s, m);
    pts.push(s.live.x / SUB, s.live.y / SUB);
    if (s.phase !== PH_RUN) break;
  }
  return { pts, tracks: s.tracks.slice() };
}

export class MixdownScene extends Phaser.Scene {
  t = 0;
  idx = -1;
  reel: Reel | null = null;
  gStatic: Phaser.GameObjects.RenderTexture | null = null;
  gDyn!: Phaser.GameObjects.Graphics;
  title!: Phaser.GameObjects.Text;
  line!: Phaser.GameObjects.Text;
  done = false;

  constructor() {
    super('mixdown');
  }

  create(): void {
    this.cameras.main.setZoom(2).centerOn(320, 210);
    this.t = 0;
    this.last = 0;
    this.idx = -1;
    this.done = false;
    this.gStatic = bakeImage(this, 640, 420, (g) => drawPaper(g, 640, 420));
    this.gDyn = this.add.graphics().setDepth(5);
    this.title = text(this, 320, 378, '', 12, CSS.ink, true).setOrigin(0.5).setDepth(10);
    this.line = text(this, 320, 402, `${STR.booth}: ${LINES.final[0][0]}`, 12, CSS.ink).setOrigin(0.5).setDepth(10).setFontStyle('italic');
    sfx('talk');
    input.clear();
  }

  private build(i: number): Reel {
    const json = ROOMS[i];
    const room = loadRoom(json);
    const r = roomSave(json.id);
    const sol: TakeLog[] = r.sol ? JSON.parse(r.sol) : [];
    if (!sol.length) return { room, live: [], ghosts: [], tracks: [], len: 1 };
    const prior = sol.slice(0, -1);
    const main = trace(room, prior, decode(sol[sol.length - 1].i));
    const ghosts = r.ghosts.map((g) => {
      const { i: rle, k } = JSON.parse(g) as { i: number[]; k: number };
      return trace(room, sol.slice(0, k), decode(rle)).pts;
    });
    return { room, live: main.pts, ghosts, tracks: main.tracks, len: Math.max(2, main.pts.length / 2) };
  }

  private enterRoom(i: number): void {
    this.idx = i;
    this.reel = this.build(i);
    const room = this.reel.room;
    this.gStatic?.destroy();
    this.gStatic = bakeImage(this, 640, 420, (g) => { drawPaper(g, 640, 420); drawTerrain(g, room); });
    this.title.setText(`${ROOMS[i].id.slice(1)}  ${ROOMS[i].name}`);
    const n = ROOMS[i].note;
    voice('music', { type: 'triangle', f: midiHz(n), dur: 1.25, vol: 0.13 });
    voice('music', { type: 'sine', f: midiHz(n - 12), dur: 1.25, vol: 0.06, attack: 0.08 });
    if (i % 2 === 0) voice('music', { type: 'sawtooth', f: midiHz(38 + (i % 6 === 0 ? 0 : 7)), dur: 2.6, vol: 0.02, attack: 0.4, filter: 700 });
  }

  private finish(): void {
    this.done = true;
    load().mixdown = true;
    save();
    this.gStatic?.destroy();
    this.gStatic = bakeImage(this, 640, 420, (g) => drawPaper(g, 640, 420));
    this.gDyn.clear();
    this.title.setText('');
    this.line.setText('');
    text(this, 320, 170, STR.title, 40, CSS.ink, true).setOrigin(0.5).setDepth(10);
    text(this, 320, 210, STR.endLine, 13, CSS.inkSoft).setOrigin(0.5).setDepth(10);
    text(this, 320, 380, STR.continue, 11, CSS.inkSoft).setOrigin(0.5).setDepth(10);
    sfx('medal');
  }

  private last = 0;

  update(): void {
    const now = performance.now();
    const delta = this.last ? now - this.last : 16.7;
    this.last = now;
    if (this.done) {
      if (input.pressed('confirm')) this.scene.start('menu');
      return;
    }
    this.t += Math.min(delta, 100);
    if (input.pressed('confirm')) return this.finish();
    if (this.t < INTRO) return;
    const i = Math.floor((this.t - INTRO) / PER_ROOM);
    if (i >= ROOMS.length) return this.finish();
    if (i !== this.idx) { this.enterRoom(i); this.line.setText(''); }
    const reel = this.reel as Reel;
    const p = ((this.t - INTRO) % PER_ROOM) / PER_ROOM;
    const g = this.gDyn;
    g.clear();
    const at = (pts: number[], f: number): [number, number] => {
      const n = pts.length / 2;
      const k = Math.min(n - 1, Math.floor(f * n)) * 2;
      return [pts[k], pts[k + 1]];
    };
    for (const gh of reel.ghosts) {
      if (gh.length < 2) continue;
      const [x, y] = at(gh, p);
      g.lineStyle(1, PAL.ink, 0.35);
      dashedRect(g, x, y, 18, 20, 2, 2);
    }
    const frame = Math.floor(p * reel.len);
    reel.tracks.forEach((tr, k) => {
      if (tr.kind === 0) drawDrone(g, tr.x / SUB, tr.y / SUB, k + 1);
      else { const [x, y] = loopPos(tr, frame, true); drawLoop(g, x, y, k + 1); }
    });
    if (reel.live.length >= 2) {
      const [x, y] = at(reel.live, p);
      drawLive(g, x, y, { sx: 1, sy: 1, face: 1, blink: false });
    }
  }
}
