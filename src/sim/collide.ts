import { TS, LIVE_W, LIVE_H, HAZARD_INSET, T_SOLID, T_DRUM, T_STATIC } from './constants.ts';
import { tileAt } from './room.ts';
import type { Room, Rect, Drone } from './types.ts';

export interface World {
  room: Room;
  gateOpen: Uint8Array;
  drones: Drone[];
}

export function fdiv(a: number, b: number): number {
  return Math.floor(a / b);
}

export function overlap(ax: number, ay: number, aw: number, ah: number, b: Rect): boolean {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export function boxOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const side = (t: number) => t === T_SOLID || t === T_DRUM;

// Returns the new x after moving dx, stopping at the first blocker.
export function sweepX(w: World, x: number, y: number, dx: number): number {
  if (dx === 0) return x;
  const { room } = w;
  const r0 = fdiv(y, TS);
  const r1 = fdiv(y + LIVE_H - 1, TS);
  const bot = y + LIVE_H;
  if (dx > 0) {
    const right = x + LIVE_W;
    let lim = right + dx;
    const c1 = fdiv(lim - 1, TS);
    for (let c = fdiv(right, TS); c <= c1; c++) {
      if (c * TS < right) continue;
      let hit = false;
      for (let r = r0; r <= r1; r++) if (side(tileAt(room, c, r))) hit = true;
      if (hit) { lim = Math.min(lim, c * TS); break; }
    }
    for (let i = 0; i < room.gates.length; i++) {
      if (w.gateOpen[i]) continue;
      const g = room.gates[i].r;
      if (g.y < bot && g.y + g.h > y && g.x >= right && g.x < lim) lim = g.x;
    }
    for (const d of w.drones) {
      if (d.y < bot && d.y + LIVE_H > y && d.x >= right && d.x < lim) lim = d.x;
    }
    return lim - LIVE_W;
  }
  let lim = x + dx;
  const c1 = fdiv(lim, TS);
  for (let c = fdiv(x - 1, TS); c >= c1; c--) {
    if ((c + 1) * TS > x) continue;
    let hit = false;
    for (let r = r0; r <= r1; r++) if (side(tileAt(room, c, r))) hit = true;
    if (hit) { lim = Math.max(lim, (c + 1) * TS); break; }
  }
  for (let i = 0; i < room.gates.length; i++) {
    if (w.gateOpen[i]) continue;
    const g = room.gates[i].r;
    const e = g.x + g.w;
    if (g.y < bot && g.y + g.h > y && e <= x && e > lim) lim = e;
  }
  for (const d of w.drones) {
    const e = d.x + LIVE_W;
    if (d.y < bot && d.y + LIVE_H > y && e <= x && e > lim) lim = e;
  }
  return lim;
}

// Returns the new y after moving dy. Drum tops do not block from above; the bounce test handles them.
export function sweepY(w: World, x: number, y: number, dy: number): number {
  if (dy === 0) return y;
  const { room } = w;
  const c0 = fdiv(x, TS);
  const c1 = fdiv(x + LIVE_W - 1, TS);
  const right = x + LIVE_W;
  if (dy > 0) {
    const bot = y + LIVE_H;
    let lim = bot + dy;
    const r1 = fdiv(lim - 1, TS);
    for (let r = fdiv(bot, TS); r <= r1; r++) {
      if (r * TS < bot) continue;
      let hit = false;
      for (let c = c0; c <= c1; c++) if (tileAt(room, c, r) === T_SOLID) hit = true;
      if (hit) { lim = Math.min(lim, r * TS); break; }
    }
    for (let i = 0; i < room.gates.length; i++) {
      if (w.gateOpen[i]) continue;
      const g = room.gates[i].r;
      if (g.x < right && g.x + g.w > x && g.y >= bot && g.y < lim) lim = g.y;
    }
    for (const d of w.drones) {
      if (d.x < right && d.x + LIVE_W > x && d.y >= bot && d.y < lim) lim = d.y;
    }
    return lim - LIVE_H;
  }
  let lim = y + dy;
  const r1 = fdiv(lim, TS);
  for (let r = fdiv(y - 1, TS); r >= r1; r--) {
    if ((r + 1) * TS > y) continue;
    let hit = false;
    for (let c = c0; c <= c1; c++) if (side(tileAt(room, c, r))) hit = true;
    if (hit) { lim = Math.max(lim, (r + 1) * TS); break; }
  }
  for (let i = 0; i < room.gates.length; i++) {
    if (w.gateOpen[i]) continue;
    const g = room.gates[i].r;
    const e = g.y + g.h;
    if (g.x < right && g.x + g.w > x && e <= y && e > lim) lim = e;
  }
  for (const d of w.drones) {
    const e = d.y + LIVE_H;
    if (d.x < right && d.x + LIVE_W > x && e <= y && e > lim) lim = e;
  }
  return lim;
}

// True if a Live-sized box at (x, y) overlaps anything solid.
export function boxBlocked(w: World, x: number, y: number): boolean {
  const { room } = w;
  for (let r = fdiv(y, TS); r <= fdiv(y + LIVE_H - 1, TS); r++) {
    for (let c = fdiv(x, TS); c <= fdiv(x + LIVE_W - 1, TS); c++) if (side(tileAt(room, c, r))) return true;
  }
  for (let i = 0; i < room.gates.length; i++) {
    if (!w.gateOpen[i] && overlap(x, y, LIVE_W, LIVE_H, room.gates[i].r)) return true;
  }
  for (const d of w.drones) if (boxOverlap(x, y, LIVE_W, LIVE_H, d.x, d.y, LIVE_W, LIVE_H)) return true;
  return false;
}

export function onStatic(room: Room, x: number, y: number): boolean {
  const ix = x + HAZARD_INSET;
  const iy = y + HAZARD_INSET;
  const iw = LIVE_W - 2 * HAZARD_INSET;
  const ih = LIVE_H - 2 * HAZARD_INSET;
  for (let r = fdiv(iy, TS); r <= fdiv(iy + ih - 1, TS); r++) {
    for (let c = fdiv(ix, TS); c <= fdiv(ix + iw - 1, TS); c++) if (tileAt(room, c, r) === T_STATIC) return true;
  }
  return false;
}
