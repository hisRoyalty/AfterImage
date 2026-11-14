import type Phaser from 'phaser';
import type { Session } from '../sim/step.ts';
import type { Loop, Room } from '../sim/types.ts';
import { loopAt } from '../sim/selves.ts';
import { PAL } from './palette.ts';

type G = Phaser.GameObjects.Graphics;
const px = (v: number) => v / 256;

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001'];
export function digit(g: G, n: number, x: number, y: number, color: number): void {
  const d = DIGITS[n] ?? DIGITS[0];
  g.fillStyle(color, 1);
  for (let i = 0; i < 15; i++) if (d[i] === '1') g.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
}

// One glyph per switch: the switch and every gate it drives share it.
export function glyph(g: G, i: number, cx: number, cy: number, color: number, r = 3): void {
  g.fillStyle(color, 1);
  switch (i % 4) {
    case 0: g.fillCircle(cx, cy, r); break;
    case 1: g.fillTriangle(cx - r, cy + r, cx, cy - r, cx + r, cy + r); break;
    case 2: g.fillRect(cx - r, cy - r, r * 2, r * 2); break;
    default: g.fillTriangle(cx, cy - r - 1, cx + r + 1, cy, cx, cy + r + 1); g.fillTriangle(cx, cy - r - 1, cx - r - 1, cy, cx, cy + r + 1);
  }
}

export function hatch(g: G, x: number, y: number, w: number, h: number, step: number): void {
  for (let d = -h + step / 2; d < w; d += step) {
    const x0 = x + Math.max(0, d), y0 = y + Math.max(0, -d);
    const len = Math.min(w - Math.max(0, d), h - Math.max(0, -d));
    g.lineBetween(x0, y0, x0 + len, y0 + len);
  }
}

export function dashedRect(g: G, x: number, y: number, w: number, h: number, dash = 3, gap = 3): void {
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < len; d += dash + gap) {
      const a = d / len, b = Math.min(len, d + dash) / len;
      g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    }
  };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
}

export function drawObjects(g: G, s: Session, now: number): void {
  const room = s.room;
  room.switches.forEach((r, i) => {
    const x = px(r.x), y = px(r.y), w = px(r.w), h = px(r.h);
    const on = s.pressed[i] === 1;
    const ph = on ? 2 : 5;
    g.fillStyle(PAL.wire, on ? 1 : 0.85);
    g.fillRoundedRect(x + 2, y + h - ph, w - 4, ph, { tl: 2, tr: 2, bl: 0, br: 0 });
    glyph(g, i, x + w / 2, y + h - ph - 6, PAL.wire, on ? 3 : 2.5);
  });
  room.gates.forEach((gt, i) => {
    const x = px(gt.r.x), y = px(gt.r.y), w = px(gt.r.w), h = px(gt.r.h);
    if (!s.gateOpen[i]) {
      g.fillStyle(PAL.wire, 1);
      g.fillRect(x + 1, y, w - 2, h);
      g.lineStyle(1, PAL.ink, 0.35);
      hatch(g, x + 1, y, w - 2, h, 5);
      gt.by.forEach((sw, k) => glyph(g, sw, x + w / 2, y + 7 + k * 9, PAL.paper, 2.5));
    } else {
      g.lineStyle(1.5, PAL.wire, 0.8);
      dashedRect(g, x + 1.5, y + 0.5, w - 3, h - 1);
    }
  });
  drawBeams(g, s, room, now);
}

