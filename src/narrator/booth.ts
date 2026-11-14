import * as E from '../sim/events.ts';
import { TS, LIVE_W, LIVE_H } from '../sim/constants.ts';
import type { Session } from '../sim/step.ts';
import { LINES } from './lines.ts';

const COOLDOWN = 10000;
const IDLE_MS = 20000;

// Booth: one dry line per take at most, highest event class first, never repeated in a save.
export class Booth {
  chapter: number;
  roomId: string;
  used: Set<string>;
  say: (text: string, ms: number) => void;
  private onAir = 0;
  private cooldown = 0;
  private spoke = false;
  private pending: [number, string] | null = null;
  private deathCells: number[] = [];
  private lastDeath = -1e9;
  private eraseRun = 0;
  private bounces = 0;
  private idle = 0;
  private ffSaid = false;
  private deaths = 0;
  private clock = 0;
  takesSinceProgress = 0;

  constructor(roomId: string, chapter: number, used: string[], say: (text: string, ms: number) => void) {
    this.roomId = roomId;
    this.chapter = chapter;
    this.used = new Set(used);
    this.say = say;
  }

  private silent(): boolean {
    return this.roomId === 'r30';
  }

  private want(cls: number, key: string): void {
    if (!this.pending || cls < this.pending[0]) this.pending = [cls, key];
  }

  input(): void {
    this.idle = 0;
  }

  enter(): void {
    this.want(5, 'enter');
  }

  // Feed the sim events of one tick.
  events(s: Session, ev: number[], takeTicks: number): void {
    for (const e of ev) {
      const c = E.evCode(e);
      if (c === E.EV_START) { this.spoke = false; this.bounces = 0; }
      else if (c === E.EV_DRONE) { this.want(1, 'drone1'); this.progress(s); }
      else if (c === E.EV_LOOP) { this.want(1, 'loop1'); this.progress(s); }
      else if (c === E.EV_KEEP) { this.want(1, 'keep1'); this.takesSinceProgress = 0; }
      else if (c === E.EV_BOUNCE) {
        this.want(1, 'bounce1');
        if (++this.bounces === 3) this.want(3, 'bounce3');
      } else if (c === E.EV_LAND || c === E.EV_HARDLAND) this.bounces = 0;
      else if (c === E.EV_DEATH || c === E.EV_TAPE) this.death(s, c === E.EV_TAPE ? E.DIE_TAPE : E.evArg(e), takeTicks);
      else if (c === E.EV_ERASE) { if (++this.eraseRun === 3) this.want(3, 'erase3'); }
      else if (c === E.EV_WIPE) this.want(3, 'wipe');
      else if (c === E.EV_CLEAR) this.clear(s);
      if (c === E.EV_RETRY || c === E.EV_DRONE || c === E.EV_LOOP || c === E.EV_WIPE || c === E.EV_DEATH || c === E.EV_TAPE) this.eraseRun = 0;
      if (c === E.EV_DEATH || c === E.EV_TAPE || c === E.EV_RETRY || c === E.EV_ERASE || c === E.EV_WIPE) this.takeEnded(s);
    }
  }

  private progress(s: Session): void {
    this.takesSinceProgress = 0;
    this.milestone(s);
  }

  private takeEnded(s: Session): void {
    this.takesSinceProgress++;
    this.milestone(s);
  }

  private milestone(s: Session): void {
    const n = s.takes;
    if (n === 10) this.want(4, 'takes10');
    else if (n === 25) this.want(4, 'takes25');
    else if (n === 50) this.want(4, 'takes50');
  }

  private death(s: Session, cause: number, ticks: number): void {
    this.deaths++;
    const l = s.dead;
    const x = l ? l.xs[l.n - 1] : s.live.x;
    const y = l ? l.ys[l.n - 1] : s.live.y;
    const cell = Math.floor((x + (LIVE_W >> 1)) / (2 * TS)) * 100 + Math.floor((y + (LIVE_H >> 1)) / (2 * TS));
    this.deathCells.push(cell);
    const same = this.deathCells.slice(-3).filter((c) => c === cell).length === 3;
    const now = this.clock;
    const quick = now - this.lastDeath < 2000;
    this.lastDeath = now;
    const o = s.room.out;
    const door = Math.abs(x + (LIVE_W >> 1) - (o.x + (o.w >> 1))) < 3 * TS && Math.abs(y - o.y) < 3 * TS;
    if (same) this.want(2, 'die.same');
    else if (quick) this.want(2, 'die.quick');
    else if (ticks > 900 && cause !== E.DIE_TAPE) this.want(2, 'die.long');
    else if (door) this.want(2, 'die.doorstep');
    else if (ticks < 60) this.want(2, 'die.first');
    else this.want(2, ['die.static', 'die.beam', 'die.pit', 'die.tape'][cause] ?? 'die.static');
  }

  private clear(s: Session): void {
    const par = s.room.json.par.drones + s.room.json.par.loops;
    if (this.silent()) { this.pending = [0, 'final']; this.spoke = false; this.cooldown = 0; this.onAir = 0; return; }
    if (this.deaths === 0 && s.tracks.length <= par) this.want(5, 'clear.clean');
    else if (s.takes >= 15) this.want(5, 'clear.long');
    else this.want(5, s.tracks.length <= par ? 'clear.par' : 'clear.over');
  }

  update(dt: number, ff: boolean, running: boolean): void {
    this.clock += dt;
    this.onAir = Math.max(0, this.onAir - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.idle += dt;
    if (this.idle > IDLE_MS && running) { this.want(3, 'idle'); this.idle = 0; }
    if (ff && !this.ffSaid) { this.want(3, 'ff'); this.ffSaid = true; }
    if (!this.pending) return;
    const [cls, key] = this.pending;
    if (this.onAir > 0 || (cls > 0 && (this.cooldown > 0 || this.spoke || this.silent()))) return;
    this.pending = null;
    const line = this.pick(key);
    if (!line) return;
    const words = line.split(/\s+/).length;
    const ms = Math.max(1800, words * 300);
    this.onAir = ms;
    this.cooldown = COOLDOWN;
    this.spoke = true;
    this.say(line, ms);
  }

  private pick(key: string): string | null {
    const pool = LINES[key];
    if (!pool) return null;
    for (const ch of [this.chapter, 0]) {
      const list = pool[ch] ?? [];
      for (let i = 0; i < list.length; i++) {
        const id = `${key}.${ch}.${i}`;
        if (!this.used.has(id)) { this.used.add(id); return list[i]; }
      }
    }
    return null;
  }
}
