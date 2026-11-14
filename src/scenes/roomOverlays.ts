import Phaser from 'phaser';
import type { RoomScene } from './RoomScene.ts';
import type { RoomFlow } from './roomFlow.ts';
import { Menu, panel, text } from './ui.ts';
import type { Item } from './ui.ts';
import { ROOMS } from '../rooms/index.ts';
import { input, settings } from '../meta/game.ts';
import { room as roomSave } from '../meta/save.ts';
import { STR, UI, fmtTicks } from '../meta/strings.ts';
import { PAL, CSS } from '../render/palette.ts';
import { img, nine } from '../render/sprites.ts';
import { sfx } from '../audio/sfx.ts';

// Chapter card, pause menu and the clear panel for a room.
export class Overlays {
  scene: RoomScene;
  flow: RoomFlow;
  card: Phaser.GameObjects.Container | null = null;
  cardT = 0;
  pause: Menu | null = null;
  pauseBg: Phaser.GameObjects.Container | null = null;
  panel: Phaser.GameObjects.Container | null = null;
  videoHint: Phaser.GameObjects.Text | null = null;

  constructor(scene: RoomScene, flow: RoomFlow) {
    this.scene = scene;
    this.flow = flow;
    scene.events.on('resume', () => { input.clear(); this.pause?.refresh(); });
  }

  start(): void {
    const i = this.scene.index;
    const ch = ROOMS[i].chapter;
    if (i === 0 || ROOMS[i - 1].chapter !== ch) this.showCard(ch);
  }

  private showCard(ch: number): void {
    const sc = this.scene;
    const g = sc.add.graphics();
    g.fillStyle(PAL.ink, 1);
    g.fillRect(220, 214, 200, 2);
    this.card = sc.add.container(0, 0, [img(sc, 'paper'), g,
      text(sc, 320, 190, STR.chapter[ch], 26, CSS.ink, true).setOrigin(0.5),
      text(sc, 320, 236, STR.chapterSub[ch], 13, CSS.inkSoft).setOrigin(0.5)]).setDepth(80);
    this.cardT = 2200;
  }

  blocking(): boolean {
    return !!this.card || !!this.pause;
  }

  update(dt: number): void {
    if (this.card) {
      this.cardT -= dt;
      const skip = input.pressed('confirm') || input.pressed('jump');
      this.card.setAlpha(Math.min(1, this.cardT / 400));
      if (this.cardT <= 0 || skip) { this.card.destroy(); this.card = null; input.clear(); }
      return;
    }
    if (this.panel) {
      if (input.takeCodes().includes('KeyV') && this.scene.recorder.blob) { this.scene.recorder.download(`overdub-${this.scene.room.json.id}.webm`); sfx('confirm'); }
      this.videoHint?.setVisible(!!this.scene.recorder.blob);
      if (input.pressed('confirm')) this.next();
      return;
    }
    if (this.pause) {
      const r = this.pause.update(input.takeCodes());
      if (r === 'back') this.closePause();
      return;
    }
    if (input.pressed('pause')) this.openPause();
    else if (input.pressed('hint')) this.flow.showHint();
  }

  private openPause(): void {
    sfx('back');
    input.clear();
    this.pauseBg = panel(this.scene, 200, 190, 60);
    const items: Item[] = [
      { label: () => UI.resume, act: () => this.closePause() },
      { label: () => UI.retryRoom, act: () => this.scene.scene.restart({ index: this.scene.index }) },
    ];
    if (this.flow.hintOffered()) items.push({ label: () => UI.hint, act: () => { this.closePause(); this.flow.showHint(); } });
    items.push(
      { label: () => UI.settings, act: () => { this.scene.scene.pause(); this.scene.scene.launch('settings', { from: 'room' }); } },
      { label: () => UI.rooms, act: () => this.scene.scene.start('menu', { select: true, index: this.scene.index }) },
      { label: () => UI.toTitle, act: () => this.scene.scene.start('menu') },
    );
    this.pause = new Menu(this.scene, 320, 210 - (items.length - 1) * 11, items, 22, 13, 62);
    this.pause.onMove = () => sfx('ui');
  }

  private closePause(): void {
    this.pause?.destroy();
    this.pause = null;
    this.pauseBg?.destroy();
    this.pauseBg = null;
    input.clear();
  }

  clearPanel(): void {
    if (this.panel) return;
    input.clear();
    const sc = this.scene;
    const s = sc.s;
    const json = s.room.json;
    const par = json.par.drones + json.par.loops;
    const r = roomSave(json.id);
    const st = settings();
    const assisted = st.assistTiming || st.assistTrack || st.assistSpeed < 100;
    const medal = !assisted && s.tracks.length <= par;
    const bg: Phaser.GameObjects.GameObject[] = [nine(sc, 'panel', -150, -26, 300, 52)];
    if (medal) bg.push(img(sc, 'medal', -138, -18));
    this.panel = sc.add.container(320, 40, [...bg,
      text(sc, -110, -10, medal ? STR.cleanTake : STR.cleared, 15, medal ? CSS.ink : CSS.inkSoft, true).setOrigin(0, 0.5),
      text(sc, 140, -10, STR.playback, 10, CSS.loop, true).setOrigin(1, 0.5),
      text(sc, -110, 10, `${STR.selves(s.tracks.length, par)}   ${assisted ? STR.assisted : STR.bestTime(fmtTicks(r.best || s.t + 1))}`, 10, CSS.inkSoft).setOrigin(0, 0.5),
      text(sc, 140, 10, STR.continue, 10, CSS.ink).setOrigin(1, 0.5)]).setDepth(40);
    this.videoHint = text(sc, 320, 76, STR.saveVideo, 9, CSS.inkSoft).setOrigin(0.5).setDepth(40).setVisible(false);
  }

  private next(): void {
    sfx('confirm');
    const n = this.scene.index + 1;
    if (n < ROOMS.length) this.scene.scene.start('room', { index: n });
    else this.scene.scene.start(this.scene.scene.get('mixdown') ? 'mixdown' : 'menu');
  }
}
