import { getAudio } from '../audio/engine.ts';

// Records the canvas (plus the game's audio when possible) into a WebM clip.
export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private dest: MediaStreamAudioDestinationNode | null = null;
  blob: Blob | null = null;

  start(canvas: HTMLCanvasElement): void {
    this.blob = null;
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') return;
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return;
    try {
      const stream = canvas.captureStream(60);
      const a = getAudio();
      if (a) {
        this.dest = a.ctx.createMediaStreamDestination();
        a.master.connect(this.dest);
        const track = this.dest.stream.getAudioTracks()[0];
        if (track) stream.addTrack(track);
      }
      this.chunks = [];
      this.rec = new MediaRecorder(stream, { mimeType: mime });
      this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
      this.rec.onstop = () => { this.blob = new Blob(this.chunks, { type: 'video/webm' }); this.cleanup(); };
      this.rec.start(250);
    } catch {
      this.rec = null;
      this.cleanup();
    }
  }

  stop(): void {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    this.rec = null;
  }

  private cleanup(): void {
    const a = getAudio();
    if (a && this.dest) { try { a.master.disconnect(this.dest); } catch { /* already gone */ } }
    this.dest = null;
  }

  download(name: string): void {
    if (!this.blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
