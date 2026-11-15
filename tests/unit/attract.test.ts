import { describe, it, expect } from 'vitest';
import { ATTRACT_ROOM, ATTRACT_SCRIPT } from '../../src/scenes/attractClip.ts';
import { loadRoom } from '../../src/sim/room.ts';
import { newSession, step, PH_CLEAR } from '../../src/sim/step.ts';
import { decode } from '../../src/sim/rle.ts';
import { validateRoom } from '../../src/rooms/validate.ts';
import * as E from '../../src/sim/events.ts';

describe('title attract clip', () => {
  it('prints a Drone, records a Loop, bounces, wipes, and repeats the same motion', () => {
    expect(validateRoom(ATTRACT_ROOM)).toEqual([]);
    const s = newSession(loadRoom(ATTRACT_ROOM));
    const m = decode(ATTRACT_SCRIPT);
    const seen = new Set<number>();
    const hashes: string[][] = [[], []];
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < m.length; i++) {
        step(s, m[i]);
        for (const e of s.ev) seen.add(E.evCode(e));
        expect(s.phase).not.toBe(PH_CLEAR);
        if (pass === 0 && i === 73) expect(s.tracks.map((t) => t.kind)).toEqual([0]);
        if (pass === 0 && i === 316) expect(s.tracks.map((t) => t.kind)).toEqual([0, 1]);
        hashes[pass].push(`${s.live.x},${s.live.y},${s.tracks.length}`);
      }
      expect(s.tracks.length).toBe(0);
    }
    expect(seen.has(E.EV_BOUNCE)).toBe(true);
    expect(seen.has(E.EV_DEATH)).toBe(false);
    expect(hashes[1]).toEqual(hashes[0]);
  });
});
