// npm run prove [rNN ...] | --all  [--fresh] [--budget=seconds]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { validateRoom } from '../../src/rooms/validate.ts';
import { belowPar } from './belowPar.ts';
import type { BelowResult } from './belowPar.ts';
import { allRoomIds, loadJson, loadSolution, roomPath, solPath, ROOT } from './load.ts';

const SOLVER_VERSION = 3;
const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const budget = Number(args.find((a) => a.startsWith('--budget='))?.slice(9) ?? 600) * 1000;
const ids = args.includes('--all') || !args.some((a) => /^r\d\d$/.test(a)) ? allRoomIds() : args.filter((a) => /^r\d\d$/.test(a));

const cacheDir = join(ROOT, 'tools', 'solver', 'out');
const cacheFile = join(cacheDir, 'below.json');
const cache: Record<string, { key: string; res: Omit<BelowResult, 'found'> }> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};

function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

let failed = 0;
for (const id of ids) {
  const json = loadJson(id);
  const tag = `${id} ${json.name.padEnd(20)}`;
  const par = json.par.drones + json.par.loops;
  const parTxt = `par ${par === 0 ? '0' : [json.par.drones && `${json.par.drones}D`, json.par.loops && `${json.par.loops}L`].filter(Boolean).join('+')}/${json.tracks}`;
  const errs = validateRoom(json);
  if (errs.length) { console.log(`${tag} INVALID ${errs.slice(0, 3).join('; ')}`); failed++; continue; }
  const room = loadRoom(json);
  const sol = loadSolution(id);
  if (!sol) { console.log(`${tag} ${parTxt} NO WITNESS`); failed++; continue; }
  const r = replay(room, sol.takes);
  const drones = r.session.tracks.filter((t) => t.kind === 0).length;
  const loops = r.session.tracks.length - drones;
  if (!r.cleared) { console.log(`${tag} ${parTxt} WITNESS FAILS: ${r.error ?? 'no clear'}`); failed++; continue; }
  if (drones !== json.par.drones || loops !== json.par.loops) {
    console.log(`${tag} ${parTxt} WITNESS USES ${drones}D+${loops}L`); failed++; continue;
  }
  if (par === 0) { console.log(`${tag} ${parTxt} witness ok, below par n/a`); continue; }
  const key = fnv(readFileSync(roomPath(id), 'utf8') + readFileSync(solPath(id), 'utf8') + SOLVER_VERSION);
  let res: Omit<BelowResult, 'found'>;
  if (!fresh && cache[id]?.key === key) res = cache[id].res;
  else {
    const b = belowPar(room, par - 1, budget);
    if (b.found) {
      console.log(`${tag} ${parTxt} BELOW PAR: cleared with ${par - 1} tracks`);
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(join(cacheDir, `${id}.below.json`), JSON.stringify({ room: id, takes: b.found }) + '\n');
      failed++;
      continue;
    }
    res = { label: b.label, searches: b.searches, ms: b.ms };
    cache[id] = { key, res };
  }
  const bad = res.label === 'Partial';
  if (bad) failed++;
  console.log(`${tag} ${parTxt} witness ok, below par ${res.label}${bad ? ' (budget hit)' : ''} [${res.searches} searches, ${(res.ms / 1000).toFixed(1)}s]`);
}
mkdirSync(cacheDir, { recursive: true });
writeFileSync(cacheFile, JSON.stringify(cache));
console.log(failed ? `${failed} room(s) failed` : `all ${ids.length} room(s) pass`);
process.exitCode = failed ? 1 : 0;
