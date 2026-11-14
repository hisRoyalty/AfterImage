export interface Rect { x: number; y: number; w: number; h: number }

export type EntityJson =
  | { t: 'switch'; id: string; x: number; y: number; w: number; h: number }
  | { t: 'gate'; x: number; y: number; w: number; h: number; open: 'any' | 'all'; by: string[] }
  | { t: 'beam'; x: number; y: number; dir: 'E' | 'W' | 'N' | 'S'; on?: number; off?: number; phase?: number };

export interface RoomJson {
  id: string;
  name: string;
  chapter: number;
  tracks: number;
  par: { drones: number; loops: number };
  note: number;
  grid: string[];
  entities: EntityJson[];
  hints: string[];
  loops?: boolean;
  dark?: number; // light radius in px for the night chapter (render only)
}

export interface Gate { r: Rect; any: boolean; by: number[] }
export interface Beam { ex: number; ey: number; dx: number; dy: number; on: number; off: number; phase: number }

export interface Room {
  json: RoomJson;
  tiles: Uint8Array;
  spawnX: number;
  spawnY: number;
  out: Rect;
  mutes: Rect[];
  switches: Rect[];
  switchIds: string[];
  gates: Gate[];
  beams: Beam[];
  timed: boolean;
  loopsOk: boolean;
}

export interface Drone { kind: 0; x: number; y: number }
export interface Loop {
  kind: 1;
  xs: Int32Array;
  ys: Int32Array;
  n: number;
  len: number;
  notes: number[]; // pairs: tick, event code
}
export type Self = Drone | Loop;

export type End = 'drone' | 'loop' | 'erase' | 'retry' | 'wipe' | 'death' | 'tape' | 'out';
export interface TakeLog { i: number[]; e: End; k?: 1 }
export interface Solution { room: string; takes: TakeLog[] }

export interface Live {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  coyote: number;
  buf: number;
  jumpT: number;
  bouncing: boolean;
  face: number;
}
