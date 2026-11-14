import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'src', 'sim');
const banned: [RegExp, string][] = [
  [/from ['"]phaser['"]/, 'Phaser import'],
  [/Math\.random/, 'Math.random'],
  [/\bDate\b/, 'Date'],
  [/performance\.now/, 'clock'],
  [/(?<![\w.])\d+\.\d+/, 'float literal'],
  [/Math\.(sqrt|sin|cos|pow|exp|log|atan2?|hypot)\b/, 'float math'],
];

describe('sim stays deterministic', () => {
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    it(f, () => {
      const src = readFileSync(join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
      for (const [re, what] of banned) expect(re.test(src), `${what} in ${f}`).toBe(false);
    });
  }
});

import { LINES } from '../../src/narrator/lines.ts';
describe('Booth lines', () => {
  it('stay within 14 words', () => {
    for (const [k, pool] of Object.entries(LINES)) for (const list of pool) for (const l of list) expect(l.split(/\s+/).length, `${k}: ${l}`).toBeLessThanOrEqual(14);
  });
});
