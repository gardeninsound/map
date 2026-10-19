import { useEffect, useRef } from 'react';
import type { CityGame, Target } from '../engine/CityGame';
import { buttonLabel } from '../engine/input';
import { Tile } from '../world/world';
import { PAL } from '../render/palette';

const MINI_COLORS: Record<number, string> = {
  [Tile.Water]: PAL.water,
  [Tile.Land]: PAL.grass,
  [Tile.Park]: PAL.park,
  [Tile.Beach]: PAL.sand,
  [Tile.Road]: '#ffffff',
  [Tile.Freeway]: PAL.freeway,
  [Tile.Civic]: '#c9b48a',
  [Tile.Plaza]: '#c8c6d4',
  [Tile.Shop]: '#8e8ba3',
  [Tile.Block]: '#e0c9a6',
  [Tile.House]: '#ff9ec4',
  [Tile.Landmark]: '#ffd166',
};

export function StreetSign({ name, storefront }: { name: string | null; storefront: string | null }) {
  if (!name) return null;
  return (
    <div className="street-signs" aria-live="polite">
      <div className="street-sign">{name}</div>
      {storefront && <div className="storefront-sign">{storefront}</div>}
    </div>
  );
}

/** The card at the bottom of the screen naming what you're standing next to. */
export function NearbyCard({ target }: { target: Target | null }) {
  if (!target) return null;
  const { name, where, verb } = target.label;
  return (
    <div className={`nearby${where ? '' : ' nearby-small'}`}>
      <div className="nearby-name">{name}</div>
      {where && <div className="nearby-where">{where}</div>}
      <div className="nearby-hint">
        <kbd>{buttonLabel('a')}</kbd> {verb}
      </div>
    </div>
  );
}

export interface MapMarker {
  x: number;
  y: number;
  color: string;
}

export interface MinimapLegend {
  color: string;
  label: string;
}

/**
 * Whole-peninsula map, 1px per tile, with a live player dot and whatever markers the app
 * supplies (read every frame, so they can change).
 */
export function Minimap({
  game,
  open,
  markers = () => [],
  legend = [],
}: {
  game: CityGame;
  open: boolean;
  markers?: () => MapMarker[];
  legend?: MinimapLegend[];
}) {
  const base = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const getMarkers = useRef(markers);
  getMarkers.current = markers;

  useEffect(() => {
    const { world } = game;
    const c = document.createElement('canvas');
    c.width = world.w;
    c.height = world.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(world.w, world.h);
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const lut = Object.fromEntries(Object.entries(MINI_COLORS).map(([k, v]) => [k, rgb(v)]));
    for (let i = 0; i < world.tiles.length; i++) {
      const [r, g, b] = lut[world.tiles[i]];
      img.data.set([r, g, b, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    base.current = c;
  }, [game]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const draw = (t: number) => {
      const c = canvas.current;
      if (c && base.current) {
        const ctx = c.getContext('2d')!;
        ctx.drawImage(base.current, 0, 0);
        for (const m of getMarkers.current()) {
          ctx.fillStyle = m.color;
          ctx.fillRect(Math.floor(m.x) - 2, Math.floor(m.y) - 2, 5, 5);
        }
        const { x, y } = game.player.pos;
        if (Math.floor(t / 300) % 2 === 0) {
          ctx.fillStyle = '#2b2350';
          ctx.fillRect(Math.floor(x) - 3, Math.floor(y) - 3, 7, 7);
          ctx.fillStyle = '#ff5d5d';
          ctx.fillRect(Math.floor(x) - 2, Math.floor(y) - 2, 5, 5);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game, open]);

  if (!open) return null;
  return (
    <div className="minimap" aria-label="Map of West Seattle">
      <canvas ref={canvas} width={game.world.w} height={game.world.h} />
      <div className="minimap-legend">
        {legend.map((l) => (
          <span key={l.label}>
            <i style={{ background: l.color }} /> {l.label}
          </span>
        ))}
        <span>
          <i style={{ background: '#ff5d5d' }} /> you
        </span>
      </div>
    </div>
  );
}
