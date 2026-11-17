/**
 * What every game you play from the map shares (Cone Catch, the Duck Arcade's cabinets): {A} goes
 * to the game, {B} leaves and hands back the result, the BACK button, and loading a game kit's
 * plain scripts from public/. A new game uses these rather than copying them (src/experiences/CLAUDE.md).
 */
import { useCallback, useEffect, useRef } from 'react';
import { input, isTouch, withButtons } from '../city';
import type { MiniGameResult } from './minigames/ConeCatch';

type CabinetOptions = {
  onExit(result: MiniGameResult): void;
  /** what to hand back on leaving: this run's score and the best so far */
  result(): MiniGameResult;
  /** {A}: start, jump, play again… (left out: {A} is just kept from reaching the map) */
  onA?(): void;
  /** right before leaving: stop a sound, save the best */
  beforeLeave?(): void;
};

/**
 * {A} → `onA`, {B} → leave. Returns `leave` for the BACK button. Always calls the latest
 * callbacks, so they can read the component's current state.
 */
export function useCabinet(options: CabinetOptions): () => void {
  const latest = useRef(options);
  latest.current = options;
  const leave = useCallback(() => {
    const o = latest.current;
    o.beforeLeave?.();
    input.clear();
    o.onExit(o.result());
  }, []);
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') {
          input.consume('a');
          latest.current.onA?.();
        } else if (b === 'b') {
          input.consume('b');
          leave();
        }
      }),
    [leave],
  );
  return leave;
}

/** the corner button back to where you came from ({B} on keys, ◀ BACK on touch) */
export function BackButton({ onClick, className = '' }: { onClick(): void; className?: string }) {
  return (
    <button className={`minigame-back ${className}`.trim()} onClick={onClick} onPointerDown={(e) => e.stopPropagation()}>
      {isTouch() ? '◀ BACK' : withButtons('{B} BACK')}
    </button>
  );
}

const loads = new Map<string, Promise<void>>();
/**
 * Loads plain scripts from public/ in order (a kit's audio before its game), once: later calls
 * share the first load. A failed load is forgotten, so the next play tries again.
 */
export function loadScripts(...files: string[]): Promise<void> {
  const key = files.join('|');
  let p = loads.get(key);
  if (!p) {
    p = files
      .reduce<Promise<void>>(
        (prev, file) =>
          prev.then(
            () =>
              new Promise<void>((ok, fail) => {
                const s = document.createElement('script');
                s.src = import.meta.env.BASE_URL + file;
                s.onload = () => ok();
                s.onerror = () => fail(new Error(`could not load ${file}`));
                document.head.appendChild(s);
              }),
          ),
        Promise.resolve(),
      )
      .catch((e: unknown) => {
        loads.delete(key);
        throw e;
      });
    loads.set(key, p);
  }
  return p;
}
