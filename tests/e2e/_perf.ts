import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 840 } });
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!(window as any).__overdub);
const sol = JSON.parse(readFileSync('solutions/r29.par.json', 'utf8'));
await p.evaluate((t) => (window as any).__overdub.paced('r29', t, 1000 / 60), sol.takes);
await p.waitForTimeout(1500);
const fps = await p.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now(); const dts: number[] = []; let last = t0;
  const f = (now: number) => { n++; dts.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else res({ fps: +((n * 1000) / (now - t0)).toFixed(1), p95ms: +dts.sort((a, b) => a - b)[Math.floor(dts.length * 0.95)].toFixed(1) }); };
  requestAnimationFrame(f);
}));
console.log(JSON.stringify(fps));
await b.close();
