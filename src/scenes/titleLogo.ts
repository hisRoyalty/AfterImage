import type Phaser from 'phaser';
import { text } from './ui.ts';
import { STR } from '../meta/strings.ts';
import { CSS } from '../render/palette.ts';
import { sfx } from '../audio/sfx.ts';

// The logo is four takes of the same word: Drone slate, Loop purple and Live yellow
// printed out of register under the ink take, trailing it like past selves.
const LAYERS = [
  { color: CSS.drone, dx: -6, dy: 6, lag: 270, flutter: 9 },
  { color: CSS.loop, dx: -4, dy: 4, lag: 180, flutter: 6 },
  { color: CSS.live, dx: -2, dy: 2, lag: 90, flutter: 3 },
  { color: CSS.ink, dx: 0, dy: 0, lag: 0, flutter: 0 },
];
const STAGGER = 250;
const DROP_MS = 220;
const BOB_MS = 2000;
const FLUTTER_EVERY = 4000;
const FLUTTER_MS = 120;

let introPlayed = false; // the intro runs once per page load

const backOut = (t: number) => { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

export class TitleLogo {
  texts: Phaser.GameObjects.Text[];
  sub: Phaser.GameObjects.Text;
  private x: number;
  private y: number;
  private t = 0;
  private intro: boolean;
  private sounded = 0;
  private still: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, subY: number, still: boolean) {
    this.x = x;
    this.y = y;
    this.still = still;
    this.texts = LAYERS.map((l, i) => text(scene, x + l.dx, y + l.dy, STR.title, 44, l.color, true).setOrigin(0.5).setDepth(5.1 + i * 0.1));
    this.sub = text(scene, x, subY, STR.subtitle, 12, CSS.inkSoft).setOrigin(0.5).setDepth(5.5);
    this.intro = !introPlayed && !still;
    introPlayed = true;
    this.update(0);
  }

  get playing(): boolean {
    return this.intro;
  }

  // Any key or click during the intro jumps to the end; the menu stays live meanwhile.
  finishIntro(): void {
    if (!this.intro) return;
    this.intro = false;
    this.update(0);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    if (this.intro && t > LAYERS.length * STAGGER + 800) this.intro = false;
    LAYERS.forEach((l, i) => {
      const tx = this.texts[i];
      let x = this.x + l.dx;
      let y = this.y + l.dy;
      let a = 1;
      if (this.intro) {
        const k = Math.max(0, Math.min(1, (t - i * STAGGER) / DROP_MS));
        a = Math.min(1, Math.max(0, (t - i * STAGGER) / 80));
        y -= 10 * (1 - backOut(k));
        if (k > 0 && this.sounded <= i) { this.sounded = i + 1; if (i < LAYERS.length - 1) sfx('tick'); else sfx('note', 62); }
      } else if (!this.still) {
        y += 2 * Math.sin((2 * Math.PI * (t - l.lag)) / BOB_MS);
        if (t % FLUTTER_EVERY < FLUTTER_MS) x += l.flutter;
      }
      tx.setPosition(x, y).setAlpha(a);
    });
    this.sub.setAlpha(this.intro ? Math.max(0, Math.min(1, (t - 1000) / 300)) : 1);
  }

  destroy(): void {
    this.texts.forEach((t) => t.destroy());
    this.sub.destroy();
  }
}
