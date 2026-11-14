import { getAudio, voice, midiHz } from './engine.ts';

export type Sfx =
  | 'jump' | 'land' | 'hardland' | 'bounce' | 'drone' | 'loop' | 'keep' | 'erase' | 'wipe' | 'refuse'
  | 'swOn' | 'swOff' | 'gateOpen' | 'gateClose' | 'beamDeath' | 'staticDeath' | 'pitDeath' | 'tape'
  | 'tick' | 'note' | 'medal' | 'hint' | 'ui' | 'confirm' | 'back' | 'talk' | 'retry';

// arg: bounce speed (px/tick) for 'bounce', MIDI note for 'note'.
export function sfx(name: Sfx, arg = 0): void {
  const a = getAudio();
  if (!a) return;
  const t = a.ctx.currentTime;
  switch (name) {
    case 'jump': voice('sfx', { type: 'square', f: 330, f2: 520, dur: 0.09, vol: 0.05, filter: 2400 }); break;
    case 'land': voice('sfx', { type: 'noise', f: 0.6, dur: 0.06, vol: 0.08, filter: 900 }); break;
    case 'hardland':
      voice('sfx', { type: 'noise', f: 0.5, dur: 0.12, vol: 0.14, filter: 700 });
      voice('sfx', { type: 'sine', f: 110, f2: 60, dur: 0.14, vol: 0.12 });
      break;
    case 'bounce': {
      const f = 90 + Math.min(10, arg) * 14;
      voice('sfx', { type: 'sine', f: f * 1.6, f2: f, dur: 0.22, vol: 0.18 });
      voice('sfx', { type: 'noise', f: 1.2, dur: 0.05, vol: 0.05, filter: 3000 });
      break;
    }
    case 'drone':
      voice('sfx', { type: 'square', f: 70, f2: 50, dur: 0.06, vol: 0.12, filter: 600 });
      voice('sfx', { type: 'noise', f: 0.4, dur: 0.05, vol: 0.1, filter: 1500 });
      voice('sfx', { type: 'triangle', f: midiHz(50), dur: 0.7, vol: 0.06, attack: 0.25 });
      break;
    case 'loop': voice('sfx', { type: 'triangle', f: 440, f2: 1320, dur: 0.18, vol: 0.08 }); break;
    case 'keep': voice('sfx', { type: 'sawtooth', f: 220, f2: 660, dur: 0.45, vol: 0.05, attack: 0.38, filter: 1800 }); break;
    case 'erase': voice('sfx', { type: 'triangle', f: 1100, f2: 300, dur: 0.16, vol: 0.07 }); break;
    case 'wipe':
      voice('sfx', { type: 'noise', f: 2.5, f2: 0.3, dur: 0.7, vol: 0.06, filter: 2500, ftype: 'bandpass', q: 2 });
      voice('sfx', { type: 'sawtooth', f: 900, f2: 120, dur: 0.7, vol: 0.03, filter: 1500 });
      break;
    case 'refuse': voice('sfx', { type: 'square', f: 140, dur: 0.08, vol: 0.06, filter: 900 }); break;
    case 'swOn': voice('sfx', { type: 'square', f: 660, dur: 0.05, vol: 0.05, filter: 3000 }); break;
    case 'swOff': voice('sfx', { type: 'square', f: 440, dur: 0.05, vol: 0.04, filter: 2000 }); break;
    case 'gateOpen': voice('sfx', { type: 'triangle', f: 330, f2: 495, dur: 0.14, vol: 0.06 }); break;
    case 'gateClose': voice('sfx', { type: 'triangle', f: 330, f2: 220, dur: 0.12, vol: 0.06 }); break;
    case 'beamDeath':
      voice('sfx', { type: 'sawtooth', f: 1400, f2: 200, dur: 0.3, vol: 0.06, filter: 4000 });
      voice('sfx', { type: 'noise', f: 1.5, dur: 0.2, vol: 0.08, filter: 5000, ftype: 'highpass' });
      break;
    case 'staticDeath': voice('sfx', { type: 'noise', f: 1, dur: 0.28, vol: 0.18, filter: 6000 }); break;
    case 'pitDeath': voice('sfx', { type: 'sine', f: 300, f2: 60, dur: 0.4, vol: 0.12 }); break;
    case 'tape': voice('sfx', { type: 'sawtooth', f: 220, f2: 40, dur: 0.5, vol: 0.06, filter: 1200 }); break;
    case 'retry': voice('sfx', { type: 'triangle', f: 600, f2: 400, dur: 0.06, vol: 0.04 }); break;
    case 'tick': voice('sfx', { type: 'square', f: 1800, dur: 0.02, vol: 0.03, filter: 5000 }); break;
    case 'note': {
      const f = midiHz(arg || 62);
      voice('sfx', { type: 'triangle', f, dur: 1.4, vol: 0.12, attack: 0.01 });
      voice('sfx', { type: 'sine', f: f * 2, dur: 0.9, vol: 0.04 });
      break;
    }
    case 'medal':
      [72, 76, 79].forEach((n, i) => voice('sfx', { type: 'triangle', f: midiHz(n), at: t + 0.09 * i, dur: 0.5, vol: 0.07 }));
      break;
    case 'hint': voice('sfx', { type: 'sine', f: 880, f2: 990, dur: 0.25, vol: 0.05 }); break;
    case 'ui': voice('sfx', { type: 'square', f: 1200, dur: 0.025, vol: 0.025, filter: 4000 }); break;
    case 'confirm': voice('sfx', { type: 'triangle', f: 660, f2: 990, dur: 0.1, vol: 0.06 }); break;
    case 'back': voice('sfx', { type: 'triangle', f: 660, f2: 440, dur: 0.1, vol: 0.05 }); break;
    case 'talk':
      voice('sfx', { type: 'noise', f: 2, dur: 0.03, vol: 0.05, filter: 3000, ftype: 'bandpass' });
      voice('sfx', { type: 'square', f: 1000, at: t + 0.02, dur: 0.03, vol: 0.02, filter: 2500 });
      break;
  }
}
