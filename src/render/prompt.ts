import type Phaser from 'phaser';
import { nine, resizeNine, res } from './sprites.ts';
import { CSS, FONT, PAL } from './palette.ts';
import { input } from '../meta/game.ts';
import { keyLabel } from '../meta/input.ts';
import type { Action } from '../meta/input.ts';
import { textRes } from '../meta/screen.ts';

const ICON = 14;

// Texture key for a key or mouse icon (src/sprites/keys/<code>.png), or '' if there is none.
export function keyIcon(scene: Phaser.Scene, code: string): string {
  const k = `key_${code}`;
  return scene.textures.exists(k) ? k : '';
}

// A small bubble: key icons, then a word or two. Remapped keys without an icon fall back to their name.
export class Prompt {
  private scene: Phaser.Scene;
  private plate: Phaser.GameObjects.NineSlice;
  private icons: Phaser.GameObjects.Image[];
  private label: Phaser.GameObjects.Text;
  private sig = '';
  private w = 0;
  private n = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    this.plate = nine(scene, 'keycap', 0, 0, 16, 18, depth).setVisible(false);
    this.icons = [0, 1].map(() => scene.add.image(0, 0, 'particle').setDepth(depth + 0.1).setTint(PAL.ink).setVisible(false));
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '9px', color: CSS.ink, resolution: textRes() }).setOrigin(0, 0.5).setDepth(depth + 0.1).setVisible(false);
  }

  private build(actions: Action[], label: string): void {
    const names: string[] = [];
    this.n = 0;
    for (const a of actions.slice(0, 2)) {
      const code = input.keys[a][0] ?? '';
      const tex = keyIcon(this.scene, code);
      if (tex) this.icons[this.n++].setTexture(tex).setScale(ICON / 16 / res(this.scene, tex));
      else names.push(keyLabel(code));
    }
    this.label.setText([names.join(' / '), label].filter(Boolean).join('  '));
    this.w = 5 + this.n * (ICON + 1) + (this.n ? 3 : 0) + this.label.width + 6;
    resizeNine(this.plate, this.scene, 'keycap', this.w, 18);
  }

  // x, y: where the bubble's bottom centre should sit, in game px.
  show(cue: { actions: Action[]; label: string; x: number; y: number } | null, now: number, still: boolean): void {
    const on = !!cue;
    this.plate.setVisible(on);
    this.label.setVisible(on);
    if (!cue) { this.icons.forEach((i) => i.setVisible(false)); this.sig = ''; return; }
    const sig = cue.actions.map((a) => input.keys[a][0]).join(',') + cue.label;
    if (sig !== this.sig) { this.sig = sig; this.build(cue.actions, cue.label); }
    const bob = still ? 0 : Math.sin(now / 240) * 1.5;
    const x = Math.max(4, Math.min(636 - this.w, cue.x - this.w / 2));
    const y = Math.max(4, cue.y - 9 + bob);
    this.plate.setPosition(x, y);
    this.icons.forEach((im, i) => im.setVisible(i < this.n).setPosition(x + 5 + ICON / 2 + i * (ICON + 1), y + 9));
    this.label.setPosition(x + 5 + this.n * (ICON + 1) + (this.n ? 3 : 0), y + 9);
  }
}
