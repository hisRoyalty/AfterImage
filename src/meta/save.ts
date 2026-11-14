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
}

export interface SaveData {
  v: 1;
  rooms: Record<string, RoomSave>;
  settings: Settings;
  keys: KeyMap;
  booth: string[];
  seenIntro: string[];
  mixdown: boolean;
}

const KEY = 'overdub.save.v1';

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function defaultSave(): SaveData {
  return {
    v: 1,
    rooms: {},
    settings: { master: 80, music: 70, sfx: 80, mute: false, reducedMotion: prefersReduced(), assistSpeed: 100, assistTiming: false, assistTrack: false, shake: true },
    keys: structuredClone(DEFAULT_KEYS),
    booth: [],
    seenIntro: [],
    mixdown: false,
  };
}

export function emptyRoom(): RoomSave {
  return { cleared: false, medal: false, best: 0, selves: 0, assisted: false, ghosts: [], sol: '' };
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      if (p.v === 1) {
        cache = { ...d, ...p, settings: { ...d.settings, ...p.settings }, keys: { ...d.keys, ...p.keys } } as SaveData;
        return cache;
      }
    }
  } catch {
    // unreadable save: start fresh
  }
  cache = d;
  return d;
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
