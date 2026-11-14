// Default art for every sprite, drawn in game pixels. `npm run sprites` renders these to src/sprites/*.png
// (only files that do not exist yet, so hand-edited sprites are never overwritten).
import { PAL } from '../../src/render/palette.ts';
import type { Pen } from './pen.ts';

const WHITE = 0xffffff;

function hatch(p: Pen, x: number, y: number, w: number, h: number, step: number): void {
  for (let d = -h + step / 2; d < w; d += step) {
    const x0 = x + Math.max(0, d), y0 = y + Math.max(0, -d);
    const len = Math.min(w - Math.max(0, d), h - Math.max(0, -d));
    p.lineBetween(x0, y0, x0 + len, y0 + len);
  }
}

function dashed(p: Pen, x: number, y: number, w: number, h: number, dash: number, gap: number): void {
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < len; d += dash + gap) {
      const a = d / len, b = Math.min(len, d + dash) / len;
      p.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    }
  };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
}

function live(p: Pen, look: [number, number], blink: boolean): void {
  const x = 4, y = 5;
  p.fillStyle(PAL.ink).fillRoundedRect(x - 1, y - 1, 20, 22, 5);
  p.fillStyle(PAL.live).fillRoundedRect(x + 1, y + 1, 16, 18, 4);
  const ex = x + 11, ey = y + 7.6;
  if (blink) {
    p.fillStyle(PAL.ink).fillRect(ex - 6, ey, 4, 1.5).fillRect(ex + 2, ey, 4, 1.5);
    return;
  }
  p.fillStyle(WHITE).fillCircle(ex - 4, ey, 2.6).fillCircle(ex + 4, ey, 2.6);
  p.fillStyle(PAL.ink).fillCircle(ex - 4 + look[0], ey + look[1], 1.3).fillCircle(ex + 4 + look[0], ey + look[1], 1.3);
}

const DIGITS = ['010110010010111', '111001111100111', '111001111001111', '101101111001001'];
function digit(p: Pen, n: number): void {
  p.fillStyle(WHITE);
  for (let i = 0; i < 15; i++) if (DIGITS[n - 1][i] === '1') p.fillRect(i % 3, Math.floor(i / 3), 1, 1);
}

function glyph(p: Pen, i: number): void {
  const c = 4, r = 3;
  p.fillStyle(WHITE);
  if (i === 0) p.fillCircle(c, c, r);
  else if (i === 1) p.fillTriangle(c - r, c + r, c, c - r, c + r, c + r);
  else if (i === 2) p.fillRect(c - r, c - r, r * 2, r * 2);
  else { p.fillTriangle(c, 0, c + 4, c, c, 8); p.fillTriangle(c, 0, c - 4, c, c, 8); }
}

function staticTile(p: Pen, top: boolean): void {
  const base = top ? 9 : 0;
  p.fillStyle(PAL.danger).fillRect(0, base, 20, 20 - base);
  if (top) for (let k = 0; k < 4; k++) p.fillTriangle(k * 5, base + 1, k * 5 + 2.5, 1, k * 5 + 5, base + 1);
  p.lineStyle(1, PAL.paper, 0.5);
  for (let k = 0; k < 4; k++) {
    const yy = base + 3 + k * 4;
    if (yy > 18) break;
    for (let s = 0; s < 4; s++) { p.lineBetween(s * 5, yy + 1.5, s * 5 + 2.5, yy - 0.5); p.lineBetween(s * 5 + 2.5, yy - 0.5, s * 5 + 5, yy + 1.5); }
  }
}

function plate(p: Pen, up: boolean): void {
  const ph = up ? 5 : 2;
  p.fillStyle(PAL.wire, up ? 0.85 : 1).fillRoundedRect(2, 20 - ph, 36, ph, { tl: 2, tr: 2, bl: 0, br: 0 });
}

function cell(p: Pen, fill: number, stroke: number, a: number, wdt: number): void {
  p.fillStyle(fill).fillRoundedRect(1, 1, 82, 38, 5);
  p.lineStyle(wdt, stroke, a).strokeRoundedRect(1, 1, 82, 38, 5);
}

