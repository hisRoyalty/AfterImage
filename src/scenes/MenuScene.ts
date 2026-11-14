import Phaser from 'phaser';
import { Menu, text, UP, DOWN, LEFT, RIGHT, OK, BACK } from './ui.ts';
import { ROOMS } from '../rooms/index.ts';
import { load, room as roomSave } from '../meta/save.ts';
import { input } from '../meta/game.ts';
import { STR, UI, fmtTicks } from '../meta/strings.ts';
import { PAL, CSS } from '../render/palette.ts';
import { drawPaper } from '../render/terrain.ts';
import { drawDrone, drawLoop, drawLive, glyph } from '../render/actors.ts';
import { initAudio } from '../audio/engine.ts';
import { bakeImage } from '../render/bake.ts';
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
  grid!: Phaser.GameObjects.Graphics;
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
    bakeImage(this, 640, 420, (g) => drawPaper(g, 640, 420));
    this.grid = this.add.graphics().setDepth(5);
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
    this.grid.clear();
    this.info.setText('');
  }

  private title(): void {
    this.clearAll();
    this.mode = 'title';
    const g = this.grid;
    this.labels.push(text(this, 320, 96, STR.title, 44, CSS.ink, true).setOrigin(0.5).setDepth(6));
    this.labels.push(text(this, 320, 130, STR.subtitle, 12, CSS.inkSoft).setOrigin(0.5).setDepth(6));
    drawLive(g, 262, 160, { sx: 1, sy: 1, face: 1, blink: false });
    drawDrone(g, 292, 160, 1);
    drawLoop(g, 322, 160, 2);
    g.fillStyle(PAL.ink, 1);
    g.fillRoundedRect(240, 181, 160, 4, 2);
    glyph(g, 0, 360, 170, PAL.wire);
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
      this.labels.push(text(this, x + 6, y + 5, String(Number(r.id.slice(1))).padStart(2, '0'), 11, CSS.ink, true).setDepth(7));
    });
    this.drawGrid();
  }

  private cell(i: number): { x: number; y: number } {
    return { x: 40 + (i % 6) * 96, y: 52 + Math.floor(i / 6) * 62 };
  }

  private drawGrid(): void {
    const g = this.grid;
    g.clear();
    ROOMS.forEach((r, i) => {
      const { x, y } = this.cell(i);
      const s = roomSave(r.id);
      const open = unlocked(i);
      g.fillStyle(i === this.sel ? PAL.live : open ? PAL.paper : PAL.paperDetail, 1);
      g.fillRoundedRect(x, y, 84, 40, 5);
      g.lineStyle(i === this.sel ? 2 : 1.25, PAL.ink, open ? 1 : 0.3);
      g.strokeRoundedRect(x, y, 84, 40, 5);
      if (s.cleared) { g.fillStyle(PAL.ink, 1); g.fillRect(x + 8, y + 26, 18, 3); }
      if (s.medal) { g.fillStyle(PAL.wire, 1); g.fillCircle(x + 72, y + 12, 5); g.fillStyle(PAL.paper, 1); g.fillCircle(x + 72, y + 12, 2); }
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
