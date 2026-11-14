import Phaser from 'phaser';

import { SPRITES } from './spriteDefs.ts';

export { SPRITES };

const files = import.meta.glob<string>('../sprites/*.png', { eager: true, query: '?url', import: 'default' });

export function preloadSprites(scene: Phaser.Scene): void {
  for (const key of Object.keys(SPRITES)) {
    const url = files[`../sprites/${key}.png`];
    if (url) scene.load.image(key, url);
  }
}

// Missing files get a visible placeholder; 1x art is switched to nearest-neighbour filtering.
export function finishSprites(scene: Phaser.Scene): void {
  for (const [key, d] of Object.entries(SPRITES)) {
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xff00ff, 1).fillRect(0, 0, d.w * 2, d.h * 2);
      g.generateTexture(key, d.w * 2, d.h * 2);
      g.destroy();
      console.warn(`sprite missing: src/sprites/${key}.png`);
    }
    const r = res(scene, key);
    if (r >= 0.9 && r < 1.5) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

// How many image pixels make one game pixel for this sprite.
export function res(scene: Phaser.Scene, key: string): number {
  const src = scene.textures.get(key).getSourceImage() as { width: number };
  return src.width / SPRITES[key].w;
}

// An image whose body box (ox, oy) sits at x, y in game pixels.
export function img(scene: Phaser.Scene, key: string, x = 0, y = 0, depth = 0): Phaser.GameObjects.Image {
  const d = SPRITES[key];
  return scene.add.image(x, y, key).setOrigin((d.ox ?? 0) / d.w, (d.oy ?? 0) / d.h).setScale(1 / res(scene, key)).setDepth(depth);
}

// A stretchable sprite (switch plates, panels, buttons) of w x h game pixels at x, y.
export function nine(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, depth = 0): Phaser.GameObjects.NineSlice {
  const d = SPRITES[key];
  const r = res(scene, key);
  const s = (d.slice ?? 0) * r;
  return scene.add.nineslice(x, y, key, undefined, w * r, h * r, s, s, s, s, !!d.tile, !!d.tile).setOrigin(0, 0).setScale(1 / r).setDepth(depth);
}

// A repeating sprite (gates, beams) filling w x h game pixels at x, y.
export function tile(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, depth = 0): Phaser.GameObjects.TileSprite {
  const r = res(scene, key);
  return scene.add.tileSprite(x, y, Math.max(1, w * r), Math.max(1, h * r), key).setOrigin(0, 0).setScale(1 / r).setDepth(depth);
}

export function resizeNine(n: Phaser.GameObjects.NineSlice, scene: Phaser.Scene, key: string, w: number, h: number): void {
  const r = res(scene, key);
  n.setSize(w * r, h * r);
}
