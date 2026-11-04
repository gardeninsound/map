import { useEffect, useRef, useState } from 'react';
import { input, isTouch, sfx, withButtons } from '../../city';
import type { ArcadeGameProps } from './games';

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

/** A plain script in public/, loaded once on first play. */
let loading: Promise<void> | null = null;
const loadKit = () =>
  (loading ??= new Promise<void>((ok, fail) => {
    const s = document.createElement('script');
    s.src = `${KIT}rabbit-zapper.js`;
    s.onload = () => ok();
    s.onerror = () => fail(new Error('could not load rabbit-zapper.js'));
    document.head.appendChild(s);
  })).catch((e) => {
    loading = null;
    throw e;
  });

const WINS_KEY = 'bearisland-rabbit-zapper-wins';
const readWins = () => {
  try {
    return Number(localStorage.getItem(WINS_KEY)) || 0;
  } catch {
    return 0;
  }
};

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
  const exit = useRef(onExit);
  exit.current = onExit;

  const leave = () => {
    input.clear();
    exit.current({ score: won.current ? 1 : 0, best: wins.current });
  };

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
            try {
              localStorage.setItem(WINS_KEY, String(wins.current));
            } catch {
              /* private mode */
            }
          },
        });
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      game?.destroy();
    };
  }, []);

  // B goes back to the arcade floor; A (Space) is the kit's own start key, so just swallow it here
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') input.consume('a');
        else if (b === 'b') {
          input.consume('b');
          leave();
        }
      }),
    [],
  );

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
      <button className="minigame-back" onClick={leave}>
        {isTouch() ? '◀ BACK' : withButtons('{B} BACK')}
      </button>
    </div>
  );
}
