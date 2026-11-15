export const PAL = {
  paper: 0xf4ede0,
  paperDetail: 0xe6dccb,
  ink: 0x1e1b26,
  inkTop: 0x433d52,
  live: 0xffc42e,
  drone: 0x5c6b8a,
  droneHatch: 0x46536f,
  loop: 0x7b5cd6,
  bounce: 0x2f6fde,
  wire: 0x1c9c9c,
  danger: 0xe23d3d,
  mute: 0xb9ad98,
  white: 0xffffff,
} as const;

export const CSS = {
  paper: '#F4EDE0',
  ink: '#1E1B26',
  inkSoft: '#6B6478',
  live: '#FFC42E',
  drone: '#5C6B8A',
  loop: '#7B5CD6',
  wire: '#1C9C9C',
  danger: '#E23D3D',
} as const;

export const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
export const MONO = '"Consolas", "Menlo", "Courier New", monospace';

// Body colours the player can pick for the Live (Customize). None near hazard red, switch teal,
// Drone slate, Loop purple or bounce blue, so every gameplay colour keeps one meaning.
export const LIVE_COLOURS: Record<string, number> = {
  yellow: 0xffc42e,
  peach: 0xffae80,
  pink: 0xff9fc6,
  lime: 0xbfe35a,
  mint: 0x7fdcb2,
  sand: 0xe6c79a,
};
