import Phaser from 'phaser';
import { drawDrone, drawLoop, drawLive } from './actors.ts';

// Everything is drawn at 2x and shown at 0.5 scale, so it stays crisp under the 2x camera zoom.
export const RES = 2;
export const SPR_W = 26;
export const SPR_H = 28;
export const SPR_OX = 4;
export const SPR_OY = 5;

type Draw = (g: Phaser.GameObjects.Graphics) => void;

// Bakes static vector art into a single image once, instead of re-tessellating it every frame.
export function bakeImage(scene: Phaser.Scene, w: number, h: number, draw: Draw, depth = 0): Phaser.GameObjects.RenderTexture {
  const g = scene.make.graphics({}, false);
  draw(g);
  g.setScale(RES);
  const rt = scene.add.renderTexture(0, 0, w * RES, h * RES).setOrigin(0, 0).setScale(1 / RES).setDepth(depth);
  rt.draw(g, 0, 0);
  rt.render();
  g.destroy();
  return rt;
}

export function bakeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  draw(g);
  g.setScale(RES);
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w * RES, height: h * RES }, false);
  rt.draw(g, 0, 0);
  rt.render();
  rt.saveTexture(key);
  g.destroy();
}

// Actor sprites: Live (right, left, blink), Drones and Loops with track numbers 1-4.
export function bakeActors(scene: Phaser.Scene): void {
  bakeTexture(scene, 'live_r', SPR_W, SPR_H, (g) => drawLive(g, SPR_OX, SPR_OY, { sx: 1, sy: 1, face: 1, blink: false }));
  bakeTexture(scene, 'live_l', SPR_W, SPR_H, (g) => drawLive(g, SPR_OX, SPR_OY, { sx: 1, sy: 1, face: -1, blink: false }));
  bakeTexture(scene, 'live_b', SPR_W, SPR_H, (g) => drawLive(g, SPR_OX, SPR_OY, { sx: 1, sy: 1, face: 1, blink: true }));
  for (let n = 1; n <= 4; n++) {
    bakeTexture(scene, `drone_${n}`, SPR_W, SPR_H, (g) => drawDrone(g, SPR_OX, SPR_OY, n));
    bakeTexture(scene, `loop_${n}`, SPR_W, SPR_H, (g) => drawLoop(g, SPR_OX, SPR_OY, n));
  }
}

// An image showing an actor sprite with its box top-left at (x, y).
export function actorImage(scene: Phaser.Scene, key: string, depth: number): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, key).setOrigin(SPR_OX / SPR_W, SPR_OY / SPR_H).setScale(1 / RES).setDepth(depth).setVisible(false);
}
