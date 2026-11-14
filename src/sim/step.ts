import {
  BEAT, TAKE_MAX, LIVE_W, LIVE_H, ROOM_H, HAZARD_INSET, TUNING,
  IN_START, IN_DRONE, IN_LOOP, IN_ERASE, IN_RETRY, IN_WIPE,
} from './constants.ts';
import type { Tuning } from './constants.ts';
import { overlap, onStatic } from './collide.ts';
import type { World } from './collide.ts';
import { newLive, stepLive } from './live.ts';
import type { LoopBoxes } from './live.ts';
import { updateSwitches, updateGates, beamOn, beamRect, hitBeam } from './objects.ts';
import { makeLoop, newLoopBoxes, placeLoops } from './selves.ts';
import { encode } from './rle.ts';
import * as E from './events.ts';
import type { Room, Self, Drone, Loop, Live, TakeLog, End } from './types.ts';

export const PH_COUNTIN = 0;
export const PH_RUN = 1;
export const PH_CLEAR = 2;

export interface DeadTake { xs: Int32Array; ys: Int32Array; n: number; notes: number[]; log: TakeLog }

export interface Session {
  room: Room;
  tun: Tuning;
  cap: number;
  tracks: Self[];
  logs: TakeLog[];
  drones: Drone[];
  loops: Loop[];
  world: World;
  phase: number;
  t: number;
  live: Live;
  pressed: Uint8Array;
  gateOpen: Uint8Array;
  beamLive: Uint8Array;
  beamSeg: Int32Array;
  lb: LoopBoxes;
  recX: Int32Array;
  recY: Int32Array;
  recIn: number[];
  notes: number[];
  dead: DeadTake | null;
  ev: number[];
  takes: number;
  lastEnd: End | null;
  clearLog: TakeLog | null;
}

export function newSession(room: Room, tun: Tuning = TUNING, extraTracks = 0): Session {
  const drones: Drone[] = [];
  const gateOpen = new Uint8Array(room.gates.length);
  const s: Session = {
    room, tun, cap: Math.min(4, room.json.tracks + extraTracks), tracks: [], logs: [], drones, loops: [],
    world: { room, gateOpen, drones }, phase: PH_COUNTIN, t: 0, live: newLive(room),
    pressed: new Uint8Array(room.switches.length), gateOpen, beamLive: new Uint8Array(room.beams.length),
    beamSeg: new Int32Array(room.beams.length * 4), lb: newLoopBoxes(),
    recX: new Int32Array(TAKE_MAX + 1), recY: new Int32Array(TAKE_MAX + 1), recIn: [], notes: [],
    dead: null, ev: [], takes: 0, lastEnd: null, clearLog: null,
  };
  resetTake(s);
  return s;
}

function syncSelves(s: Session): void {
  s.drones.length = 0;
  s.loops.length = 0;
  for (const t of s.tracks) {
    if (t.kind === 0) s.drones.push(t);
    else s.loops.push(t);
  }
}

export function resetTake(s: Session): void {
  syncSelves(s);
  s.live = newLive(s.room);
  s.phase = PH_COUNTIN;
  s.t = 0;
  s.recIn = [];
  s.notes = [];
  placeLoops(s.loops, 0, false, s.lb);
  updateSwitches(s.room, s.live.x, s.live.y, s.drones, s.lb, s.pressed, null);
  updateGates(s.room, s.pressed, s.gateOpen, s.live.x, s.live.y, s.drones, true, null);
  updateBeams(s);
}

function updateBeams(s: Session): void {
  const { room } = s;
  for (let i = 0; i < room.beams.length; i++) {
    s.beamLive[i] = beamOn(room.beams[i], s.t) ? 1 : 0;
    beamRect(room, room.beams[i], s.gateOpen, s.drones, s.lb, s.beamSeg, i * 4);
  }
}

export function inMute(s: Session): boolean {
  for (const m of s.room.mutes) if (overlap(s.live.x, s.live.y, LIVE_W, LIVE_H, m)) return true;
  return false;
}

// Steps 2-8 of the tick. Returns 0 to continue, 1 death, 2 clear. Death cause lands in s.ev.
export function tick(s: Session, input: number): number {
  const { room, live, ev } = s;
  placeLoops(s.loops, s.t, true, s.lb);
  updateSwitches(room, live.x, live.y, s.drones, s.lb, s.pressed, ev);
  updateGates(room, s.pressed, s.gateOpen, live.x, live.y, s.drones, false, ev);
  updateBeams(s);
  stepLive(live, input, s.tun, s.world, s.lb, ev);
  if (onStatic(room, live.x, live.y)) { ev.push(E.ev(E.EV_DEATH, E.DIE_STATIC)); return 1; }
  const ix = live.x + HAZARD_INSET;
  const iy = live.y + HAZARD_INSET;
  const iw = LIVE_W - 2 * HAZARD_INSET;
  const ih = LIVE_H - 2 * HAZARD_INSET;
  for (let i = 0; i < room.beams.length; i++) {
    if (s.beamLive[i] && hitBeam(s.beamSeg, i * 4, ix, iy, iw, ih)) { ev.push(E.ev(E.EV_DEATH, E.DIE_BEAM)); return 1; }
  }
  if (live.y >= ROOM_H) { ev.push(E.ev(E.EV_DEATH, E.DIE_PIT)); return 1; }
  if (overlap(live.x, live.y, LIVE_W, LIVE_H, room.out)) return 2;
  return 0;
}

