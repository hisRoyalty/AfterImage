import Phaser from 'phaser';
import { text, UP, DOWN, LEFT, RIGHT, OK, BACK } from './ui.ts';
import { ROOMS } from '../rooms/index.ts';
import { themeOf } from '../rooms/themes.ts';
import { load, save } from '../meta/save.ts';
import { input, settings } from '../meta/game.ts';
import { COLOUR_IDS, HAT_IDS } from '../meta/look.ts';
import { CUSTOM, UI } from '../meta/strings.ts';
import { CSS, PAL, LIVE_COLOURS } from '../render/palette.ts';
import { img, nine } from '../render/sprites.ts';
import { Backdrop } from '../render/backdrop.ts';
import { LiveSprite } from '../render/actorLayer.ts';
import { applyLook } from '../render/liveLook.ts';
import { fitCamera } from '../meta/screen.ts';
import { useCursor, clickable } from '../meta/pointer.ts';
import { initAudio } from '../audio/engine.ts';
import { sfx } from '../audio/sfx.ts';
import { nextRoom } from './MenuScene.ts';

const SW_X = 300, SW_Y = 108, SW_GAP = 46, SW_R = 15;
const HAT_X = 300, HAT_Y = 172, HAT_GAP = 60, HAT_S = 52, HAT_COLS = 4;
const PREV_X = 160, PREV_FEET = 236, PREV_SCALE = 4;
const HOP_MS = 2600;

