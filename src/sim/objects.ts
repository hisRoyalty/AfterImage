import { TS, SUB, COLS, ROWS, LIVE_W, LIVE_H, BEAT, T_SOLID, T_DRUM } from './constants.ts';
import { overlap, boxOverlap } from './collide.ts';
import { tileAt } from './room.ts';
import type { LoopBoxes } from './live.ts';
import type { Room, Drone, Beam } from './types.ts';
import { EV_SW_ON, EV_SW_OFF, EV_GATE_OPEN, EV_GATE_CLOSE, ev } from './events.ts';

export function updateSwitches(room: Room, lx: number, ly: number, drones: Drone[], lb: LoopBoxes, pressed: Uint8Array, out: number[] | null): void {
  for (let i = 0; i < room.switches.length; i++) {
    const r = room.switches[i];
    let on = overlap(lx, ly, LIVE_W, LIVE_H, r);
    for (let d = 0; !on && d < drones.length; d++) on = overlap(drones[d].x, drones[d].y, LIVE_W, LIVE_H, r);
    for (let k = 0; !on && k < lb.n; k++) on = overlap(lb.cx[k], lb.cy[k], LIVE_W, LIVE_H, r);
    const v = on ? 1 : 0;
    if (out && v !== pressed[i]) out.push(ev(v ? EV_SW_ON : EV_SW_OFF, i));
    pressed[i] = v;
  }
}

function satisfied(room: Room, gi: number, pressed: Uint8Array): boolean {
  const g = room.gates[gi];
  if (g.by.length === 0) return false;
  if (g.any) {
    for (const s of g.by) if (pressed[s]) return true;
    return false;
  }
  for (const s of g.by) if (!pressed[s]) return false;
  return true;
}

// reset=true sets gates straight from switches (take start); otherwise closing waits for the Live and Drones to leave.
export function updateGates(room: Room, pressed: Uint8Array, open: Uint8Array, lx: number, ly: number, drones: Drone[], reset: boolean, out: number[] | null): void {
  for (let i = 0; i < room.gates.length; i++) {
    const want = satisfied(room, i, pressed);
    let v = want ? 1 : 0;
    if (!want && open[i] && !reset) {
      const r = room.gates[i].r;
      let busy = overlap(lx, ly, LIVE_W, LIVE_H, r);
      for (let d = 0; !busy && d < drones.length; d++) busy = overlap(drones[d].x, drones[d].y, LIVE_W, LIVE_H, r);
      if (busy) v = 1;
    }
    if (reset) {
      const r = room.gates[i].r;
      for (let d = 0; !v && d < drones.length; d++) if (overlap(drones[d].x, drones[d].y, LIVE_W, LIVE_H, r)) v = 1;
    }
    if (out && v !== open[i]) out.push(ev(v ? EV_GATE_OPEN : EV_GATE_CLOSE, i));
    open[i] = v;
  }
}

export function beamOn(b: Beam, t: number): boolean {
  if (b.on <= 0) return true;
  const cyc = b.on + b.off;
  return (Math.floor(t / BEAT) + b.phase) % cyc < b.on;
}

const BAND = 4 * SUB;
const BAND_OFF = 8 * SUB;
const side = (t: number) => t === T_SOLID || t === T_DRUM;

// Writes the beam's rect (x, y, w, h) into seg at offset o.
export function beamRect(room: Room, b: Beam, open: Uint8Array, drones: Drone[], lb: LoopBoxes, seg: Int32Array, o: number): void {
  const horiz = b.dy === 0;
  let cx = b.ex + b.dx;
  let cy = b.ey + b.dy;
  while (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && !side(tileAt(room, cx, cy))) { cx += b.dx; cy += b.dy; }
  const fwd = b.dx + b.dy > 0;
  // a = start along the axis, e = end along the axis
  const a = horiz ? (fwd ? (b.ex + 1) * TS : b.ex * TS) : (fwd ? (b.ey + 1) * TS : b.ey * TS);
  let e = horiz ? (fwd ? cx * TS : (cx + 1) * TS) : (fwd ? cy * TS : (cy + 1) * TS);
  const bandLo = (horiz ? b.ey : b.ex) * TS + BAND_OFF;
  const clip = (bx: number, by: number, bw: number, bh: number) => {
    const lo = horiz ? by : bx;
    const len = horiz ? bh : bw;
    if (lo >= bandLo + BAND || lo + len <= bandLo) return;
    const s = horiz ? bx : by;
    const f = s + (horiz ? bw : bh);
    if (fwd) { if (f > a && s < e) e = Math.max(a, s); }
    else if (s < a && f > e) e = Math.min(a, f);
  };
  for (let i = 0; i < room.gates.length; i++) {
    if (open[i]) continue;
    const r = room.gates[i].r;
    clip(r.x, r.y, r.w, r.h);
  }
  for (const d of drones) clip(d.x, d.y, LIVE_W, LIVE_H);
  for (let k = 0; k < lb.n; k++) clip(lb.cx[k], lb.cy[k], LIVE_W, LIVE_H);
  const lo = Math.min(a, e);
  const len = Math.abs(e - a);
  if (horiz) { seg[o] = lo; seg[o + 1] = bandLo; seg[o + 2] = len; seg[o + 3] = BAND; }
  else { seg[o] = bandLo; seg[o + 1] = lo; seg[o + 2] = BAND; seg[o + 3] = len; }
}

export function hitBeam(seg: Int32Array, o: number, x: number, y: number, w: number, h: number): boolean {
  return seg[o + 2] > 0 && seg[o + 3] > 0 && boxOverlap(x, y, w, h, seg[o], seg[o + 1], seg[o + 2], seg[o + 3]);
}
