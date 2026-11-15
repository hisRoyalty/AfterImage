import * as E from '../sim/events.ts';
import { PH_RUN, PH_COUNTIN } from '../sim/step.ts';
import type { Session } from '../sim/step.ts';
import { SUB, LIVE_H, LIVE_W } from '../sim/constants.ts';
import { load, save } from './save.ts';
import type { Action } from './input.ts';
import { TUT } from './strings.ts';

export interface Cue { id: string; actions: Action[]; label: string; x: number; y: number }

// Prompts that are nice to know but not needed to progress: they retire after being on screen this long.
const OPTIONAL_MS = 9000;
const OPTIONAL = new Set(['retry', 'wipe', 'ff', 'erase']);

// Teaches each key the first time it matters. A step is done when the player does the thing; done steps are saved.
export class Tutorial {
  private id: string;
  private chapter: number;
  private idle = 0;
  private shown: Record<string, number> = {};

  constructor(roomId: string, chapter: number) {
    this.id = roomId;
    this.chapter = chapter;
  }

  private done(id: string): boolean {
    return load().tutorial.includes(id);
  }

  private mark(id: string): void {
    if (this.done(id)) return;
    load().tutorial.push(id);
    save();
  }

  events(s: Session, ev: number[]): void {
    for (const e of ev) {
      const c = E.evCode(e);
      if (c === E.EV_JUMP) this.mark('jump');
      else if (c === E.EV_DRONE) { this.mark('drone'); if (s.tracks.length >= 2) this.mark('stack'); }
      else if (c === E.EV_LOOP) this.mark('loop');
      else if (c === E.EV_KEEP) this.mark('keep');
      else if (c === E.EV_ERASE) this.mark('erase');
      else if (c === E.EV_RETRY) this.mark('retry');
      else if (c === E.EV_WIPE) this.mark('wipe');
      else if (c === E.EV_CLEAR) {
        if (this.id === 'r04') this.mark('erase');
        if (this.id === 'r08') this.mark('wait');
      }
    }
  }

  // stuck: takes since the last new track. Returns the prompt to show now, if any.
  update(s: Session, dt: number, ff: boolean, stuck: number): Cue | null {
    if (!load().settings.tutorial) return null;
    const lv = s.live;
    const lx = lv.x / SUB + 9, ly = lv.y / SUB;
    const running = s.phase === PH_RUN;
    const onDrone = lv.ground && s.drones.some((d) => d.y === lv.y + LIVE_H && d.x < lv.x + LIVE_W && d.x + LIVE_W > lv.x);
    if (Math.abs(lv.x - s.room.spawnX) > 24 * SUB) this.mark('move');
    if (onDrone) this.mark('stand');
    if (ff) this.mark('ff');
    if (this.id === 'r08' && running && s.t > 20 && lv.x === s.room.spawnX) this.mark('wait');
    this.idle = running && lv.ground && lv.vx === 0 ? this.idle + dt : 0;
    const cue = this.pick(s, lx, ly, running, onDrone, stuck);
    if (cue && OPTIONAL.has(cue.id)) {
      this.shown[cue.id] = (this.shown[cue.id] ?? 0) + dt;
      if (this.shown[cue.id] > OPTIONAL_MS) this.mark(cue.id);
    }
    return cue;
  }

  private pick(s: Session, lx: number, ly: number, running: boolean, onDrone: boolean, stuck: number): Cue | null {
    const id = this.id;
    const above = (cid: string, actions: Action[], label: string): Cue => ({ id: cid, actions, label, x: lx, y: ly - 16 });
    const todo = (cid: string) => !this.done(cid);
    if (id === 'r01') {
      if (todo('move')) return above('move', ['left', 'right'], TUT.move);
      if (todo('jump')) return above('jump', ['jump'], TUT.jump);
      if (todo('drone') && s.tracks.length === 0) return running && s.live.ground && (lx > 330 || s.t > 240) ? above('drone', ['drone'], TUT.drone) : null;
      if (todo('stand') && s.drones.length) return { id: 'stand', actions: ['jump'], label: TUT.stand, x: s.drones[0].x / SUB + 9, y: s.drones[0].y / SUB - 16 };
    }
    if (id === 'r02' && todo('stack') && s.tracks.length === 1 && onDrone) return above('stack', ['drone'], TUT.stack);
    if (id === 'r04' && todo('erase') && s.tracks.length >= 1 && stuck >= 1) return above('erase', ['erase'], TUT.erase);
    if (id === 'r07') {
      if (todo('loop') && s.tracks.length === 0 && running && s.t >= 60 && (s.pressed[0] === 1 || s.t > 240)) return above('loop', ['loop'], TUT.loop);
      if (todo('ff') && s.loops.length > 0 && running && this.idle > 1500) return above('ff', ['ff'], TUT.ff);
    }
    if (id === 'r08' && todo('wait') && s.tracks.length === 0 && s.phase === PH_COUNTIN) return above('wait', ['wait'], TUT.wait);
    if (id === 'r09' && todo('keep') && s.tracks.length === 0 && s.phase === PH_COUNTIN && s.dead) return above('keep', ['loop'], TUT.keep);
    if (this.chapter <= 2 && todo('retry') && running && s.t > 600) return above('retry', ['retry'], TUT.retry);
    if (todo('wipe') && s.tracks.length >= 2 && stuck >= 4 && s.phase === PH_COUNTIN) return above('wipe', ['retry'], TUT.wipe);
    return null;
  }
}

export function replayTutorial(): void {
  load().tutorial = [];
  save();
}
