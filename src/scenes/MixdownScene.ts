import Phaser from 'phaser';
import { MAIN as ROOMS } from '../rooms/index.ts';
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
import { bakeRoom } from '../render/terrain.ts';
import { SelfSprite, LiveSprite, loopPos } from '../render/actorLayer.ts';
import { img } from '../render/sprites.ts';
import { CSS } from '../render/palette.ts';
import { text } from './ui.ts';
import { sfx } from '../audio/sfx.ts';
import { fitCamera } from '../meta/screen.ts';
import { useCursor } from '../meta/pointer.ts';
import { voice, midiHz, getAudio } from '../audio/engine.ts';

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
  gStatic: Phaser.GameObjects.GameObject | null = null;
  ghosts: Phaser.GameObjects.Image[] = [];
  selves: SelfSprite[] = [];
  live!: LiveSprite;
  title!: Phaser.GameObjects.Text;
  line!: Phaser.GameObjects.Text;
  done = false;
  clicked = false;

  constructor() {
    super('mixdown');
  }

  create(): void {
    fitCamera(this);
    useCursor(this, 'menu');
    this.input.on('pointerdown', () => { this.clicked = true; });
    this.t = 0;
    this.last = 0;
    this.idx = -1;
    this.done = false;
    img(this, 'paper', 0, 0, -5);
    this.gStatic = null;
    this.ghosts = Array.from({ length: 12 }, () => img(this, 'ghost', 0, 0, 4).setAlpha(0.35).setVisible(false));
    this.selves = [0, 1, 2, 3].map(() => new SelfSprite(this, 5));
    this.live = new LiveSprite(this, 6);
    this.live.im.setVisible(false);
    this.title = text(this, 320, 378, '', 12, CSS.ink, true).setOrigin(0.5).setDepth(10);
    this.line = text(this, 320, 402, `${STR.booth}: ${LINES.final[0][0]}`, 12, CSS.ink).setOrigin(0.5).setDepth(10).setFontStyle('italic');
    sfx('talk');
    input.clear();
    this.duck(0.25);
    this.events.once('shutdown', () => this.duck(1));
  }

  // The soundtrack steps back so the 30 room notes can be heard as one melody.
  private duck(v: number): void {
    const a = getAudio();
    if (a) a.musicDuck.gain.setTargetAtTime(v, a.ctx.currentTime, 0.3);
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
    this.gStatic = bakeRoom(this, room, true);
    this.title.setText(`${ROOMS[i].id.slice(1)}  ${ROOMS[i].name}`);
    const n = ROOMS[i].note;
    voice('sfx', { type: 'triangle', f: midiHz(n), dur: 1.25, vol: 0.13 });
    voice('sfx', { type: 'sine', f: midiHz(n - 12), dur: 1.25, vol: 0.06, attack: 0.08 });
    if (i % 2 === 0) voice('sfx', { type: 'sawtooth', f: midiHz(38 + (i % 6 === 0 ? 0 : 7)), dur: 2.6, vol: 0.02, attack: 0.4, filter: 700 });
  }

  private finish(): void {
    this.done = true;
    this.duck(1);
    load().mixdown = true;
    save();
    this.gStatic?.destroy();
    this.gStatic = null;
    this.ghosts.forEach((g) => g.setVisible(false));
    this.selves.forEach((sp) => sp.show(undefined, 1, 0, 0));
    this.live.im.setVisible(false);
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
    const click = this.clicked;
    this.clicked = false;
    if (this.done) {
      if (input.pressed('confirm') || click) this.scene.start('menu');
      return;
    }
    this.t += Math.min(delta, 100);
    // a short guard so an Enter meant for the clear banner cannot skip the reel
    if ((input.pressed('confirm') || click) && this.t > 900) return this.finish();
    if (this.t < INTRO) return;
    const i = Math.floor((this.t - INTRO) / PER_ROOM);
    if (i >= ROOMS.length) return this.finish();
    if (i !== this.idx) { this.enterRoom(i); this.line.setText(''); }
    const reel = this.reel as Reel;
    const p = ((this.t - INTRO) % PER_ROOM) / PER_ROOM;
    const at = (pts: number[], f: number): [number, number] => {
      const n = pts.length / 2;
      const k = Math.min(n - 1, Math.floor(f * n)) * 2;
      return [pts[k], pts[k + 1]];
    };
    this.ghosts.forEach((im, k) => {
      const gh = reel.ghosts[k];
      im.setVisible(!!gh && gh.length >= 2);
      if (gh && gh.length >= 2) { const [x, y] = at(gh, p); im.setPosition(x, y); }
    });
    const frame = Math.floor(p * reel.len);
    this.selves.forEach((sp, k) => {
      const tr = reel.tracks[k];
      if (!tr) return sp.show(undefined, k + 1, 0, 0);
      if (tr.kind === 0) sp.show(tr, k + 1, tr.x / SUB, tr.y / SUB);
      else { const [x, y] = loopPos(tr, frame, true); sp.show(tr, k + 1, x, y); }
    });
    this.live.im.setVisible(reel.live.length >= 2);
    if (reel.live.length >= 2) {
      const [x, y] = at(reel.live, p);
      this.live.show(x, y, { sx: 1, sy: 1, face: 1, blink: false });
    }
  }
}
