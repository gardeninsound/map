import { useEffect, useRef } from 'react';
import type { Game, Target } from '../game/Game';
import { buttonLabel } from '../game/input';
import { Tile } from '../world/world';
import { PAL } from '../game/render/palette';

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

export function NearbyCard({ target }: { target: Target | null }) {
  if (!target) return null;
  const [name, where, verb] =
    target.kind === 'place'
      ? [target.loc.name, target.loc.where, target.loc.experience ? 'look' : 'talk']
      : [target.npc.voice.name, null, 'say hi'];
  return (
    <div className={`nearby${target.kind === 'npc' ? ' nearby-small' : ''}`}>
      <div className="nearby-name">{name}</div>
      {where && <div className="nearby-where">{where}</div>}
      <div className="nearby-hint">
        <kbd>{buttonLabel('a')}</kbd> {verb}
      </div>
    </div>
  );
}

/** Whole-peninsula map, 1px per tile, with art spots and a live player dot. */
export function Minimap({ game, open }: { game: Game; open: boolean }) {
  const base = useRef<HTMLCanvasElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

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
        for (const loc of game.places) {
          ctx.fillStyle = loc.experience ? '#ffe066' : '#ff7eb6';
          if (game.visited.has(loc.id)) ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.floor(loc.x) - 2, Math.floor(loc.y) - 2, 5, 5);
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
        <span><i style={{ background: '#ffe066' }} /> open</span>
        <span><i style={{ background: '#ff7eb6' }} /> soon</span>
        <span><i style={{ background: '#ff5d5d' }} /> you</span>
      </div>
    </div>
  );
}
