import type Phaser from 'phaser';
import { COLS, ROWS, TILE, T_SOLID, T_STATIC, T_DRUM } from '../sim/constants.ts';
import { tileAt } from '../sim/room.ts';
import type { Room } from '../sim/types.ts';
import { PAL } from './palette.ts';
import { hatch } from './actors.ts';

type G = Phaser.GameObjects.Graphics;
const px = (v: number) => v / 256;

export function drawPaper(g: G, w: number, h: number): void {
  g.fillStyle(PAL.paper, 1);
  g.fillRect(0, 0, w, h);
  g.lineStyle(1, PAL.paperDetail, 0.55);
  for (let staff = 0; staff < 4; staff++) {
    const top = 34 + staff * 90;
    for (let l = 0; l < 5; l++) g.lineBetween(0, top + l * 7, w, top + l * 7);
  }
}

export function drawTerrain(g: G, room: Room): void {
  const at = (x: number, y: number) => tileAt(room, x, y);
  const solid = (x: number, y: number) => {
    const t = at(x, y);
    return t === T_SOLID || t === T_DRUM;
  };
  for (const m of room.mutes) {
    g.fillStyle(PAL.mute, 0.16);
    g.fillRect(px(m.x), px(m.y), px(m.w), px(m.h));
    g.lineStyle(1, PAL.mute, 0.5);
    hatch(g, px(m.x), px(m.y), px(m.w), px(m.h), 6);
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = at(x, y);
      const X = x * TILE, Y = y * TILE;
      if (t === T_SOLID) {
        const up = solid(x, y - 1), dn = solid(x, y + 1), lf = solid(x - 1, y), rt = solid(x + 1, y);
        const r = { tl: !up && !lf ? 5 : 0, tr: !up && !rt ? 5 : 0, bl: !dn && !lf ? 5 : 0, br: !dn && !rt ? 5 : 0 };
        g.fillStyle(PAL.ink, 1);
        g.fillRoundedRect(X, Y, TILE, TILE, r);
        if (!up) {
          g.fillStyle(PAL.inkTop, 1);
          g.fillRoundedRect(X + (r.tl ? 2 : 0), Y + 1, TILE - (r.tl ? 2 : 0) - (r.tr ? 2 : 0), 3, { tl: r.tl ? 2 : 0, tr: r.tr ? 2 : 0, bl: 0, br: 0 });
        }
      } else if (t === T_DRUM) {
        g.fillStyle(PAL.ink, 1);
        g.fillRect(X, Y + 5, TILE, TILE - 5);
        g.fillStyle(PAL.bounce, 1);
        g.fillRoundedRect(X, Y, TILE, 6, 3);
        g.lineStyle(1, PAL.white, 0.6);
        g.lineBetween(X + 3, Y + 2, X + TILE - 3, Y + 2);
        g.fillStyle(PAL.bounce, 0.7);
        for (let k = 4; k < TILE; k += 6) g.fillRect(X + k, Y + 8, 2, TILE - 10);
      } else if (t === T_STATIC) {
        drawStatic(g, X, Y, at(x, y - 1) !== T_STATIC);
      }
    }
  }
  drawPad(g, room);
  drawOut(g, px(room.out.x), px(room.out.y));
}

function drawStatic(g: G, X: number, Y: number, topEdge: boolean): void {
  g.fillStyle(PAL.danger, 1);
  const base = topEdge ? Y + 9 : Y;
  g.fillRect(X, base, TILE, Y + TILE - base);
  if (topEdge) {
    for (let k = 0; k < 4; k++) g.fillTriangle(X + k * 5, base + 1, X + k * 5 + 2.5, Y + 1, X + k * 5 + 5, base + 1);
  }
  g.lineStyle(1, PAL.paper, 0.5);
  for (let k = 0; k < 3; k++) {
    const yy = base + 3 + k * 4;
    if (yy > Y + TILE - 2) break;
    for (let s = 0; s < 4; s++) g.lineBetween(X + s * 5, yy + 1.5, X + s * 5 + 2.5, yy - 0.5), g.lineBetween(X + s * 5 + 2.5, yy - 0.5, X + s * 5 + 5, yy + 1.5);
  }
}

function drawPad(g: G, room: Room): void {
  const cx = px(room.spawnX) + 9;
  const fy = px(room.spawnY) + 20;
  g.fillStyle(PAL.ink, 1);
  g.fillRoundedRect(cx - 18, fy - 3, 36, 3, { tl: 2, tr: 2, bl: 0, br: 0 });
  g.lineStyle(1.5, PAL.ink, 0.5);
  g.strokeCircle(cx - 11, fy - 9, 3.5);
  g.strokeCircle(cx + 11, fy - 9, 3.5);
}

export function drawOut(g: G, x: number, y: number): void {
  g.fillStyle(PAL.live, 0.25);
  g.fillRoundedRect(x + 1, y + 1, 18, 39, { tl: 9, tr: 9, bl: 0, br: 0 });
  g.lineStyle(2, PAL.ink, 1);
  g.strokeRoundedRect(x + 1, y + 1, 18, 39, { tl: 9, tr: 9, bl: 0, br: 0 });
  g.fillStyle(PAL.ink, 1);
  g.fillTriangle(x + 7, y + 15, x + 13, y + 20, x + 7, y + 25);
}
