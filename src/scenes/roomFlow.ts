import Phaser from 'phaser';
import type { RoomScene } from './RoomScene.ts';
import type { Session } from '../sim/step.ts';
import { PH_RUN } from '../sim/step.ts';
import * as E from '../sim/events.ts';
import { input, settings } from '../meta/game.ts';
import { room as roomSave, save } from '../meta/save.ts';
import { STR, fmtTicks } from '../meta/strings.ts';
import { PAL, CSS, FONT } from '../render/palette.ts';
import type { LivePose } from '../render/actors.ts';
import { ROOMS } from '../rooms/index.ts';

type G = Phaser.GameObjects.Graphics;

// Everything around the sim for one room: clear panel, simple effects and pose.
export class RoomFlow {
  scene: RoomScene;
  clearT = -1;
  panel: Phaser.GameObjects.Container | null = null;
  flash = 0;
  squash = 0;
  stretch = 0;
  blinkT = 0;

  constructor(scene: RoomScene) {
    this.scene = scene;
  }

  onEvents(ev: number[]): void {
    for (const e of ev) {
      const c = E.evCode(e);
      if (c === E.EV_DEATH || c === E.EV_TAPE) this.flash = 1;
      else if (c === E.EV_JUMP || c === E.EV_BOUNCE) this.stretch = 1;
      else if (c === E.EV_LAND || c === E.EV_HARDLAND) this.squash = c === E.EV_HARDLAND ? 1 : 0.6;
      else if (c === E.EV_CLEAR) this.onClear();
    }
  }

  private onClear(): void {
    this.clearT = 0;
    const s = this.scene.s;
    const json = s.room.json;
    const st = settings();
    const assisted = st.assistTiming || st.assistTrack || st.assistSpeed < 100;
    const par = json.par.drones + json.par.loops;
    const used = s.tracks.length;
    const r = roomSave(json.id);
    const ticks = s.t + 1;
    r.cleared = true;
    if (!assisted) {
      if (used <= par) r.medal = true;
      if (!r.best || ticks < r.best) r.best = ticks;
    } else r.assisted = true;
    if (!r.selves || used < r.selves) r.selves = used;
    r.sol = JSON.stringify(s.logs.concat(s.clearLog ? [s.clearLog] : []));
    save();
  }

  blocking(): boolean {
    return this.clearT >= 0;
  }

  liveVisible(): boolean {
    return true;
  }

  update(delta: number): void {
    const reduced = settings().reducedMotion;
    this.flash = Math.max(0, this.flash - delta / 180);
    this.squash = reduced ? 0 : Math.max(0, this.squash - delta / 120);
    this.stretch = reduced ? 0 : Math.max(0, this.stretch - delta / 140);
    this.blinkT = (this.blinkT + delta) % 3200;
    if (this.clearT < 0) return;
    this.clearT += delta;
    if (this.clearT > 500 && !this.panel) this.showPanel();
    if (this.panel && input.pressed('confirm')) {
      const next = this.scene.index + 1;
      if (next < ROOMS.length) this.scene.scene.start('room', { index: next });
      else this.scene.scene.start('room', { index: 0 });
    }
  }

  private showPanel(): void {
    input.clear();
    const s = this.scene.s;
    const json = s.room.json;
    const par = json.par.drones + json.par.loops;
    const r = roomSave(json.id);
    const st = settings();
    const assisted = st.assistTiming || st.assistTrack || st.assistSpeed < 100;
    const medal = !assisted && s.tracks.length <= par;
    const sc = this.scene;
    const bg = sc.add.graphics();
    bg.fillStyle(PAL.paper, 0.94);
    bg.fillRoundedRect(-120, -52, 240, 104, 8);
    bg.lineStyle(2, PAL.ink, 1);
    bg.strokeRoundedRect(-120, -52, 240, 104, 8);
    const t = (y: number, txt: string, size: number, color: string = CSS.ink, bold = false) =>
      sc.add.text(0, y, txt, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', resolution: 3 }).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [bg,
      t(-32, medal ? STR.cleanTake : STR.cleared, 18, medal ? CSS.ink : CSS.inkSoft, true),
      t(-8, STR.selves(s.tracks.length, par), 12),
      t(10, assisted ? STR.assisted : STR.bestTime(fmtTicks(r.best || s.t + 1)), 11, CSS.inkSoft),
      t(36, STR.continue, 11, CSS.inkSoft)];
    this.panel = sc.add.container(320, 180, items).setDepth(40);
  }

  pose(s: Session): LivePose {
    const k = this.stretch * 0.18 - this.squash * 0.22;
    return { sx: 1 - k * 0.8, sy: 1 + k, face: s.live.face, blink: this.blinkT > 3050 || s.phase !== PH_RUN };
  }

  drawFx(g: G, _now: number): void {
    if (this.flash > 0 && !settings().reducedMotion) {
      g.fillStyle(PAL.danger, 0.18 * this.flash);
      g.fillRect(0, 0, 640, 360);
    }
  }
}
