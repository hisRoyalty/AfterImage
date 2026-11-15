import type Phaser from 'phaser';
import { loadRoom } from '../sim/room.ts';
import { newSession, step, PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { decode } from '../sim/rle.ts';
import { SUB } from '../sim/constants.ts';
import * as E from '../sim/events.ts';
import { drawGround } from '../render/terrain.ts';
import { SelfLayer, LiveSprite } from '../render/actorLayer.ts';
import { img, res } from '../render/sprites.ts';
import { PAL } from '../render/palette.ts';
import { ATTRACT_ROOM, ATTRACT_SCRIPT } from './attractClip.ts';

const STEP_MS = 1000 / 60;
const ECHOES = [{ lag: 10, a: 0.26 }, { lag: 20, a: 0.16 }, { lag: 30, a: 0.08 }];
const RING = 32;
const SELF_ALPHA = 0.72;
const STILL_AT = 380; // reduced motion: one fixed frame of the clip

// Attract mode: the scripted clip runs through the real sim on a floor strip under the menu.
// The Live leaves translucent echoes of where it just was; its Drone and Loop stay on the reel.
export class TitleAttract {
  private s: Session;
  private masks: number[];
  private i = 0;
  private acc = 0;
  private g: Phaser.GameObjects.Graphics;
  private selves: SelfLayer;
  private live: LiveSprite;
  private echoes: LiveSprite[];
  private dust: Dust | null = null;
  private rx = new Float32Array(RING);
  private ry = new Float32Array(RING);
  private rvy = new Float32Array(RING);
  private rg = new Uint8Array(RING);
  private rf = new Int8Array(RING);
  private head = 0;
  private filled = 0;
  private px = 0;
  private py = 0;
  private still: boolean;

  constructor(scene: Phaser.Scene, depth: number, still: boolean) {
    const room = loadRoom(ATTRACT_ROOM);
    this.s = newSession(room);
    this.masks = decode(ATTRACT_SCRIPT);
    this.still = still;
    this.g = scene.add.graphics().setDepth(depth);
    drawGround(this.g, room);
    this.selves = new SelfLayer(scene, depth + 1);
    this.echoes = ECHOES.map((e) => { const l = new LiveSprite(scene, depth + 1.5); l.im.setAlpha(e.a).setVisible(false); return l; });
    this.live = new LiveSprite(scene, depth + 2);
    if (!still) this.dust = new Dust(scene, depth + 2.5);
    this.px = this.s.live.x;
    this.py = this.s.live.y;
    if (still) for (let k = 0; k < STILL_AT; k++) this.tick();
    this.draw();
  }

  get focusX(): number {
    return this.s.live.x / SUB + 9;
  }

  private tick(): void {
    const s = this.s;
    this.px = s.live.x;
    this.py = s.live.y;
    step(s, this.masks[this.i]);
    this.i = (this.i + 1) % this.masks.length;
    if (s.phase === PH_COUNTIN) { this.px = s.live.x; this.py = s.live.y; this.filled = 0; }
    else {
      const h = this.head = (this.head + 1) % RING;
      this.rx[h] = s.live.x; this.ry[h] = s.live.y; this.rvy[h] = s.live.vy; this.rg[h] = s.live.ground ? 1 : 0; this.rf[h] = s.live.face;
      this.filled = Math.min(RING, this.filled + 1);
    }
    if (this.still) return;
    const lx = s.live.x / SUB + 9, ly = s.live.y / SUB + 20;
    for (const e of s.ev) {
      const c = E.evCode(e);
      if (c === E.EV_LAND || c === E.EV_JUMP) this.dust?.emit(lx, ly, 3, PAL.paperDetail, { speed: 25, life: 0.3, grav: 40 });
      else if (c === E.EV_BOUNCE) this.dust?.emit(lx, ly, 6, PAL.bounce, { speed: 60, life: 0.35 });
      else if (c === E.EV_DRONE || c === E.EV_LOOP) this.dust?.emit(lx, ly - 10, 8, c === E.EV_DRONE ? PAL.drone : PAL.loop, { speed: 45, life: 0.45 });
    }
  }

  update(dt: number): void {
    if (this.still) return;
    this.acc += Math.min(dt, 250);
    let n = 0;
    while (this.acc >= STEP_MS && n++ < 4) { this.acc -= STEP_MS; this.tick(); }
    if (n >= 4) this.acc = Math.min(this.acc, STEP_MS);
    this.dust?.update(dt);
    this.draw();
  }

  private draw(): void {
    const s = this.s;
    const a = this.still ? 1 : Math.max(0, Math.min(1, this.acc / STEP_MS));
    this.selves.update(s, s.phase !== PH_COUNTIN);
    for (const sp of this.selves.sprites) { sp.body.setAlpha(SELF_ALPHA); sp.num.setAlpha(SELF_ALPHA); }
    const x = (this.px + (s.live.x - this.px) * a) / SUB, y = (this.py + (s.live.y - this.py) * a) / SUB;
    this.live.show(x, y, { sx: 1, sy: 1, face: s.live.face, blink: s.phase === PH_COUNTIN }, s.live.vy, s.live.ground);
    ECHOES.forEach((e, k) => {
      const sp = this.echoes[k];
      const on = !this.still && this.filled > e.lag;
      sp.im.setVisible(on);
      if (!on) return;
      const h = (this.head - e.lag + RING) % RING;
      sp.show(this.rx[h] / SUB, this.ry[h] / SUB, { sx: 1, sy: 1, face: this.rf[h], blink: false }, this.rvy[h], this.rg[h] === 1);
    });
  }

  destroy(): void {
    this.g.destroy();
    this.selves.sprites.forEach((sp) => { sp.body.destroy(); sp.num.destroy(); });
    this.selves.paths?.destroy();
    this.echoes.forEach((e) => e.im.destroy());
    this.live.im.destroy();
    this.dust?.destroy();
  }
}

// A small fixed pool of dust motes for landings, bounces and prints. Positions are seeded, not random.
const DUST = 24;
class Dust {
  private ims: Phaser.GameObjects.Image[];
  private x = new Float32Array(DUST);
  private y = new Float32Array(DUST);
  private vx = new Float32Array(DUST);
  private vy = new Float32Array(DUST);
  private life = new Float32Array(DUST);
  private span = new Float32Array(DUST);
  private grav = new Float32Array(DUST);
  private next = 0;
  private seed = 7;
  private base: number;

  constructor(scene: Phaser.Scene, depth: number) {
    this.base = 1 / res(scene, 'particle');
    this.ims = Array.from({ length: DUST }, () => img(scene, 'particle', 0, 0, depth).setOrigin(0.5).setVisible(false));
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return (this.seed >>> 8) / 16777216;
  }

  emit(x: number, y: number, n: number, color: number, o: { speed: number; life: number; grav?: number }): void {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % DUST;
      const ang = -Math.PI / 2 + (this.rnd() - 0.5) * Math.PI * 1.6;
      const sp = o.speed * (0.4 + this.rnd() * 0.6);
      this.x[i] = x; this.y[i] = y;
      this.vx[i] = Math.cos(ang) * sp; this.vy[i] = Math.sin(ang) * sp;
      this.span[i] = this.life[i] = o.life * (0.6 + this.rnd() * 0.4);
      this.grav[i] = o.grav ?? 160;
      this.ims[i].setTint(color);
    }
  }

  update(dt: number): void {
    const s = dt / 1000;
    for (let i = 0; i < DUST; i++) {
      const im = this.ims[i];
      if (this.life[i] <= 0) { if (im.visible) im.setVisible(false); continue; }
      this.life[i] -= s;
      this.vy[i] += this.grav[i] * s;
      this.x[i] += this.vx[i] * s;
      this.y[i] += this.vy[i] * s;
      const a = Math.max(0, this.life[i] / this.span[i]);
      im.setVisible(true).setPosition(this.x[i], this.y[i]).setAlpha(a).setScale((0.3 + 0.25 * a) * this.base);
    }
  }

  destroy(): void {
    this.ims.forEach((im) => im.destroy());
  }
}
