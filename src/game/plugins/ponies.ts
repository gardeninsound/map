import { rng, Tile, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec } from '../../city';
import { ponies, PONY_MEADOW, ponyLabel, type Pony } from '../../content/ponies';
import { newPony, ponyTick, type PonyState } from '../ponies';
import { buildPony, type PonySprites } from '../ponySprites';

export interface MeadowPony {
  pony: Pony;
  s: PonyState;
}

/**
 * The pastel ponies of Lincoln Park's meadow (idea box #36; Bear Island's own herd — words in
 * content/ponies.ts, wandering pure + tested in game/ponies.ts): five graze and trot about the
 * meadow and the trails through it. Walk up and {A} (target `pony`): one stops to say hi.
 */
export class Ponies implements CityPlugin {
  herd: MeadowPony[] = [];
  /** the one you're talking to stands still */
  talking: MeadowPony | null = null;
  private home: Vec = { x: 0, y: 0 };
  private suits: (x: number, y: number) => boolean = () => false;
  private rand = rng(36);
  private sprites: PonySprites[] = [];

  attach(game: CityGame) {
    const w = game.world;
    const p = w.project(PONY_MEADOW.lat, PONY_MEADOW.lon);
    this.home = p;
    this.suits = (x, y) => {
      const t = w.tileAt(Math.floor(x), Math.floor(y));
      return t === Tile.Lawn || w.isWalkable(x, y);
    };
    this.herd = ponies.map((pony, i) => {
      const a = (i / ponies.length) * Math.PI * 2;
      let at = { x: p.x + Math.cos(a) * 2.5, y: p.y + Math.sin(a) * 1.8 };
      if (!this.suits(at.x, at.y)) at = { ...p };
      return { pony, s: newPony(at, this.rand) };
    });
  }

  targets(): Target[] {
    return this.herd.map((h, i) => ({ key: `pony:${i}`, kind: 'pony', x: h.s.pos.x, y: h.s.pos.y, label: ponyLabel(h.pony), data: h }));
  }

  update(dt: number, game: CityGame) {
    if (game.paused === false) this.talking = null;
    for (const h of this.herd) ponyTick(h.s, dt, this.home, this.suits, this.rand, h === this.talking);
  }

  draw(d: DrawContext) {
    if (!this.sprites.length) this.sprites = this.herd.map((h) => buildPony(h.pony.coat, h.pony.mane));
    const { ctx } = d;
    this.herd.forEach((h, i) => {
      const p = d.toScreen(h.s.pos);
      if (!d.onScreen(p, 24)) return;
      const sp = this.sprites[i]!;
      const img = h.s.to ? sp.trot[h.s.facing][Math.floor(h.s.walkT * 7) % 2]! : sp.graze[h.s.facing];
      d.push({
        y: h.s.pos.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(p.x - 8, p.y + 1, 16, 2);
          ctx.drawImage(img, p.x - 10, p.y - 15);
        },
      });
    });
  }

  /** a pony's face for the dialog box */
  portrait(h: MeadowPony): string {
    return this.sprites[this.herd.indexOf(h)]?.trot.right[0]!.toDataURL() ?? '';
  }
}
