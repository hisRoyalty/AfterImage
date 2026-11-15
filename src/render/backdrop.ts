import type Phaser from 'phaser';
import { tile, img, res } from './sprites.ts';

// Layer art is white-on-transparent (src/sprites/bg_*.png) and tinted here, so one set serves several chapters.
interface Theme { set: string; clouds: number; mid: number; near: number; mote: number; flip?: boolean }

export const THEMES: Record<string, Theme> = {
  meadow: { set: 'hills', clouds: 0xfbf8f1, mid: 0xe9e4cf, near: 0xdcd8bb, mote: 0xcfc9a6 },
  grove: { set: 'trees', clouds: 0xfaf8f2, mid: 0xe1e8d9, near: 0xd0dccb, mote: 0xb9cbb3 },
  spores: { set: 'mushrooms', clouds: 0xfcf7f1, mid: 0xf0ddd2, near: 0xe7cdbf, mote: 0xdcb9a8 },
  dunes: { set: 'desert', clouds: 0xfcf8ee, mid: 0xf0e0c3, near: 0xe7d2a8, mote: 0xd9c08e },
  dusk: { set: 'hills', clouds: 0xf8f5f6, mid: 0xe3dce8, near: 0xd5cce0, mote: 0xc3b6d2, flip: true },
};

const MOTES = 10;
const ROOM_H = 360;

// Far clouds, mid hills, near decor and a few drifting motes behind the terrain.
export class Backdrop {
  private layers: { t: Phaser.GameObjects.TileSprite; par: number; drift: number; r: number }[] = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private mx = new Float32Array(MOTES);
  private my = new Float32Array(MOTES);
  private mv = new Float32Array(MOTES);
  private clock = 0;

  constructor(scene: Phaser.Scene, theme: string, depth: number) {
    const th = THEMES[theme];
    if (!th) return;
    const add = (key: string, y: number, tint: number, alpha: number, par: number, drift: number, scale = 1) => {
      const t = tile(scene, key, 0, y, 640 / scale, 256, depth + this.layers.length * 0.1).setTint(tint).setAlpha(alpha);
      t.setScale(t.scaleX * scale, t.scaleY * scale);
      if (th.flip) t.setFlipX(true);
      this.layers.push({ t, par, drift, r: res(scene, key) });
    };
    add('bg_clouds', 4, th.clouds, 0.95, 0.03, 2.2, 1.4);
    add(`bg_${th.set}_mid`, ROOM_H - 256 + 12, th.mid, 1, 0.08, 0);
    add(`bg_${th.set}_near`, ROOM_H - 256 + 66, th.near, 1, 0.16, 0);
    for (let i = 0; i < MOTES; i++) {
      const m = img(scene, 'particle', 0, 0, depth + 0.5).setOrigin(0.5).setTint(th.mote).setAlpha(0.55);
      m.setScale((0.5 + (i % 3) * 0.2) / res(scene, 'particle'));
      this.mx[i] = (i * 197) % 640;
      this.my[i] = 30 + ((i * 113) % 300);
      this.mv[i] = 3 + (i % 4) * 1.6;
      this.motes.push(m);
    }
  }

  // focusX: the Live's x in game px. still: reduced motion.
  update(dt: number, focusX: number, still: boolean): void {
    if (!still) this.clock += dt / 1000;
    const off = still ? 0 : focusX - 320;
    for (const l of this.layers) l.t.tilePositionX = (off * l.par + this.clock * l.drift) * l.r;
    for (let i = 0; i < this.motes.length; i++) {
      const y = ROOM_H - ((ROOM_H - this.my[i] + this.clock * this.mv[i]) % ROOM_H);
      const x = (this.mx[i] + Math.sin(this.clock * 0.4 + i) * 12 - off * 0.12 + 640) % 640;
      this.motes[i].setPosition(x, y).setAlpha(0.55 * Math.min(1, y / 40, (ROOM_H - y) / 40));
    }
  }
}
