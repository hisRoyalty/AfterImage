import { getAudio, onAudioReady } from './engine.ts';
import { load, save } from '../meta/save.ts';

// Every .ogg in ./ogg becomes a track. Vite copies them into the build and hands back URLs.
const files = import.meta.glob<string>('./ogg/*.ogg', { eager: true, query: '?url', import: 'default' });

export interface Track { title: string; url: string }

export const TRACKS: Track[] = Object.keys(files)
  .sort((a, b) => a.localeCompare(b))
  .map((k) => ({ title: k.replace(/^.*\//, '').replace(/\.ogg$/i, ''), url: files[k] }));

// Streams one track at a time through the music bus and moves on when it ends, wrapping round.
class Playlist {
  private el: HTMLAudioElement | null = null;
  private started = false;
  private listeners: ((title: string) => void)[] = [];

  get title(): string {
    return TRACKS.length ? TRACKS[this.index].title : '';
  }

  private get index(): number {
    const i = load().settings.track ?? 0;
    return TRACKS.length ? ((i % TRACKS.length) + TRACKS.length) % TRACKS.length : 0;
  }

  get time(): number {
    return this.el ? this.el.currentTime : 0;
  }

  onChange(fn: (title: string) => void): void {
    this.listeners.push(fn);
  }

  start(): void {
    const a = getAudio();
    if (!a || this.started || !TRACKS.length) return;
    this.started = true;
    const el = new Audio();
    el.preload = 'auto';
    el.addEventListener('ended', () => this.skip(1));
    el.addEventListener('error', () => this.skip(1));
    a.ctx.createMediaElementSource(el).connect(a.playlist);
    this.el = el;
    this.load();
  }

  private load(): void {
    if (!this.el) return;
    this.el.src = TRACKS[this.index].url;
    void this.el.play().catch(() => undefined);
    for (const fn of this.listeners) fn(this.title);
  }

  skip(step: number): void {
    if (!TRACKS.length) return;
    load().settings.track = this.index + step;
    save();
    if (this.started) this.load();
    else for (const fn of this.listeners) fn(this.title);
  }
}

export const playlist = new Playlist();
onAudioReady(() => playlist.start());