// Pick the Live's body colour and a hat. Changes apply and save at once.
export class CustomizeScene extends Phaser.Scene {
  private row = 0; // 0 colour, 1 hat
  private ring!: Phaser.GameObjects.Graphics;
  private swatches!: Phaser.GameObjects.Graphics;
  private cells: Phaser.GameObjects.NineSlice[] = [];
  private preview!: LiveSprite;
  private minis: { sprite: LiveSprite; x: number; y: number }[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private name!: Phaser.GameObjects.Text;
  private backdrop!: Backdrop;
  private hover = -1; // hovered swatch, for the soft ring
  private t = 0;
  private lastNow = 0;
  private leaving = false;

  constructor() {
    super('Customize');
  }

  create(): void {
    fitCamera(this);
    useCursor(this, 'menu');
    input.clear();
    this.leaving = false;
    this.lastNow = 0;
    this.t = 0;
    this.row = 0;
    this.cells = [];
    this.labels = [];
    this.minis = [];
    this.hover = -1;
    img(this, 'paper', 0, 0, -5);
    const th = themeOf(ROOMS[nextRoom()]);
    this.backdrop = new Backdrop(this, th === 'night' || th === 'plain' ? 'dusk' : th, -4);
    text(this, 320, 30, CUSTOM.title, 18, CSS.ink, true).setOrigin(0.5).setDepth(6);
    const back = text(this, 40, 30, UI.backLink, 10, CSS.inkSoft).setOrigin(0, 0.5).setDepth(6);
    clickable(back, () => this.leave());
    text(this, 320, 372, CUSTOM.note, 10, CSS.inkSoft).setOrigin(0.5).setDepth(6);
    text(this, 320, 398, CUSTOM.help, 9, CSS.inkSoft).setOrigin(0.5).setDepth(6);

    // preview panel with a big Live
    nine(this, 'panel', 60, 64, 200, 236, 1);
    this.preview = new LiveSprite(this, 3);
    this.name = text(this, PREV_X, 270, '', 11, CSS.ink, true).setOrigin(0.5).setDepth(3);

    // colour row
    this.labels.push(text(this, SW_X - 6, SW_Y - 34, CUSTOM.colour, 11, CSS.ink, true).setDepth(6));
    this.swatches = this.add.graphics().setDepth(4);
    this.ring = this.add.graphics().setDepth(5);
    COLOUR_IDS.forEach((_, i) => {
      const z = this.add.zone(SW_X + SW_R + i * SW_GAP, SW_Y, SW_R * 2 + 6, SW_R * 2 + 6).setDepth(7);
      clickable(z, () => { this.row = 0; this.setColour(i); }, (st) => { this.hover = st === 'idle' ? -1 : i; this.draw(); });
    });

    // hat grid: each cell shows the Live wearing that hat
    this.labels.push(text(this, HAT_X - 6, HAT_Y - 24, CUSTOM.hat, 11, CSS.ink, true).setDepth(6));
    HAT_IDS.forEach((id, i) => {
      const x = HAT_X + (i % HAT_COLS) * HAT_GAP, y = HAT_Y + Math.floor(i / HAT_COLS) * HAT_GAP;
      this.cells.push(nine(this, 'cell', x, y, HAT_S, HAT_S, 4));
      const m = new LiveSprite(this, 5);
      m.hatOverride = id;
      this.minis.push({ sprite: m, x: x + HAT_S / 2 - 9, y: y + HAT_S - 8 - 20 });
      const z = this.add.zone(x + HAT_S / 2, y + HAT_S / 2, HAT_S, HAT_S).setDepth(7);
      clickable(z, () => { this.row = 1; this.setHat(i); }, (st) => { this.cells[i].setAlpha(st === 'down' ? 0.8 : 1); });
    });

    this.draw();
    this.cameras.main.fadeIn(160, 244, 237, 224);
  }

  private colourIndex(): number {
    return Math.max(0, COLOUR_IDS.indexOf(load().look.colour));
  }

  private hatIndex(): number {
    return Math.max(0, HAT_IDS.indexOf(load().look.hat));
  }

  private wrap(i: number, n: number): number {
    return ((i % n) + n) % n;
  }

  private setColour(i: number): void {
    const id = COLOUR_IDS[this.wrap(i, COLOUR_IDS.length)];
    if (id !== load().look.colour) this.apply({ colour: id });
    this.draw();
  }

  private setHat(i: number): void {
    const id = HAT_IDS[this.wrap(i, HAT_IDS.length)];
    if (id !== load().look.hat) this.apply({ hat: id });
    this.draw();
  }

  private apply(change: { colour?: string; hat?: string }): void {
    const d = load();
    d.look = { ...d.look, ...change };
    save();
    applyLook(this, d.look);
    sfx('ui');
  }

  private draw(): void {
    const ci = this.colourIndex(), hi = this.hatIndex();
    const g = this.swatches;
    g.clear();
    COLOUR_IDS.forEach((id, i) => {
      const cx = SW_X + SW_R + i * SW_GAP;
      g.fillStyle(PAL.ink, 1).fillCircle(cx, SW_Y, SW_R);
      g.fillStyle(LIVE_COLOURS[id], 1).fillCircle(cx, SW_Y, SW_R - 2);
    });
    const r = this.ring;
    r.clear();
    if (this.hover >= 0 && this.hover !== ci) r.lineStyle(2, PAL.inkTop, 0.35).strokeCircle(SW_X + SW_R + this.hover * SW_GAP, SW_Y, SW_R + 5);
    r.lineStyle(this.row === 0 ? 3 : 2, PAL.ink, this.row === 0 ? 1 : 0.5).strokeCircle(SW_X + SW_R + ci * SW_GAP, SW_Y, SW_R + 5);
    this.cells.forEach((c, i) => {
      const key = i === hi ? 'cell_on' : 'cell';
      if (c.texture.key !== key) c.setTexture(key);
      c.setAlpha(i === hi && this.row !== 1 ? 0.75 : 1);
    });
    // re-show so the hat previews pick up a new body colour
    for (const m of this.minis) m.sprite.show(m.x, m.y, { sx: 1.25, sy: 1.25, face: 1, blink: false });
    this.labels.forEach((l, i) => l.setColor(i === this.row ? CSS.ink : CSS.inkSoft));
    this.name.setText(`${CUSTOM.colours[COLOUR_IDS[ci]]}  ·  ${CUSTOM.hats[HAT_IDS[hi]]}`);
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    sfx('back');
    input.clear();
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
    this.cameras.main.fadeOut(140, 244, 237, 224);
  }

  // Preview: a little hop every few seconds, blinking now and then. Reduced motion keeps it still.
  private animatePreview(dt: number): void {
    const still = settings().reducedMotion;
    if (!still) this.t += dt;
    const t = this.t % HOP_MS;
    let sx = PREV_SCALE, sy = PREV_SCALE, lift = 0, vy = 0, ground = true;
    if (!still && t < 110) { const k = 1 - Math.abs(t / 55 - 1); sx += 0.5 * k; sy -= 0.5 * k; }
    else if (!still && t < 650) { const k = (t - 110) / 540; lift = 34 * 4 * k * (1 - k); vy = k < 0.5 ? -300 : 300; ground = false; }
    else if (!still && t < 760) { const k = 1 - Math.abs((t - 650) / 55 - 1); sx += 0.4 * k; sy -= 0.4 * k; }
    const blink = !still && this.t % 3700 > 3550;
    this.preview.show(PREV_X - 9, PREV_FEET - 20 - lift, { sx, sy, face: 1, blink }, vy, ground);
  }

  update(): void {
    const now = performance.now();
    const dt = this.lastNow ? Math.min(250, now - this.lastNow) : 16.7;
    this.lastNow = now;
    this.backdrop.update(dt, 320, settings().reducedMotion);
    this.animatePreview(dt);
    if (this.leaving) return;
    for (const c of input.takeCodes()) {
      initAudio();
      if (BACK.includes(c) || OK.includes(c)) return this.leave();
      const hi = this.hatIndex();
      if (UP.includes(c) || DOWN.includes(c)) {
        const down = DOWN.includes(c);
        // inside the hat grid, up and down move between its rows first
        if (this.row === 1 && !down && hi >= HAT_COLS) { this.setHat(hi - HAT_COLS); continue; }
        if (this.row === 1 && down && hi + HAT_COLS < HAT_IDS.length) { this.setHat(hi + HAT_COLS); continue; }
        const next = down ? 1 : 0;
        if (next !== this.row) { this.row = next; sfx('ui'); this.draw(); }
      } else if (LEFT.includes(c) || RIGHT.includes(c)) {
        const d = RIGHT.includes(c) ? 1 : -1;
        if (this.row === 0) this.setColour(this.colourIndex() + d);
        else this.setHat(hi + d);
      }
    }
  }
}
