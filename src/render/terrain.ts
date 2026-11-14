import type Phaser from 'phaser';
import { COLS, ROWS, TILE, T_SOLID, T_STATIC, T_DRUM } from '../sim/constants.ts';
import { tileAt } from '../sim/room.ts';
import type { Room } from '../sim/types.ts';
import { PAL } from './palette.ts';
import { res, SPRITES } from './sprites.ts';
import { RES } from './bake.ts';

type G = Phaser.GameObjects.Graphics;
type RT = Phaser.GameObjects.RenderTexture;
const px = (v: number) => v / 256;

// Ground stays code-drawn: rounded ink blocks with a lighter top edge.
export function drawGround(g: G, room: Room): void {
  const solid = (x: number, y: number) => {
    const t = tileAt(room, x, y);
    return t === T_SOLID || t === T_DRUM;
  };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tileAt(room, x, y) !== T_SOLID) continue;
      const X = x * TILE, Y = y * TILE;
      const up = solid(x, y - 1), dn = solid(x, y + 1), lf = solid(x - 1, y), rt = solid(x + 1, y);
      const r = { tl: !up && !lf ? 5 : 0, tr: !up && !rt ? 5 : 0, bl: !dn && !lf ? 5 : 0, br: !dn && !rt ? 5 : 0 };
      g.fillStyle(PAL.ink, 1);
      g.fillRoundedRect(X, Y, TILE, TILE, r);
      if (!up) {
        g.fillStyle(PAL.inkTop, 1);
        g.fillRoundedRect(X + (r.tl ? 2 : 0), Y + 1, TILE - (r.tl ? 2 : 0) - (r.tr ? 2 : 0), 3, { tl: r.tl ? 2 : 0, tr: r.tr ? 2 : 0, bl: 0, br: 0 });
      }
    }
  }
}

// Stamps a sprite into a baked texture at game-pixel position x, y (top-left), optionally rotated about its centre.
export function stampSprite(scene: Phaser.Scene, rt: RT, key: string, x: number, y: number, o: { alpha?: number; tint?: number; angle?: number } = {}): void {
  const d = SPRITES[key];
  const k = RES / res(scene, key);
  rt.stamp(key, undefined, (x + d.w / 2) * RES, (y + d.h / 2) * RES, { originX: 0.5, originY: 0.5, scale: k, alpha: o.alpha ?? 1, tint: o.tint ?? 0xffffff, angle: o.angle ?? 0 });
}

// The whole static room as one image: paper, mute zones, ground, hazards, drumheads, pad, Out and emitters.
export function bakeRoom(scene: Phaser.Scene, room: Room, w = 640, h = 420, depth = 0): RT {
  const rt = scene.add.renderTexture(0, 0, w * RES, h * RES).setOrigin(0, 0).setScale(1 / RES).setDepth(depth);
  stampSprite(scene, rt, 'paper', 0, 0);
  for (const m of room.mutes) {
    for (let y = px(m.y); y < px(m.y + m.h); y += TILE) for (let x = px(m.x); x < px(m.x + m.w); x += TILE) stampSprite(scene, rt, 'mute', x, y);
  }
  const g = scene.make.graphics({}, false);
  drawGround(g, room);
  g.setScale(RES);
  rt.draw(g, 0, 0);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(room, x, y);
      if (t === T_DRUM) stampSprite(scene, rt, 'drum', x * TILE, y * TILE);
      else if (t === T_STATIC) stampSprite(scene, rt, tileAt(room, x, y - 1) === T_STATIC ? 'static_fill' : 'static_top', x * TILE, y * TILE);
    }
  }
  stampSprite(scene, rt, 'pad', px(room.spawnX) + 9 - 20, px(room.spawnY));
  stampSprite(scene, rt, 'out', px(room.out.x), px(room.out.y));
  for (const b of room.beams) stampSprite(scene, rt, 'emitter', b.ex * TILE, b.ey * TILE, { angle: Math.atan2(b.dy, b.dx) * (180 / Math.PI) });
  rt.render();
  g.destroy();
  return rt;
}
