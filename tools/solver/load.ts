import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RoomJson, Solution } from '../../src/sim/types.ts';

export const ROOT = process.cwd();
export const roomPath = (id: string) => join(ROOT, 'src', 'rooms', `${id}.json`);
export const solPath = (id: string) => join(ROOT, 'solutions', `${id}.par.json`);
export const planPath = (id: string) => join(ROOT, 'tools', 'solver', 'plans', `${id}.json`);

export function loadJson(id: string): RoomJson {
  return JSON.parse(readFileSync(roomPath(id), 'utf8')) as RoomJson;
}

export function loadSolution(id: string): Solution | null {
  const p = solPath(id);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Solution) : null;
}

export function allRoomIds(): string[] {
  return readdirSync(join(ROOT, 'src', 'rooms')).filter((f) => /^r\d\d\.json$/.test(f)).map((f) => f.slice(0, 3)).sort();
}
