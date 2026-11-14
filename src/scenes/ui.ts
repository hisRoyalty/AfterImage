import Phaser from 'phaser';
import { CSS, FONT, PAL } from '../render/palette.ts';
import { nine, resizeNine } from '../render/sprites.ts';

export interface Item {
  label: () => string;
  act?: () => void;
  left?: () => void;
  right?: () => void;
}

export const UP = ['ArrowUp', 'KeyW'];
export const DOWN = ['ArrowDown', 'KeyS'];
export const LEFT = ['ArrowLeft', 'KeyA'];
export const RIGHT = ['ArrowRight', 'KeyD'];
export const OK = ['Enter', 'Space'];
export const BACK = ['Escape', 'Backspace'];

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 12, color: string = CSS.ink, bold = false): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', resolution: 3 });
}

// Vertical keyboard menu. update() returns 'back' when Escape is pressed.
export class Menu {
  items: Item[];
  texts: Phaser.GameObjects.Text[] = [];
  cursor = 0;
  bar: Phaser.GameObjects.NineSlice;
  scene: Phaser.Scene;
  x: number;
  y: number;
  gap: number;
  onMove: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, items: Item[], gap = 20, size = 13, depth = 60) {
    this.items = items;
    this.x = x;
    this.y = y;
    this.gap = gap;
    this.scene = scene;
    this.bar = nine(scene, 'button', 0, 0, 24, 16, depth);
    items.forEach((it, i) => this.texts.push(text(scene, x, y + i * gap, it.label(), size).setOrigin(0.5, 0.5).setDepth(depth + 1)));
    this.refresh();
  }

  refresh(): void {
    this.items.forEach((it, i) => this.texts[i].setText(it.label()).setColor(i === this.cursor ? CSS.ink : CSS.inkSoft));
    const t = this.texts[this.cursor];
    this.bar.setVisible(!!t);
    if (!t) return;
    resizeNine(this.bar, this.scene, 'button', t.width + 20, 16);
    this.bar.setPosition(this.x - t.width / 2 - 10, t.y - 8);
  }

  update(codes: string[]): 'back' | null {
    for (const c of codes) {
      const it = this.items[this.cursor];
      if (UP.includes(c)) this.cursor = (this.cursor + this.items.length - 1) % this.items.length;
      else if (DOWN.includes(c)) this.cursor = (this.cursor + 1) % this.items.length;
      else if (LEFT.includes(c)) it.left?.();
      else if (RIGHT.includes(c)) it.right?.();
      else if (OK.includes(c)) it.act?.();
      else if (BACK.includes(c)) return 'back';
      else continue;
      this.onMove?.();
      if (!this.texts.length) return null;
      this.refresh();
    }
    return null;
  }

  destroy(): void {
    this.texts.forEach((t) => t.destroy());
    this.bar.destroy();
    this.texts = [];
  }
}

// Dims the screen and puts a paper panel in the middle. Returns both so callers can destroy them together.
export function panel(scene: Phaser.Scene, w: number, h: number, depth = 55): Phaser.GameObjects.Container {
  const dim = scene.add.graphics();
  dim.fillStyle(PAL.ink, 0.35);
  dim.fillRect(0, 0, 640, 420);
  const p = nine(scene, 'panel', 320 - w / 2, 210 - h / 2, w, h);
  return scene.add.container(0, 0, [dim, p]).setDepth(depth);
}
