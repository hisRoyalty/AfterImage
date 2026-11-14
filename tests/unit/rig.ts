import { loadRoom } from '../../src/sim/room.ts';
import { newSession, step } from '../../src/sim/step.ts';
import type { Session } from '../../src/sim/step.ts';
import { TUNING } from '../../src/sim/constants.ts';
import type { Tuning } from '../../src/sim/constants.ts';
import type { RoomJson, EntityJson } from '../../src/sim/types.ts';

// Builds a 32x18 room from a sparse list of rows (y -> string); unspecified rows are empty with side walls.
export function makeRoom(rows: Record<number, string>, entities: EntityJson[] = [], tracks = 4): RoomJson {
  const grid: string[] = [];
  for (let y = 0; y < 18; y++) grid.push((rows[y] ?? '#' + '.'.repeat(30) + '#').padEnd(32, '.').slice(0, 32));
  return { id: 'rt', name: 'rig', chapter: 1, tracks, par: { drones: 0, loops: 0 }, note: 60, grid, entities, hints: ['a', 'b', 'c'] };
}

export function session(json: RoomJson, tun: Tuning = TUNING): Session {
  return newSession(loadRoom(json), tun);
}

export function run(s: Session, mask: number, n: number, each?: (s: Session) => void): void {
  for (let i = 0; i < n; i++) { step(s, mask); each?.(s); }
}

export const FLOOR = '#'.repeat(32);
