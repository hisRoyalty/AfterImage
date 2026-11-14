import type { Session } from './step.ts';

function mix(h: number, v: number): number {
  h ^= v & 0xffff;
  h = Math.imul(h, 16777619);
  h ^= v >>> 16;
  return Math.imul(h, 16777619);
}

export function hashSession(s: Session): number {
  const l = s.live;
  let h = 2166136261;
  for (const v of [s.phase, s.t, l.x, l.y, l.vx, l.vy, l.ground ? 1 : 0, l.coyote, l.buf, l.jumpT, l.bouncing ? 1 : 0, s.takes]) h = mix(h, v);
  for (const g of s.gateOpen) h = mix(h, g);
  for (const t of s.tracks) {
    if (t.kind === 0) { h = mix(h, t.x); h = mix(h, t.y); }
    else { h = mix(h, t.len); for (let i = 0; i < t.n; i += 7) { h = mix(h, t.xs[i]); h = mix(h, t.ys[i]); } }
  }
  return h >>> 0;
}
