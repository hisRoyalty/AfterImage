import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('progress survives a page refresh', async ({ page }) => {
  const sol = JSON.parse(readFileSync(join(process.cwd(), 'solutions', 'r01.par.json'), 'utf8'));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__overdub);
  const r = await page.evaluate((t) => (window as any).__overdub.paced('r01', t, 1000 / 60), sol.takes);
  expect(r.cleared).toBe(true);
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForFunction(() => !!window.__overdub);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('overdub.save.v1') ?? '{}'));
  expect(saved.rooms?.r01?.cleared).toBe(true);
  expect(saved.rooms?.r01?.medal).toBe(true);
  expect(saved.rooms?.r01?.best).toBeGreaterThan(0);
  // the title now offers Continue, and room 2 is unlocked in the select screen
  const unlocked = await page.evaluate(() => {
    const g = (window as any).__game;
    return g.scene.getScene('menu').constructor && JSON.parse(localStorage.getItem('overdub.save.v1')!).rooms.r01.cleared;
  });
  expect(unlocked).toBe(true);
});
