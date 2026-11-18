import { hash, rng, Tile, type CityGame, type CityPlugin, type DrawContext } from '../../city';
import { forageSpot, newSquirrel, stepSquirrel, type Ground, type Squirrel } from '../squirrels';
import { buildSquirrel } from '../squirrelSprites';

/** few enough that a park doesn't look overrun */
const COUNT = 2;

/**
 * Squirrels (idea box #30; rules pure + tested in game/squirrels.ts): two always somewhere
 * near you, scampering on the ground near trees. When one of the neighbors (a person) walks
 * close, it dashes up the nearest tree and hides — just its tail hanging out of the leaves —
 * till the coast is clear. Rabbits are fine: walk right up.
 */
export class Squirrels implements CityPlugin {
  squirrels: Squirrel[] = [];
  private ground!: Ground;
  private rand = rng(23);
  private sprites: ReturnType<typeof buildSquirrel> | null = null;
  private fill = 0;

  attach(game: CityGame) {
    const w = game.world;
    this.ground = {
      ground: (x, y) => w.isWalkable(x, y),
      // park trees, as the map draws them (render/tileArt.ts)
      tree: (tx, ty) => {
        const t = w.tileAt(tx, ty);
        if (t === Tile.Park) return hash(tx, ty, 11) < 0.82;
        if (t === Tile.Lawn) return hash(tx, ty, 11) < 0.14;
        return false;
      },
    };
  }

  update(dt: number, game: CityGame) {
    const you = game.player.pos;
    this.fill -= dt;
    if (this.fill <= 0 && this.squirrels.length < COUNT) {
      this.fill = 1;
      const p = forageSpot(you, 3, 12, this.ground, this.rand);
      if (p) this.squirrels.push(newSquirrel(p));
    }
    // the people walking about (not the cat, the crow, the chicken…)
    const people = game.npcs.filter((n) => !n.custom).map((n) => n.pos);
    for (const s of this.squirrels) stepSquirrel(s, dt, people, you, this.ground, this.rand);
  }

  draw(d: DrawContext) {
    const sp = (this.sprites ??= buildSquirrel());
    const { ctx, time } = d;
    this.squirrels.forEach((s, i) => {
      const p = d.toScreen(s.pos);
      if (!d.onScreen(p, 16)) return;
      if (s.mode === 'hiding') {
        // in the tree: the tail hangs out of the leaves, twitching now and then
        const twitch = (time * 1.3 + i) % 3 < 0.2 ? 1 : 0;
        d.push({ y: s.pos.y + 0.6, draw: () => ctx.drawImage(sp.tail[s.facing], p.x - 8 + twitch, p.y - 22) });
        return;
      }
      const moving = s.mode !== 'forage';
      const img = moving ? (Math.floor(time * 12) % 2 ? sp.hop : sp.sit)[s.facing] : sp.sit[s.facing];
      d.push({
        y: s.pos.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(p.x - 3, p.y + 1, 6, 1);
          ctx.drawImage(img, p.x - 8, p.y - 15);
        },
      });
    });
  }
}