function endTake(s: Session, end: End): void {
  s.lastEnd = end;
  s.takes++;
  resetTake(s);
}

function takeLog(s: Session, e: End): TakeLog {
  return { i: encode(s.recIn), e };
}

function free(s: Session): boolean {
  return s.tracks.length < s.cap;
}

function countIn(s: Session, input: number): boolean {
  const { ev } = s;
  if (input & IN_LOOP) {
    if (s.dead && free(s)) {
      const d = s.dead;
      s.tracks.push(makeLoop(d.xs, d.ys, d.n, d.notes));
      s.logs.push({ ...d.log, k: 1 });
      s.dead = null;
      ev.push(E.EV_KEEP);
      resetTake(s);
    } else ev.push(E.EV_REFUSE);
  } else if (input & IN_ERASE) {
    if (s.tracks.length) { s.tracks.pop(); s.logs.pop(); ev.push(E.EV_ERASE); resetTake(s); }
    else ev.push(E.EV_REFUSE);
  } else if (input & IN_WIPE) {
    if (s.tracks.length) { s.tracks.length = 0; s.logs.length = 0; ev.push(E.EV_WIPE); resetTake(s); }
  } else if (input & IN_DRONE) ev.push(E.EV_REFUSE);
  if (!(input & IN_START)) return false;
  s.phase = PH_RUN;
  s.dead = null;
  ev.push(E.EV_START);
  return true;
}

// Commands at step 1 of a running tick. Returns true if the take ended.
function command(s: Session, input: number): boolean {
  const { ev, live } = s;
  if (input & IN_WIPE) {
    s.tracks.length = 0; s.logs.length = 0; ev.push(E.EV_WIPE); endTake(s, 'wipe'); return true;
  }
  if (input & IN_RETRY) { ev.push(E.EV_RETRY); endTake(s, 'retry'); return true; }
  if (input & IN_ERASE) {
    if (s.tracks.length) { s.tracks.pop(); s.logs.pop(); }
    ev.push(E.EV_ERASE); endTake(s, 'erase'); return true;
  }
  if (input & IN_DRONE) {
    if (live.ground && !inMute(s) && free(s)) {
      s.tracks.push({ kind: 0, x: live.x, y: live.y });
      s.logs.push(takeLog(s, 'drone'));
      ev.push(E.EV_DRONE);
      endTake(s, 'drone');
      return true;
    }
    ev.push(E.EV_REFUSE);
  } else if (input & IN_LOOP) {
    if (s.t >= BEAT && !inMute(s) && free(s)) {
      s.tracks.push(makeLoop(s.recX, s.recY, s.t, s.notes));
      s.logs.push(takeLog(s, 'loop'));
      ev.push(E.EV_LOOP);
      endTake(s, 'loop');
      return true;
    }
    ev.push(E.EV_REFUSE);
  }
  return false;
}

const NOTE_EVENTS = new Set([E.EV_JUMP, E.EV_LAND, E.EV_HARDLAND, E.EV_BOUNCE, E.EV_SW_ON]);

export function step(s: Session, input: number): void {
  s.ev.length = 0;
  if (s.phase === PH_CLEAR) return;
  if (s.phase === PH_COUNTIN && !countIn(s, input)) return;
  s.recIn.push(input);
  if (command(s, input)) return;
  const res = tick(s, input);
  const t = s.t;
  s.recX[t] = s.live.x;
  s.recY[t] = s.live.y;
  for (const e of s.ev) if (NOTE_EVENTS.has(E.evCode(e))) s.notes.push(t, E.evCode(e));
  if (res === 1) return die(s, 'death');
  if (res === 2) {
    s.phase = PH_CLEAR;
    s.clearLog = takeLog(s, 'out');
    s.ev.push(E.EV_CLEAR);
    return;
  }
  s.t = t + 1;
  if (s.t >= TAKE_MAX) {
    s.ev.push(E.ev(E.EV_TAPE, E.DIE_TAPE));
    die(s, 'tape');
  }
}

function die(s: Session, e: End): void {
  const n = s.t + (e === 'death' ? 1 : 0);
  s.dead = { xs: s.recX.slice(0, n), ys: s.recY.slice(0, n), n, notes: s.notes.slice(), log: takeLog(s, e) };
  endTake(s, e);
}
