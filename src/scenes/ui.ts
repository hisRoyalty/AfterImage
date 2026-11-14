import Phaser from 'phaser';
import { CSS, FONT, PAL } from '../render/palette.ts';

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
  g: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  gap: number;
  onMove: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, items: Item[], gap = 20, size = 13, depth = 60) {
    this.items = items;
    this.x = x;
    this.y = y;
    this.gap = gap;
    this.g = scene.add.graphics().setDepth(depth);
    items.forEach((it, i) => this.texts.push(text(scene, x, y + i * gap, it.label(), size).setOrigin(0.5, 0.5).setDepth(depth + 1)));
    this.refresh();
  }

  refresh(): void {
    this.items.forEach((it, i) => this.texts[i].setText(it.label()).setColor(i === this.cursor ? CSS.ink : CSS.inkSoft));
    this.g.clear();
    const t = this.texts[this.cursor];
    if (!t) return;
    this.g.fillStyle(PAL.live, 1);
    this.g.fillRoundedRect(this.x - t.width / 2 - 10, t.y - 8, t.width + 20, 16, 4);
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
    this.g.destroy();
    this.texts = [];
  }
}

export function panel(scene: Phaser.Scene, w: number, h: number, depth = 55): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(PAL.ink, 0.35);
  g.fillRect(0, 0, 640, 420);
  g.fillStyle(PAL.paper, 1);
  g.fillRoundedRect(320 - w / 2, 210 - h / 2, w, h, 8);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeRoundedRect(320 - w / 2, 210 - h / 2, w, h, 8);
  return g;
}
