import { COLS, ROWS, TS, LIVE_W, LIVE_H, T_EMPTY, T_SOLID, T_STATIC, T_DRUM } from './constants.ts';
import type { Room, RoomJson, Rect } from './types.ts';

const DIRS: Record<string, [number, number]> = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };

export function tileRect(x: number, y: number, w: number, h: number): Rect {
  return { x: x * TS, y: y * TS, w: w * TS, h: h * TS };
}

export function loadRoom(json: RoomJson): Room {
  const tiles = new Uint8Array(COLS * ROWS);
  const mutes: Rect[] = [];
  let sx = 1;
  let sy = 1;
  let ox = 0;
  let oy = 0;
  for (let y = 0; y < ROWS; y++) {
    const row = json.grid[y] ?? '';
    for (let x = 0; x < COLS; x++) {
      const c = row[x] ?? '.';
      let t = T_EMPTY;
      if (c === '#') t = T_SOLID;
      else if (c === 'x') t = T_STATIC;
      else if (c === '=') t = T_DRUM;
      else if (c === 'S') { sx = x; sy = y; }
      else if (c === 'O') { ox = x; oy = y; }
      else if (c === 'm') mutes.push(tileRect(x, y, 1, 1));
      tiles[y * COLS + x] = t;
    }
  }
  mutes.push(tileRect(sx, sy - 1, 2, 2));
  const switches: Rect[] = [];
  const switchIds: string[] = [];
  const gates: Room['gates'] = [];
  const beams: Room['beams'] = [];
  for (const e of json.entities) {
    if (e.t === 'switch') {
      switches.push(tileRect(e.x, e.y, e.w, e.h));
      switchIds.push(e.id);
    }
  }
  for (const e of json.entities) {
    if (e.t === 'gate') {
      gates.push({ r: tileRect(e.x, e.y, e.w, e.h), any: e.open !== 'all', by: e.by.map((id) => switchIds.indexOf(id)) });
    } else if (e.t === 'beam') {
      const [dx, dy] = DIRS[e.dir];
      beams.push({ ex: e.x, ey: e.y, dx, dy, on: e.on ?? 0, off: e.off ?? 0, phase: e.phase ?? 0 });
    }
  }
  return {
    json,
    tiles,
    spawnX: (sx + 1) * TS - (LIVE_W >> 1),
    spawnY: (sy + 1) * TS - LIVE_H,
    out: tileRect(ox, oy - 1, 1, 2),
    mutes,
    switches,
    switchIds,
    gates,
    beams,
    timed: beams.some((b) => b.on > 0),
  };
}

export function tileAt(room: Room, cx: number, cy: number): number {
  if (cx < 0 || cx >= COLS || cy < 0) return T_SOLID;
  if (cy >= ROWS) return T_EMPTY;
  return room.tiles[cy * COLS + cx];
}

