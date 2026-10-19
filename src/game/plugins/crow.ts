import type { CityGame, CityPlugin, DrawContext, Npc, Vec } from 'west-seattle-map';
import { CROW_NAME, crowStops } from '../../content/crow';
import { sounds } from '../../ui/sounds';
import { altitude, flyTick, newCrow, takeOff, type CrowState } from '../crow';
import { buildCrow } from '../sprites';

/**
 * The snack crow: perches outside Les Schwab, asks for snacks, then flies over the
 * rooftops to its next stop (see content/crow.ts). The app runs the conversation and
 * calls `flyAway`.
 */
export class Crow implements CityPlugin {
  npc!: Npc;
  state!: CrowState;
  private perches: Vec[] = [];
  private sprites = buildCrow();

  attach(game: CityGame) {
    const { world } = game;
    this.perches = crowStops.map((s) => {
      const shop = world.shops.find((x) => s.shop.test(x.name));
      const p = shop ?? world.project(s.lat, s.lon);
      return world.nearestWalkable(p.x, p.y);
    });
    this.state = newCrow(this.perches);
    this.npc = {
      id: -2,
      pos: this.state.pos,
      dir: { x: 0, y: 0 },
      facing: 'right',
      walkT: 0,
      timer: 0,
      talking: false,
      still: true,
      custom: true,
      voice: { name: CROW_NAME, lines: [] },
      sprite: this.sprites.perch,
    };
    game.npcs.push(this.npc);
  }

  /** After the snack question: caw and fly to the next perch. */
  flyAway(shared: boolean) {
    if (shared) this.state.snacks++;
    this.npc.talking = false;
    takeOff(this.state, this.perches);
    sounds.caw();
  }

  update(dt: number, game: CityGame) {
    flyTick(this.state, dt);
    this.npc.pos = this.state.pos;
    this.npc.inactive = !!this.state.flight; // can't chat mid-air
    // Perched and idle, the crow looks this way and that.
    if (!this.state.flight && !this.npc.talking) this.npc.facing = Math.floor(game.now / 2.7) % 3 === 1 ? 'left' : 'right';
  }

  draw(d: DrawContext) {
    const c = this.npc;
    const f = this.state.flight;
    const alt = f ? Math.round(altitude(f) * 40) : 0;
    const s = d.toScreen(c.pos);
    if (!d.onScreen({ x: s.x, y: s.y - alt })) return;
    const { ctx, time } = d;
    d.push({
      // airborne, it passes over everything
      y: f ? Infinity : c.pos.y,
      draw: () => {
        const w = alt > 20 ? 4 : 6;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(s.x - w / 2, s.y + 1, w, 2);
        if (f) {
          const img = this.sprites.fly[f.to.x >= f.from.x ? 'right' : 'left'][Math.floor(time * 8) % 2];
          ctx.drawImage(img, s.x - 8, s.y - 12 - alt);
        } else {
          const hop = !c.talking && (time * 0.6) % 2.5 < 0.12 ? 1 : 0;
          ctx.drawImage(c.sprite[c.facing][hop], s.x - 8, s.y - 15);
        }
      },
    });
  }
}
