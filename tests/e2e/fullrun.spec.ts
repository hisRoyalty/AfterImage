import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ids = readdirSync(join(process.cwd(), 'src', 'rooms')).filter((f) => /^r\d\d\.json$/.test(f)).map((f) => f.slice(0, 3)).sort()
  .filter((id) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'rooms', `${id}.json`), 'utf8')).chapter <= 5); // story chapters end with the Mixdown
const takes = (id: string) => JSON.parse(readFileSync(join(process.cwd(), 'solutions', `${id}.par.json`), 'utf8')).takes;

test('fresh browser: title screen to the end of the Mixdown', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__overdub);
  const hook = () => page.evaluate(() => (window as any).__overdub.scene() as string[]);
  expect(await hook()).toContain('menu');
  await page.keyboard.press('Enter'); // Start
  await page.waitForTimeout(300);
  for (const id of ids) {
    const r = await page.evaluate((t) => (window as any).__overdub.drive(t), takes(id));
    expect(r?.room, 'room order').toBe(id);
    expect(r?.cleared, `${id} cleared`).toBe(true);
    // dismiss a chapter card if one is up, then continue past the clear banner
    for (let k = 0; k < 12; k++) {
      await page.waitForTimeout(250);
      const now = await page.evaluate(() => { const g = (window as any).__game; return g.scene.isActive('room') ? g.scene.getScene('room').room.json.id : g.scene.getScenes(true)[0]?.scene.key; });
      if (now !== id) break;
      await page.keyboard.press('Enter');
    }
  }
  await page.waitForTimeout(500);
  expect(await hook()).toContain('mixdown');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter'); // skip to the end card
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect(await hook()).toContain('menu');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('overdub.save.v1')!));
  expect(ids.every((id) => save.rooms[id]?.cleared)).toBe(true);
  expect(save.mixdown).toBe(true);
  expect(errors).toEqual([]);
});
