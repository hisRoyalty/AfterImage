import type { KeyMap } from './input.ts';
import { DEFAULT_KEYS } from './input.ts';

export interface RoomSave {
  cleared: boolean;
  medal: boolean;
  best: number; // ticks of the clearing take, 0 = none
  selves: number;
  assisted: boolean;
  ghosts: string[]; // compressed failed takes kept for the Mixdown
  sol: string; // compressed clearing solution (tracks + clearing take)
  score: number; // best coin score this room has paid, 0-60
  takes: number; // takes ended since this room was last cleared
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  mute: boolean;
  reducedMotion: boolean;
  assistSpeed: number; // 60, 80 or 100
  assistTiming: boolean;
  assistTrack: boolean;
  shake: boolean;
  track: number;
  tutorial: boolean;
}

export interface Wallet { coins: number; earned: number; spent: number; custom: number; retro: boolean }
export interface SkinState { owned: string[]; equipped: string }

export interface SaveData {
  v: 2;
  rooms: Record<string, RoomSave>;
  settings: Settings;
  keys: KeyMap;
  booth: string[];
  seenIntro: string[];
  tutorial: string[]; // tutorial steps already done
  mixdown: boolean;
  wallet: Wallet;
  skins: SkinState;
}

const KEY = 'overdub.save.v2';
// The v1 save is read once for migration and never written or removed: it stays as a backup.
const KEY_V1 = 'overdub.save.v1';

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function defaultSave(): SaveData {
  return {
    v: 2,
    rooms: {},
    settings: { master: 80, music: 70, sfx: 80, mute: false, reducedMotion: prefersReduced(), assistSpeed: 100, assistTiming: false, assistTrack: false, shake: true, track: 0, tutorial: true },
    keys: structuredClone(DEFAULT_KEYS),
    booth: [],
    seenIntro: [],
    tutorial: [],
    mixdown: false,
    wallet: { coins: 0, earned: 0, spent: 0, custom: 0, retro: true },
    skins: { owned: ['lead'], equipped: 'lead' },
  };
}

export function emptyRoom(): RoomSave {
  return { cleared: false, medal: false, best: 0, selves: 0, assisted: false, ghosts: [], sol: '', score: 0, takes: 0 };
}

const nat = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

// Any stored value to a v2 save. Never throws; unknown shapes give a fresh save.
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw) || (raw.v !== 1 && raw.v !== 2)) return d;
  const p = raw as Partial<Record<keyof SaveData, unknown>>;
  const rooms: Record<string, RoomSave> = {};
  if (isObj(p.rooms)) for (const [id, r] of Object.entries(p.rooms)) if (isObj(r)) rooms[id] = { ...emptyRoom(), ...(r as Partial<RoomSave>) };
  const w = isObj(p.wallet) ? p.wallet : {};
  const sk = isObj(p.skins) ? p.skins : {};
  const owned = Array.isArray(sk.owned) ? (sk.owned as unknown[]).filter((s): s is string => typeof s === 'string') : [];
  if (!owned.includes('lead')) owned.unshift('lead');
  const eq = typeof sk.equipped === 'string' && owned.includes(sk.equipped) ? sk.equipped : 'lead';
  return {
    ...d,
    ...(p as Partial<SaveData>),
    v: 2,
    rooms,
    settings: { ...d.settings, ...(isObj(p.settings) ? p.settings : {}) },
    keys: { ...d.keys, ...(isObj(p.keys) ? p.keys : {}) },
    wallet: { coins: nat(w.coins), earned: nat(w.earned), spent: nat(w.spent), custom: nat(w.custom), retro: raw.v === 1 ? false : w.retro !== false },
    skins: { owned, equipped: eq },
  };
}

let cache: SaveData | null = null;

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function load(): SaveData {
  if (cache) return cache;
  const v2 = read(KEY);
  if (isObj(v2) && v2.v === 2) {
    cache = migrate(v2);
    return cache;
  }
  const v1 = read(KEY_V1);
  cache = migrate(v1);
  if (v1) save();
  return cache;
}

export function save(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage full or blocked; progress stays in memory
  }
}

export function room(id: string): RoomSave {
  const d = load();
  return (d.rooms[id] ??= emptyRoom());
}

export function resetSave(): void {
  cache = defaultSave();
  save();
}

// Tests only: forget the cached save so the next load() reads storage again.
export function _resetCache(): void {
  cache = null;
}
