import { load } from '../meta/save.ts';

// WebAudio graph: voices -> music/sfx buses -> master -> compressor -> out. Created on first input.
export interface Audio {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  noise: AudioBuffer;
  musicDuck: GainNode;
}

let audio: Audio | null = null;

export function getAudio(): Audio | null {
  return audio;
}

export function initAudio(): void {
  if (audio) {
    if (audio.ctx.state === 'suspended') void audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  const master = ctx.createGain();
  master.connect(comp);
  const music = ctx.createGain();
  const musicDuck = ctx.createGain();
  music.connect(musicDuck);
  musicDuck.connect(master);
  const sfx = ctx.createGain();
  sfx.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x3fffffff) - 1;
  }
  audio = { ctx, master, music, sfx, noise, musicDuck };
  applyAudioSettings();
}

export function applyAudioSettings(): void {
  if (!audio) return;
  const st = load().settings;
  const t = audio.ctx.currentTime;
  const m = st.mute ? 0 : st.master / 100;
  audio.master.gain.setTargetAtTime(m * 0.9, t, 0.02);
  audio.music.gain.setTargetAtTime((st.music / 100) * 0.55, t, 0.02);
  audio.sfx.gain.setTargetAtTime((st.sfx / 100) * 0.8, t, 0.02);
}

export function midiHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// A single enveloped voice. type 'noise' uses the shared noise buffer through a filter.
export function voice(bus: 'music' | 'sfx', o: {
  type: OscillatorType | 'noise'; f: number; f2?: number; at?: number; dur: number; vol: number;
  attack?: number; filter?: number; q?: number; ftype?: BiquadFilterType;
}): void {
  if (!audio) return;
  const { ctx } = audio;
  const t0 = Math.max(ctx.currentTime, o.at ?? ctx.currentTime);
  const g = ctx.createGain();
  const a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  const flt = ctx.createBiquadFilter();
  flt.type = o.ftype ?? 'lowpass';
  flt.frequency.value = o.filter ?? 8000;
  flt.Q.value = o.q ?? 0.7;
  flt.connect(g);
  g.connect(bus === 'music' ? audio.music : audio.sfx);
  let src: AudioScheduledSourceNode;
  if (o.type === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    n.loop = true;
    n.playbackRate.value = o.f;
    if (o.f2) n.playbackRate.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    src = n;
  } else {
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    src = osc;
  }
  src.connect(flt);
  src.start(t0);
  src.stop(t0 + o.dur + 0.05);
}
