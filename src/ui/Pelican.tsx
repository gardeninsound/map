import { useEffect, useRef, useState } from 'react';
import type { CityGame } from '../city';
import { pelicanLines } from '../content/pelican';
import { PELICAN_TIMES, PELICAN_TIMES_STILL, pelicanAt, type PelicanFrame, type PelicanPhase } from '../game/pelican';
import { buildPelican } from '../game/sprites';
import { sounds } from './sounds';

/** on the button it's drawn no bigger than this many px per pixel, so its head stays on screen */
const PERCH_SCALE = 2;
/** the button it lands on (App's HUD) */
const BUTTON = '.hud-idea';

interface Shown extends PelicanFrame {
  img: string;
  w: number;
  h: number;
  scale: number;
  /** the button's bottom edge, for the bubble under it */
  below: number | null;
}

/**
 * The pelican's visit after you join (path and timing in game/pelican.ts): in over the map to
 * land beside your rabbit and ask, then up onto the ✿ IDEA button, then away off the screen.
 * Laid over everything, never in the way of a click.
 */
export function Pelican({ game, onDone }: { game: CityGame; onDone(): void }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const sprites = buildPelican();
    const url = new Map<HTMLCanvasElement, string>();
    const src = (c: HTMLCanvasElement) => url.get(c) ?? (url.set(c, c.toDataURL()), url.get(c)!);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const times = still ? PELICAN_TIMES_STILL : PELICAN_TIMES;
    const start = performance.now();
    const from = { x: -80, y: window.innerHeight * 0.3 };
    let last: PelicanPhase | null = null;
    let raf = 0;
    let perched: Element | null = null;

    const tick = (now: number) => {
      // the first frame can be stamped a touch before `start`
      const t = Math.max(0, (now - start) / 1000);
      const base = game.scale;
      const you = game.screenPoint(game.player.pos);
      const el = document.querySelector(BUTTON);
      const r = el?.getBoundingClientRect();
      // over the ✿ end of the button, so its word still shows (facing left, its body sits right of centre)
      const button = r && r.width ? { x: r.left + 4, y: r.bottom - 6 } : null;
      const f = pelicanAt(
        t,
        { from, byYou: { x: you.x + 18 * base, y: you.y + base }, button, away: { x: window.innerWidth + 140, y: -140 } },
        times,
      );

      if (f.phase !== last) {
        if (f.phase === 'ask' || f.phase === 'perch') sounds.gronk();
        if (f.phase === 'arrive' || f.phase === 'hop' || f.phase === 'leave') sounds.flap();
        last = f.phase;
      }
      // the button bobs while it stands on it
      if (f.phase === 'perch' && el && perched !== el) (perched = el).classList.add('pelican-perch');
      if (f.phase !== 'perch' && perched) {
        perched.classList.remove('pelican-perch');
        perched = null;
      }
      if (f.phase === 'done') {
        done.current();
        return;
      }

      const small = Math.min(base, PERCH_SCALE);
      const scale = f.phase === 'hop' ? base + (small - base) * f.k : f.phase === 'perch' || f.phase === 'leave' ? small : base;
      const img = f.flying ? sprites.fly[f.facing][Math.floor(t * 8) % 2]! : sprites.stand[f.facing];
      setShown({ ...f, img: src(img), w: img.width, h: img.height, scale, below: r ? r.bottom : null });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      perched?.classList.remove('pelican-perch');
    };
  }, [game]);

  if (!shown) return null;
  const { pos, w, h, scale, say } = shown;
  return (
    <div className="pelican-layer" aria-live="polite">
      <img
        className="pelican"
        src={shown.img}
        alt=""
        style={{ left: Math.round(pos.x - (w * scale) / 2), top: Math.round(pos.y - h * scale), width: w * scale }}
      />
      {say === 'ask' && (
        <p className="pelican-say" style={{ left: Math.round(pos.x), top: Math.round(pos.y - h * scale - 10) }}>
          {pelicanLines.ask}
        </p>
      )}
      {say === 'dream' && (
        <p className="pelican-say pelican-say-under" style={{ left: Math.round(pos.x), top: Math.round((shown.below ?? pos.y) + 14) }}>
          {pelicanLines.dream}
        </p>
      )}
    </div>
  );
}
