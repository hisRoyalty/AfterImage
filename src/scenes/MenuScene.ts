import Phaser from 'phaser';
import { Menu, text, UP, DOWN, LEFT, RIGHT, OK, BACK } from './ui.ts';
import { ROOMS } from '../rooms/index.ts';
import { load, room as roomSave } from '../meta/save.ts';
import { input } from '../meta/game.ts';
import { STR, UI, fmtTicks } from '../meta/strings.ts';
import { PAL, CSS } from '../render/palette.ts';
import { img, nine, res } from '../render/sprites.ts';
import { SelfSprite } from '../render/actorLayer.ts';
import { initAudio } from '../audio/engine.ts';
import { sfx } from '../audio/sfx.ts';

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
  menu: Menu | null = null;
  mode: 'title' | 'select' = 'title';
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
    this.cameras.main.setZoom(2).centerOn(320, 210);
    input.clear();
    img(this, 'paper');
    this.info = text(this, 320, 372, '', 11, CSS.ink).setOrigin(0.5).setDepth(6);
    this.help = text(this, 320, 398, '', 9, CSS.inkSoft).setOrigin(0.5).setDepth(6);
    this.events.on('resume', () => { input.clear(); if (this.mode === 'title') this.title(); });
    if (this.mode === 'title') this.title();
    else this.select();
  }

  private clearAll(): void {
    this.menu?.destroy();
    this.menu = null;
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
    this.labels.push(text(this, 320, 96, STR.title, 44, CSS.ink, true).setOrigin(0.5).setDepth(6));
    this.labels.push(text(this, 320, 130, STR.subtitle, 12, CSS.inkSoft).setOrigin(0.5).setDepth(6));
    const drone = new SelfSprite(this, 6);
    const loop = new SelfSprite(this, 6);
    drone.show({ kind: 0, x: 0, y: 0 }, 1, 292, 160);
    loop.show({ kind: 1, xs: new Int32Array(1), ys: new Int32Array(1), n: 1, len: 60, notes: [] }, 2, 322, 160);
    this.objs.push(img(this, 'live_idle', 262, 160, 6), drone.body, drone.num, loop.body, loop.num,
      img(this, 'tick', 240, 181, 5).setDisplaySize(160, 4), img(this, 'glyph_0', 360, 170, 6).setOrigin(0.5).setTint(PAL.wire));
    const started = Object.values(load().rooms).some((r) => r.cleared);
    this.menu = new Menu(this, 320, 230, [
      { label: () => (started ? UI.continue : UI.newGame), act: () => this.play(nextRoom()) },
      { label: () => UI.rooms, act: () => this.select() },
      { label: () => UI.settings, act: () => { this.scene.pause(); this.scene.launch('settings', { from: 'menu' }); } },
    ], 26, 14, 10);
    this.menu.onMove = () => sfx('ui');
    this.help.setText(UI.menuHelp);
    this.info.setText(UI.credits).setColor(CSS.inkSoft);
  }

  private select(): void {
    this.clearAll();
    this.mode = 'select';
    this.help.setText(UI.selectHelp);
    this.info.setColor(CSS.ink);
    for (let ch = 1; ch <= 5; ch++) this.labels.push(text(this, 40, 40 + (ch - 1) * 62, STR.chapter[ch], 10, CSS.inkSoft, true).setDepth(6));
    ROOMS.forEach((r, i) => {
      const { x, y } = this.cell(i);
      const box = nine(this, 'cell', x, y, 84, 40, 5);
      const tick = img(this, 'tick', x + 8, y + 26, 6);
      const medal = img(this, 'medal', x + 72, y + 12, 6).setOrigin(0.5).setScale(0.55 / res(this, 'medal'));
      this.cells.push({ box, tick, medal });
      this.objs.push(box, tick, medal);
      this.labels.push(text(this, x + 6, y + 5, String(Number(r.id.slice(1))).padStart(2, '0'), 11, CSS.ink, true).setDepth(7));
    });
    this.drawGrid();
  }

  private cell(i: number): { x: number; y: number } {
    return { x: 40 + (i % 6) * 96, y: 52 + Math.floor(i / 6) * 62 };
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
    initAudio();
    sfx('confirm');
    this.clearAll();
    this.scene.start('room', { index: i });
  }

  update(): void {
    const codes = input.takeCodes();
    if (codes.length) initAudio();
    if (this.mode === 'title') {
      this.menu?.update(codes);
      return;
    }
    for (const c of codes) {
      const n = ROOMS.length;
      if (LEFT.includes(c)) this.sel = (this.sel + n - 1) % n;
      else if (RIGHT.includes(c)) this.sel = (this.sel + 1) % n;
      else if (UP.includes(c)) this.sel = (this.sel + n - 6) % n;
      else if (DOWN.includes(c)) this.sel = (this.sel + 6) % n;
      else if (OK.includes(c)) { if (unlocked(this.sel)) return this.play(this.sel); sfx('refuse'); continue; }
      else if (BACK.includes(c)) { sfx('back'); return this.title(); }
      else continue;
      sfx('ui');
      this.drawGrid();
    }
  }
}
