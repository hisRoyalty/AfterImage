import type { RoomJson } from '../sim/types.ts';

const mods = import.meta.glob<RoomJson>('./r*.json', { eager: true, import: 'default' });

export const ROOMS: RoomJson[] = Object.keys(mods).sort().map((k) => mods[k]);

// Chapters I-V tell the story and end with the Mixdown; chapter VI is the night post-game.
export const MAIN = ROOMS.filter((r) => r.chapter <= 5);

export function roomIndex(id: string): number {
  return ROOMS.findIndex((r) => r.id === id);
}
