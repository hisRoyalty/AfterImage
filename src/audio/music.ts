import { getAudio } from './engine.ts';
import type { Session } from '../sim/step.ts';

// The soundtrack itself is the playlist (playlist.ts). Here: duck it under fast-forward with a tape whir.
export class Music {
  private whir: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  onStep(_s: Session): void {
    // reserved for per-tick music events
  }

  update(_s: Session, ff: boolean, _dt: number): void {
    const a = getAudio();
    if (!a) return;
    const t = a.ctx.currentTime;
    a.musicDuck.gain.setTargetAtTime(ff ? 0.15 : 1, t, 0.08);
    if (ff && !this.whir) {
      const src = a.ctx.createBufferSource();
      src.buffer = a.noise;
      src.loop = true;
      const flt = a.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 2500;
      const gain = a.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(flt).connect(gain).connect(a.sfx);
      src.start();
      gain.gain.setTargetAtTime(0.05, t, 0.05);
      this.whir = { src, gain };
    } else if (!ff && this.whir) {
      this.whir.gain.gain.setTargetAtTime(0, t, 0.05);
      this.whir.src.stop(t + 0.3);
      this.whir = null;
    }
  }

  stop(): void {
    const a = getAudio();
    if (a) a.musicDuck.gain.setTargetAtTime(1, a.ctx.currentTime, 0.1);
    if (a && this.whir) { this.whir.src.stop(a.ctx.currentTime + 0.1); this.whir = null; }
  }
}
