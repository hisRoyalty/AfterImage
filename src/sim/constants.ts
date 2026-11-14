// All sim values are integers. Positions in 1/256 px, speeds per tick, accelerations per tick².
export const SUB = 256;
export const TILE = 20;
export const TS = TILE * SUB;
export const COLS = 32;
export const ROWS = 18;
export const ROOM_W = COLS * TS;
export const ROOM_H = ROWS * TS;
export const BEAT = 30;
export const TAKE_MAX = 40 * BEAT;
export const MAX_TRACKS = 4;
export const LIVE_W = 18 * SUB;
export const LIVE_H = 20 * SUB;
export const HAZARD_INSET = 3 * SUB;
export const LOOP_TOP_PAD = 3 * SUB;

export interface Tuning {
  run: number;
  accG: number;
  stopG: number;
  accA: number;
  stopA: number;
  jump: number;
  gUp: number;
  gDown: number;
  hangV: number;
  cutV: number;
  cutMin: number;
  maxFall: number;
  bounceMul: number; // out of 256
  coyote: number;
  buffer: number;
}

export const TUNING: Tuning = {
  run: 461,
  accG: 77,
  stopG: 154,
  accA: 50,
  stopA: 38,
  jump: 1280,
  gUp: 61,
  gDown: 107,
  hangV: 128,
  cutV: 427,
  cutMin: 5,
  maxFall: 2560,
  bounceMul: 197,
  coyote: 5,
  buffer: 6,
};

export function assistTuning(base: Tuning): Tuning {
  return { ...base, coyote: 9, buffer: 9 };
}

// Input bits. Held: L R J WAIT. Pulses (one tick): JP and the commands.
export const IN_L = 1;
export const IN_R = 2;
export const IN_J = 4;
export const IN_JP = 8;
export const IN_WAIT = 16;
export const IN_DRONE = 32;
export const IN_LOOP = 64;
export const IN_ERASE = 128;
export const IN_RETRY = 256;
export const IN_WIPE = 512;
export const IN_START = IN_L | IN_R | IN_JP | IN_WAIT;
export const IN_MOVE = IN_L | IN_R | IN_J | IN_JP | IN_WAIT;

// Tile codes
export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_STATIC = 2;
export const T_DRUM = 3;
