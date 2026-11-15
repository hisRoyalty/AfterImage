import Phaser from 'phaser';

export const VIEW_W = 640;
export const VIEW_H = 420;

let game: Phaser.Game | null = null;
const watchers: (() => void)[] = [];

export function initScreen(g: Phaser.Game): void {
  game = g;
  g.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => watchers.forEach((f) => f()));
  g.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => watchers.forEach((f) => f()));
}

// Zoom that fits the 640 x 420 view in a w x h window. Snaps to a whole number when one is within 4%.
export function fitZoom(w: number, h: number): number {
  const z = Math.min(w / VIEW_W, h / VIEW_H);
  const n = Math.round(z);
  return n >= 1 && n <= z * 1.0001 && z - n < n * 0.04 ? n : z;
}

// Text is rasterised at this scale so it stays sharp at the current window size.
export function textRes(): number {
  return Math.max(2, Math.min(6, Math.ceil(fitZoom(window.innerWidth, window.innerHeight))));
}

// Letterboxed camera: the view keeps its aspect ratio and is centred; the rest shows the background colour.
export function fitCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const apply = () => {
    const w = scene.scale.width, h = scene.scale.height;
    const z = fitZoom(w, h);
    const vw = Math.round(VIEW_W * z), vh = Math.round(VIEW_H * z);
    cam.setViewport(Math.floor((w - vw) / 2), Math.floor((h - vh) / 2), vw, vh);
    cam.setZoom(z);
    cam.centerOn(VIEW_W / 2, VIEW_H / 2);
  };
  apply();
  scene.scale.on('resize', apply);
  scene.events.once('shutdown', () => scene.scale.off('resize', apply));
}

export function isFullscreen(): boolean {
  return !!game?.scale.isFullscreen;
}

export function toggleFullscreen(): void {
  if (!game || !game.device.fullscreen.available) return;
  game.scale.toggleFullscreen();
}

export function onFullscreenChange(fn: () => void): void {
  watchers.push(fn);
}
