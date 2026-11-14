import { TUNING, IN_LOOP } from './constants.ts';
import type { Tuning } from './constants.ts';
import { decode } from './rle.ts';
import { newSession, step, PH_RUN, PH_CLEAR } from './step.ts';
import type { Session } from './step.ts';
import { hashSession } from './hash.ts';
import type { Room, TakeLog } from './types.ts';

export interface ReplayResult {
  cleared: boolean;
  session: Session;
  hashes: number[];
  ticks: number;
  error: string | null;
}

export function replay(room: Room, takes: TakeLog[], tun: Tuning = TUNING, hashEvery = 0): ReplayResult {
  const s = newSession(room, tun);
  const hashes: number[] = [];
  let ticks = 0;
  let error: string | null = null;
  for (let k = 0; k < takes.length && !error; k++) {
    const take = takes[k];
    const masks = decode(take.i);
    const before = s.takes;
    for (let j = 0; j < masks.length; j++) {
      step(s, masks[j]);
      ticks++;
      if (hashEvery && ticks % hashEvery === 0) hashes.push(hashSession(s));
      if (s.phase !== PH_RUN && j < masks.length - 1) { error = `take ${k} ended at input ${j} of ${masks.length}`; break; }
    }
    if (error) break;
    if (take.e === 'out') {
      if (s.phase !== PH_CLEAR) error = `take ${k} did not reach the Out`;
    } else if (s.takes !== before + 1 || s.lastEnd !== take.e) {
      error = `take ${k} ended as ${s.phase === PH_RUN ? 'running' : s.lastEnd}, expected ${take.e}`;
    }
    if (!error && take.k) {
      const n = s.tracks.length;
      step(s, IN_LOOP);
      if (s.tracks.length !== n + 1) error = `take ${k} could not be kept`;
    }
  }
  return { cleared: !error && s.phase === PH_CLEAR, session: s, hashes, ticks, error };
}

// Flat per-tick input stream for a solution, keeps included.
export function solutionMasks(takes: TakeLog[]): number[] {
  const out: number[] = [];
  for (const t of takes) {
    for (const m of decode(t.i)) out.push(m);
    if (t.k) out.push(IN_LOOP);
  }
  return out;
}
