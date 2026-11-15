import Phaser from 'phaser';
import { BEAT, TAKE_MAX } from '../sim/constants.ts';
import { PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { PAL, CSS, FONT } from './palette.ts';
import { img } from './sprites.ts';
import { SelfSprite } from './actorLayer.ts';
import { STR } from '../meta/strings.ts';
import { textRes } from '../meta/screen.ts';

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
  slots: Phaser.GameObjects.Image[];
  icons: SelfSprite[];
  beats: Phaser.GameObjects.Image[];
  pulse: Phaser.GameObjects.Image;
  ff: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    img(scene, 'hud_bar', 0, HUD_Y, 19);
    this.g = scene.add.graphics().setDepth(20);
    this.slots = [0, 1, 2, 3].map((i) => img(scene, 'slot', 196 + i * 30, HUD_Y + 6, 20));
    this.icons = [0, 1, 2, 3].map(() => new SelfSprite(scene, 21));
    this.beats = [0, 1, 2, 3].map((b) => img(scene, 'beat_off', 339 + b * 11, HUD_Y + 14, 20).setOrigin(0.5));
    this.pulse = img(scene, 'beat_on', 339, HUD_Y + 14, 20.5).setOrigin(0.5);
    this.ff = img(scene, 'ff', 386, HUD_Y + 8, 20).setVisible(false);
    const style = { fontFamily: FONT, fontSize: '11px', color: CSS.ink, resolution: textRes() };
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
    for (let i = 0; i < 4; i++) {
      const tr = s.tracks[i];
      const key = i >= s.cap ? 'slot_locked' : tr ? 'slot_full' : 'slot';
      if (this.slots[i].texture.key !== key) this.slots[i].setTexture(key);
      this.icons[i].show(i < s.cap ? tr : undefined, i + 1, 199 + i * 30, HUD_Y + 8);
    }
    const beat = s.phase === PH_COUNTIN ? -1 : Math.floor(s.t / BEAT) % 4;
    this.beats.forEach((b, i) => {
      const key = i === beat ? 'beat_on' : 'beat_off';
      if (b.texture.key !== key) b.setTexture(key);
    });
    this.pulse.setVisible(s.phase === PH_COUNTIN).setAlpha(0.25 + 0.5 * (0.5 + 0.5 * Math.sin(now / 160)));
    const frac = s.phase === PH_COUNTIN ? 0 : Math.min(1, s.t / TAKE_MAX);
    g.fillStyle(PAL.paperDetail, 1);
    g.fillRect(330, HUD_Y + 23, 52, 3);
    g.fillStyle(frac > 0.85 ? PAL.danger : PAL.ink, 1);
    g.fillRect(330, HUD_Y + 23, 52 * frac, 3);
    this.ff.setVisible(ff);
    if (wipe > 0) {
      g.lineStyle(3, PAL.danger, 1);
      g.beginPath();
      g.arc(324, HUD_Y + 18, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wipe);
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
