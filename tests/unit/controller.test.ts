import { describe, it, expect } from 'vitest';
import { makeRoom, session, run, FLOOR } from './rig.ts';
import { IN_J, IN_JP, IN_R, IN_WAIT, SUB } from '../../src/sim/constants.ts';
import { EV_BOUNCE, evCode } from '../../src/sim/events.ts';
import type { Session } from '../../src/sim/step.ts';

const flat = { 15: '#S' + '.'.repeat(29) + '#', 16: FLOOR, 17: FLOOR };
const px = (v: number) => v / SUB;

function jump(hold: number) {
  const s = session(makeRoom(flat));
  run(s, IN_WAIT, 2);
  const y0 = s.live.y;
  let minY = y0, air = 0, apex = 0;
  for (let i = 0; i < 200; i++) {
    run(s, IN_WAIT | (i === 0 ? IN_J | IN_JP : i < hold ? IN_J : 0), 1);
    if (s.live.y < minY) { minY = s.live.y; apex = i + 1; }
    if (!s.live.ground) air++;
    else if (air) break;
  }
  return { h: px(y0 - minY), air, apex };
}

// Deck k tiles above a floor drumhead; full jump off the deck to the right.
function bounceFrom(k: number) {
  const rows: Record<number, string> = { 16: '#'.repeat(4) + '='.repeat(22) + '#'.repeat(6), 17: FLOOR };
  for (let r = 16 - k; r < 16; r++) rows[r] = '####' + '.'.repeat(27) + '#';
  rows[15 - k] = '#S' + '.'.repeat(29) + '#';
  const s = session(makeRoom(rows));
  let bounced = false, best = 1e9;
  for (let i = 0; i < 600; i++) {
    run(s, IN_R | IN_J | (i === 0 ? IN_JP : 0), 1);
    if (s.ev.some((e) => evCode(e) === EV_BOUNCE)) {
      if (bounced) break;
      bounced = true;
    }
    if (bounced) best = Math.min(best, s.live.y);
  }
  return bounced ? 16 * 20 - px(best) - 20 : -1;
}

function gapReach(): number {
  // Largest bare gap crossed from a running edge takeoff with coyote.
  let ok = 0;
  for (let g = 3; g <= 6; g++) if (crosses(g * 20)) ok = g * 20;
  return ok;
}

function crosses(gapPx: number): boolean {
  for (let delay = 0; delay <= 6; delay++) {
    const s: Session = session(makeRoom(flat));
    const far = 200 + gapPx;
    for (let c = 0; c < 32; c++) s.room.tiles[16 * 32 + c] = c * 20 < 200 || c * 20 >= far ? 1 : 0;
    s.room.tiles.fill(0, 17 * 32, 18 * 32);
    let airT = 0;
    let jumped = false;
    for (let i = 0; i < 300; i++) {
      let m = IN_R;
      if (!s.live.ground && !jumped) airT++;
      if (!jumped && (airT > delay || (delay === 0 && s.live.x + 18 * SUB >= 200 * SUB + 17 * SUB))) { m |= IN_JP; jumped = true; }
      if (jumped) m |= IN_J;
      run(s, m, 1);
      if (s.phase === 0) break;
      if (jumped && s.live.ground && s.live.x + 18 * SUB > far * SUB) return true;
    }
  }
  return false;
}

describe('controller (DESIGN section 3)', () => {
  it('full jump: about 50 px and 40 ticks in the air', () => {
    const j = jump(999);
    expect(j.h).toBeGreaterThanOrEqual(49);
    expect(j.h).toBeLessThanOrEqual(52);
    expect(j.air).toBeGreaterThanOrEqual(38);
    expect(j.air).toBeLessThanOrEqual(42);
    expect(j.apex).toBeGreaterThanOrEqual(21);
    expect(j.apex).toBeLessThanOrEqual(24);
  });
  it('tap jump: about 24 px', () => {
    const j = jump(1);
    expect(j.h).toBeGreaterThanOrEqual(22);
    expect(j.h).toBeLessThanOrEqual(26);
  });
  it('2-tile wall clears, 3-tile does not', () => {
    expect(jump(999).h).toBeGreaterThan(40 + 6);
    expect(jump(999).h).toBeLessThan(60 - 6);
  });
  it('run reaches 108 px/s in 6 ticks', () => {
    const s = session(makeRoom(flat));
    const v: number[] = [];
    run(s, IN_R, 6, (s) => v.push(s.live.vx));
    expect(v[4]).toBeLessThan(461);
    expect(v[5]).toBe(461);
  });
  it('bounce heights follow the drop', () => {
    const h = [0, 1, 2, 3, 4, 6].map(bounceFrom);
    console.log('bounce', h.map((v) => v.toFixed(1)).join(' / '));
    const want = [53, 67, 92, 110, 120, 120];
    h.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThanOrEqual(6));
    h.forEach((v) => expect(v).toBeLessThanOrEqual(121));
  });
  it('bare gap: 4 tiles crossable, 5 not', () => {
    const g = gapReach();
    console.log('gap', g);
    expect(g).toBe(80);
  });
});
