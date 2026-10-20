import type { CityGame, CityPlugin, DrawContext, Npc } from '../../city';
import { CHICKEN_NAME, chickenHome } from '../../content/chicken';
import { buildChicken } from '../sprites';

/**
 * The chicken: stands on California outside Greentree Animal Hospital, pecks at the ground
 * and looks about. The app runs her two questions and the mini-game invitation
 * (content/chicken.ts) and opens Cone Catch.
 */
export class Chicken implements CityPlugin {
  npc!: Npc;
  private sprite = buildChicken();

  attach(game: CityGame) {
    const { world } = game;
    const shop = world.shops.find((s) => chickenHome.shop.test(s.name));
    const p = shop ?? world.project(chickenHome.lat, chickenHome.lon);
    const spot = world.nearestWalkable(p.x, p.y);
    this.npc = {
      id: -3,
      pos: { x: spot.x, y: spot.y },
      dir: { x: 0, y: 0 },
      facing: 'right',
      walkT: 0,
      timer: 0,
      talking: false,
      still: true,
      custom: true,
      voice: { name: CHICKEN_NAME, lines: [] },
      sprite: this.sprite,
    };
    game.npcs.push(this.npc);
  }

  update(_dt: number, game: CityGame) {
    // idle, she turns this way and that
    if (!this.npc.talking) this.npc.facing = Math.floor(game.now / 3.1) % 2 ? 'left' : 'right';
  }

  draw(d: DrawContext) {
    const c = this.npc;
    const s = d.toScreen(c.pos);
    if (!d.onScreen(s)) return;
    const { ctx, time } = d;
    d.push({
      y: c.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(s.x - 5, s.y + 1, 10, 2);
        // a peck or two every couple of seconds (not mid-conversation)
        const peck = !c.talking && (time % 2.3 < 0.18 || (time % 2.3 > 0.35 && time % 2.3 < 0.5)) ? 1 : 0;
        ctx.drawImage(c.sprite[c.facing][peck], s.x - 8, s.y - 15);
      },
    });
  }
}
