import { Input } from './input.ts';
import { load } from './save.ts';
import type { Settings } from './save.ts';

export const input = new Input();
input.keys = { ...input.keys, ...load().keys };

export function settings(): Settings {
  return load().settings;
}
