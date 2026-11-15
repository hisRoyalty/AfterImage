import type Phaser from 'phaser';
import { SPRITES } from './sprites.ts';
import { LIVE_COLOURS, PAL } from './palette.ts';
import type { Look } from '../meta/look.ts';

// The Live's frames recoloured in place: each pixel is solved as a mix of ink, Live yellow and white,
// then rebuilt with the chosen colour in place of the yellow, so outline, eyes and edges stay intact.
const FRAMES = ['live_idle', 'live_blink', 'live_jump', 'live_fall'];
let look: Look = { colour: 'yellow', hat: 'none' };

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

// Inverse of the 3x3 matrix whose columns are ink, yellow and white.
function inverse(m: number[][]): number[][] {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

const INK = rgb(PAL.ink), YEL = rgb(PAL.live), WHITE = [255, 255, 255];
const INV = inverse([0, 1, 2].map((k) => [INK[k], YEL[k], WHITE[k]]));

export function currentLook(): Look {
  return look;
}

// Texture key to draw for a Live frame under the current colour.
export function liveFrame(key: string): string {
  return look.colour === 'yellow' ? key : `${key}_c`;
}

export function hatKey(id: string = look.hat): string | null {
  return id === 'none' ? null : `hat_${id}`;
}

// Applies a look: rebuilds the recoloured frames (once per colour change) and remembers the hat.
export function applyLook(scene: Phaser.Scene, next: Look): void {
  const recolour = next.colour !== look.colour || !scene.textures.exists('live_idle_c');
  look = { ...next };
  if (!recolour || look.colour === 'yellow') return;
  const col = rgb(LIVE_COLOURS[look.colour] ?? PAL.live);
  for (const key of FRAMES) {
    const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const w = src.width, h = src.height, ck = `${key}_c`;
    SPRITES[ck] = SPRITES[key];
    const tex = scene.textures.exists(ck) ? (scene.textures.get(ck) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(ck, w, h);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0);
    const px = ctx.getImageData(0, 0, w, h);
    const d = px.data;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3] === 0) continue;
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const wi = INV[0][0] * r + INV[0][1] * g + INV[0][2] * b;
      const wy = INV[1][0] * r + INV[1][1] * g + INV[1][2] * b;
      const ww = INV[2][0] * r + INV[2][1] * g + INV[2][2] * b;
      for (let k = 0; k < 3; k++) d[p + k] = Math.max(0, Math.min(255, Math.round(wi * INK[k] + wy * col[k] + ww * WHITE[k])));
    }
    ctx.putImageData(px, 0, 0);
    tex.refresh();
  }
}
