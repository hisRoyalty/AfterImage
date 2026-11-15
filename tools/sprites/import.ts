// npm run sprites:import [-- <packs dir>]: builds sprites from the Kenney packs (CC0) into src/sprites.
// Packs dir (default assets/incoming) must hold: new-platformer-pack, input-prompts, cursor-pack.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const src = process.argv[2] ?? join(process.cwd(), 'assets', 'incoming');
const out = join(process.cwd(), 'src', 'sprites');
const NPP = join(src, 'new-platformer-pack', 'Sprites');
const KEYS = join(src, 'input-prompts', 'Keyboard & Mouse', 'Default');
const CUR = join(src, 'cursor-pack', 'PNG', 'Outline', 'Default');
const b64 = (f: string) => readFileSync(f).toString('base64');

// Runs in the page: pixel work on a canvas.
async function pageLib(): Promise<void> {
  const load = (data: string) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + data; });
  const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const done = (c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1];
  const w = window as unknown as Record<string, unknown>;

  // White silhouette whose alpha comes from each pixel: mode picks what counts as "ink".
  w.silhouette = async (data: string, mode: 'fade' | 'near' | 'cloud') => {
    const im = await load(data);
    const c = canvas(im.width, im.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(im, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height);
    const d = px.data;
    let lo = 255;
    for (let i = 0; i < d.length; i += 4) lo = Math.min(lo, d[i], d[i + 1], d[i + 2]);
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mn = Math.min(r, g, b);
      let a = 0;
      if (mode === 'fade') a = (255 - mn) / (255 - lo);
      else if (mode === 'cloud') a = (mn - lo) / (255 - lo);
      else a = Math.max(0, Math.min(1, (Math.max(r, g) - b) / 40)) * (1.15 - ((r + g + b) / 765) * 0.5);
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
    }
    ctx.putImageData(px, 0, 0);
    return done(c);
  };

  // Door frames at w x h: 0 closed .. n-1 open. The leaf is recoloured to the Live yellow and swings shut-to-open.
  w.door = async (closedTop: string, closed: string, openTop: string, open: string, wOut: number, hOut: number, n: number) => {
    const [ct, cb, ot, ob] = await Promise.all([closedTop, closed, openTop, open].map(load));
    const T = ct.width;
    const stack = (a: HTMLImageElement, b: HTMLImageElement) => { const c = canvas(T, T * 2); const x = c.getContext('2d')!; x.drawImage(a, 0, 0); x.drawImage(b, 0, T); return c; };
    const shut = stack(ct, cb);
    const gap = stack(ot, ob);
    const leaf = canvas(T, T * 2);
    const sx = shut.getContext('2d')!;
    const px = sx.getImageData(0, 0, T, T * 2);
    const lp = leaf.getContext('2d')!.createImageData(T, T * 2);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (!(r > g + 25 && g > b)) continue;
      // terracotta leaf -> amber, and remember it as the part that swings
      const l = (r + g + b) / 765;
      d[i] = Math.min(255, 255 * (0.55 + l * 0.75)); d[i + 1] = Math.min(255, 196 * (0.5 + l * 0.8)); d[i + 2] = 46 * (0.4 + l);
      lp.data[i] = d[i]; lp.data[i + 1] = d[i + 1]; lp.data[i + 2] = d[i + 2]; lp.data[i + 3] = d[i + 3];
    }
    sx.putImageData(px, 0, 0);
    leaf.getContext('2d')!.putImageData(lp, 0, 0);
    const x0 = Math.round(T * 0.22), x1 = Math.round(T * 0.78);
    const frames: string[] = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const c = canvas(T, T * 2);
      const x = c.getContext('2d')!;
      if (k === 0) x.drawImage(shut, 0, 0);
      else {
        x.drawImage(gap, 0, 0);
        if (t < 1) x.drawImage(leaf, x0, 0, x1 - x0, T * 2, x0, 0, (x1 - x0) * (1 - t), T * 2);
      }
      const o = canvas(wOut, hOut);
      const ox = o.getContext('2d')!;
      ox.imageSmoothingQuality = 'high';
      ox.drawImage(c, 0, 0, wOut, hOut);
      frames.push(done(o));
    }
    return frames;
  };
}

const KEYMAP: Record<string, string> = {
  ArrowLeft: 'arrow_left', ArrowRight: 'arrow_right', ArrowUp: 'arrow_up', ArrowDown: 'arrow_down', Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift',
  Enter: 'enter', Escape: 'escape', Tab: 'tab', Backspace: 'backspace', ControlLeft: 'ctrl', ControlRight: 'ctrl', AltLeft: 'alt', AltRight: 'alt',
};
for (const ch of 'abcdefghijklmnopqrstuvwxyz') KEYMAP[`Key${ch.toUpperCase()}`] = ch;
for (const n of '0123456789') KEYMAP[`Digit${n}`] = n;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<body></body>');
  await page.evaluate(pageLib);
  const save = (name: string, data: string) => writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
  const call = (fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => (window as unknown as Record<string, (...x: unknown[]) => Promise<unknown>>)[f as string](...(a as unknown[])), [fn, args] as const);
  const bg = (n: string) => b64(join(NPP, 'Backgrounds', 'Double', `background_${n}.png`));

  save('bg_clouds', (await call('silhouette', bg('clouds'), 'cloud')) as string);
  for (const t of ['hills', 'trees', 'desert', 'mushrooms']) {
    save(`bg_${t}_mid`, (await call('silhouette', bg(`fade_${t}`), 'fade')) as string);
    save(`bg_${t}_near`, (await call('silhouette', bg(`color_${t}`), 'near')) as string);
  }
  const tile = (n: string) => b64(join(NPP, 'Tiles', 'Double', `${n}.png`));
  const frames = (await call('door', tile('door_closed_top'), tile('door_closed'), tile('door_open_top'), tile('door_open'), 40, 80, 4)) as string[];
  frames.forEach((f, i) => save(`door_${i}`, f));

  mkdirSync(join(out, 'keys'), { recursive: true });
  let keys = 0;
  for (const [code, name] of Object.entries(KEYMAP)) {
    const f = join(KEYS, `keyboard_${name}.png`);
    if (existsSync(f)) { copyFileSync(f, join(out, 'keys', `${code}.png`)); keys++; }
  }
  copyFileSync(join(KEYS, 'mouse_left_outline.png'), join(out, 'keys', 'MouseLeft.png'));
  copyFileSync(join(CUR, 'pointer_c.png'), join(out, 'cursor.png'));
  copyFileSync(join(CUR, 'hand_point.png'), join(out, 'cursor_hand.png'));
  console.log(`imported: 9 background layers, ${frames.length} door frames, ${keys + 1} key icons, 2 cursors`);
} finally {
  await browser.close();
}
