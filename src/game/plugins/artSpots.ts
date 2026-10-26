import { hash, type CityGame, type CityPlugin, type DrawContext, type Target } from '../../city';
import type { ArtLocation } from '../../content/locations';
import { SPIN_BASE, SPIN_FRAMES } from '../lemonSpin';
import { buildHearts, buildLemons } from '../sprites';

export interface PlacedLocation extends ArtLocation {
  /** tile coords of the lemon, beside the street */
  x: number;
  y: number;
}

/**
 * The art spots: a spinning lemon marks each (ripe where there's a scene, still green if
 * coming soon) with a little heart bobbing above it, beating now and then; it sparkles until
 * you've been. Honors prefers-reduced-motion (a still lemon, a still heart). Walk up and press A — the app opens the spot.
 */
export class ArtSpots implements CityPlugin {
  places: PlacedLocation[] = [];
  readonly visited = new Set<string>();
  private lemons = buildLemons();
  private hearts = buildHearts();
  private still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private locations: ArtLocation[]) {}

  attach(game: CityGame) {
    this.places = this.locations.map((l) => {
      const p = game.world.project(l.lat, l.lon);
      return { ...l, ...(l.pinned ? p : game.besideRoad(p)) };
    });
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
          // each lemon turns at its own phase, about one turn every 1.6 s
          const phase = hash(Math.floor(loc.x), Math.floor(loc.y), 21);
          const frame = this.still ? 0 : Math.floor(time * 10 + phase * SPIN_FRAMES) % SPIN_FRAMES;
          ctx.drawImage((live ? this.lemons.ripe : this.lemons.unripe)[frame], s.x - 12, s.y - SPIN_BASE - 1);
          // the heart: bobbing, with a quick double beat every couple of seconds
          const beatT = (time + phase * 2) % 1.8;
          const beat = !this.still && (beatT < 0.09 || (beatT > 0.2 && beatT < 0.29)) ? 1 : 0;
          const bob = this.still ? 0 : Math.round(Math.sin(time * 3 + phase * 6) * 1.5);
          const hy = s.y - SPIN_BASE - 11 + bob;
          ctx.drawImage((live ? this.hearts.open : this.hearts.soon)[beat], s.x - (beat ? 5 : 4), hy - beat);
          // a twinkle beside the heart until you've been
          if (!this.visited.has(loc.id) && Math.floor(time * 3) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(s.x + 7, hy - 2, 1, 3);
            ctx.fillRect(s.x + 6, hy - 1, 3, 1);
          }
        },
      });
    }
  }
}

