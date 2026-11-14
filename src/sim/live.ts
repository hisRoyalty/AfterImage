import { TS, LIVE_W, LIVE_H, LOOP_TOP_PAD, IN_L, IN_R, IN_J, IN_JP, T_DRUM } from './constants.ts';
import type { Tuning } from './constants.ts';
import { sweepX, sweepY, boxBlocked, fdiv } from './collide.ts';
import type { World } from './collide.ts';
import { tileAt } from './room.ts';
import { EV_JUMP, EV_LAND, EV_HARDLAND, EV_BOUNCE, ev } from './events.ts';
import type { Live, Room } from './types.ts';

export interface LoopBoxes {
  n: number;
  cx: Int32Array;
  cy: Int32Array;
  px: Int32Array;
  py: Int32Array;
  ok: Uint8Array;
}

export const HARD_LAND = 1800;

export function newLive(room: Room): Live {
  return { x: room.spawnX, y: room.spawnY, vx: 0, vy: 0, ground: true, coyote: 0, buf: 0, jumpT: -1, bouncing: false, face: 1 };
}

export function copyLive(a: Live, b: Live): void {
  b.x = a.x; b.y = a.y; b.vx = a.vx; b.vy = a.vy; b.ground = a.ground; b.coyote = a.coyote;
  b.buf = a.buf; b.jumpT = a.jumpT; b.bouncing = a.bouncing; b.face = a.face;
}

function horizontal(lv: Live, input: number, tun: Tuning): void {
  const dir = (input & IN_R ? 1 : 0) - (input & IN_L ? 1 : 0);
  const acc = lv.ground ? tun.accG : tun.accA;
  const stop = lv.ground ? tun.stopG : tun.stopA;
  if (dir !== 0) {
    lv.face = dir;
    lv.vx += lv.vx * dir < 0 ? dir * Math.max(acc, stop) : dir * acc;
    if (lv.vx > tun.run) lv.vx = tun.run;
    if (lv.vx < -tun.run) lv.vx = -tun.run;
  } else if (lv.vx > 0) lv.vx = Math.max(0, lv.vx - stop);
  else if (lv.vx < 0) lv.vx = Math.min(0, lv.vx + stop);
}

// Highest bouncy top crossed this tick, or -1.
function bounceTop(lv: Live, w: World, lb: LoopBoxes, prevBot: number, wantBot: number, gotBot: number): number {
  let best = -1;
  if (wantBot > prevBot) {
    const c0 = fdiv(lv.x, TS);
    const c1 = fdiv(lv.x + LIVE_W - 1, TS);
    const r1 = fdiv(wantBot - 1, TS);
    for (let r = fdiv(prevBot + TS - 1, TS); r <= r1 && best < 0; r++) {
      const top = r * TS;
      if (top > gotBot) break;
      for (let c = c0; c <= c1; c++) if (tileAt(w.room, c, r) === T_DRUM) best = top;
    }
  }
  for (let i = 0; i < lb.n; i++) {
    if (!lb.ok[i]) continue;
    const top = lb.cy[i];
    if (best >= 0 && top >= best) continue;
    if (prevBot > lb.py[i] || wantBot <= top || top > gotBot) continue;
    const lx = lb.cx[i];
    if (lv.x >= lx + LIVE_W + LOOP_TOP_PAD || lv.x + LIVE_W <= lx - LOOP_TOP_PAD) continue;
    if (boxBlocked(w, lv.x, top - LIVE_H)) continue;
    best = top;
  }
  return best;
}

export function stepLive(lv: Live, input: number, tun: Tuning, w: World, lb: LoopBoxes, out: number[]): void {
  horizontal(lv, input, tun);
  if (input & IN_JP) lv.buf = tun.buffer;
  if (lv.buf > 0 && (lv.ground || lv.coyote > 0)) {
    lv.vy = -tun.jump;
    lv.jumpT = 0;
    lv.buf = 0;
    lv.coyote = 0;
    lv.ground = false;
    lv.bouncing = false;
    out.push(EV_JUMP);
  }
  let g = lv.vy < 0 ? tun.gUp : tun.gDown;
  if (!lv.ground && !lv.bouncing && input & IN_J && lv.vy > -tun.hangV && lv.vy < tun.hangV) g >>= 1;
  lv.vy = Math.min(lv.vy + g, tun.maxFall);
  if (lv.jumpT >= 0) {
    lv.jumpT++;
    if (!(input & IN_J) && lv.jumpT >= tun.cutMin && lv.vy < -tun.cutV) lv.vy = -tun.cutV;
    if (lv.vy >= 0) lv.jumpT = -1;
  }

  const nx = sweepX(w, lv.x, lv.y, lv.vx);
  if (nx !== lv.x + lv.vx) lv.vx = 0;
  lv.x = nx;

  const wasGround = lv.ground;
  const impact = lv.vy;
  const prevBot = lv.y + LIVE_H;
  const wantBot = prevBot + lv.vy;
  const ny = sweepY(w, lv.x, lv.y, lv.vy);
  const gotBot = ny + LIVE_H;
  lv.ground = lv.vy > 0 && gotBot < wantBot;
  if (lv.vy < 0 && gotBot > wantBot) {
    lv.vy = 0;
    lv.jumpT = -1;
  }
  lv.y = ny;

  const top = bounceTop(lv, w, lb, prevBot, wantBot, gotBot);
  if (top >= 0) {
    lv.y = top - LIVE_H;
    lv.vy = -Math.max(tun.jump, (Math.max(impact, 0) * tun.bounceMul) >> 8);
    lv.bouncing = true;
    lv.jumpT = -1;
    lv.ground = false;
    lv.buf = 0;
    lv.coyote = 0;
    out.push(ev(EV_BOUNCE, Math.max(impact, 0) >> 8));
  } else if (lv.ground) {
    lv.vy = 0;
    lv.bouncing = false;
    lv.jumpT = -1;
    if (!wasGround) out.push(impact > HARD_LAND ? EV_HARDLAND : EV_LAND);
  }
  if (lv.ground) lv.coyote = tun.coyote + 1;
  else if (lv.coyote > 0) lv.coyote--;
  if (lv.buf > 0) lv.buf--;
}
