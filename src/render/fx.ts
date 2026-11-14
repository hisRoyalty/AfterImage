import type Phaser from 'phaser';
import { res } from './sprites.ts';

const MAX = 192;

// Fixed pool: no allocation while playing.
export class Particles {
  x = new Float32Array(MAX);
  y = new Float32Array(MAX);
  vx = new Float32Array(MAX);
  vy = new Float32Array(MAX);
  life = new Float32Array(MAX);
  span = new Float32Array(MAX);
  size = new Float32Array(MAX);
  color = new Uint32Array(MAX);
  grav = new Float32Array(MAX);
  next = 0;
  private ims: Phaser.GameObjects.Image[] = [];
  private base = 1;

  attach(scene: Phaser.Scene, depth: number): void {
    this.base = 1 / res(scene, 'particle');
    this.ims = Array.from({ length: MAX }, () => scene.add.image(0, 0, 'particle').setDepth(depth).setVisible(false));
  }

  emit(x: number, y: number, n: number, color: number, o: { speed?: number; up?: number; life?: number; size?: number; grav?: number; spread?: number } = {}): void {
    const speed = o.speed ?? 60;
    const spread = o.spread ?? Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = Math.cos(ang) * sp;
      this.vy[i] = Math.sin(ang) * sp - (o.up ?? 0);
      this.span[i] = this.life[i] = (o.life ?? 0.5) * (0.6 + Math.random() * 0.4);
      this.size[i] = o.size ?? 2;
      this.color[i] = color;
      this.grav[i] = o.grav ?? 240;
    }
  }

  update(dt: number): void {
    const s = dt / 1000;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= s;
      this.vy[i] += this.grav[i] * s;
      this.x[i] += this.vx[i] * s;
      this.y[i] += this.vy[i] * s;
    }
  }

  draw(): void {
    for (let i = 0; i < this.ims.length; i++) {
      const im = this.ims[i];
      if (this.life[i] <= 0) { if (im.visible) im.setVisible(false); continue; }
      const a = this.life[i] / this.span[i];
      const sz = (this.size[i] * (0.5 + 0.5 * a)) / 4;
      im.setVisible(true).setPosition(this.x[i], this.y[i]).setAlpha(a).setTint(this.color[i]).setScale(sz * this.base);
    }
  }

  clear(): void {
    this.life.fill(0);
  }
}
