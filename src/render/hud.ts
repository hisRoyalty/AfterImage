import Phaser from 'phaser';
import { BEAT, TAKE_MAX } from '../sim/constants.ts';
import { PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { PAL, CSS, FONT } from './palette.ts';
import { bakeImage, actorImage, RES } from './bake.ts';
import { STR } from '../meta/strings.ts';

export const VIEW_W = 640;
export const VIEW_H = 420;
export const HUD_Y = 360;

export class Hud {
  g: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  par: Phaser.GameObjects.Text;
  keys: Phaser.GameObjects.Text;
  booth: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  icons: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene) {
    bakeImage(scene, VIEW_W, VIEW_H - HUD_Y, (g) => { g.fillStyle(PAL.paper, 1); g.fillRect(0, 0, VIEW_W, VIEW_H - HUD_Y); g.fillStyle(PAL.ink, 1); g.fillRect(0, 0, VIEW_W, 2); }, 19).setPosition(0, HUD_Y);
    this.g = scene.add.graphics().setDepth(20);
    this.icons = [0, 1, 2, 3].map((i) => actorImage(scene, 'drone_1', 21).setPosition(199 + i * 30, HUD_Y + 8).setScale(1 / RES));
    const style = { fontFamily: FONT, fontSize: '11px', color: CSS.ink, resolution: 3 };
    this.title = scene.add.text(10, HUD_Y + 7, '', { ...style, fontSize: '13px', fontStyle: 'bold' }).setDepth(21);
    this.par = scene.add.text(10, HUD_Y + 34, '', { ...style, color: CSS.inkSoft }).setDepth(21);
    this.keys = scene.add.text(VIEW_W - 10, HUD_Y + 9, '', { ...style, color: CSS.inkSoft }).setOrigin(1, 0).setDepth(21);
    this.hint = scene.add.text(VIEW_W - 10, HUD_Y + 34, '', { ...style, color: CSS.wire, fontStyle: 'bold' }).setOrigin(1, 0).setDepth(21);
    this.booth = scene.add.text(400, HUD_Y + 41, '', { ...style, fontSize: '12px', fontStyle: 'italic' }).setOrigin(0.5, 0.5).setDepth(21);
  }

  setRoom(num: number, name: string, par: string, keys: string): void {
    this.title.setText(`${String(num).padStart(2, '0')}  ${name}`);
    this.par.setText(par);
    this.keys.setText(keys);
  }

  draw(s: Session, wipe: number, ff: boolean, now: number): void {
    const g = this.g;
    g.clear();
    // track lanes
    const x0 = 196;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * 30, y = HUD_Y + 6;
      const tr = s.tracks[i];
      if (i >= s.cap) {
        this.icons[i].setVisible(false);
        g.fillStyle(PAL.paperDetail, 1);
        g.fillRoundedRect(x, y, 24, 24, 4);
        continue;
      }
      g.lineStyle(1.5, PAL.ink, tr ? 0.9 : 0.35);
      g.strokeRoundedRect(x, y, 24, 24, 4);
      this.icons[i].setVisible(!!tr);
      if (tr) this.icons[i].setTexture(`${tr.kind === 0 ? 'drone' : 'loop'}_${i + 1}`);
    }
    // beat marker and take clock
    const bx = 334;
    const beat = s.phase === PH_COUNTIN ? -1 : Math.floor(s.t / BEAT) % 4;
    for (let b = 0; b < 4; b++) {
      const on = b === beat;
      g.fillStyle(on ? PAL.ink : PAL.paperDetail, 1);
      g.fillCircle(bx + b * 11, HUD_Y + 14, on ? 4 : 3);
    }
    if (s.phase === PH_COUNTIN) {
      const p = 0.5 + 0.5 * Math.sin(now / 160);
      g.fillStyle(PAL.ink, 0.25 + 0.5 * p);
      g.fillCircle(bx + 16, HUD_Y + 14, 2);
    }
    const frac = s.phase === PH_COUNTIN ? 0 : Math.min(1, s.t / TAKE_MAX);
    g.fillStyle(PAL.paperDetail, 1);
    g.fillRect(bx - 4, HUD_Y + 23, 52, 3);
    g.fillStyle(frac > 0.85 ? PAL.danger : PAL.ink, 1);
    g.fillRect(bx - 4, HUD_Y + 23, 52 * frac, 3);
    if (ff) {
      g.fillStyle(PAL.ink, 1);
      g.fillTriangle(bx + 52, HUD_Y + 9, bx + 58, HUD_Y + 14, bx + 52, HUD_Y + 19);
      g.fillTriangle(bx + 58, HUD_Y + 9, bx + 64, HUD_Y + 14, bx + 58, HUD_Y + 19);
    }
    if (wipe > 0) {
      g.lineStyle(3, PAL.danger, 1);
      g.beginPath();
      g.arc(x0 + 128, HUD_Y + 18, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wipe);
      g.strokePath();
    }
  }

  say(text: string, isHint = false): void {
    this.booth.setText(text ? (isHint ? text : `${STR.booth}: ${text}`) : '').setColor(isHint ? CSS.wire : CSS.ink);
  }

  setHint(t: string): void {
    if (this.hint.text !== t) this.hint.setText(t);
  }
}
