import { IN_L, IN_R, IN_J, IN_JP, IN_WAIT, TAKE_MAX, BEAT } from '../../src/sim/constants.ts';
import { tick, step, PH_RUN } from '../../src/sim/step.ts';
import type { Session } from '../../src/sim/step.ts';



class KeySet {
  bits = 20;
  mask = (1 << 20) - 1;
  a = new Int32Array(1 << 20);
  b = new Int32Array(1 << 20);
  c = new Int32Array(1 << 20);
  used = new Uint8Array(1 << 20);
  size = 0;

  add(k1: number, k2: number, k3: number): boolean {
    if (this.size * 2 > this.mask) this.grow();
    let h = Math.imul(k1, 0x9e3779b1) ^ Math.imul(k2 + 0x7f4a7c15, 0x85ebca6b) ^ Math.imul(k3 + 0x165667b1, 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    let i = h & this.mask;
    while (this.used[i]) {
      if (this.a[i] === k1 && this.b[i] === k2 && this.c[i] === k3) return false;
      i = (i + 1) & this.mask;
    }
    this.used[i] = 1;
    this.a[i] = k1;
    this.b[i] = k2;
    this.c[i] = k3;
    this.size++;
    return true;
  }

  private grow(): void {
    const { a, b, c, used } = this;
    this.bits++;
    const n = 1 << this.bits;
    this.mask = n - 1;
    this.a = new Int32Array(n);
    this.b = new Int32Array(n);
    this.c = new Int32Array(n);
    this.used = new Uint8Array(n);
    this.size = 0;
    for (let i = 0; i < used.length; i++) if (used[i]) this.add(a[i], b[i], c[i]);
  }
}

class Heap {
  ids: number[] = [];
  pri: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, p: number): void {
    const { ids, pri } = this;
    let i = ids.length;
    ids.push(id); pri.push(p);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (pri[up] <= p) break;
      ids[i] = ids[up]; pri[i] = pri[up]; i = up;
    }
    ids[i] = id; pri[i] = p;
  }
  pop(): number {
    const { ids, pri } = this;
    const top = ids[0];
    const id = ids.pop() as number, p = pri.pop() as number;
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pri[c + 1] < pri[c]) c++;
        if (pri[c] >= p) break;
        ids[i] = ids[c]; pri[i] = pri[c]; i = c;
      }
      ids[i] = id; pri[i] = p;
    }
    return top;
  }
}

const F = 10; // ints per node: x y vx vy misc t gates parent act spare
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
// Jump hold lengths in ticks. All are at least cutMin, so the release tick decides the height.
export const HOLDS = [5, 9, 14, 40];

export interface SearchOpts {
  stride?: number;
  maxNodes?: number;
  // checked after every tick; res is 0 running, 1 death, 2 clear
  goal: (s: Session, res: number) => boolean;
  visit?: (s: Session, node: number) => void;
  qp?: number; // position dedup shift (8 = 1 px)
  qv?: number; // speed dedup shift
  heur?: (s: Session) => number; // best-first: expands lowest depth*stride + heur first
}

export interface SearchResult {
  masks: number[] | null;
  nodes: number;
  complete: boolean;
}

// Breadth-first search over one take from the session's current state (count-in, or running
// after a scripted prefix). Inputs: direction every `stride` ticks; a jump is pressed only when it
// can fire and is held for one of HOLDS.
export class TakeSearch {
  s: Session;
  store = new Int32Array(F * (1 << 16));
  count = 0;
  curHead = 0;
  curAct = 0;
  curK = 0;
  period: number;
  rootMasks: number[];
  private root: Session['live'];
  private rootT: number;
  private rootGates: number;
  private hold = 0;
  private qp = 8;
  private qv = 0;
  private stride = 1;

  constructor(s: Session, prefix: number[] = []) {
    this.s = s;
    for (const m of prefix) step(s, m);
    this.rootMasks = prefix.slice();
    this.root = { ...s.live };
    this.rootT = s.phase === PH_RUN ? s.t : 0;
    this.rootGates = this.gateBits();
    let p = 1;
    if (s.loops.length || s.room.timed) {
      for (const l of s.loops) p = (p * l.len) / gcd(p, l.len);
      for (const b of s.room.beams) if (b.on > 0) { const c = (b.on + b.off) * BEAT; p = (p * c) / gcd(p, c); }
      if (p > 65535) p = 65536;
    }
    this.period = p;
  }

  private gateBits(): number {
    let g = 0;
    for (let i = 0; i < this.s.gateOpen.length; i++) if (this.s.gateOpen[i]) g |= 1 << i;
    return g;
  }

  private load(n: number): void {
    const o = n * F, st = this.store, lv = this.s.live;
    lv.x = st[o]; lv.y = st[o + 1]; lv.vx = st[o + 2]; lv.vy = st[o + 3];
    const m = st[o + 4];
    lv.ground = (m & 1) !== 0; lv.bouncing = (m & 2) !== 0;
    lv.coyote = (m >> 2) & 15; lv.buf = (m >> 6) & 15; lv.jumpT = ((m >> 10) & 63) - 1;
    this.hold = (m >> 16) & 63;
    this.s.t = st[o + 5];
    const g = st[o + 6];
    for (let i = 0; i < this.s.gateOpen.length; i++) this.s.gateOpen[i] = (g >> i) & 1;
  }

