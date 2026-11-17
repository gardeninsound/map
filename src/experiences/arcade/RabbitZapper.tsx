import { useEffect, useRef, useState } from 'react';
import { isTouch, sfx } from '../../city';
import { BackButton, loadScripts, useCabinet } from '../cabinet';
import type { ArcadeGameProps } from './games';
import { store, storedNumber } from '../../city/stored';

/** The kit's handle (public/rabbit-zapper.js, converted from "Rabbit Zapper.html"). */
interface RabbitZapperGame {
  setSound(on: boolean): void;
  destroy(): void;
}
declare global {
  interface Window {
    RabbitZapper?: {
      mount(opts: {
        canvas: HTMLCanvasElement;
        padLeft?: HTMLElement | null;
        padRight?: HTMLElement | null;
        live?: HTMLElement | null;
        base?: string;
        sound?: boolean;
        onEvent?(name: 'win' | 'over', data: { score: number }): void;
      }): RabbitZapperGame;
    };
  }
}

const KIT = import.meta.env.BASE_URL;
/** a plain script in public/, loaded once on first play */
const loadKit = () => loadScripts('rabbit-zapper.js');

const WINS_KEY = 'bearisland-rabbit-zapper-wins';
const readWins = () => storedNumber(WINS_KEY);

/**
 * Rabbit Zapper: monsters creep in from both sides; the rabbit zaps them with eye lasers.
 * Zap four, then the boss, then a picnic. The kit handles its own keys (arrows / A-D zap,
 * Space / Enter start); {B} leaves. "Score" is 1 if the last run melted the boss; best = wins.
 */
export default function RabbitZapper({ onExit }: ArcadeGameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const padL = useRef<HTMLButtonElement>(null);
  const padR = useRef<HTMLButtonElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const won = useRef(false);
  const wins = useRef(readWins());
  const [failed, setFailed] = useState(false);
  // {B} goes back to the arcade floor; {A} (Space) is the kit's own start key, so it's only kept from the map
  const leave = useCabinet({ onExit, result: () => ({ score: won.current ? 1 : 0, best: wins.current }) });

  useEffect(() => {
    let gone = false;
    let game: RabbitZapperGame | null = null;
    loadKit()
      .then(() => {
        if (gone || !canvas.current || !window.RabbitZapper) return;
        game = window.RabbitZapper.mount({
          canvas: canvas.current,
          padLeft: padL.current,
          padRight: padR.current,
          live: live.current,
          base: `${KIT}rabbit-zapper/`,
          sound: !sfx.isMuted(),
          onEvent(name) {
            won.current = name === 'win';
            if (name !== 'win') return;
            wins.current += 1;
            store(WINS_KEY, wins.current);
          },
        });
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      game?.destroy();
    };
  }, []);


  return (
    <div className="scene rabbit-zapper-scene">
      <canvas ref={canvas} className="rabbit-zapper-stage" tabIndex={0} aria-label="Rabbit Zapper. Tap a monster to zap it." />
      <div className="rabbit-zapper-pad">
        <button ref={padL} type="button" aria-label="Zap the nearest monster on the left">◀ ZAP LEFT</button>
        <button ref={padR} type="button" aria-label="Zap the nearest monster on the right">ZAP RIGHT ▶</button>
      </div>
      <p className="duck-scroller-note">
        {failed ? 'The rabbit got lost on the way in. Try again in a moment.' : isTouch() ? 'Tap a monster to zap it.' : 'Click a monster, or ← → to zap that side.'}
      </p>
      <p ref={live} className="sr-only" aria-live="polite" />
      <BackButton onClick={leave} />
    </div>
  );
}
