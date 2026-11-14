// Player-facing UI text. Booth's lines live in src/narrator/lines.ts.
export const STR = {
  title: 'OVERDUB',
  subtitle: 'four tracks, one take at a time',
  booth: 'BOOTH',
  par: (p: string, tracks: number) => `par ${p}  ·  ${tracks} track${tracks === 1 ? '' : 's'}`,
  parNone: '0',
  keysCh1: 'X drone   Z erase   R retry',
  keysAll: 'X drone   C loop   Z erase   R retry',
  cleanTake: 'CLEAN TAKE',
  cleared: 'CLEARED',
  selves: (used: number, par: number) => `selves ${used} / par ${par}`,
  bestTime: (s: string) => `best ${s}`,
  assisted: 'assisted: no medal or time',
  continue: 'Enter  continue',
  playback: 'PLAYBACK',
  paused: 'PAUSED',
  chapter: ['', 'I. COUNT-IN', 'II. ROUND', 'III. BACKBEAT', 'IV. FEEDBACK', 'V. MIXDOWN'],
  chapterSub: ['', 'Drones', 'Loops as time', 'Bounce', 'Hazards as tools', 'All four tracks'],
};

export function fmtTicks(t: number): string {
  const cs = Math.floor((t * 100) / 60);
  return `${Math.floor(cs / 100)}.${String(cs % 100).padStart(2, '0')}s`;
}