export const ART: Record<string, (p: Pen) => void> = {
  paper: (p) => {
    p.fillStyle(PAL.paper).fillRect(0, 0, 640, 420);
    p.lineStyle(1, PAL.paperDetail, 0.55);
    for (let st = 0; st < 4; st++) for (let l = 0; l < 5; l++) p.lineBetween(0, 34 + st * 90 + l * 7, 640, 34 + st * 90 + l * 7);
  },
  hud_bar: (p) => { p.fillStyle(PAL.paper).fillRect(0, 0, 640, 60); p.fillStyle(PAL.ink).fillRect(0, 0, 640, 2); },
  live_idle: (p) => live(p, [1, 0], false),
  live_blink: (p) => live(p, [1, 0], true),
  live_jump: (p) => live(p, [1, -1.2], false),
  live_fall: (p) => live(p, [1, 1.2], false),
  drone: (p) => {
    const x = 4, y = 5;
    p.fillStyle(PAL.drone).fillRoundedRect(x, y, 18, 20, 4);
    p.lineStyle(1, PAL.droneHatch);
    hatch(p, x + 1, y + 1, 16, 18, 5);
    p.fillStyle(PAL.paper).fillRect(x + 4, y + 8, 4, 1.5).fillRect(x + 10, y + 8, 4, 1.5);
  },
  loop: (p) => {
    const x = 4, y = 5;
    p.fillStyle(PAL.loop, 0.12).fillRoundedRect(x, y, 18, 20, 4);
    p.lineStyle(1.5, PAL.loop);
    dashed(p, x + 0.75, y + 0.75, 16.5, 18.5, 3, 2);
    p.fillStyle(PAL.bounce).fillRoundedRect(x - 1, y - 1, 20, 3, 1.5);
    p.fillStyle(PAL.loop).fillRect(x + 4, y + 8, 4, 1.5).fillRect(x + 10, y + 8, 4, 1.5);
  },
  digit_1: (p) => digit(p, 1),
  digit_2: (p) => digit(p, 2),
  digit_3: (p) => digit(p, 3),
  digit_4: (p) => digit(p, 4),
  ghost: (p) => { p.lineStyle(1, PAL.ink); dashed(p, 1, 1, 18, 20, 2, 2); },
  loop_dot: (p) => p.fillStyle(PAL.loop).fillRect(0, 0, 2, 2),
  static_top: (p) => staticTile(p, true),
  static_fill: (p) => staticTile(p, false),
  drum: (p) => {
    p.fillStyle(PAL.ink).fillRect(0, 5, 20, 15);
    p.fillStyle(PAL.bounce).fillRoundedRect(0, 0, 20, 6, 3);
    p.lineStyle(1, WHITE, 0.6).lineBetween(3, 2, 17, 2);
    p.fillStyle(PAL.bounce, 0.7);
    for (let k = 4; k < 20; k += 6) p.fillRect(k, 8, 2, 10);
  },
  pad: (p) => {
    p.fillStyle(PAL.ink).fillRoundedRect(2, 17, 36, 3, { tl: 2, tr: 2, bl: 0, br: 0 });
    p.lineStyle(1.5, PAL.ink, 0.5).strokeCircle(9, 11, 3.5).strokeCircle(31, 11, 3.5);
  },
  out: (p) => {
    p.fillStyle(PAL.live, 0.25).fillRoundedRect(1, 1, 18, 39, { tl: 9, tr: 9, bl: 0, br: 0 });
    p.lineStyle(2, PAL.ink).strokeRoundedRect(1, 1, 18, 39, { tl: 9, tr: 9, bl: 0, br: 0 });
    p.fillStyle(PAL.ink).fillTriangle(7, 15, 13, 20, 7, 25);
  },
  mute: (p) => { p.fillStyle(PAL.mute, 0.16).fillRect(0, 0, 20, 20); p.lineStyle(1, PAL.mute, 0.5); hatch(p, 0, 0, 20, 20, 5); },
  emitter: (p) => { p.fillStyle(PAL.danger).fillTriangle(12, 5, 12, 15, 20, 10); p.fillRect(8, 7, 4, 6); },
  beam_on: (p) => { p.fillStyle(PAL.danger, 0.25).fillRect(0, 0, 20, 8); p.fillStyle(PAL.danger).fillRect(0, 3, 20, 2); },
  beam_off: (p) => { p.fillStyle(PAL.danger, 0.35); for (let d = 0; d < 20; d += 5) p.fillRect(d, 3.5, 2, 1); },
  switch_up: (p) => plate(p, true),
  switch_down: (p) => plate(p, false),
  glyph_0: (p) => glyph(p, 0),
  glyph_1: (p) => glyph(p, 1),
  glyph_2: (p) => glyph(p, 2),
  glyph_3: (p) => glyph(p, 3),
  gate_closed: (p) => { p.fillStyle(PAL.wire).fillRect(0, 0, 20, 20); p.lineStyle(1, PAL.ink, 0.35); hatch(p, 0, 0, 20, 20, 5); },
  gate_open: (p) => { p.lineStyle(1.5, PAL.wire, 0.8); dashed(p, 1.5, 1, 17, 18, 2.5, 2.5); },
  particle: (p) => p.fillStyle(WHITE).fillRect(0, 0, 4, 4),
  slot: (p) => p.lineStyle(1.5, PAL.ink, 0.35).strokeRoundedRect(0.75, 0.75, 22.5, 22.5, 4),
  slot_full: (p) => p.lineStyle(1.5, PAL.ink, 0.9).strokeRoundedRect(0.75, 0.75, 22.5, 22.5, 4),
  slot_locked: (p) => p.fillStyle(PAL.paperDetail).fillRoundedRect(0, 0, 24, 24, 4),
  beat_on: (p) => p.fillStyle(PAL.ink).fillCircle(5, 5, 4),
  beat_off: (p) => p.fillStyle(PAL.paperDetail).fillCircle(5, 5, 3),
  ff: (p) => { p.fillStyle(PAL.ink).fillTriangle(1, 1, 7, 6, 1, 11).fillTriangle(8, 1, 14, 6, 8, 11); },
  medal: (p) => { p.fillStyle(PAL.wire).fillCircle(10, 10, 8.5); p.fillStyle(PAL.paper).fillCircle(10, 10, 3.5); },
  tick: (p) => p.fillStyle(PAL.ink).fillRect(0, 0, 18, 3),
  keycap: (p) => { p.fillStyle(PAL.paper).fillRoundedRect(1, 1, 14, 12, 3); p.lineStyle(1.5, PAL.ink, 0.8).strokeRoundedRect(1, 1, 14, 12, 3); },
  panel: (p) => { p.fillStyle(PAL.paper, 0.96).fillRoundedRect(1, 1, 30, 30, 8); p.lineStyle(2, PAL.ink).strokeRoundedRect(1, 1, 30, 30, 8); },
  button: (p) => p.fillStyle(PAL.live).fillRoundedRect(0, 0, 24, 16, 4),
  cell: (p) => cell(p, PAL.paper, PAL.ink, 1, 1.25),
  cell_on: (p) => cell(p, PAL.live, PAL.ink, 1, 2),
  cell_locked: (p) => cell(p, PAL.paperDetail, PAL.ink, 0.3, 1.25),
};
