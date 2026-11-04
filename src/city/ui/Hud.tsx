import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CityGame, Target } from '../engine/CityGame';
import { buttonLabel } from '../engine/input';
import { Tile } from '../world/world';
import { PAL } from '../render/palette';

const MINI_COLORS: Record<number, string> = {
  [Tile.Water]: PAL.water,
  [Tile.Land]: PAL.grass,
  [Tile.Park]: PAL.park,
  [Tile.Beach]: PAL.sand,
  [Tile.Road]: PAL.sidewalk,
  [Tile.Freeway]: PAL.freeway,
  [Tile.Civic]: '#b8322a',
  [Tile.Plaza]: '#cbbba8',
  [Tile.Shop]: '#8f8076',
  [Tile.Block]: '#d9b98a',
  [Tile.House]: '#d98c78',
  [Tile.Landmark]: '#e0a93a',
  [Tile.Lawn]: PAL.grassLight,
  [Tile.Parking]: PAL.road,
  [Tile.Drawn]: '#a8442e',
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
  /** a moving thing (another player): drawn outlined, above the place diamonds */
  above?: boolean;
}

/** Where a name tag can sit around its diamond, in the order they're tried. */
const beside = (dy: number) => [
  { left: '7px', right: 'auto', top: `${dy - 6}px`, transform: 'none' },
  { left: 'auto', right: '7px', top: `${dy - 6}px`, transform: 'none' },
];
const TAG_SPOTS = [
  ...beside(0),
  { left: '0', right: 'auto', top: '-22px', transform: 'translateX(-50%)' },
  { left: '0', right: 'auto', top: '9px', transform: 'translateX(-50%)' },
  ...[-11, 11, -22, 22].flatMap(beside),
];

/** A named place shown on the map: a diamond with a name tag (e.g. a landmark). */
export interface MapPlace {
  x: number;
  y: number;
  name: string;
  color: string;
}

export interface MinimapLegend {
  color: string;
  label: string;
}

/**
 * Whole-peninsula map, 1px per tile, with a live player dot, whatever markers the app
 * supplies (read every frame, so they can change), and named places (diamonds with name
 * tags, earliest first: each tag tries right, left, above and below its diamond, then beside
 * it nudged a line or two up or down, taking the first spot that stays on the map and clear
 * of every diamond and the tags already placed; if none is free, only the diamond shows —
 * hover it for the name). Clicking a diamond picks that place. With `onPick`, clicking
 * or tapping the map hands back that spot in tile coordinates (e.g. to jump there).
 */
export function Minimap({
  game,
  open,
  markers = () => [],
  places = [],
  legend = [],
  onPick,
}: {
  game: CityGame;
  open: boolean;
  markers?: () => MapMarker[];
  places?: MapPlace[];
  legend?: MinimapLegend[];
  /** the map was clicked at this spot (tile coords) */
  onPick?: (p: { x: number; y: number }) => void;
}) {
  const tags = useRef<(HTMLElement | null)[]>([]);
  const base = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** over the diamonds: `above` markers, then you, so you're never covered */
  const top = useRef<HTMLCanvasElement>(null);
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
        const markers = getMarkers.current();
        for (const m of markers) {
          if (m.above) continue;
          ctx.fillStyle = m.color;
          ctx.fillRect(Math.floor(m.x) - 2, Math.floor(m.y) - 2, 5, 5);
        }
        const tc = top.current?.getContext('2d');
        if (tc) {
          // drawn at screen resolution, so these stay a readable size however small the map is
          const dpr = window.devicePixelRatio || 1;
          const cw = Math.round(tc.canvas.clientWidth * dpr);
          const ch = Math.round(tc.canvas.clientHeight * dpr);
          if (tc.canvas.width !== cw || tc.canvas.height !== ch) Object.assign(tc.canvas, { width: cw, height: ch });
          tc.setTransform(1, 0, 0, 1, 0, 0);
          tc.clearRect(0, 0, cw, ch);
          const sx = cw / game.world.w;
          const sy = ch / game.world.h;
          const dot = (x: number, y: number, r: number, fill: string, ring = false) => {
            const px = Math.round(x * sx);
            const py = Math.round(y * sy);
            const o = Math.round(2 * dpr);
            if (ring) {
              // a paper ring, so a green scarf still shows on a green park
              const q = o + Math.round(dpr);
              tc.fillStyle = '#fff7e6';
              tc.fillRect(px - r - q, py - r - q, 2 * (r + q), 2 * (r + q));
            }
            tc.fillStyle = '#2b2350';
            tc.fillRect(px - r - o, py - r - o, 2 * (r + o), 2 * (r + o));
            tc.fillStyle = fill;
            tc.fillRect(px - r, py - r, 2 * r, 2 * r);
          };
          for (const m of markers) if (m.above) dot(m.x, m.y, Math.round(3 * dpr), m.color, true);
          // you: always shown, on top of everything, flashing between red and white
          dot(game.player.pos.x, game.player.pos.y, Math.round(4 * dpr), Math.floor(t / 300) % 2 === 0 ? '#ff5d5d' : '#ffffff');
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game, open]);

  // place the name tags: on the map, and clear of each other
  useLayoutEffect(() => {
    if (!open) return;
    const map = canvas.current?.getBoundingClientRect();
    if (!map) return;
    // every diamond is in the way from the start, so no tag covers another place's diamond
    const kept: DOMRect[] = tags.current.flatMap((el) => {
      const d = el?.previousElementSibling?.getBoundingClientRect();
      return d ? [d] : [];
    });
    const fits = (r: DOMRect) =>
      r.left >= map.left && r.right <= map.right && r.top >= map.top && r.bottom <= map.bottom &&
      !kept.some((k) => r.left < k.right + 2 && r.right + 2 > k.left && r.top < k.bottom + 1 && r.bottom + 1 > k.top);
    for (const el of tags.current) {
      if (!el) continue;
      el.style.display = '';
      const spot = TAG_SPOTS.find((c) => {
        Object.assign(el.style, c);
        return fits(el.getBoundingClientRect());
      });
      if (spot) kept.push(el.getBoundingClientRect());
      else el.style.display = 'none';
    }
  }, [open, places]);

  if (!open) return null;
  const { w, h } = game.world;
  return (
    <div className="minimap" aria-label="Map of West Seattle">
      <div className="minimap-map">
        <canvas
          ref={canvas}
          width={w}
          height={h}
          className={onPick ? 'pickable' : undefined}
          title={onPick ? 'Click to go there' : undefined}
          onClick={(e) => {
            if (!onPick) return;
            const r = e.currentTarget.getBoundingClientRect();
            onPick({ x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h });
          }}
        />
        <canvas ref={top} className="minimap-top" aria-hidden="true" />
        {places.map((p, i) => (
          // name + spot: two landmarks can share a short name (both Safeways show as "Safeway")
          <span key={`${p.name}@${p.x},${p.y}`} className="minimap-place" style={{ left: `${(p.x / w) * 100}%`, top: `${(p.y / h) * 100}%` }}>
            <i
              style={{ background: p.color }}
              title={p.name}
              onClick={() => onPick?.({ x: p.x, y: p.y })}
            />
            <b
              ref={(el) => {
                tags.current[i] = el;
              }}
            >
              {p.name}
            </b>
          </span>
        ))}
      </div>
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
