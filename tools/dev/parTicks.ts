// npm run par:ticks: par time per room = the witness's clearing tick rounded up to a whole beat.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { BEAT } from '../../src/sim/constants.ts';
import { allRoomIds, loadJson, loadSolution, ROOT } from '../solver/load.ts';

export function computeParTicks(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of allRoomIds()) {
    const sol = loadSolution(id);
    if (!sol) throw new Error(`${id}: no witness`);
    const r = replay(loadRoom(loadJson(id)), sol.takes);
    if (!r.cleared) throw new Error(`${id}: witness does not clear`);
    out[id] = Math.ceil((r.session.t + 1) / BEAT) * BEAT;
  }
  return out;
}

if (process.argv[1]?.endsWith('parTicks.ts')) {
  const t = computeParTicks();
  writeFileSync(join(ROOT, 'src', 'rooms', 'parTicks.json'), JSON.stringify(t, Object.keys(t).sort(), 2) + '\n');
  console.log(Object.entries(t).map(([k, v]) => `${k} ${v}`).join('  '));
}
