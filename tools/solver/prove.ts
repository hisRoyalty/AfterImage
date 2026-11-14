// npm run prove [rNN ...] | --all  [--fresh] [--budget=seconds] [--jobs=N]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { validateRoom } from '../../src/rooms/validate.ts';
import { belowPar } from './belowPar.ts';
import { allRoomIds, loadJson, loadSolution, roomPath, solPath, ROOT } from './load.ts';

const SOLVER_VERSION = 8;
const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const budget = Number(args.find((a) => a.startsWith('--budget='))?.slice(9) ?? 600) * 1000;
const jobs = Number(args.find((a) => a.startsWith('--jobs='))?.slice(7) ?? 6);
const named = args.filter((a) => /^r\d\d$/.test(a));
const ids = named.length ? named : allRoomIds();
const cacheDir = join(ROOT, 'tools', 'solver', 'out');

function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

// Proves one room; returns [ok, line].
function proveRoom(id: string): [boolean, string] {
  const json = loadJson(id);
  const tag = `${id} ${json.name.padEnd(20)}`;
  const par = json.par.drones + json.par.loops;
  const parTxt = `par ${par === 0 ? '0' : [json.par.drones && `${json.par.drones}D`, json.par.loops && `${json.par.loops}L`].filter(Boolean).join('+')}/${json.tracks}`;
  const errs = validateRoom(json);
  if (errs.length) return [false, `${tag} INVALID ${errs.slice(0, 3).join('; ')}`];
  const room = loadRoom(json);
  const sol = loadSolution(id);
  if (!sol) return [false, `${tag} ${parTxt} NO WITNESS`];
  const r = replay(room, sol.takes);
  const drones = r.session.tracks.filter((t) => t.kind === 0).length;
  const loops = r.session.tracks.length - drones;
  if (!r.cleared) return [false, `${tag} ${parTxt} WITNESS FAILS: ${r.error ?? 'no clear'}`];
  if (drones !== json.par.drones || loops !== json.par.loops) return [false, `${tag} ${parTxt} WITNESS USES ${drones}D+${loops}L`];
  if (par === 0) return [true, `${tag} ${parTxt} witness ok, below par n/a`];
  const key = fnv(readFileSync(roomPath(id), 'utf8') + readFileSync(solPath(id), 'utf8') + SOLVER_VERSION);
  const cf = join(cacheDir, `${id}.json`);
  const cached = existsSync(cf) ? JSON.parse(readFileSync(cf, 'utf8')) : null;
  let res = !fresh && cached?.key === key ? cached.res : null;
  if (!res) {
    const b = belowPar(room, par - 1, budget);
    mkdirSync(cacheDir, { recursive: true });
    if (b.found) {
      writeFileSync(join(cacheDir, `${id}.below.json`), JSON.stringify({ room: id, takes: b.found }) + '\n');
      return [false, `${tag} ${parTxt} BELOW PAR: cleared with ${par - 1} tracks (tools/solver/out/${id}.below.json)`];
    }
    res = { label: b.label, searches: b.searches, capped: b.capped, ms: b.ms };
    writeFileSync(cf, JSON.stringify({ key, res }));
  }
  const note = res.label !== 'Checked' ? ` (${res.capped} of ${res.searches} searches capped${res.label === 'Partial' ? ', time budget hit' : ''})` : '';
  return [true, `${tag} ${parTxt} witness ok, below par ${res.label}${note} [${res.searches} searches, ${(res.ms / 1000).toFixed(1)}s]`];
}

if (args.includes('--worker')) {
  const [ok, line] = proveRoom(named[0]);
  console.log(line);
  process.exitCode = ok ? 0 : 1;
} else {
  const self = fileURLToPath(import.meta.url);
  const extra = args.filter((a) => a.startsWith('--') && !a.startsWith('--jobs'));
  let failed = 0;
  let next = 0;
  const lines: string[] = new Array(ids.length);
  await new Promise<void>((done) => {
    let running = 0;
    const launch = () => {
      if (next >= ids.length) { if (running === 0) done(); return; }
      const i = next++;
      running++;
      const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', self, ids[i], '--worker', ...extra], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.on('close', (code) => {
        lines[i] = out.trim();
        console.log(lines[i]);
        if (code !== 0) failed++;
        running--;
        launch();
      });
    };
    for (let k = 0; k < Math.min(jobs, ids.length); k++) launch();
  });
  console.log(failed ? `${failed} room(s) failed` : `all ${ids.length} room(s) pass`);
  process.exitCode = failed ? 1 : 0;
}
