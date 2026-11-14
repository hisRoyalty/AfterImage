import { load, save } from './save.ts';
import { input } from './game.ts';
import { UI } from './strings.ts';
import { applyAudioSettings, initAudio, onAudioSettings } from '../audio/engine.ts';
import { playlist, TRACKS } from '../audio/playlist.ts';

const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
const WAVES = '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>';
const CROSS = '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
const NEXT = '<path d="M5 6l9 6-9 6zM16 6h3v12h-3z" fill="currentColor"/>';
const svg = (inner: string) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${inner}</svg>`;

const CSS = `
#dock { position: fixed; right: 8px; top: 8px; z-index: 10; display: flex; flex-direction: column;
  align-items: center; gap: 8px; padding: 4px; background: #F4EDE0; border: 2px solid #1E1B26; border-radius: 10px;
  font: 11px "Trebuchet MS", "Segoe UI", Verdana, sans-serif; color: #1E1B26; opacity: .82; transition: opacity .15s; user-select: none; }
#dock:hover { opacity: 1; }
#dock button { all: unset; cursor: pointer; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 6px; }
#dock button:hover { background: #FFC42E; }
#dock .more { display: none; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 4px; }
#dock:hover .more { display: flex; }
#dock .sliders { display: flex; gap: 6px; }
#dock label { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#dock input[type=range] { writing-mode: vertical-lr; direction: rtl; width: 18px; height: 96px; accent-color: #1E1B26; cursor: pointer; margin: 0; }
#dock .now { writing-mode: vertical-rl; max-height: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6B6478; }
#dock.muted input[type=range] { opacity: .4; }
`;

// Volume, mute and track controls in the top corner; sliders open on hover. Mouse only, so the keyboard stays with the game.
export function mountAudioDock(): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const dock = document.createElement('div');
  dock.id = 'dock';
  dock.innerHTML = `
    <button class="mute" tabindex="-1"></button>
    <div class="more">
    <div class="sliders">
      <label title="${UI.musicLabel}"><input class="music" type="range" min="0" max="100" step="5" tabindex="-1" aria-label="${UI.musicLabel}">${UI.musicShort}</label>
      <label title="${UI.sfxLabel}"><input class="sfx" type="range" min="0" max="100" step="5" tabindex="-1" aria-label="${UI.sfxLabel}">${UI.sfxShort}</label>
    </div>
    <button class="next" tabindex="-1" title="${UI.nextTrack}" aria-label="${UI.nextTrack}">${svg(NEXT)}</button>
    <div class="now"></div>
    </div>`;
  document.body.appendChild(dock);
  const $ = <T extends HTMLElement>(c: string) => dock.querySelector(`.${c}`) as T;
  const mute = $<HTMLButtonElement>('mute');
  const music = $<HTMLInputElement>('music');
  const sfx = $<HTMLInputElement>('sfx');
  const next = $<HTMLButtonElement>('next');
  const now = $<HTMLDivElement>('now');
  if (!TRACKS.length) { next.style.display = 'none'; now.style.display = 'none'; }

  const sync = () => {
    const st = load().settings;
    music.value = String(st.music);
    sfx.value = String(st.sfx);
    mute.innerHTML = svg(SPEAKER + (st.mute ? CROSS : WAVES));
    mute.title = st.mute ? UI.unmute : UI.muteLabel;
    mute.setAttribute('aria-label', mute.title);
    dock.classList.toggle('muted', st.mute);
  };
  const changed = () => { save(); applyAudioSettings(); };
  const toggleMute = () => { initAudio(); const st = load().settings; st.mute = !st.mute; changed(); };

  dock.addEventListener('pointerdown', () => initAudio());
  dock.addEventListener('pointerup', () => setTimeout(() => (document.activeElement as HTMLElement | null)?.blur(), 0));
  mute.addEventListener('click', toggleMute);
  music.addEventListener('input', () => { load().settings.music = Number(music.value); changed(); });
  sfx.addEventListener('input', () => { load().settings.sfx = Number(sfx.value); changed(); });
  next.addEventListener('click', () => { initAudio(); playlist.skip(1); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || input.onKey || !input.keys.mute?.includes(e.code)) return;
    toggleMute();
  });
  playlist.onChange((title) => { now.textContent = `♪ ${title}`; now.title = title; });
  now.textContent = TRACKS.length ? `♪ ${playlist.title}` : '';
  onAudioSettings(sync);
  sync();
}
