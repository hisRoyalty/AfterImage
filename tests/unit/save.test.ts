import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/meta/screen.ts', () => ({ toggleFullscreen: () => {} }));
import { migrate, defaultSave } from '../../src/meta/save.ts';

const V1_FIXTURE = {
  v: 1,
  rooms: {
    r01: { cleared: true, medal: true, best: 280, selves: 1, assisted: false, ghosts: ['{"i":[2,10],"k":0}'], sol: '[{"i":[2,5],"e":"out"}]' },
    r02: { cleared: true, medal: false, best: 500, selves: 3, assisted: false, ghosts: [], sol: '[{"i":[2,6],"e":"out"}]' },
    r03: { cleared: true, medal: false, best: 0, selves: 1, assisted: true, ghosts: ['{"i":[1,3],"k":1}'], sol: '[{"i":[2,7],"e":"out"}]' },
  },
  settings: { master: 40, music: 10, sfx: 55, mute: true, reducedMotion: true, assistSpeed: 80, assistTiming: true, assistTrack: false, shake: false, track: 3, tutorial: false },
  keys: { jump: ['KeyK'], drone: ['KeyJ'] },
  booth: ['c1.first', 'c1.death'],
  seenIntro: ['r01'],
  tutorial: ['move', 'jump'],
  mixdown: true,
};

describe('save migration', () => {
  it('keeps every v1 field and adds the new ones', () => {
    const fx = structuredClone(V1_FIXTURE);
    const s = migrate(fx);
    expect(s.v).toBe(2);
    for (const [id, r] of Object.entries(V1_FIXTURE.rooms)) expect(s.rooms[id]).toEqual({ ...r, score: 0, takes: 0 });
    expect(s.settings).toEqual(V1_FIXTURE.settings);
    expect(s.keys.jump).toEqual(['KeyK']);
    expect(s.keys.drone).toEqual(['KeyJ']);
    expect(s.keys.left).toEqual(defaultSave().keys.left);
    expect(s.booth).toEqual(V1_FIXTURE.booth);
    expect(s.seenIntro).toEqual(V1_FIXTURE.seenIntro);
    expect(s.tutorial).toEqual(V1_FIXTURE.tutorial);
    expect(s.mixdown).toBe(true);
    expect(s.wallet).toEqual({ coins: 0, earned: 0, spent: 0, custom: 0, retro: false });
    expect(s.skins).toEqual({ owned: ['lead'], equipped: 'lead' });
    expect(s.look).toEqual({ colour: 'yellow', hat: 'none' });
  });

  it('keeps a valid look and repairs a bad one', () => {
    expect(migrate({ v: 2, look: { colour: 'mint', hat: 'tophat' } }).look).toEqual({ colour: 'mint', hat: 'tophat' });
    expect(migrate({ v: 2, look: { colour: 'red', hat: 42 } }).look).toEqual({ colour: 'yellow', hat: 'none' });
    expect(migrate({ v: 2, look: 'x' }).look).toEqual({ colour: 'yellow', hat: 'none' });
  });

  it('gives defaults for garbage', () => {
    for (const g of [null, undefined, 'x', 42, [], { v: 9 }, { rooms: {} }]) {
      const s = migrate(g);
      expect(s.v).toBe(2);
      expect(s.rooms).toEqual({});
      expect(s.wallet.retro).toBe(true);
    }
  });

  it('sanitises wallet and skins', () => {
    const s = migrate({ v: 2, wallet: { coins: -5, earned: 3.7, spent: 'x', custom: 2 }, skins: { owned: [1, 'cans'], equipped: 'reed' } });
    expect(s.wallet).toEqual({ coins: 0, earned: 3, spent: 0, custom: 2, retro: true });
    expect(s.skins.owned).toEqual(['lead', 'cans']);
    expect(s.skins.equipped).toBe('lead');
  });

  it('round-trips v2', () => {
    const a = migrate(structuredClone(V1_FIXTURE));
    a.wallet.coins = 250;
    a.skins = { owned: ['lead', 'cans'], equipped: 'cans' };
    a.rooms.r01.score = 60;
    a.look = { colour: 'pink', hat: 'beret' };
    const b = migrate(JSON.parse(JSON.stringify(a)));
    expect(b).toEqual({ ...a, wallet: { ...a.wallet, retro: false } });
  });
});
