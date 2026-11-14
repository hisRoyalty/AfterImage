import type { RoomJson } from '../sim/types.ts';

const mods = import.meta.glob<RoomJson>('./r*.json', { eager: true, import: 'default' });

export const ROOMS: RoomJson[] = Object.keys(mods).sort().map((k) => mods[k]);

export function roomIndex(id: string): number {
  return ROOMS.findIndex((r) => r.id === id);
}
