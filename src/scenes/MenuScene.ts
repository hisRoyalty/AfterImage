import Phaser from 'phaser';
import { text, UP, DOWN, LEFT, RIGHT, OK, BACK } from './ui.ts';
import { ROOMS } from '../rooms/index.ts';
import { load, room as roomSave } from '../meta/save.ts';
import { input, settings } from '../meta/game.ts';
import { STR, UI, fmtTicks } from '../meta/strings.ts';
import { CSS, PAL } from '../render/palette.ts';
import { img, nine, res } from '../render/sprites.ts';
import { Backdrop } from '../render/backdrop.ts';
import { themeOf } from '../rooms/themes.ts';
import { TITLE } from '../meta/titleStrings.ts';
import { TitleLogo } from './titleLogo.ts';
import { TitleMenu } from './titleMenu.ts';
import { TitleAttract } from './titleAttract.ts';
import { initAudio } from '../audio/engine.ts';
import { sfx } from '../audio/sfx.ts';
import { fitCamera, isFullscreen, toggleFullscreen } from '../meta/screen.ts';
import { useCursor, clickable } from '../meta/pointer.ts';

export function unlocked(i: number): boolean {
  if (i === 0) return true;
  if (roomSave(ROOMS[i - 1].id).cleared) return true;
  return ROOMS.slice(i).some((r) => roomSave(r.id).cleared);
}

export function nextRoom(): number {
  const i = ROOMS.findIndex((r) => !roomSave(r.id).cleared);
  return i < 0 ? 0 : i;
}

export class MenuScene extends Phaser.Scene {
  menu: TitleMenu | null = null;
  logo: TitleLogo | null = null;
  attract: TitleAttract | null = null;
  backdrop!: Backdrop;
  leaving = false;
  lastNow = 0;
  noteT = 0;
  mode: 'title' | 'select' = 'title';
  fs = false;
  sel = 0;
  objs: Phaser.GameObjects.GameObject[] = [];
  cells: { box: Phaser.GameObjects.NineSlice; tick: Phaser.GameObjects.Image; medal: Phaser.GameObjects.Image }[] = [];
  labels: Phaser.GameObjects.Text[] = [];
  info!: Phaser.GameObjects.Text;
  help!: Phaser.GameObjects.Text;

  constructor() {
    super('menu');
  }

  init(data: { select?: boolean; index?: number }): void {
    this.mode = data.select ? 'select' : 'title';
    this.sel = data.index ?? nextRoom();
  }

  create(): void {
    fitCamera(this);
    useCursor(this, 'menu');
    input.clear();
    this.leaving = false;
    this.lastNow = 0;
    img(this, 'paper', 0, 0, -5);
    // the backdrop of the chapter you are in; the night chapter and plain rooms fall back to dusk
    const th = themeOf(ROOMS[nextRoom()]);
    this.backdrop = new Backdrop(this, th === 'night' || th === 'plain' ? 'dusk' : th, -4);
    this.add.graphics().setDepth(0.5).fillStyle(PAL.paper, 1).fillRect(0, 360, 640, 60); // clean band under the floor for the credits
    this.info = text(this, 320, 372, '', 11, CSS.ink).setOrigin(0.5).setDepth(6);
    this.help = text(this, 320, 398, '', 9, CSS.inkSoft).setOrigin(0.5).setDepth(6);
    this.events.on('resume', () => { input.clear(); this.menu?.refresh(); });
    if (this.mode === 'title') this.title();
    else this.select();
    this.cameras.main.fadeIn(160, 244, 237, 224);
  }

  // Title and room select share this scene: a quick dip to paper hides the swap.
  private swap(build: () => void): void {
    if (this.leaving) return;
    const cam = this.cameras.main;
    if (settings().reducedMotion) { build(); return; }
    this.leaving = true;
    cam.once('camerafadeoutcomplete', () => { build(); this.leaving = false; input.clear(); cam.fadeIn(120, 244, 237, 224); });
    cam.fadeOut(90, 244, 237, 224);
  }

  // Fade to paper, then start the next scene. Only one transition at a time.
  private goTo(key: string, data?: object, ms = 140): void {
    if (this.leaving) return;
    this.leaving = true;
    input.clear();
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
    this.cameras.main.fadeOut(ms, 244, 237, 224);
  }

  private clearAll(): void {
    this.menu?.destroy();
    this.menu = null;
    this.logo?.destroy();
    this.logo = null;
    this.attract?.destroy();
    this.attract = null;
    this.labels.forEach((l) => l.destroy());
    this.labels = [];
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.cells = [];
    this.info.setText('');
  }

  private title(): void {
    this.clearAll();
    this.mode = 'title';
    const still = settings().reducedMotion;
    this.logo = new TitleLogo(this, 320, 74, 114, still);
    this.attract = new TitleAttract(this, 1, still);
    const started = Object.values(load().rooms).some((r) => r.cleared);
    this.menu = new TitleMenu(this, 320, 152, 21, [
      { label: () => (started ? UI.continue : UI.newGame), act: () => this.play(nextRoom()) },
      { label: () => UI.rooms, act: () => { sfx('confirm'); this.swap(() => this.select()); } },
      { label: () => TITLE.customize, act: () => this.customize() },
      { label: () => UI.settings, act: () => { sfx('confirm'); this.scene.pause(); this.scene.launch('settings', { from: 'menu' }); } },
      { label: () => UI.fullscreen(isFullscreen()), act: () => toggleFullscreen() },
    ], still);
    this.help.setText(UI.menuHelp).setColor(CSS.inkSoft);
    this.info.setText(UI.credits).setColor(CSS.inkSoft);
  }

