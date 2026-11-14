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
  endLine: 'Every take you made is on the reel.',
};

export function fmtTicks(t: number): string {
  const cs = Math.floor((t * 100) / 60);
  return `${Math.floor(cs / 100)}.${String(cs % 100).padStart(2, '0')}s`;
}

export const UI = {
  continue: 'Continue',
  newGame: 'Start',
  rooms: 'Rooms',
  settings: 'Settings',
  resume: 'Resume',
  retryRoom: 'Restart room',
  hint: 'Hint',
  toTitle: 'Title screen',
  back: 'Back',
  master: (v: number) => `Master volume  ‹ ${v} ›`,
  music: (v: number) => `Music  ‹ ${v} ›`,
  sfx: (v: number) => `Sound effects  ‹ ${v} ›`,
  mute: (on: boolean) => `Mute  ${on ? 'on' : 'off'}`,
  reduced: (on: boolean) => `Reduced motion  ${on ? 'on' : 'off'}`,
  shake: (on: boolean) => `Screen shake  ${on ? 'on' : 'off'}`,
  speed: (v: number) => `Assist: game speed  ‹ ${v}% ›`,
  timing: (on: boolean) => `Assist: longer coyote and buffer  ${on ? 'on' : 'off'}`,
  track: (on: boolean) => `Assist: extra track  ${on ? 'on' : 'off'}`,
  controls: 'Controls',
  reset: 'Erase all progress',
  resetSure: 'Press again to erase everything',
  resetDone: 'Progress erased',
  pressKey: 'Press a key…  (Esc cancels)',
  defaults: 'Reset to defaults',
  action: {
    left: 'Move left', right: 'Move right', jump: 'Jump', wait: 'Wait', drone: 'Drone', loop: 'Loop', erase: 'Erase',
    retry: 'Retry (hold to wipe)', ff: 'Fast-forward', hint: 'Hint', pause: 'Pause', confirm: 'Continue',
  } as Record<string, string>,
  locked: 'locked',
  selectHelp: 'arrows choose   Enter play   Esc back',
  menuHelp: 'arrows choose   Enter select',
  hintOffer: (k: string) => `${k} hint`,
  hintTier: (i: number, t: string) => `HINT ${i}/3  ${t}`,
  credits: 'made with Phaser · sound synthesised live',
  mixdown: 'Mixdown',
};
