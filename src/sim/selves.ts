import { BEAT } from './constants.ts';
import type { Loop } from './types.ts';
import type { LoopBoxes } from './live.ts';

export function loopLength(n: number): number {
  return Math.ceil((n + BEAT) / BEAT) * BEAT;
}

export function makeLoop(xs: Int32Array, ys: Int32Array, n: number, notes: number[]): Loop {
  return { kind: 1, xs: xs.slice(0, n), ys: ys.slice(0, n), n, len: loopLength(n), notes: notes.slice() };
}

export function loopAt(l: Loop, f: number): number {
  return f < l.n ? f : l.n - 1;
}

export function newLoopBoxes(): LoopBoxes {
  return { n: 0, cx: new Int32Array(4), cy: new Int32Array(4), px: new Int32Array(4), py: new Int32Array(4), ok: new Uint8Array(4) };
}

// Places every Loop at frame t mod len. running=false means count-in: frame 0 and no bouncing.
export function placeLoops(loops: Loop[], t: number, running: boolean, lb: LoopBoxes): void {
  lb.n = loops.length;
  for (let i = 0; i < loops.length; i++) {
    const l = loops[i];
    const f = running ? t % l.len : 0;
    const k = loopAt(l, f);
    lb.cx[i] = l.xs[k];
    lb.cy[i] = l.ys[k];
    if (f === 0) {
      lb.ok[i] = 0;
      lb.px[i] = l.xs[k];
      lb.py[i] = l.ys[k];
    } else {
      const p = loopAt(l, f - 1);
      lb.ok[i] = 1;
      lb.px[i] = l.xs[p];
      lb.py[i] = l.ys[p];
    }
  }
}
