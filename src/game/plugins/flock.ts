import { rng, Tile, type CityGame, type CityPlugin, type DrawContext } from '../../city';
import { sounds } from '../../ui/sounds';
import { altitude, newBird, spotNear, stepBird, type Bird } from '../flock';
import { buildCrow, buildGull, type CrowSprites } from '../sprites';

interface Kind {
  name: 'crow' | 'gull';
  /** how many are about at once */
  count: number;
  suits: (x: number, y: number) => boolean;
  sprites: CrowSprites;
  birds: Bird[];
}

/** a bird calls as it takes off within this many tiles of you */
const HEAR = 9;

/**
 * Crows on the streets and gulls on the beaches (rules pure + tested in game/flock.ts): a few
 * of each always somewhere near you, pecking about; walk up and they flap off and land a way
 * away, with a caw or a gull's cry. (The snack crow on Alaska is its own plugin, crow.ts.)
 */
export class Flock implements CityPlugin {
  kinds: Kind[] = [];
  private rand = rng(7);
  private fill = 0;

  attach(game: CityGame) {
    const w = game.world;
    this.kinds = [
      { name: 'crow', count: 7, suits: (x, y) => w.isWalkable(x, y), sprites: buildCrow(), birds: [] },
      { name: 'gull', count: 6, suits: (x, y) => w.tileAt(Math.floor(x), Math.floor(y)) === Tile.Beach, sprites: buildGull(), birds: [] },
    ];
  }

  update(dt: number, game: CityGame) {
    const you = game.player.pos;
    // the first of each kind turn up near you, in view (after that they follow you about, out of sight)
    this.fill -= dt;
    if (this.fill <= 0) {
      this.fill = 1;
      for (const k of this.kinds) {
        if (k.birds.length >= k.count) continue;
        const p = spotNear(you, 3, 12, k.suits, this.rand);
        if (p) k.birds.push(newBird(p, this.rand));
      }
    }
    for (const k of this.kinds) {
      for (const b of k.birds) {
        const what = stepBird(b, dt, you, k.suits, this.rand);
        if (what === 'flew' && !game.quiet && Math.hypot(b.pos.x - you.x, b.pos.y - you.y) < HEAR) {
          if (k.name === 'crow') sounds.caw();
          else sounds.gull();
        }
      }
    }
  }

  draw(d: DrawContext) {
    const { ctx, time } = d;
    for (const k of this.kinds) {
      k.birds.forEach((b, i) => {
        const alt = b.flight ? Math.round(altitude(b.flight.t) * 26) : 0;
        const s = d.toScreen(b.pos);
        if (!d.onScreen({ x: s.x, y: s.y - alt }, 20)) return;
        d.push({
          y: b.flight ? Infinity : b.pos.y,
          draw: () => {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(s.x - 2, s.y + 1, alt > 14 ? 3 : 5, 1);
            if (b.flight) {
              const img = k.sprites.fly[b.facing][Math.floor(time * 9 + i) % 2]!;
              ctx.drawImage(img, s.x - 8, s.y - 13 - alt);
            } else {
              // a peck now and then
              const peck = (time * 0.7 + i * 0.37) % 2.2 < 0.15 ? 1 : 0;
              ctx.drawImage(k.sprites.perch[b.facing][peck]!, s.x - 8, s.y - 15);
            }
          },
        });
      });
    }
  }
}
