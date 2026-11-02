import { useEffect, useRef, useState } from 'react';
import { input, isTouch, sfx, withButtons } from '../../city';
import type { ArcadeGameProps } from './games';

/** The kit's handle (public/duck-scroller.js, from the Duck Scroller Kit artifact). */
interface DuckScrollerGame {
  restart(): void;
  pause(): void;
  resume(): void;
  setSound(on: boolean): void;
  setMusic(on: boolean): void;
  destroy(): void;
}
type DuckScrollerEvent = 'ready' | 'greeting' | 'duckLine' | 'pineapple' | 'pineappleDone' | 'credits' | 'finished' | 'error';
declare global {
  interface Window {
    DuckScroller?: {
      mount(el: HTMLElement, opts: Record<string, unknown> & { onEvent?(name: DuckScrollerEvent, data: unknown): void }): DuckScrollerGame;
    };
  }
}

const KIT = import.meta.env.BASE_URL;

/** Plain scripts in public/ (audio first, it only sets a global), loaded once on first play. */
let loading: Promise<void> | null = null;
const loadKit = () =>
  (loading ??= ['duck-scroller-audio.js', 'duck-scroller.js'].reduce<Promise<void>>(
    (prev, file) =>
      prev.then(
        () =>
          new Promise((ok, fail) => {
            const s = document.createElement('script');
            s.src = KIT + file;
            s.onload = () => ok();
            s.onerror = () => fail(new Error(`could not load ${file}`));
            document.head.appendChild(s);
          }),
      ),
    Promise.resolve(),
  )).catch((e) => {
    loading = null;
    throw e;
  });

const FOUND_KEY = 'bearisland-duck-scroller-found';
const readFound = () => {
  try {
    return Number(localStorage.getItem(FOUND_KEY)) || 0;
  } catch {
    return 0;
  }
};

/**
 * Duck Scroller: a painted side scroller (the Duck Scroller Kit, mounted as-is). Walk the duck
 * right with arrows / A-D until it finds the pineapple. {B} leaves; {A} plays again after the
 * credits. "Score" is 1 once the pineapple is found; best = times found.
 */
export default function DuckScroller({ onExit }: ArcadeGameProps) {
  const slot = useRef<HTMLDivElement>(null);
  const game = useRef<DuckScrollerGame | null>(null);
  const found = useRef(false);
  const best = useRef(readFound());
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const exit = useRef(onExit);
  exit.current = onExit;

  const leave = () => {
    input.clear();
    exit.current({ score: found.current ? 1 : 0, best: best.current });
  };

  useEffect(() => {
    let gone = false;
    loadKit()
      .then(() => {
        if (gone || !slot.current || !window.DuckScroller) return;
        const g = window.DuckScroller.mount(slot.current, {
          base: `${KIT}duck-scroller/`,
          loadFont: false, // Press Start 2P is bundled
          onEvent(name) {
            if (name === 'pineappleDone' && !found.current) {
              found.current = true;
              best.current += 1;
              try {
                localStorage.setItem(FOUND_KEY, String(best.current));
              } catch {
                /* private mode */
              }
            } else if (name === 'finished') setFinished(true);
            else if (name === 'error') setFailed(true);
          },
        });
        if (sfx.isMuted()) g.setSound(false);
        game.current = g;
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      game.current?.destroy();
      game.current = null;
    };
  }, []);

  // A plays again once the credits are up, B goes back to the arcade floor
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') {
          input.consume('a');
          if (game.current && finishedRef.current) {
            game.current.restart();
            setFinished(false);
          }
        } else if (b === 'b') {
          input.consume('b');
          leave();
        }
      }),
    [],
  );
  const finishedRef = useRef(finished);
  finishedRef.current = finished;

  return (
    <div className="scene duck-scroller-scene">
      <div ref={slot} className="duck-scroller-slot" aria-label="Duck Scroller: walk the duck right to find the pineapple" />
      {failed && <p className="duck-scroller-note">The duck got lost on the way in. Try again in a moment.</p>}
      {finished && <p className="duck-scroller-note">{withButtons('{A} play again')}</p>}
      <button className="minigame-back" onClick={leave}>
        {isTouch() ? '◀ BACK' : withButtons('{B} BACK')}
      </button>
    </div>
  );
}