function drawBeams(g: G, s: Session, room: Room, now: number): void {
  room.beams.forEach((b, i) => {
    const o = i * 4;
    const x = px(s.beamSeg[o]), y = px(s.beamSeg[o + 1]), w = px(s.beamSeg[o + 2]), h = px(s.beamSeg[o + 3]);
    const ex = b.ex * 20, ey = b.ey * 20;
    g.fillStyle(PAL.danger, 1);
    const nx = ex + 10 + b.dx * 8, ny = ey + 10 + b.dy * 8;
    g.fillTriangle(nx + b.dy * 5 - b.dx * 3, ny - b.dx * 5 - b.dy * 3, nx - b.dy * 5 - b.dx * 3, ny + b.dx * 5 - b.dy * 3, nx + b.dx * 4, ny + b.dy * 4);
    if (s.beamLive[i]) {
      const flick = 0.75 + 0.25 * Math.sin(now / 40);
      g.fillStyle(PAL.danger, 0.25 * flick);
      g.fillRect(x - (h > w ? 2 : 0), y - (w > h ? 2 : 0), w + (h > w ? 4 : 0), h + (w > h ? 4 : 0));
      g.fillStyle(PAL.danger, 1);
      g.fillRect(x, y + (w > h ? 1 : 0), w, w > h ? 2 : h);
    } else {
      g.fillStyle(PAL.danger, 0.35);
      const len = Math.max(w, h);
      for (let d = 0; d < len; d += 8) {
        if (w > h) g.fillRect(x + d, y + 1.5, 2, 1);
        else g.fillRect(x + 1.5, y + d, 1, 2);
      }
    }
  });
}

export function drawDrone(g: G, x: number, y: number, n: number, alpha = 1): void {
  g.fillStyle(PAL.drone, alpha);
  g.fillRoundedRect(x, y, 18, 20, 4);
  g.lineStyle(1, PAL.droneHatch, alpha);
  hatch(g, x + 1, y + 1, 16, 18, 5);
  g.fillStyle(PAL.paper, alpha);
  g.fillRect(x + 4, y + 8, 4, 1.5);
  g.fillRect(x + 10, y + 8, 4, 1.5);
  digit(g, n, x + 8, y + 13, PAL.paper);
}

export function loopPos(l: Loop, t: number, running: boolean): [number, number] {
  const k = loopAt(l, running ? t % l.len : 0);
  return [px(l.xs[k]), px(l.ys[k])];
}

export function drawLoopPath(g: G, l: Loop, alpha = 0.45): void {
  g.fillStyle(PAL.loop, alpha);
  for (let f = 0; f < l.n; f += 4) g.fillRect(px(l.xs[f]) + 8, px(l.ys[f]) + 9, 2, 2);
}

export function drawLoop(g: G, x: number, y: number, n: number, alpha = 1): void {
  g.fillStyle(PAL.loop, 0.12 * alpha);
  g.fillRoundedRect(x, y, 18, 20, 4);
  g.lineStyle(1.5, PAL.loop, alpha);
  dashedRect(g, x + 0.75, y + 0.75, 16.5, 18.5, 3, 2);
  g.fillStyle(PAL.bounce, alpha);
  g.fillRoundedRect(x - 1, y - 1, 20, 3, 1.5);
  g.fillStyle(PAL.loop, alpha);
  g.fillRect(x + 4, y + 8, 4, 1.5);
  g.fillRect(x + 10, y + 8, 4, 1.5);
  digit(g, n, x + 8, y + 13, PAL.loop);
}

export interface LivePose { sx: number; sy: number; face: number; blink: boolean }

export function drawLive(g: G, x: number, y: number, p: LivePose): void {
  const w = 18 * p.sx, h = 20 * p.sy;
  const lx = x + 9 - w / 2, ly = y + 20 - h;
  g.fillStyle(PAL.ink, 1);
  g.fillRoundedRect(lx - 1, ly - 1, w + 2, h + 2, 5);
  g.fillStyle(PAL.live, 1);
  g.fillRoundedRect(lx + 1, ly + 1, w - 2, h - 2, 4);
  const ex = x + 9 + p.face * 2, ey = ly + h * 0.38;
  if (p.blink) {
    g.fillStyle(PAL.ink, 1);
    g.fillRect(ex - 6, ey, 4, 1.5);
    g.fillRect(ex + 2, ey, 4, 1.5);
  } else {
    g.fillStyle(PAL.white, 1);
    g.fillCircle(ex - 4, ey, 2.6);
    g.fillCircle(ex + 4, ey, 2.6);
    g.fillStyle(PAL.ink, 1);
    g.fillCircle(ex - 4 + p.face, ey, 1.3);
    g.fillCircle(ex + 4 + p.face, ey, 1.3);
  }
}
