import Phaser from 'phaser';
import type { RoomScene } from './RoomScene.ts';
import type { Session } from '../sim/step.ts';
import { PH_RUN } from '../sim/step.ts';
import { SUB } from '../sim/constants.ts';
import * as E from '../sim/events.ts';
import { input, settings } from '../meta/game.ts';
import { load, room as roomSave, save } from '../meta/save.ts';
import { keyLabel } from '../meta/input.ts';
import { UI } from '../meta/strings.ts';
import { PAL } from '../render/palette.ts';
import type { LivePose } from '../render/actors.ts';
import { Particles } from '../render/fx.ts';
import { Booth } from '../narrator/booth.ts';
import { sfx } from '../audio/sfx.ts';
import { Overlays } from './roomOverlays.ts';

type G = Phaser.GameObjects.Graphics;

// Everything around the sim for one room: sound, effects, Booth, hints and the overlays.
export class RoomFlow {
  scene: RoomScene;
  fx = new Particles();
  booth: Booth;
  ov: Overlays;
  clearT = -1;
  flash = 0;
  squash = 0;
  stretch = 0;
  blinkT = 0;
  boothT = 0;
  hintT = 0;
  hintTier = 0;
  deaths = 0;

  constructor(scene: RoomScene) {
    this.scene = scene;
    const json = scene.room.json;
    this.booth = new Booth(json.id, json.chapter, load().booth, (t, ms) => this.say(t, ms));
    this.ov = new Overlays(scene, this);
  }

  start(): void {
    this.ov.start();
    this.booth.enter();
  }

  private say(text: string, ms: number): void {
    this.scene.hud.say(text);
    this.boothT = ms;
    sfx('talk');
    load().booth = [...this.booth.used];
    save();
  }

  onEvents(s: Session, ev: number[], preT: number): void {
    if (ev.length) this.booth.events(s, ev, preT);
    const lx = s.live.x / SUB + 9, ly = s.live.y / SUB + 20;
    const reduced = settings().reducedMotion;
    for (const e of ev) {
      const c = E.evCode(e);
      switch (c) {
        case E.EV_JUMP: sfx('jump'); this.stretch = 1; this.fx.emit(lx, ly, 4, PAL.paperDetail, { speed: 30, life: 0.3, grav: 60 }); break;
        case E.EV_LAND: sfx('land'); this.squash = 0.6; this.fx.emit(lx, ly, 3, PAL.paperDetail, { speed: 25, life: 0.25, grav: 40 }); break;
        case E.EV_HARDLAND: sfx('hardland'); this.squash = 1; this.fx.emit(lx, ly, 8, PAL.mute, { speed: 50, life: 0.35, grav: 80 }); this.shake(60, 0.002); break;
        case E.EV_BOUNCE: sfx('bounce', E.evArg(e)); this.stretch = 1.2; this.fx.emit(lx, ly, 6, PAL.bounce, { speed: 70, life: 0.35, spread: 2 }); break;
        case E.EV_DRONE: sfx('drone'); break;
        case E.EV_LOOP: sfx('loop'); break;
        case E.EV_KEEP: sfx('keep'); break;
        case E.EV_ERASE: sfx('erase'); break;
        case E.EV_WIPE: sfx('wipe'); break;
        case E.EV_RETRY: sfx('retry'); break;
        case E.EV_REFUSE: sfx('refuse'); break;
        case E.EV_SW_ON: sfx('swOn'); break;
        case E.EV_SW_OFF: sfx('swOff'); break;
        case E.EV_GATE_OPEN: sfx('gateOpen'); break;
        case E.EV_GATE_CLOSE: sfx('gateClose'); break;
        case E.EV_START: sfx('tick'); break;
        case E.EV_DEATH:
        case E.EV_TAPE: {
          this.deaths++;
          const cause = c === E.EV_TAPE ? E.DIE_TAPE : E.evArg(e);
          sfx(cause === E.DIE_BEAM ? 'beamDeath' : cause === E.DIE_PIT ? 'pitDeath' : cause === E.DIE_TAPE ? 'tape' : 'staticDeath');
          const d = s.dead;
          if (d) this.fx.emit(d.xs[d.n - 1] / SUB + 9, d.ys[d.n - 1] / SUB + 10, reduced ? 6 : 16, cause === E.DIE_TAPE ? PAL.mute : PAL.danger, { speed: 90, life: 0.5 });
          if (!reduced) this.flash = 1;
          this.shake(120, 0.004);
          break;
        }
        case E.EV_CLEAR: this.onClear(s); break;
      }
    }
  }

  private shake(ms: number, k: number): void {
    const st = settings();
    if (st.shake && !st.reducedMotion) this.scene.cameras.main.shake(ms, k);
  }

  private onClear(s: Session): void {
    this.clearT = 0;
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
    if (new URLSearchParams(location.search).has('rec')) exportRec(json.id, r.sol);
    sfx('note', json.note);
    if (used <= par && !assisted) setTimeout(() => sfx('medal'), 450);
    const lx = s.live.x / SUB + 9, ly = s.live.y / SUB + 10;
    this.fx.emit(lx, ly, 24, PAL.live, { speed: 110, life: 0.8 });
  }

  blocking(): boolean {
    return this.clearT >= 0 || this.ov.blocking();
  }

  liveVisible(): boolean {
    return true;
  }

  hintOffered(): boolean {
    return this.booth.takesSinceProgress >= 8 || this.hintTier > 0;
  }

  showHint(): void {
    if (!this.hintOffered()) return;
    const hints = this.scene.room.json.hints;
    this.hintTier = Math.min(3, this.hintTier + 1);
    this.scene.hud.say(UI.hintTier(this.hintTier, hints[this.hintTier - 1]), true);
    this.hintT = 7000;
    this.boothT = 0;
    sfx('hint');
  }

  update(delta: number): void {
    const s = this.scene.s;
    const reduced = settings().reducedMotion;
    this.fx.update(delta);
    this.flash = Math.max(0, this.flash - delta / 180);
    this.squash = reduced ? 0 : Math.max(0, this.squash - delta / 120);
    this.stretch = reduced ? 0 : Math.max(0, this.stretch - delta / 140);
    this.blinkT = (this.blinkT + delta) % 3200;
    if (this.boothT > 0 && (this.boothT -= delta) <= 0) this.scene.hud.say('');
    if (this.hintT > 0 && (this.hintT -= delta) <= 0) this.scene.hud.say('');
    if (this.hintT <= 0) this.booth.update(delta, this.scene.ff, s.phase === PH_RUN);
    this.scene.hud.setHint(this.hintOffered() ? UI.hintOffer(keyLabel(input.keys.hint[0] ?? 'KeyH')) : '');
    this.ov.update(delta);
    if (this.clearT >= 0) {
      this.clearT += delta;
      if (this.clearT > 500) this.ov.clearPanel();
    }
  }

  pose(s: Session): LivePose {
    const k = this.stretch * 0.18 - this.squash * 0.22;
    return { sx: 1 - k * 0.8, sy: 1 + k, face: s.live.face, blink: this.blinkT > 3050 || s.phase !== PH_RUN };
  }

  drawFx(g: G): void {
    this.fx.draw(g);
    if (this.flash > 0) {
      g.fillStyle(PAL.danger, 0.12 * this.flash);
      g.fillRect(0, 0, 640, 360);
    }
  }
}

function exportRec(id: string, sol: string): void {
  const blob = new Blob([JSON.stringify({ room: id, takes: JSON.parse(sol) })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${id}.rec.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
