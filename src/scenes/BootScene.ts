import Phaser from 'phaser';
import { preloadSprites, finishSprites } from '../render/sprites.ts';

// Loads every sprite, then hands over to the scene the URL asks for.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    preloadSprites(this);
  }

  create(): void {
    finishSprites(this);
    const target = this.registry.get('start') as { key: string; data?: object };
    this.scene.start(target.key, target.data);
    (this.registry.get('onReady') as (() => void) | undefined)?.();
  }
}
