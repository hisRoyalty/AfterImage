import type Phaser from 'phaser';
import { text, UP, DOWN, OK } from './ui.ts';
import { CSS } from '../render/palette.ts';
import { nine, resizeNine } from '../render/sprites.ts';
import { clickable } from '../meta/pointer.ts';
import { sfx } from '../audio/sfx.ts';

export interface TitleItem { label: () => string; act: () => void }

const SLIDE_MS = 110;
const PRESS_MS = 90;
const BAR_H = 18;
const PAD = 12;

// The title's vertical menu: a yellow bar that slides to the focused item, hover focuses,
// press dips the bar and squeezes the label, items rise in one after another.
export class TitleMenu {
  private scene: Phaser.Scene;
  private items: TitleItem[];
  private texts: Phaser.GameObjects.Text[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private bar: Phaser.GameObjects.NineSlice;
  private cur = 0;
  private bx = 0;
  private by = 0;
  private bw = 0;
  private from = { x: 0, y: 0, w: 0 };
  private slideT = 1;
  private pressT = 0;
  private enterT: number;
  private x: number;
  private y: number;
  private gap: number;
  private still: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, gap: number, items: TitleItem[], still: boolean, depth = 10) {
    this.scene = scene;
    this.items = items;
    this.x = x;
    this.y = y;
    this.gap = gap;
    this.still = still;
    this.enterT = still ? 1e9 : 0;
    this.bar = nine(scene, 'button', 0, 0, 24, BAR_H, depth);
    items.forEach((it, i) => {
      this.texts.push(text(scene, x, y + i * gap, it.label(), 13).setOrigin(0.5).setDepth(depth + 1));
      const z = scene.add.zone(x, y + i * gap, 200, gap).setDepth(depth + 2);
      clickable(z, () => this.activate(i), (s) => {
        if (s === 'over' && this.cur !== i) this.focus(i);
        if (s === 'down') this.pressT = PRESS_MS;
      });
      this.zones.push(z);
    });
    this.place(true);
  }

  refresh(): void {
    this.items.forEach((it, i) => this.texts[i].setText(it.label()));
    this.place(true);
  }

  private focus(i: number): void {
    this.cur = i;
    sfx('ui');
    this.place(this.still);
  }

  private activate(i: number): void {
    this.cur = i;
    this.pressT = PRESS_MS;
    this.place(true);
    this.items[i].act();
  }

  // Target of the bar for the focused item; snap or slide there.
  private place(snap: boolean): void {
    const t = this.texts[this.cur];
    const w = t.width + PAD * 2;
    this.from = { x: this.bx, y: this.by, w: this.bw };
    this.bx = this.x - w / 2;
    this.by = this.y + this.cur * this.gap - BAR_H / 2;
    this.bw = w;
    this.slideT = snap || this.from.w === 0 ? 1 : 0;
    this.texts.forEach((tx, i) => tx.setColor(i === this.cur ? CSS.ink : CSS.inkSoft));
  }

  update(codes: string[], dt: number): void {
    for (const c of codes) {
      const n = this.items.length;
      if (UP.includes(c)) this.focus((this.cur + n - 1) % n);
      else if (DOWN.includes(c)) this.focus((this.cur + 1) % n);
      else if (OK.includes(c)) { this.activate(this.cur); return; }
    }
    this.enterT += dt;
    this.pressT = Math.max(0, this.pressT - dt);
    if (this.slideT < 1) this.slideT = Math.min(1, this.slideT + dt / SLIDE_MS);
    const e = 1 - Math.pow(1 - this.slideT, 3);
    const x = this.from.x + (this.bx - this.from.x) * e;
    const y = this.from.y + (this.by - this.from.y) * e;
    const w = this.from.w + (this.bw - this.from.w) * e;
    const pressed = this.pressT > 0;
    resizeNine(this.bar, this.scene, 'button', Math.round(w), BAR_H);
    this.bar.setPosition(x, y + (pressed ? 1 : 0)).setTint(pressed ? 0xd9b64a : 0xffffff);
    this.texts.forEach((tx, i) => {
      const k = Math.max(0, Math.min(1, (this.enterT - i * 35) / 140));
      const focus = i === this.cur;
      const s = focus ? (pressed ? 0.96 : 1.05) : 1;
      tx.setAlpha(k).setY(this.y + i * this.gap + 6 * (1 - k)).setScale(this.still ? 1 : s);
    });
    this.bar.setAlpha(Math.max(0, Math.min(1, this.enterT / 140)));
  }

  destroy(): void {
    this.texts.forEach((t) => t.destroy());
    this.zones.forEach((z) => z.destroy());
    this.bar.destroy();
  }
}
