import { getAudio, voice, midiHz } from './engine.ts';
import type { Session } from '../sim/step.ts';
import { PH_RUN } from '../sim/step.ts';
import { BEAT, ROOM_H, TS } from '../sim/constants.ts';
import { loopAt } from '../sim/selves.ts';
import * as E from '../sim/events.ts';
import type { Loop } from '../sim/types.ts';

const PAD_NOTES = [38, 45, 53, 60];
const SCALE = [0, 3, 5, 7, 10]; // D minor pentatonic over D
const LEAD = 2 / 60; // schedule slightly ahead of the step that triggers it

function scaleNote(step: number, base = 50): number {
  const o = Math.floor(step / 5);
  return base + 12 * o + SCALE[((step % 5) + 5) % 5];
}

interface Pad { osc: OscillatorNode[]; gain: GainNode }

// Music layers follow the sim: bed on every take, one pad per Drone, one riff per Loop.
export class Music {
  private pads: (Pad | null)[] = [null, null, null, null];
  private hiss: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private whir: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private countMs = 0;

  start(): void {
    const a = getAudio();
    if (!a || this.hiss) return;
    this.hiss = this.noiseLoop(0.012, 6000, 'highpass');
  }

  private noiseLoop(vol: number, f: number, type: BiquadFilterType, bus: 'music' | 'sfx' = 'music'): { src: AudioBufferSourceNode; gain: GainNode } | null {
    const a = getAudio();
    if (!a) return null;
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const flt = a.ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    const gain = a.ctx.createGain();
    gain.gain.value = vol;
    src.connect(flt).connect(gain).connect(bus === 'music' ? a.music : a.sfx);
    src.start();
    return { src, gain };
  }

  private syncPads(s: Session): void {
    const a = getAudio();
    if (!a) return;
    for (let i = 0; i < 4; i++) {
      const want = s.tracks[i]?.kind === 0;
      const p = this.pads[i];
      if (want && !p) {
        const gain = a.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, a.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.035, a.ctx.currentTime + 0.6);
        const flt = a.ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = 900;
        flt.connect(gain).connect(a.music);
        const osc = [-6, 6].map((det) => {
          const o = a.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midiHz(PAD_NOTES[i]);
          o.detune.value = det;
          o.connect(flt);
          o.start();
          return o;
        });
        this.pads[i] = { osc, gain };
      } else if (!want && p) {
        this.releasePad(i);
      }
    }
  }

  private releasePad(i: number): void {
    const a = getAudio();
    const p = this.pads[i];
    if (!a || !p) return;
    const t = a.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setTargetAtTime(0.0001, t, 0.15);
    p.osc.forEach((o) => o.stop(t + 0.8));
    this.pads[i] = null;
  }

  // Call after every sim step.
  onStep(s: Session): void {
    const a = getAudio();
    if (!a) return;
    this.syncPads(s);
    if (s.phase !== PH_RUN) return;
    const t = s.t;
    const at = a.ctx.currentTime + LEAD;
    if (t % (2 * BEAT) === BEAT) voice('music', { type: 'noise', f: 1.6, at, dur: 0.05, vol: 0.05, filter: 4500, ftype: 'bandpass', q: 3 });
    if (t % (4 * BEAT) === 0) voice('music', { type: 'sine', f: midiHz(38), at, dur: 0.25, vol: 0.05 });
    for (const l of s.loops) this.riff(l, t, at);
    for (const e of s.ev) if (E.evCode(e) === E.EV_DEATH) this.allPadsDip();
  }

  private riff(l: Loop, t: number, at: number): void {
    const f = t % l.len;
    for (let i = 0; i < l.notes.length; i += 2) {
      if (l.notes[i] !== f) continue;
      const code = l.notes[i + 1];
      const y = l.ys[loopAt(l, f)];
      const step = Math.floor((ROOM_H - y) / (2 * TS));
      const n = scaleNote(step, code === E.EV_SW_ON ? 62 : 50);
      if (code === E.EV_JUMP) voice('music', { type: 'triangle', f: midiHz(n), at, dur: 0.18, vol: 0.05 });
      else if (code === E.EV_BOUNCE) voice('music', { type: 'sine', f: midiHz(n) * 1.5, f2: midiHz(n), at, dur: 0.25, vol: 0.07 });
      else if (code === E.EV_SW_ON) voice('music', { type: 'sine', f: midiHz(n + 12), at, dur: 0.5, vol: 0.04 });
      else voice('music', { type: 'triangle', f: midiHz(n - 12), at, dur: 0.12, vol: 0.05, filter: 1200 });
    }
  }

  private allPadsDip(): void {
    const a = getAudio();
    if (!a) return;
    const t = a.ctx.currentTime;
    for (const p of this.pads) {
      if (!p) continue;
      p.osc.forEach((o) => { o.detune.setValueAtTime(o.detune.value, t); o.detune.linearRampToValueAtTime(-500, t + 0.25); o.detune.linearRampToValueAtTime(0, t + 0.6); });
    }
  }

  // Per frame: count-in clicks, fast-forward whir and ducking.
  update(s: Session, ff: boolean, dt: number): void {
    const a = getAudio();
    if (!a) return;
    this.start();
    const t = a.ctx.currentTime;
    a.musicDuck.gain.setTargetAtTime(ff ? 0.0 : s.phase === PH_RUN ? 1 : 0.45, t, 0.05);
    if (s.phase !== PH_RUN) {
      this.countMs += dt;
      if (this.countMs >= 500) { this.countMs -= 500; voice('music', { type: 'square', f: 1600, dur: 0.02, vol: 0.02, filter: 5000 }); }
    } else this.countMs = 0;
    if (ff && !this.whir) {
      this.whir = this.noiseLoop(0.0001, 2500, 'bandpass', 'sfx');
      this.whir?.gain.gain.setTargetAtTime(0.05, t, 0.05);
    } else if (!ff && this.whir) {
      this.whir.gain.gain.setTargetAtTime(0, t, 0.05);
      this.whir.src.stop(t + 0.3);
      this.whir = null;
    }
  }

  stop(): void {
    const a = getAudio();
    for (let i = 0; i < 4; i++) this.releasePad(i);
    if (a && this.hiss) { this.hiss.src.stop(a.ctx.currentTime + 0.1); this.hiss = null; }
    if (a && this.whir) { this.whir.src.stop(a.ctx.currentTime + 0.1); this.whir = null; }
  }
}
