import Phaser from 'phaser';
import { Menu, panel, text, BACK } from './ui.ts';
import type { Item } from './ui.ts';
import { load, save, resetSave } from '../meta/save.ts';
import { input } from '../meta/game.ts';
import { ACTIONS, DEFAULT_KEYS, keyLabel } from '../meta/input.ts';
import type { Action } from '../meta/input.ts';
import { UI } from '../meta/strings.ts';
import { CSS } from '../render/palette.ts';
import { fitCamera } from '../meta/screen.ts';
import { applyAudioSettings } from '../audio/engine.ts';

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export class SettingsScene extends Phaser.Scene {
  menu: Menu | null = null;
  caller = 'menu';
  note!: Phaser.GameObjects.Text;
  resetArmed = false;
  capture: Action | null = null;

  constructor() {
    super('settings');
  }

  init(data: { from?: string }): void {
    this.caller = data.from ?? 'menu';
  }

  create(): void {
    fitCamera(this);
    panel(this, 360, 330);
    this.note = text(this, 320, 362, '', 10, CSS.inkSoft).setOrigin(0.5).setDepth(70);
    this.main();
  }

  private changed(): void {
    save();
    applyAudioSettings();
  }

  private main(): void {
    this.menu?.destroy();
    const st = load().settings;
    const items: Item[] = [
      { label: () => UI.master(st.master), left: () => { st.master = clamp(st.master - 10); this.changed(); }, right: () => { st.master = clamp(st.master + 10); this.changed(); } },
      { label: () => UI.music(st.music), left: () => { st.music = clamp(st.music - 10); this.changed(); }, right: () => { st.music = clamp(st.music + 10); this.changed(); } },
      { label: () => UI.sfx(st.sfx), left: () => { st.sfx = clamp(st.sfx - 10); this.changed(); }, right: () => { st.sfx = clamp(st.sfx + 10); this.changed(); } },
      { label: () => UI.mute(st.mute), act: () => { st.mute = !st.mute; this.changed(); } },
      { label: () => UI.reduced(st.reducedMotion), act: () => { st.reducedMotion = !st.reducedMotion; this.changed(); } },
      { label: () => UI.shake(st.shake), act: () => { st.shake = !st.shake; this.changed(); } },
      { label: () => UI.speed(st.assistSpeed), left: () => { st.assistSpeed = Math.max(60, st.assistSpeed - 20); this.changed(); }, right: () => { st.assistSpeed = Math.min(100, st.assistSpeed + 20); this.changed(); } },
      { label: () => UI.timing(st.assistTiming), act: () => { st.assistTiming = !st.assistTiming; this.changed(); } },
      { label: () => UI.track(st.assistTrack), act: () => { st.assistTrack = !st.assistTrack; this.changed(); } },
      { label: () => UI.controls, act: () => this.controls() },
      { label: () => (this.resetArmed ? UI.resetSure : UI.reset), act: () => this.reset() },
      { label: () => UI.back, act: () => this.close() },
    ];
    this.menu = new Menu(this, 320, 70, items, 22, 12, 60);
  }

  private reset(): void {
    if (!this.resetArmed) { this.resetArmed = true; return; }
    resetSave();
    input.keys = structuredClone(DEFAULT_KEYS);
    this.resetArmed = false;
    this.note.setText(UI.resetDone);
    this.main();
  }

  private controls(): void {
    this.menu?.destroy();
    const keys = load().keys;
    const items: Item[] = ACTIONS.map((a) => ({
      label: () => `${UI.action[a]}   ${keys[a].map(keyLabel).join(' / ')}`,
      act: () => { this.capture = a; this.note.setText(UI.pressKey); input.onKey = (code) => this.bind(code); },
    }));
    items.push({ label: () => UI.defaults, act: () => { Object.assign(keys, structuredClone(DEFAULT_KEYS)); input.keys = structuredClone(DEFAULT_KEYS); save(); } });
    items.push({ label: () => UI.back, act: () => this.main() });
    this.menu = new Menu(this, 320, 66, items, 20, 11, 60);
  }

  private bind(code: string): void {
    input.onKey = null;
    const a = this.capture;
    this.capture = null;
    this.note.setText('');
    if (!a || BACK.includes(code)) { this.menu?.refresh(); return; }
    const keys = load().keys;
    for (const k of ACTIONS) keys[k] = keys[k].filter((c) => c !== code);
    keys[a] = [code];
    input.keys = structuredClone(keys);
    save();
    this.menu?.refresh();
  }

  private close(): void {
    this.menu?.destroy();
    this.menu = null;
    input.clear();
    this.scene.stop();
    this.scene.resume(this.caller);
  }

  update(): void {
    if (this.capture) return;
    const r = this.menu?.update(input.takeCodes());
    if (r === 'back') this.close();
  }
}
