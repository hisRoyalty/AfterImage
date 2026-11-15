// Backdrop themes. A room can set "theme" in its JSON; otherwise its chapter picks one.
export const CHAPTER_THEME = ['', 'meadow', 'grove', 'spores', 'dunes', 'dusk', 'night'];
export const THEME_NAMES = ['meadow', 'grove', 'spores', 'dunes', 'dusk', 'night', 'plain'];

export function themeOf(r: { chapter: number; theme?: string }): string {
  return r.theme && THEME_NAMES.includes(r.theme) ? r.theme : CHAPTER_THEME[r.chapter] ?? 'plain';
}
