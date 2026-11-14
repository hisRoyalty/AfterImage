// npm run sprites [-- --force]: writes default art to src/sprites/<key>.png for every sprite that has no file yet.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const force = process.argv.includes('--force');
const dir = join(process.cwd(), 'src', 'sprites');
mkdirSync(dir, { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5199/tools/sprites/export.html');
  await page.waitForFunction(() => !!(window as unknown as { __sprites?: unknown }).__sprites, null, { timeout: 30000 });
  const sprites = await page.evaluate(() => (window as unknown as { __sprites: Record<string, string> }).__sprites);
  let wrote = 0, kept = 0;
  for (const [key, url] of Object.entries(sprites)) {
    const file = join(dir, `${key}.png`);
    if (existsSync(file) && !force) { kept++; continue; }
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    wrote++;
  }
  console.log(`sprites: wrote ${wrote}, kept ${kept} existing (use --force to overwrite)`);
} finally {
  await browser.close();
  await server.close();
}
