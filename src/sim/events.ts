export const EV_START = 1;
export const EV_JUMP = 2;
export const EV_LAND = 3;
export const EV_HARDLAND = 4;
export const EV_BOUNCE = 5;
export const EV_DRONE = 6;
export const EV_LOOP = 7;
export const EV_KEEP = 8;
export const EV_ERASE = 9;
export const EV_WIPE = 10;
export const EV_RETRY = 11;
export const EV_REFUSE = 12;
export const EV_SW_ON = 13;
export const EV_SW_OFF = 14;
export const EV_GATE_OPEN = 15;
export const EV_GATE_CLOSE = 16;
export const EV_DEATH = 17;
export const EV_TAPE = 18;
export const EV_CLEAR = 19;

export const DIE_STATIC = 0;
export const DIE_BEAM = 1;
export const DIE_PIT = 2;
export const DIE_TAPE = 3;

export const ev = (code: number, arg = 0) => code | (arg << 8);
export const evCode = (e: number) => e & 255;
export const evArg = (e: number) => e >> 8;
