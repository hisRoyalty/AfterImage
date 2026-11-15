import type Phaser from 'phaser';
import { spriteUrl } from '../render/sprites.ts';
import { sfx } from '../audio/sfx.ts';

type Mode = 'menu' | 'play';
let mode: Mode = 'menu';
let lastMove = -1e9;
let device: 'keyboard' | 'mouse' = 'keyboard';
const HIDE_AFTER = 1500;

export const cursorCss = () => `url("${spriteUrl('cursor')}") 4 3, auto`;
export const handCss = () => `url("${spriteUrl('cursor_hand')}") 9 3, pointer`;

// The cursor is always shown in menus; during play it hides until the mouse moves.
export function initPointer(): void {
  const style = document.createElement('style');
  style.textContent = 'body.nocursor canvas { cursor: none !important; }';
  document.head.appendChild(style);
  window.addEventListener('mousemove', () => { lastMove = performance.now(); });
  window.addEventListener('mousedown', () => { device = 'mouse'; lastMove = performance.now(); });
  window.addEventListener('keydown', () => { device = 'keyboard'; });
  setInterval(() => document.body.classList.toggle('nocursor', mode === 'play' && performance.now() - lastMove > HIDE_AFTER), 150);
}

export function setCursorMode(m: Mode): void {
  mode = m;
}

export function useCursor(scene: Phaser.Scene, m: Mode): void {
  scene.input.setDefaultCursor(cursorCss());
  mode = m;
}

export function lastDevice(): 'keyboard' | 'mouse' {
  return device;
}

type Hit = Phaser.GameObjects.Zone | Phaser.GameObjects.Text | Phaser.GameObjects.Image;
export type HitState = 'idle' | 'over' | 'down';

// Makes an object clickable with hover and pressed feedback and a click sound.
export function clickable(obj: Hit, fn: () => void, state?: (s: HitState) => void): void {
  const show = state ?? ((s: HitState) => { if ('setAlpha' in obj) (obj as Phaser.GameObjects.Text).setAlpha(s === 'over' ? 0.7 : s === 'down' ? 0.5 : 1); });
  obj.setInteractive({ cursor: handCss() });
  let down = false;
  obj.on('pointerover', () => show('over'));
  obj.on('pointerout', () => { down = false; show('idle'); });
  obj.on('pointerdown', () => { down = true; show('down'); });
  obj.on('pointerup', () => {
    if (!down) return;
    down = false;
    show('over');
    sfx('click');
    fn();
  });
}
