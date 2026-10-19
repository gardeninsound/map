/**
 * One shared controller: keyboard and the on-screen pad both write into it, the
 * game loop and scenes read from it. Buttons are edge-triggered via `consume`.
 */
export type Button = 'a' | 'b' | 'map' | 'menu' | 'start';
export type Dir = 'up' | 'down' | 'left' | 'right';

const touch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

/** What to call the buttons: A/B on the touch pad, real key names on a keyboard (A is also WASD-left). */
export const buttonLabel = (b: 'a' | 'b') => (touch ? b.toUpperCase() : b === 'a' ? 'SPACE' : 'ESC');
export const isTouch = () => touch;

/** Swap {A} / {B} placeholders in copy for the right button names. */
export const withButtons = (text: string) => text.replace(/\{A\}/g, buttonLabel('a')).replace(/\{B\}/g, buttonLabel('b'));

const held = new Set<Dir>();
const pressed = new Set<Button>();
let run = false;
const listeners = new Set<(b: Button) => void>();

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const KEY_BUTTONS: Record<string, Button> = {
  Space: 'a', Enter: 'a', KeyZ: 'a', KeyE: 'a',
  Escape: 'b', KeyX: 'b', Backspace: 'b',
  KeyM: 'map',
  KeyT: 'menu',
};

export const input = {
  dir() {
    return {
      x: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
      y: (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
    };
  },
  running: () => run,
  hold(d: Dir, on: boolean) {
    if (on) held.add(d);
    else held.delete(d);
  },
  press(b: Button) {
    pressed.add(b);
    listeners.forEach((fn) => fn(b));
  },
  /** true once per press */
  consume(b: Button) {
    return pressed.delete(b);
  },
  clear() {
    held.clear();
    pressed.clear();
  },
  /** subscribe to button presses (for React scenes); returns unsubscribe */
  on(fn: (b: Button) => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function bindKeyboard(target: Window = window) {
  const down = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
    run = e.shiftKey;
    const d = KEY_DIRS[e.code];
    if (d) {
      held.add(d);
      e.preventDefault();
      return;
    }
    const b = KEY_BUTTONS[e.code];
    if (b && !e.repeat) {
      // Let real buttons handle their own Enter/Space activation.
      if ((e.code === 'Enter' || e.code === 'Space') && e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      input.press(b);
    }
  };
  const up = (e: KeyboardEvent) => {
    run = e.shiftKey;
    const d = KEY_DIRS[e.code];
    if (d) held.delete(d);
  };
  const blur = () => held.clear();
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', blur);
  };
}
