// Browser side of the sprite exporter: renders each default sprite at 2x and exposes PNG data URLs.
import { SPRITES } from '../../src/render/spriteDefs.ts';
import { ART } from './art.ts';
import { Pen } from './pen.ts';

const SCALE = 2;
const out: Record<string, string> = {};
for (const [key, d] of Object.entries(SPRITES)) {
  const draw = ART[key];
  if (!draw) { console.warn('no art for', key); continue; }
  const c = document.createElement('canvas');
  c.width = d.w * SCALE;
  c.height = d.h * SCALE;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(SCALE, SCALE);
  draw(new Pen(ctx));
  out[key] = c.toDataURL('image/png');
}
(window as unknown as { __sprites: Record<string, string> }).__sprites = out;
