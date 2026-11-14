// node tests/e2e/shot.ts <room> <out.png> [keys...]: screenshot a room from the preview server.
import { chromium } from '@playwright/test';
const [room, out, ...keys] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 840 } });
const errs: string[] = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:4173/?room=${room}`);
await p.waitForTimeout(800);
for (const k of keys) {
  const [code, ms] = k.split(':');
  if (ms) { await p.keyboard.down(code); await p.waitForTimeout(Number(ms)); await p.keyboard.up(code); }
  else await p.keyboard.press(code);
}
await p.waitForTimeout(200);
await p.screenshot({ path: out });
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors');
await b.close();