  // The Customize scene is built separately; until it is registered the button only explains.
  private customize(): void {
    if (this.scene.manager.keys['Customize']) {
      initAudio();
      sfx('confirm');
      this.goTo('Customize', { from: 'menu' });
      return;
    }
    sfx('refuse');
    this.help.setText(TITLE.customizeSoon).setColor(CSS.ink);
    this.noteT = 2000;
  }

  private select(): void {
    this.clearAll();
    this.mode = 'select';
    this.help.setText(UI.selectHelp);
    this.info.setColor(CSS.ink);
    const chapters = Math.ceil(ROOMS.length / 6);
    for (let ch = 1; ch <= chapters; ch++) this.labels.push(text(this, 40, 26 + (ch - 1) * 54, STR.chapter[ch], 10, CSS.inkSoft, true).setDepth(6));
    ROOMS.forEach((r, i) => {
      const { x, y } = this.cell(i);
      const box = nine(this, 'cell', x, y, 84, 36, 5);
      const tick = img(this, 'tick', x + 8, y + 24, 6);
      const medal = img(this, 'medal', x + 72, y + 12, 6).setOrigin(0.5).setScale(0.55 / res(this, 'medal'));
      // mouse: hover selects, click plays
      const zone = this.add.zone(x + 42, y + 18, 84, 36).setDepth(8);
      clickable(zone, () => { if (unlocked(i)) this.play(i); else sfx('refuse'); }, (st) => {
        if (st === 'over' && this.sel !== i) { this.sel = i; sfx('ui'); this.drawGrid(); }
        box.setAlpha(st === 'down' ? 0.8 : 1);
      });
      this.cells.push({ box, tick, medal });
      this.objs.push(box, tick, medal, zone);
      this.labels.push(text(this, x + 6, y + 5, String(Number(r.id.slice(1))).padStart(2, '0'), 11, CSS.ink, true).setDepth(7));
    });
    const back = text(this, 40, 398, UI.backLink, 10, CSS.inkSoft).setOrigin(0, 0.5).setDepth(7);
    clickable(back, () => { sfx('back'); this.swap(() => this.title()); });
    this.labels.push(back);
    this.drawGrid();
  }

  private cell(i: number): { x: number; y: number } {
    return { x: 40 + (i % 6) * 96, y: 38 + Math.floor(i / 6) * 54 };
  }

  private drawGrid(): void {
    ROOMS.forEach((r, i) => {
      const c = this.cells[i];
      if (!c) return;
      const s = roomSave(r.id);
      const key = i === this.sel ? 'cell_on' : unlocked(i) ? 'cell' : 'cell_locked';
      if (c.box.texture.key !== key) c.box.setTexture(key);
      c.tick.setVisible(s.cleared);
      c.medal.setVisible(s.medal);
    });
    const r = ROOMS[this.sel];
    const s = roomSave(r.id);
    const par = r.par.drones + r.par.loops;
    const parTxt = par === 0 ? '0' : [r.par.drones && `${r.par.drones}D`, r.par.loops && `${r.par.loops}L`].filter(Boolean).join('+');
    const bits = [`${r.id.slice(1)}  ${r.name}`, STR.par(parTxt, r.tracks)];
    if (!unlocked(this.sel)) bits.push(UI.locked);
    else if (s.cleared) bits.push(s.medal ? STR.cleanTake : STR.cleared, s.best ? STR.bestTime(fmtTicks(s.best)) : '');
    this.info.setText(bits.filter(Boolean).join('   ·   '));
  }

  private play(i: number): void {
    if (this.leaving) return;
    initAudio();
    sfx('confirm');
    this.goTo('room', { index: i });
  }

  update(): void {
    const now = performance.now();
    const dt = this.lastNow ? Math.min(250, now - this.lastNow) : 16.7;
    this.lastNow = now;
    const still = settings().reducedMotion;
    this.backdrop.update(dt, this.attract?.focusX ?? 320, still);
    const codes = this.leaving ? [] : input.takeCodes();
    if (codes.length) initAudio();
    if (this.fs !== isFullscreen()) { this.fs = isFullscreen(); this.menu?.refresh(); }
    if (this.mode === 'title') {
      if (this.noteT > 0 && (this.noteT -= dt) <= 0) this.help.setText(UI.menuHelp).setColor(CSS.inkSoft);
      if (codes.length || this.input.activePointer.isDown) this.logo?.finishIntro();
      this.logo?.update(dt);
      this.attract?.update(dt);
      this.menu?.update(codes, dt);
      return;
    }
    for (const c of codes) {
      const n = ROOMS.length;
      if (LEFT.includes(c)) this.sel = (this.sel + n - 1) % n;
      else if (RIGHT.includes(c)) this.sel = (this.sel + 1) % n;
      else if (UP.includes(c)) this.sel = (this.sel + n - 6) % n;
      else if (DOWN.includes(c)) this.sel = (this.sel + 6) % n;
      else if (OK.includes(c)) { if (unlocked(this.sel)) return this.play(this.sel); sfx('refuse'); continue; }
      else if (BACK.includes(c)) { sfx('back'); return this.swap(() => this.title()); }
      else continue;
      sfx('ui');
      this.drawGrid();
    }
  }
}
