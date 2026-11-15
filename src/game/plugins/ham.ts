import type { CityGame, CityPlugin, DrawContext, Npc, Target, Vec } from '../../city';
import { rng } from '../../city';
import { HAM_NAME, hamHome, hamLines, hamPets } from '../../content/ham';
import { hamTick, newHam, type HamState } from '../ham';
import { buildHam, type HamSprites } from '../sprites';
import { sounds } from '../../ui/sounds';
import { talk, type Action, type Actor } from '../actions';

/**
 * Ham the cat, around the hidden house on 45th Ave SW: saunters the street and the alley
 * behind (state in game/ham.ts), sits to look at a rabbit that comes close, and says one set
 * of lines per visit (content/ham.ts) — the App's plain neighbor talk does the talking.
 */
export class Ham implements CityPlugin, Actor {
  private game!: CityGame;
  npc!: Npc;
  state: HamState | null = null;
  home: Vec | null = null;
  private sprites: HamSprites | null = null;
  private rand = rng(1918);
  private visit = 0;
  private wasTalking = false;

  /** {A}: Ham's lines, then he asks for pets (idea box #30) */
  act(t: Target): Action | null {
    if (t.npc !== this.npc) return null;
    const portrait = this.game.portraitOf(this.npc);
    return talk(HAM_NAME, [...this.npc.voice.lines, hamPets.ask], {
      portrait,
      choices: [
        { label: hamPets.yes, next: { kind: 'do', run: () => this.pet(), then: talk(HAM_NAME, hamPets.after, { portrait }) } },
        { label: hamPets.no, next: talk(HAM_NAME, hamPets.bye, { portrait }) },
      ],
    });
  }

  attach(game: CityGame) {
    this.game = game;
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

  /** seconds of hearts left over Ham, after pets */
  hearts = 0;

  /** Pets: a purr and hearts floating up. */
  pet() {
    this.hearts = 2.5;
    sounds.purr();
  }

  update(dt: number, game: CityGame) {
    this.hearts = Math.max(0, this.hearts - dt);
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
        // pets: little hearts drifting up
        for (let i = 0; i < 3 && this.hearts > 0; i++) {
          const age = (2.5 - this.hearts + i * 0.5) % 1.5;
          const hx = Math.round(p.x - 4 + i * 4 + Math.sin(time * 4 + i) * 1.5), hy = Math.round(p.y - 18 - age * 14);
          ctx.fillStyle = '#ff2e93';
          ctx.fillRect(hx, hy, 2, 1); ctx.fillRect(hx + 3, hy, 2, 1);
          ctx.fillRect(hx - 1, hy + 1, 7, 1); ctx.fillRect(hx, hy + 2, 5, 1); ctx.fillRect(hx + 1, hy + 3, 3, 1); ctx.fillRect(hx + 2, hy + 4, 1, 1);
        }
      },
    });
  }
}
