// node tools/solver/try.ts rNN <takes-from-plan> "<script>"  -> prints a trace of the script's take
import { readFileSync } from 'node:fs';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { step, PH_RUN } from '../../src/sim/step.ts';
import { evCode, evArg } from '../../src/sim/events.ts';
import { SUB } from '../../src/sim/constants.ts';
import { compileTake } from './author.ts';
import { loadJson, planPath } from './load.ts';
import { parseScript } from './script.ts';
import type { TakeLog } from '../../src/sim/types.ts';

const [id, nTakes, script] = process.argv.slice(2);
const room = loadRoom(loadJson(id));
const plan = JSON.parse(readFileSync(planPath(id), 'utf8'));
const takes: TakeLog[] = [];
for (let k = 0; k < Number(nTakes); k++) takes.push(compileTake(room, takes, plan.takes[k]));
const s = replay(room, takes).session;
const names = ['', 'start', 'jump', 'land', 'hardland', 'bounce', 'drone', 'loop', 'keep', 'erase', 'wipe', 'retry', 'refuse', 'sw+', 'sw-', 'gate+', 'gate-', 'death', 'tape', 'clear'];
for (const l of s.loops) console.log(`loop n=${l.n} len=${l.len} end=(${(l.xs[l.n - 1] / SUB).toFixed(0)},${(l.ys[l.n - 1] / SUB).toFixed(0)})`);
let t = 0;
for (const m of parseScript(script)) {
  step(s, m);
  const evs = s.ev.map((e) => names[evCode(e)] + (evArg(e) ? ':' + evArg(e) : '')).filter((e) => e !== 'start');
  if (evs.length || t % 20 === 0) console.log(`t${t} x${(s.live.x / SUB).toFixed(1)} y${(s.live.y / SUB).toFixed(1)} vx${s.live.vx} vy${s.live.vy} ${evs.join(' ')}`);
  t++;
  if (s.phase !== PH_RUN) { console.log('take ended:', s.lastEnd, s.phase); break; }
}
