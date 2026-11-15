import type Phaser from 'phaser';
import { img, res } from './sprites.ts';
import { PAL } from './palette.ts';

const FRAME_MS = 70;

// The Out: a door that glows while idle and swings open when the Live reaches it.
export class Door {
  private im: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private scene: Phaser.Scene;
  private t = 0;
  private clock = 0;
  opened = false;
  cx: number;
  cy: number;

  // x, y: top-left of the 1 x 2 tile Out in game px.
  constructor(scene: Phaser.Scene, x: number, y: number, depth: number) {
    this.scene = scene;
    this.cx = x + 10;
    this.cy = y + 20;
    this.glow = img(scene, 'glow', this.cx, this.cy + 4, depth - 0.1).setOrigin(0.5).setTint(PAL.live);
    this.im = img(scene, 'door_0', x, y, depth);
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.t = 0;
  }

  update(dt: number, reduced: boolean): void {
    this.clock += dt;
    const base = 1 / res(this.scene, 'glow');
    if (!this.opened) {
      const p = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock / 420);
      this.glow.setAlpha(0.28 + 0.22 * p).setScale(base * (0.95 + 0.12 * p));
      return;
    }
    this.t += dt;
    const f = Math.min(3, 1 + Math.floor(this.t / FRAME_MS));
    const key = `door_${f}`;
    if (this.im.texture.key !== key) this.im.setTexture(key);
    const flare = Math.max(0, 1 - this.t / 500);
    this.glow.setAlpha(0.35 + 0.5 * flare).setScale(base * (1.05 + 0.5 * flare));
  }
}
