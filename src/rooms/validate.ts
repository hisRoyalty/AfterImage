import { COLS, ROWS } from '../sim/constants.ts';
import type { RoomJson } from '../sim/types.ts';
import { THEME_NAMES } from './themes.ts';

const LEGAL = new Set(['#', '.', 'S', 'O', 'x', '=', 'm']);

export function validateRoom(r: RoomJson): string[] {
  const err: string[] = [];
  const at = (x: number, y: number) => (y < 0 || y >= ROWS || x < 0 || x >= COLS ? '#' : r.grid[y][x]);
  if (!/^r\d\d$/.test(r.id)) err.push('bad id');
  if (!r.name) err.push('missing name');
  if (!(r.chapter >= 1 && r.chapter <= 6)) err.push('chapter out of range');
  if (!(r.tracks >= 0 && r.tracks <= 4)) err.push('tracks out of range');
  if (r.par.drones + r.par.loops > r.tracks) err.push('par exceeds tracks');
  if (!Number.isInteger(r.note)) err.push('note must be an integer');
  if (r.hints?.length !== 3) err.push('need 3 hints');
  if (r.theme !== undefined && !THEME_NAMES.includes(r.theme)) err.push(`unknown theme ${r.theme}`);
  if (r.grid.length !== ROWS) err.push(`grid has ${r.grid.length} rows`);
  let spawns = 0;
  let outs = 0;
  r.grid.forEach((row, y) => {
    if (row.length !== COLS) err.push(`row ${y} has ${row.length} chars`);
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!LEGAL.has(c)) err.push(`bad char ${c} at ${x},${y}`);
      if (c === 'S') {
        spawns++;
        if (at(x + 1, y) !== '.') err.push('spawn pad needs an empty tile to its right');
        if (at(x, y + 1) !== '#' || at(x + 1, y + 1) !== '#') err.push('spawn pad needs solid floor');
      }
      if (c === 'O') {
        outs++;
        if (at(x, y - 1) !== '.') err.push('Out needs an empty tile above');
      }
    }
  });
  if (spawns !== 1) err.push(`${spawns} spawns`);
  if (outs !== 1) err.push(`${outs} Outs`);
  const ids = new Set<string>();
  const inBounds = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= COLS && y + h <= ROWS;
  for (const e of r.entities) {
    if (e.t === 'switch') {
      if (ids.has(e.id)) err.push(`duplicate switch ${e.id}`);
      ids.add(e.id);
      if (!inBounds(e.x, e.y, e.w, e.h)) err.push(`switch ${e.id} out of bounds`);
    }
  }
  for (const e of r.entities) {
    if (e.t === 'gate') {
      if (!inBounds(e.x, e.y, e.w, e.h)) err.push('gate out of bounds');
      for (const id of e.by) if (!ids.has(id)) err.push(`gate wired to missing switch ${id}`);
      for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (at(x, y) !== '.' && at(x, y) !== 'm') err.push(`gate over ${at(x, y)} at ${x},${y}`);
    } else if (e.t === 'beam') {
      if (at(e.x, e.y) !== '#') err.push(`beam emitter at ${e.x},${e.y} must sit on a solid tile`);
      if ((e.on === undefined) !== (e.off === undefined)) err.push('beam needs both on and off');
    }
  }
  return err;
}
