import { INK, type CityGame, type CityPlugin, type DrawContext, type Target } from '../../city';
import type { ArtLocation } from '../../content/locations';
import { LEMON_BASE } from '../lemon';
import { buildLemons, buildMike } from '../sprites';

export interface PlacedLocation extends ArtLocation {
  /** tile coords of the lemon, beside the street */
  x: number;
  y: number;
}

/**
 * The art spots: a lemon marks each (ripe where there's a scene, still green if coming
 * soon), Mike waits beside the open ones, and a beacon bobs until you've been. Walk up and press A — the app opens the spot.
 */
export class ArtSpots implements CityPlugin {
  places: PlacedLocation[] = [];
  readonly visited = new Set<string>();
  private mike = buildMike();
  private lemons = buildLemons();

  constructor(private locations: ArtLocation[]) {}

  attach(game: CityGame) {
    this.places = this.locations.map((l) => ({ ...l, ...game.besideRoad(game.world.project(l.lat, l.lon)) }));
  }

  /** spots you can step into */
  get open() {
    return this.places.filter((p) => p.experience);
  }

  targets(): Target[] {
    return this.places.map((loc) => ({
      key: `place:${loc.id}`,
      kind: 'place',
      x: loc.x,
      y: loc.y,
      label: { name: loc.name, where: loc.where, verb: loc.experience ? 'look' : 'talk' },
      data: loc,
    }));
  }

  draw(d: DrawContext) {
    const { ctx, time } = d;
    for (const loc of this.places) {
      const s = d.toScreen(loc);
      if (!d.onScreen(s)) continue;
      const live = !!loc.experience;
      d.push({
        y: loc.y,
        draw: () => {
          ctx.drawImage(live ? this.lemons.ripe : this.lemons.unripe, s.x - 9, s.y - LEMON_BASE - 1);
          if (live) ctx.drawImage(this.mike[Math.floor(time * 2) % 2], s.x + 11, s.y - 14);
          if (!this.visited.has(loc.id)) beacon(ctx, s.x + 1, s.y - LEMON_BASE - 7, time, live);
        },
      });
    }
  }
}

function beacon(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, live: boolean) {
  const bob = Math.round(Math.sin(time * 4) * 2);
  ctx.fillStyle = INK;
  ctx.fillRect(x - 4, y + bob - 1, 9, 6);
  ctx.fillStyle = live ? '#ffe066' : '#ffffff';
  // ▼
  ctx.fillRect(x - 3, y + bob, 7, 1);
  ctx.fillRect(x - 2, y + bob + 1, 5, 1);
  ctx.fillRect(x - 1, y + bob + 2, 3, 1);
  ctx.fillRect(x, y + bob + 3, 1, 1);
  if (live && Math.floor(time * 3) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 6, y + bob - 3, 1, 3);
    ctx.fillRect(x + 5, y + bob - 2, 3, 1);
  }
}
