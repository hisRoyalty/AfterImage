// Attract mode for the title: a flat stage and a scripted session run through the real sim.
// The Live prints a Drone, records a Loop over it, then chases that Loop and wipes the reel.
import type { RoomJson } from '../sim/types.ts';

const row = (s: string) => s.padEnd(32, '.');

export const ATTRACT_ROOM: RoomJson = {
  id: 'r00', name: 'Attract', chapter: 2, tracks: 3, par: { drones: 0, loops: 0 }, note: 62, loops: true, hints: ['', '', ''], entities: [],
  grid: [row(''), row('.'.repeat(31) + 'O'), ...Array.from({ length: 14 }, () => row('')), row('..S'), '#'.repeat(32)],
};

// Run-length pairs (mask, ticks). 1 left, 2 right, 4 jump held, 8 jump pressed, 16 wait, 32 Drone, 64 Loop, 512 wipe.
export const ATTRACT_SCRIPT: number[] = [
  2, 60, 0, 12, 32, 1,
  2, 42, 14, 1, 6, 24, 2, 115, 0, 60, 64, 1,
  16, 20, 2, 42, 14, 1, 6, 24, 2, 82, 14, 1, 6, 24, 2, 100, 0, 45, 1, 30, 0, 75, 512, 1,
];
