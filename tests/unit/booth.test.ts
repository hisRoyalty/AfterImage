import { describe, it, expect } from 'vitest';
import { Booth } from '../../src/narrator/booth.ts';
import { makeRoom, session } from './rig.ts';
import { EV_START, EV_DRONE, EV_DEATH, EV_CLEAR, ev, DIE_STATIC } from '../../src/sim/events.ts';

describe('Booth', () => {
  it('speaks once per take, respects cooldown, never repeats', () => {
    const said: string[] = [];
    const b = new Booth('r01', 1, [], (t) => said.push(t));
    const s = session(makeRoom({ 15: '#S' + '.'.repeat(29) + '#', 16: '#'.repeat(32), 17: '#'.repeat(32) }));
    b.events(s, [EV_START], 0);
    b.events(s, [EV_DRONE], 100);
    b.update(16, false, true);
    expect(said).toEqual(['That is bleed on track one. Fine. Use it.']);
    b.events(s, [ev(EV_DEATH, DIE_STATIC)], 200);
    b.update(16, false, true);
    expect(said.length).toBe(1); // cooldown and one line per take
    b.update(12000, false, true);
    b.events(s, [EV_START], 0);
    b.events(s, [EV_DRONE], 100);
    b.update(16, false, true);
    expect(new Set(said).size).toBe(said.length);
  });
  it('stays silent in R30 until the Out', () => {
    const said: string[] = [];
    const b = new Booth('r30', 5, [], (t) => said.push(t));
    const s = session(makeRoom({ 15: '#S' + '.'.repeat(29) + '#', 16: '#'.repeat(32), 17: '#'.repeat(32) }));
    b.enter();
    b.events(s, [ev(EV_DEATH, DIE_STATIC)], 200);
    b.update(20000, false, true);
    expect(said).toEqual([]);
    b.events(s, [EV_CLEAR], 300);
    b.update(16, false, false);
    expect(said[0]).toMatch(/erase head/);
  });
});
