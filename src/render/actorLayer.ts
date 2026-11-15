import type Phaser from 'phaser';
import type { Session } from '../sim/step.ts';
import type { Loop, Self } from '../sim/types.ts';
import { loopAt } from '../sim/selves.ts';
import { SUB } from '../sim/constants.ts';
import { PAL } from './palette.ts';
import { img, res, SPRITES } from './sprites.ts';
import { stampSprite } from './terrain.ts';
import { RES } from './bake.ts';
import { liveFrame, hatKey } from './liveLook.ts';

export interface LivePose { sx: number; sy: number; face: number; blink: boolean }

export function loopPos(l: Loop, t: number, running: boolean): [number, number] {
  const k = loopAt(l, running ? t % l.len : 0);
  return [l.xs[k] / SUB, l.ys[k] / SUB];
}

// A Drone or Loop body with its track number badge.
export class SelfSprite {
  body: Phaser.GameObjects.Image;
  num: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, depth: number) {
    this.body = img(scene, 'drone', 0, 0, depth).setVisible(false);
    this.num = img(scene, 'digit_1', 0, 0, depth + 0.1).setVisible(false);
  }

  show(tr: Self | undefined, n: number, x: number, y: number, alpha = 1): void {
    const on = !!tr;
    this.body.setVisible(on);
    this.num.setVisible(on);
    if (!tr) return;
    const scene = this.body.scene;
    const key = tr.kind === 0 ? 'drone' : 'loop';
    if (this.body.texture.key !== key) this.body.setTexture(key).setScale(1 / res(scene, key));
    const dk = `digit_${n}`;
    if (this.num.texture.key !== dk) this.num.setTexture(dk).setScale(1 / res(scene, dk));
    this.body.setPosition(x, y).setAlpha(alpha);
    this.num.setPosition(x + 8, y + 13).setTint(tr.kind === 0 ? PAL.paper : PAL.loop).setAlpha(alpha);
  }
}

export class LiveSprite {
  im: Phaser.GameObjects.Image;
  hat: Phaser.GameObjects.Image;
  // A fixed hat for this sprite (Customize previews); null follows the player's look.
  hatOverride: string | null = null;
  private sync = () => this.syncHat();
  private ev: Phaser.Events.EventEmitter;

  constructor(scene: Phaser.Scene, depth: number) {
    const d = SPRITES.live_idle;
    this.im = img(scene, 'live_idle', 0, 0, depth).setOrigin(((d.ox ?? 0) + 9) / d.w, ((d.oy ?? 0) + 20) / d.h);
    const h = SPRITES.hat_tophat;
    this.hat = img(scene, 'hat_tophat', 0, 0, depth + 0.05).setOrigin(((h.ox ?? 0) + 9) / h.w, ((h.oy ?? 0) + 20) / h.h).setVisible(false);
    // callers move, fade and hide im directly, so the hat copies it just before each render
    this.ev = scene.events;
    this.ev.on('prerender', this.sync);
  }

  // x, y: top-left of the 18x20 body in game pixels.
  show(x: number, y: number, p: LivePose, vy = 0, ground = true): void {
    const base = p.blink ? 'live_blink' : ground ? 'live_idle' : vy < -200 ? 'live_jump' : vy > 200 ? 'live_fall' : 'live_idle';
    const key = liveFrame(base);
    const r = res(this.im.scene, key);
    if (this.im.texture.key !== key) this.im.setTexture(key);
    this.im.setPosition(x + 9, y + 20).setScale(p.sx / r, p.sy / r).setFlipX(p.face < 0);
  }

  private syncHat(): void {
    const im = this.im, hat = this.hat;
    if (!im.scene || !hat.scene) {
      this.ev.off('prerender', this.sync);
      if (hat.scene) hat.destroy();
      return;
    }
    const key = hatKey(this.hatOverride ?? undefined);
    hat.setVisible(!!key && im.visible);
    if (!key || !im.visible) return;
    if (hat.texture.key !== key) hat.setTexture(key);
    const k = res(im.scene, im.texture.key) / res(hat.scene, key);
    hat.setPosition(im.x, im.y).setScale(im.scaleX * k, im.scaleY * k).setFlipX(im.flipX).setAlpha(im.alpha);
  }
}

// Every self in a session: Drones fixed, Loops at their current frame.
export class SelfLayer {
  sprites: SelfSprite[];
  paths: Phaser.GameObjects.RenderTexture | null = null;
  private pathKey = '';
  private scene: Phaser.Scene;
  private depth: number;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    this.depth = depth;
    this.sprites = [0, 1, 2, 3].map(() => new SelfSprite(scene, depth));
  }

  update(s: Session, running: boolean): void {
    this.syncPaths(s.tracks);
    this.sprites.forEach((sp, i) => {
      const tr = s.tracks[i];
      if (!tr) return sp.show(undefined, i + 1, 0, 0);
      if (tr.kind === 0) sp.show(tr, i + 1, tr.x / SUB, tr.y / SUB);
      else { const [x, y] = loopPos(tr, s.t, running); sp.show(tr, i + 1, x, y); }
    });
  }

  // Loop paths only change when the tracks do, so they live in one baked layer.
  private syncPaths(tracks: Self[]): void {
    const key = tracks.map((t) => (t.kind === 1 ? `L${t.n}:${t.xs[0]}` : 'D')).join(',');
    if (key === this.pathKey) return;
    this.pathKey = key;
    this.paths?.destroy();
    this.paths = null;
    const loops = tracks.filter((t): t is Loop => t.kind === 1);
    if (!loops.length) return;
    const rt = this.scene.add.renderTexture(0, 0, 640 * RES, 360 * RES).setOrigin(0, 0).setScale(1 / RES).setDepth(this.depth - 1);
    for (const l of loops) for (let f = 0; f < l.n; f += 4) stampSprite(this.scene, rt, 'loop_dot', l.xs[f] / SUB + 8, l.ys[f] / SUB + 9, { alpha: 0.45 });
    rt.render();
    this.paths = rt;
  }
}
