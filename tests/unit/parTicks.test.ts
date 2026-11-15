import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeParTicks } from '../../tools/dev/parTicks.ts';

describe('par ticks', () => {
  it('match the witnesses', () => {
    const file = JSON.parse(readFileSync(join(process.cwd(), 'src', 'rooms', 'parTicks.json'), 'utf8'));
    expect(file).toEqual(computeParTicks());
  });
});
