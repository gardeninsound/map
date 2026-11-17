import { useEffect, useRef, useState } from 'react';
import { sfx, withButtons } from '../../city';
import { BackButton, loadScripts, useCabinet } from '../cabinet';
import type { ArcadeGameProps } from './games';
import { store, storedNumber } from '../../city/stored';

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
/** plain scripts in public/ (audio first, it only sets a global), loaded once on first play */
const loadKit = () => loadScripts('duck-scroller-audio.js', 'duck-scroller.js');

const FOUND_KEY = 'bearisland-duck-scroller-found';
const readFound = () => storedNumber(FOUND_KEY);

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
  const finishedRef = useRef(finished);
  finishedRef.current = finished;
  // {A} plays again once the credits are up, {B} goes back to the arcade floor
  const leave = useCabinet({
    onExit,
    result: () => ({ score: found.current ? 1 : 0, best: best.current }),
    onA: () => {
      if (game.current && finishedRef.current) {
        game.current.restart();
        setFinished(false);
      }
    },
  });

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
              store(FOUND_KEY, best.current);
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


  return (
    <div className="scene duck-scroller-scene">
      <div ref={slot} className="duck-scroller-slot" aria-label="Duck Scroller: walk the duck right to find the pineapple" />
      {failed && <p className="duck-scroller-note">The duck got lost on the way in. Try again in a moment.</p>}
      {finished && <p className="duck-scroller-note">{withButtons('{A} play again')}</p>}
      <BackButton onClick={leave} />
    </div>
  );
}
