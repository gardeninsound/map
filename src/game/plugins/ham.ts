import type { CityGame, CityPlugin, DrawContext, Npc, Vec } from '../../city';
import { rng } from '../../city';
import { HAM_NAME, hamHome, hamLines } from '../../content/ham';
import { hamTick, newHam, type HamState } from '../ham';
import { buildHam, type HamSprites } from '../sprites';
import { sounds } from '../../ui/sounds';

/**
 * Ham the cat, around the hidden house on 45th Ave SW: saunters the street and the alley
 * behind (state in game/ham.ts), sits to look at a rabbit that comes close, and says one set
 * of lines per visit (content/ham.ts) — the App's plain neighbor talk does the talking.
 */
export class Ham implements CityPlugin {
  npc!: Npc;
  state: HamState | null = null;
  home: Vec | null = null;
  private sprites: HamSprites | null = null;
  private rand = rng(1918);
  private visit = 0;
  private wasTalking = false;

  attach(game: CityGame) {
    const p = game.world.project(hamHome.lat, hamHome.lon);
    this.home = game.world.nearestWalkable(p.x, p.y);
    this.state = newHam(this.home);
    const sprites = (this.sprites = buildHam());
    const sit = [sprites.sit, sprites.sit];
    this.npc = {
      id: -6,
      pos: { ...this.state.pos },
      dir: { x: 0, y: 0 },
      facing: 'down',
      walkT: 0,
      timer: 0,
      talking: false,
      still: true,
      custom: true,
      voice: { name: HAM_NAME, lines: hamLines[0] },
      // the portrait is down[0]: Ham sitting, face on
      sprite: { down: sit, up: sit, left: sprites.walk.left, right: sprites.walk.right },
    };
    game.npcs.push(this.npc);
  }

  update(dt: number, game: CityGame) {
    const s = this.state;
    if (!s || !this.home) return;
    const talking = this.npc.talking;
    if (talking && !this.wasTalking) sounds.mew();
    if (!talking && this.wasTalking) {
      // next visit, the next lines
      this.visit++;
      this.npc.voice = { name: HAM_NAME, lines: hamLines[this.visit % hamLines.length] };
    }
    this.wasTalking = talking;
    hamTick(s, dt, this.home, game.paused ? null : game.player.pos, game.world.isWalkable, this.rand, talking);
    this.npc.pos = s.pos;
  }

  draw(d: DrawContext) {
    const s = this.state;
    const sprites = this.sprites;
    if (!s || !sprites) return;
    const p = d.toScreen(s.pos);
    if (!d.onScreen(p)) return;
    const { ctx, time } = d;
    d.push({
      y: s.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(p.x - 6, p.y + 1, 12, 2);
        if (s.mode === 'walk') {
          ctx.drawImage(sprites.walk[s.side][Math.floor(s.walkT * 6) % 2], p.x - 8, p.y - 12);
        } else {
          // grooming: paw up, then down, then up
          const img = s.mode === 'groom' && time % 0.8 < 0.45 ? sprites.groom : sprites.sit;
          ctx.drawImage(img, p.x - 8, p.y - 14);
        }
      },
    });
  }
}
