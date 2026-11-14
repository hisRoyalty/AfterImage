import { IN_L, IN_R, IN_J, IN_JP, IN_WAIT, IN_DRONE, IN_LOOP, IN_ERASE, IN_RETRY, IN_WIPE } from '../sim/constants.ts';

export type Action = 'left' | 'right' | 'jump' | 'wait' | 'drone' | 'loop' | 'erase' | 'retry' | 'ff' | 'hint' | 'pause' | 'confirm';
export const ACTIONS: Action[] = ['left', 'right', 'jump', 'wait', 'drone', 'loop', 'erase', 'retry', 'ff', 'hint', 'pause', 'confirm'];

export type KeyMap = Record<Action, string[]>;

export const DEFAULT_KEYS: KeyMap = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  wait: ['KeyS', 'ArrowDown'],
  drone: ['KeyX'],
  loop: ['KeyC'],
  erase: ['KeyZ'],
  retry: ['KeyR'],
  ff: ['ShiftLeft', 'ShiftRight'],
  hint: ['KeyH'],
  pause: ['Escape'],
  confirm: ['Enter'],
};

const WIPE_TICKS = 36;

export class Input {
  keys: KeyMap = structuredClone(DEFAULT_KEYS);
  private down = new Set<string>();
  private edges = new Set<Action>();
  private codes: string[] = [];
  private retryHeld = 0;
  private wiped = false;
  enabled = true;
  onKey: ((code: string) => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.keydown(e));
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  private keydown(e: KeyboardEvent): void {
    if (e.code === 'F1' || e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (this.onKey) { e.preventDefault(); this.onKey(e.code); return; }
    if (e.repeat) return;
    this.down.add(e.code);
    this.codes.push(e.code);
    if (this.codes.length > 32) this.codes.shift();
    for (const a of ACTIONS) if (this.keys[a].includes(e.code)) this.edges.add(a);
  }

  held(a: Action): boolean {
    for (const k of this.keys[a]) if (this.down.has(k)) return true;
    return false;
  }

  pressed(a: Action): boolean {
    const p = this.edges.has(a);
    this.edges.delete(a);
    return p;
  }

  peek(a: Action): boolean {
    return this.edges.has(a);
  }

  takeCodes(): string[] {
    const c = this.codes;
    this.codes = [];
    return c;
  }

  clear(): void {
    this.edges.clear();
    this.codes = [];
  }

  // One sim tick's input. Pulses fire once; holding Retry for 0.6 s adds a Wipe pulse.
  simMask(ff: boolean): number {
    let m = 0;
    if (!ff) {
      if (this.held('left')) m |= IN_L;
      if (this.held('right')) m |= IN_R;
      if (this.held('jump')) m |= IN_J;
      if (this.pressed('jump')) m |= IN_JP | IN_J;
      if (this.held('wait')) m |= IN_WAIT;
    } else {
      this.edges.delete('jump');
      m |= IN_WAIT;
    }
    if (this.pressed('wait')) m |= IN_WAIT;
    if (this.pressed('drone')) m |= IN_DRONE;
    if (this.pressed('loop')) m |= IN_LOOP;
    if (this.pressed('erase')) m |= IN_ERASE;
    if (this.pressed('retry')) { m |= IN_RETRY; this.retryHeld = 0; this.wiped = false; }
    if (this.held('retry')) {
      if (++this.retryHeld >= WIPE_TICKS && !this.wiped) { m |= IN_WIPE; this.wiped = true; }
    } else this.retryHeld = 0;
    return m;
  }

  get wipeProgress(): number {
    return this.held('retry') && !this.wiped ? Math.min(1, this.retryHeld / WIPE_TICKS) : 0;
  }
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift',
    Escape: 'Esc', Enter: 'Enter', Backspace: 'Bksp', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', Tab: 'Tab',
  };
  return names[code] ?? code;
}
