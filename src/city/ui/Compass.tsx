import { useEffect, useRef, useState } from 'react';
import type { CityGame } from '../engine/CityGame';
import { INK } from '../render/palette';
import { ARROW_N, ARROW_NE } from '../render/sprites';

function Arrow({ dir }: { dir: number }) {
  const grid = dir % 2 === 0 ? ARROW_N : ARROW_NE;
  const turn = Math.floor(dir / 2) * 90;
  return (
    <svg viewBox="0 0 11 11" className="compass-arrow" style={{ transform: `rotate(${turn}deg)` }} shapeRendering="crispEdges" aria-hidden>
      {grid.flatMap((row, y) =>
        [...row].map((c, x) => (c === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="#ff5d5d" /> : null)),
      )}
    </svg>
  );
}

/** A place the compass can point to (tile coords). */
export interface CompassSpot {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Nearest spot, measured in tiles, with its bearing (0 = north, clockwise). */
export function nearestSpot<T extends CompassSpot>(spots: T[], x: number, y: number) {
  let best: { loc: T; d: number; angle: number } | null = null;
  for (const loc of spots) {
    const d = Math.hypot(loc.x - x, loc.y - y);
    if (!best || d < best.d) best = { loc, d, angle: Math.atan2(loc.x - x, -(loc.y - y)) };
  }
  return best;
}

/** 0 = N, 1 = NE … 7 = NW, from a bearing in radians (0 = north, clockwise). */
export const octant = (angle: number) => ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;

/**
 * Points at the nearest of `spots` (re-read every tick), with its name and distance.
 * Polls the game ~8×/s rather than every frame; re-renders only when something changes.
 */
export function Compass({ game, spots, onClick }: { game: CityGame; spots: () => CompassSpot[]; onClick?(): void }) {
  const getSpots = useRef(spots);
  getSpots.current = spots;
  const [state, setState] = useState<{ id: string; name: string; dir: number; metres: number; here: boolean } | null>(null);

  useEffect(() => {
    const tick = () => {
      const { x, y } = game.player.pos;
      const near = nearestSpot(getSpots.current(), x, y);
      if (!near) return setState(null);
      const metres = Math.round((near.d * game.world.tileMeters) / 10) * 10;
      const next = { id: near.loc.id, name: near.loc.name, dir: octant(near.angle), metres, here: near.d < 2.5 };
      setState((s) =>
        s && s.id === next.id && s.dir === next.dir && s.metres === next.metres && s.here === next.here ? s : next,
      );
    };
    tick();
    const id = setInterval(tick, 125);
    return () => clearInterval(id);
  }, [game]);

  if (!state) return null;
  const label = state.here ? "you're here!" : state.metres >= 1000 ? `${(state.metres / 1000).toFixed(1)} km` : `${state.metres} m`;
  return (
    <button className="compass" onClick={onClick} aria-label={`Nearest: ${state.name}, ${label}`}>
      <span className="compass-face" style={{ borderColor: INK }}>
        <span className="compass-n" aria-hidden>N</span>
        {state.here ? <span className="compass-star" aria-hidden>★</span> : <Arrow dir={state.dir} />}
      </span>
      <span className="compass-text">
        <span className="compass-name">{state.name}</span>
        <span className="compass-dist">{label}</span>
      </span>
    </button>
  );
}