  private push(parent: number, act: number): number {
    if ((this.count + 1) * F > this.store.length) {
      const bigger = new Int32Array(this.store.length * 2);
      bigger.set(this.store);
      this.store = bigger;
    }
    const n = this.count++, o = n * F, st = this.store, lv = this.s.live;
    st[o] = lv.x; st[o + 1] = lv.y; st[o + 2] = lv.vx; st[o + 3] = lv.vy;
    st[o + 4] = (lv.ground ? 1 : 0) | (lv.bouncing ? 2 : 0) | (lv.coyote << 2) | (lv.buf << 6) | ((Math.min(lv.jumpT, 40) + 1) << 10) | (this.hold << 16);
    st[o + 5] = this.s.t; st[o + 6] = this.gateBits(); st[o + 7] = parent; st[o + 8] = act;
    return n;
  }

  private key(set: KeySet, n: number): boolean {
    const o = n * F, st = this.store, qp = this.qp, qv = this.qv, m = st[o + 4];
    const k1 = (st[o] >> qp) | ((st[o + 1] >> qp) << 10) | (((st[o + 2] + 512) >> qv) << 19);
    const k2 = ((st[o + 3] + 4096) >> qv) | ((m & 63) << 13) | (((m >> 16) & 63) << 19);
    const k3 = (this.period > 1 ? st[o + 5] % this.period : 0) | (st[o + 6] << 17);
    return set.add(k1, k2, k3);
  }

  // Runs one decision from the loaded state. Returns 0 ok, 1 ended (death/tape/goal miss), 2 goal.
  private act(act: number, o: SearchOpts, head: number): number {
    const dir = act & 3;
    const jumpIdx = act >> 2;
    if (jumpIdx) this.hold = HOLDS[jumpIdx - 1];
    for (let k = 0; k < this.stride; k++) {
      const m = (dir === 1 ? IN_L : dir === 2 ? IN_R : 0) | IN_WAIT | (this.hold > 0 ? IN_J : 0) | (k === 0 && jumpIdx ? IN_JP : 0);
      if (this.hold > 0) this.hold--;
      this.s.ev.length = 0;
      const res = tick(this.s, m);
      this.curHead = head; this.curAct = act; this.curK = k + 1;
      if (o.goal(this.s, res)) return 2;
      this.s.t++;
      if (res !== 0 || this.s.t >= TAKE_MAX) return 1;
    }
    return 0;
  }

  run(o: SearchOpts): SearchResult {
    this.stride = o.stride ?? 1;
    const maxNodes = o.maxNodes ?? 4_000_000;
    const set = new KeySet();
    this.qp = o.qp ?? 8;
    this.qv = o.qv ?? 0;
    this.count = 0;
    Object.assign(this.s.live, this.root);
    this.s.t = this.rootT;
    this.hold = 0;
    for (let i = 0; i < this.s.gateOpen.length; i++) this.s.gateOpen[i] = (this.rootGates >> i) & 1;
    this.key(set, this.push(-1, 0));
    const heap = o.heur ? new Heap() : null;
    const depth: number[] = [0];
    heap?.push(0, 0);
    for (let i = 0; heap ? heap.size > 0 : i < this.count; i++) {
      if (this.count > maxNodes) return { masks: null, nodes: this.count, complete: false };
      const head = heap ? heap.pop() : i;
      this.load(head);
      if (o.visit) o.visit(this.s, head);
      const lv = this.s.live;
      const canJump = this.hold === 0 && (lv.ground || lv.coyote > 0);
      const nAct = canJump ? 3 * (HOLDS.length + 1) : 3;
      for (let i = 0; i < nAct; i++) {
        const act = (i % 3) | (Math.floor(i / 3) << 2);
        if (i) this.load(head);
        const r = this.act(act, o, head);
        if (r === 2) return { masks: this.path(head, act, this.curK), nodes: this.count, complete: true };
        if (r === 1) continue;
        const n = this.push(head, act);
        if (!this.key(set, n)) { this.count--; continue; }
        if (heap && o.heur) { depth[n] = depth[head] + this.stride; heap.push(n, depth[n] + o.heur(this.s)); }
      }
    }
    return { masks: null, nodes: this.count, complete: true };
  }

  // Masks from the take start to node n, plus `lastTicks` of a final action.
  path(n: number, lastAct = -1, lastTicks = 0): number[] {
    const acts: number[] = [];
    for (let i = n; i > 0; i = this.store[i * F + 7]) acts.push(this.store[i * F + 8]);
    acts.reverse();
    const out = this.rootMasks.slice();
    let hold = 0;
    const emit = (act: number, ticks: number) => {
      const dir = act & 3, jumpIdx = act >> 2;
      if (jumpIdx) hold = HOLDS[jumpIdx - 1];
      for (let k = 0; k < ticks; k++) {
        out.push((dir === 1 ? IN_L : dir === 2 ? IN_R : 0) | IN_WAIT | (hold > 0 ? IN_J : 0) | (k === 0 && jumpIdx ? IN_JP : 0));
        if (hold > 0) hold--;
      }
    };
    for (const a of acts) emit(a, this.stride);
    if (lastAct >= 0) emit(lastAct, lastTicks);
    return out;
  }
}
