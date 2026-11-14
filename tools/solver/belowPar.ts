import { IN_WAIT, IN_DRONE, IN_LOOP, IN_J, IN_JP, BEAT, LIVE_W, LIVE_H, TS } from '../../src/sim/constants.ts';
import { replay } from '../../src/sim/replay.ts';
import { inMute } from '../../src/sim/step.ts';
import { encode } from '../../src/sim/rle.ts';
import type { Room, TakeLog } from '../../src/sim/types.ts';
import { TakeSearch } from './search.ts';

export type Label = 'Proven' | 'Checked' | 'Partial';
export interface BelowResult { found: TakeLog[] | null; label: Label; searches: number; capped: number; ms: number }

const roundBeat = (n: number) => Math.ceil(n / BEAT) * BEAT;

// Looks for a clear using k tracks with a quantized breadth-first search (2-4 px, binned speeds).
// For k > 0 it tries Drone spots every 5 px (10 px deeper) and beat-quantized Loops: walk to a rest
// tile, idle, commit at one of three loop lengths; plus every kept death cell.
export function belowPar(room: Room, k: number, budgetMs: number): BelowResult {
  const t0 = Date.now();
  let searches = 0;
  let timeout = false;
  let capped = 0;
  const hasTiming = room.switches.length > 0 || room.beams.length > 0;

  const explore = (prefix: TakeLog[], depth: number): TakeLog[] | null => {
    if (timeout || Date.now() - t0 > budgetMs) { timeout = true; return null; }
    const base = replay(room, prefix).session;
    const ts = new TakeSearch(base);
    const timed = base.loops.length > 0 || room.timed;
    const collect = depth < k;
    const quant = depth === 0 ? 5 : 10;
    const drones = new Map<number, number>();
    const rests = new Map<number, number>();
    const deaths = new Map<number, [number, number, number]>();
    searches++;
    const r = ts.run({
      ...(collect ? { qp: 9, qv: 6, stride: timed ? 2 : 1 } : depth === 0 ? { qp: 9, qv: 5 } : timed ? { qp: 10, qv: 7, stride: 3 } : { qp: 10, qv: 6 }),
      maxNodes: depth === 0 ? 4_000_000 : 1_500_000,
      goal: (s, res) => {
        if (res === 2) return true;
        if (res === 1 && collect) {
          const key = (((s.live.x + (LIVE_W >> 1)) / TS) | 0) * 64 + (((s.live.y + (LIVE_H >> 1)) / TS) | 0) * 2 + (s.ev[s.ev.length - 1] >> 8 & 1);
          if (!deaths.has(key)) deaths.set(key, [ts.curHead, ts.curAct, ts.curK]);
        }
        return false;
      },
      visit: collect
        ? (s, n) => {
            if (!s.live.ground || inMute(s)) return;
            const dk = (((s.live.x >> 8) / quant) | 0) * 4096 + (s.live.y >> 8);
            if (!drones.has(dk)) drones.set(dk, n);
            if (s.live.vx === 0) {
              const rk = (((s.live.x + (LIVE_W >> 1)) / TS) | 0) * 64 + (((s.live.y + LIVE_H - 1) / TS) | 0);
              if (!rests.has(rk)) rests.set(rk, n);
            }
          }
        : undefined,
    });
    if (!r.complete) capped++;
    if (r.masks) return prefix.concat([{ i: encode(r.masks), e: 'out' }]);
    if (!collect) return null;
    const tryTake = (t: TakeLog) => {
      const res = replay(room, prefix.concat([t]));
      if (res.error) return null;
      return explore(prefix.concat([t]), depth + 1);
    };
    for (const n of drones.values()) {
      const f = tryTake({ i: encode(ts.path(n).concat([IN_WAIT | IN_DRONE])), e: 'drone' });
      if (f || timeout) return f;
    }
    if (!room.loopsOk) return null;
    const touches = (n: number) => {
      const st = ts.store, o = n * 10;
      const x = st[o], y = st[o + 1];
      for (const r of room.switches) if (x < r.x + r.w && x + LIVE_W > r.x && y < r.y + r.h && y + LIVE_H > r.y) return true;
      for (const b of room.beams) if (b.dy === 0 && y < b.ey * TS + 12 * 256 && y + LIVE_H > b.ey * TS + 8 * 256) return true;
      return false;
    };
    for (const n of rests.values()) {
      const path = ts.path(n);
      const key = hasTiming && touches(n);
      for (const d of key ? [0, BEAT, 2 * BEAT] : [0]) {
        const walk = new Array<number>(d).fill(IN_WAIT).concat(path);
        const n0 = Math.max(BEAT, walk.length);
        for (const extra of key ? [0, BEAT, 2 * BEAT] : [BEAT]) {
          const len = roundBeat(n0) + extra;
          const masks = walk.slice();
          while (masks.length < len) masks.push(IN_WAIT);
          masks.push(IN_WAIT | IN_LOOP);
          const f = tryTake({ i: encode(masks), e: 'loop' });
          if (f || timeout) return f;
        }
      }
      // jump in place (stomp target), and commit at the apex (hovering stone)
      for (const wait of [BEAT, 3 * BEAT]) {
        const base = path.concat(new Array<number>(wait).fill(IN_WAIT));
        const hop = base.concat([IN_WAIT | IN_J | IN_JP], new Array<number>(39).fill(IN_WAIT | IN_J), new Array<number>(12).fill(IN_WAIT));
        for (const cut of [hop.length, base.length + 22]) {
          const masks = hop.slice(0, Math.max(cut, BEAT));
          masks.push(IN_WAIT | IN_LOOP);
          const f = tryTake({ i: encode(masks), e: 'loop' });
          if (f || timeout) return f;
        }
      }
    }
    for (const [head, act, kk] of deaths.values()) {
      const f = tryTake({ i: encode(ts.path(head, act, kk)), e: 'death', k: 1 });
      if (f || timeout) return f;
    }
    return null;
  };

  const found = explore([], 0);
  const label: Label = timeout || capped ? 'Partial' : 'Checked';
  return { found, label, searches, capped, ms: Date.now() - t0 };
}
