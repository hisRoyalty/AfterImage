import Phaser from 'phaser';
import { RoomScene } from './scenes/RoomScene.ts';
import { MenuScene } from './scenes/MenuScene.ts';
import { SettingsScene } from './scenes/SettingsScene.ts';
import { ROOMS } from './rooms/index.ts';
import { loadRoom } from './sim/room.ts';
import { replay, solutionMasks } from './sim/replay.ts';
import type { TakeLog } from './sim/types.ts';

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
game.scene.add('menu', MenuScene, roomParam <= 0);
game.scene.add('room', RoomScene, roomParam > 0, { index: startIndex });
game.scene.add('settings', SettingsScene, false);

// Hook for the e2e specs: same sim code as the shipped bundle.
declare global {
  interface Window { __overdub?: unknown }
}
(window as unknown as { __game: Phaser.Game }).__game = game;
window.__overdub = {
  rooms: () => ROOMS.map((r) => r.id),
  replay: (id: string, takes: TakeLog[]) => {
    const json = ROOMS.find((r) => r.id === id);
    if (!json) return null;
    const r = replay(loadRoom(json), takes, undefined, 30);
    return { cleared: r.cleared, hashes: r.hashes, error: r.error };
  },
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
