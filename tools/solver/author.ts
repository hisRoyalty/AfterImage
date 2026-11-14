// Compiles tools/solver/plans/rNN.json into solutions/rNN.par.json.
// Usage: node tools/solver/author.ts r01 [r02 ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { IN_WAIT, IN_DRONE, IN_LOOP, IN_J, LIVE_W, LIVE_H, TS } from '../../src/sim/constants.ts';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { inMute } from '../../src/sim/step.ts';
import type { Session } from '../../src/sim/step.ts';
import { encode } from '../../src/sim/rle.ts';
import type { TakeLog, Room } from '../../src/sim/types.ts';
import { TakeSearch } from './search.ts';
import { parseScript } from './script.ts';
import { loadJson, planPath, solPath } from './load.ts';

const CONFIGS = [[1, 9, 6, 3], [1, 8, 5, 3], [1, 10, 6, 0], [1, 9, 6, 0], [2, 9, 5, 0], [1, 8, 5, 1]];

type Box = [number, number, number, number];
interface PlanTake {
  pre?: string;
  goal?: 'out' | { stand?: Box; at?: Box; die?: Box };
  post?: string;
  until?: number;
  end: 'drone' | 'loop' | 'keep' | 'out';
}

const inBox = (s: Session, b: Box) => {
  const cx = s.live.x + (LIVE_W >> 1);
  const cy = s.live.y + (LIVE_H >> 1);
  return cx >= b[0] * TS && cx < (b[2] + 1) * TS && cy >= b[1] * TS && cy < (b[3] + 1) * TS;
};

export function compileTake(room: Room, prior: TakeLog[], p: PlanTake): TakeLog {
  let masks = parseScript(p.pre ?? '');
  if (p.goal) {
    const g = p.goal;
    const goal = (s: Session, res: number) => {
      if (g === 'out') return res === 2;
      if (g.die) return res === 1 && inBox(s, g.die);
      if (res !== 0) return false;
      if (g.stand) return s.live.ground && s.live.vx === 0 && inBox(s, g.stand) && !inMute(s);
      if (g.at) return inBox(s, g.at);
      return false;
    };
    let found: number[] | null = null;
    const tb = g === 'out' ? room.out : { x: (g.stand ?? g.at ?? g.die)![0] * TS, y: (g.stand ?? g.at ?? g.die)![1] * TS, w: TS, h: TS };
    const gx = tb.x + (tb.w >> 1), gy = tb.y + (tb.h >> 1);
    for (const [stride, qp, qv, w] of CONFIGS) {
      const heur = w ? (s: Session) => (w * (Math.abs(s.live.x + (LIVE_W >> 1) - gx) + Math.abs(s.live.y + (LIVE_H >> 1) - gy))) / 461 : undefined;
      const r = new TakeSearch(replay(room, prior).session, masks).run({ goal, stride, qp, qv, heur, maxNodes: 3_000_000 });
      if (r.masks) { found = r.masks; break; }
    }
    if (!found) throw new Error(`goal ${JSON.stringify(g)} not reached`);
    masks = found;
  }
  const last = masks.length ? masks[masks.length - 1] : 0;
  masks = masks.concat(parseScript(p.post ?? '', last & IN_J ? 1 : 0));
  if (p.until) while (masks.length < p.until) masks.push(IN_WAIT);
  if (p.end === 'drone') masks.push(IN_WAIT | IN_DRONE);
  if (p.end === 'loop') masks.push(IN_WAIT | IN_LOOP);
  const e = p.end === 'keep' ? 'death' : p.end;
  return p.end === 'keep' ? { i: encode(masks), e, k: 1 } : { i: encode(masks), e };
}

export function compilePlan(id: string): TakeLog[] {
  const room = loadRoom(loadJson(id));
  const plan = JSON.parse(readFileSync(planPath(id), 'utf8')) as { takes: PlanTake[] };
  const takes: TakeLog[] = [];
  for (let k = 0; k < plan.takes.length; k++) {
    const t = compileTake(room, takes, plan.takes[k]);
    takes.push(t);
    const r = replay(room, takes);
    if (r.error) throw new Error(`take ${k}: ${r.error}`);
  }
  const r = replay(room, takes);
  if (!r.cleared) throw new Error('plan does not clear the room');
  return takes;
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/').split('/').pop() ?? '')) {
  for (const id of process.argv.slice(2)) {
    try {
      const takes = compilePlan(id);
      writeFileSync(solPath(id), JSON.stringify({ room: id, takes }) + '\n');
      const ticks = takes.reduce((n, t) => n + t.i.filter((_, i) => i % 2).reduce((a, b) => a + b, 0), 0);
      console.log(`${id}: ${takes.length} takes, ${ticks} ticks -> solutions/${id}.par.json`);
    } catch (e) {
      console.log(`${id}: FAILED ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
}
