import type Phaser from 'phaser';
import type { Session } from '../sim/step.ts';
import { PAL } from './palette.ts';
import { img, nine, tile, res } from './sprites.ts';

const px = (v: number) => v / 256;

interface SwitchView { plate: Phaser.GameObjects.NineSlice; glyph: Phaser.GameObjects.Image; on: number; x: number; y: number; w: number; h: number }
interface GateView { closed: Phaser.GameObjects.TileSprite; open: Phaser.GameObjects.NineSlice; glyphs: Phaser.GameObjects.Image[] }
interface BeamView { on: Phaser.GameObjects.TileSprite; off: Phaser.GameObjects.TileSprite }

// Switches, gates and beams as sprites, updated from the session every frame.
export class ObjectLayer {
  scene: Phaser.Scene;
  switches: SwitchView[] = [];
  gates: GateView[] = [];
  beams: BeamView[] = [];

  constructor(scene: Phaser.Scene, s: Session, depth = 3) {
    this.scene = scene;
    const room = s.room;
    room.switches.forEach((r, i) => {
      const x = px(r.x), y = px(r.y), w = px(r.w), h = px(r.h);
      const plate = nine(scene, 'switch_up', x, y + h - 20, w, 20, depth);
      const glyph = img(scene, `glyph_${i % 4}`, 0, 0, depth + 1).setOrigin(0.5).setTint(PAL.wire);
      this.switches.push({ plate, glyph, on: -1, x, y, w, h });
    });
    room.gates.forEach((g) => {
      const x = px(g.r.x), y = px(g.r.y), w = px(g.r.w), h = px(g.r.h);
      const closed = tile(scene, 'gate_closed', x, y, w, h, depth);
      const open = nine(scene, 'gate_open', x, y, w, h, depth);
      const glyphs = g.by.map((sw, k) => img(scene, `glyph_${sw % 4}`, x + w / 2, y + 7 + k * 9, depth + 1).setOrigin(0.5).setTint(PAL.paper).setScale(0.8 / res(scene, `glyph_${sw % 4}`)));
      this.gates.push({ closed, open, glyphs });
    });
    room.beams.forEach(() => {
      this.beams.push({ on: tile(scene, 'beam_on', 0, 0, 20, 8, depth), off: tile(scene, 'beam_off', 0, 0, 20, 8, depth) });
    });
  }

  update(s: Session, now: number): void {
    this.switches.forEach((v, i) => {
      const on = s.pressed[i];
      if (on === v.on) return;
      v.on = on;
      v.plate.setTexture(on ? 'switch_down' : 'switch_up');
      v.glyph.setPosition(v.x + v.w / 2, v.y + v.h - (on ? 2 : 5) - 6).setScale((on ? 1 : 0.85) / res(this.scene, v.glyph.texture.key));
    });
    this.gates.forEach((v, i) => {
      const open = s.gateOpen[i] === 1;
      v.closed.setVisible(!open);
      v.open.setVisible(open);
      for (const g of v.glyphs) g.setVisible(!open);
    });
    s.room.beams.forEach((b, i) => {
      const v = this.beams[i];
      const o = i * 4;
      const x = px(s.beamSeg[o]), y = px(s.beamSeg[o + 1]), w = px(s.beamSeg[o + 2]), h = px(s.beamSeg[o + 3]);
      const horiz = b.dy === 0;
      const len = horiz ? w : h;
      const live = s.beamLive[i] === 1;
      const show = live ? v.on : v.off;
      const hide = live ? v.off : v.on;
      hide.setVisible(false);
      show.setVisible(len > 0);
      if (len <= 0) return;
      const r = res(this.scene, show.texture.key);
      show.setSize(len * r, 8 * r);
      if (horiz) show.setAngle(0).setPosition(x, y - 2);
      else show.setAngle(90).setPosition(x + 6, y);
      show.setAlpha(live ? 0.8 + 0.2 * Math.sin(now / 40) : 1);
    });
  }
}
