import Phaser from 'phaser';
import { RoomScene } from './scenes/RoomScene.ts';
import { MenuScene } from './scenes/MenuScene.ts';
import { SettingsScene } from './scenes/SettingsScene.ts';
import { MixdownScene } from './scenes/MixdownScene.ts';
import { BootScene } from './scenes/BootScene.ts';
import { ROOMS } from './rooms/index.ts';
import { loadRoom } from './sim/room.ts';
import { replay, solutionMasks } from './sim/replay.ts';
import type { TakeLog } from './sim/types.ts';
import { mountAudioDock } from './meta/audioDock.ts';
import { playlist } from './audio/playlist.ts';
import { getAudio } from './audio/engine.ts';

const params = new URLSearchParams(location.search);
const roomParam = Number(params.get('room') ?? 0);
const startIndex = roomParam > 0 ? Math.max(0, ROOMS.findIndex((r) => Number(r.id.slice(1)) === roomParam)) : 0;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 840,
  backgroundColor: '#F4EDE0',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [],
});
mountAudioDock();
game.registry.set('start', params.has('mixdown') ? { key: 'mixdown' } : roomParam > 0 ? { key: 'room', data: { index: startIndex } } : { key: 'menu' });
game.registry.set('onReady', () => { window.__overdub = hook; });
game.scene.add('menu', MenuScene, false);
game.scene.add('room', RoomScene, false);
game.scene.add('settings', SettingsScene, false);
game.scene.add('mixdown', MixdownScene, false);
game.scene.add('boot', BootScene, true);

// Hook for the e2e specs: same sim code as the shipped bundle.
declare global {
  interface Window { __overdub?: unknown }
}
(window as unknown as { __game: Phaser.Game }).__game = game;
const hook = {
  rooms: () => ROOMS.map((r) => r.id),
  replay: (id: string, takes: TakeLog[]) => {
    const json = ROOMS.find((r) => r.id === id);
    if (!json) return null;
    const r = replay(loadRoom(json), takes, undefined, 30);
    return { cleared: r.cleared, hashes: r.hashes, error: r.error };
  },
  // Feeds a witness into whatever room is running, through the real game loop.
  drive: (takes: TakeLog[]) => {
    const s = game.scene.getScene('room') as RoomScene;
    if (!game.scene.isActive('room')) return null;
    s.driveScripted(solutionMasks(takes), 1000 / 60);
    return { room: s.room.json.id, cleared: s.s.phase === 2 };
  },
  scene: () => game.scene.getScenes(true).map((x) => x.scene.key),
  music: () => ({ title: playlist.title, time: playlist.time, ctx: getAudio()?.ctx.state ?? 'none' }),
  paced: (id: string, takes: TakeLog[], frameMs: number) => {
    game.scene.stop('menu');
    game.scene.stop('room');
    game.scene.start('room', { index: ROOMS.findIndex((r) => r.id === id) });
    return new Promise((res) => {
      setTimeout(() => {
        const s = game.scene.getScene('room') as RoomScene;
        const hash = s.driveScripted(solutionMasks(takes), frameMs);
        res({ hash, cleared: s.s.phase === 2 });
      }, 50);
    });
  },
};
