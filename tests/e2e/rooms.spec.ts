import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadRoom } from '../../src/sim/room.ts';
import { replay } from '../../src/sim/replay.ts';
import { hashSession } from '../../src/sim/hash.ts';
import type { RoomJson, Solution } from '../../src/sim/types.ts';

const root = process.cwd();
const ids = readdirSync(join(root, 'solutions')).filter((f) => f.endsWith('.par.json')).map((f) => f.slice(0, 3)).sort();
const load = (id: string) => ({
  room: loadRoom(JSON.parse(readFileSync(join(root, 'src', 'rooms', `${id}.json`), 'utf8')) as RoomJson),
  sol: JSON.parse(readFileSync(join(root, 'solutions', `${id}.par.json`), 'utf8')) as Solution,
});

test('witnesses clear in the built game with Node-identical hashes', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__overdub);
  for (const id of ids) {
    const { room, sol } = load(id);
    const node = replay(room, sol.takes, undefined, 30);
    const web = await page.evaluate(([i, t]) => (window.__overdub as any).replay(i, t), [id, sol.takes] as const);
    expect(web.error, id).toBeNull();
    expect(web.cleared, id).toBe(true);
    expect(web.hashes, id).toEqual(node.hashes);
  }
});

test('frame pacing at 30, 60 and 144 Hz gives the same final state', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__overdub);
  for (const id of ids) {
    const { room, sol } = load(id);
    const want = hashSession(replay(room, sol.takes).session);
    for (const hz of [30, 60, 144]) {
      const r = await page.evaluate(([i, t, ms]) => (window.__overdub as any).paced(i, t, ms), [id, sol.takes, 1000 / hz] as const);
      expect(r.cleared, `${id} @${hz}Hz`).toBe(true);
      expect(r.hash, `${id} @${hz}Hz`).toBe(want);
    }
  }
});
