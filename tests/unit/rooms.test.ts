import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { validateRoom } from '../../src/rooms/validate.ts';
import type { RoomJson, Solution } from '../../src/sim/types.ts';

const dir = join(process.cwd(), 'src', 'rooms');
const ids = readdirSync(dir).filter((f) => /^r\d\d\.json$/.test(f)).map((f) => f.slice(0, 3));

describe('rooms', () => {
  for (const id of ids) {
    it(`${id} is valid and its witness clears at par, twice the same`, () => {
      const json = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as RoomJson;
      expect(validateRoom(json)).toEqual([]);
      const p = join(process.cwd(), 'solutions', `${id}.par.json`);
      expect(existsSync(p)).toBe(true);
      const sol = JSON.parse(readFileSync(p, 'utf8')) as Solution;
      const a = replay(loadRoom(json), sol.takes, undefined, 30);
      const b = replay(loadRoom(json), sol.takes, undefined, 30);
      expect(a.error).toBeNull();
      expect(a.cleared).toBe(true);
      expect(a.session.tracks.length).toBe(json.par.drones + json.par.loops);
      expect(b.hashes).toEqual(a.hashes);
    });
  }
});
