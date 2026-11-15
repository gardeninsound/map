import { INK, Tile, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec } from '../../city';
import { mermaidLabel, mermaids, type Mermaid } from '../../content/mermaids';
import { bubbleText, callingAt, rockNear, SEE } from '../mermaids';
import { buildMermaid } from '../mermaidSprites';
import { drawTiny, TINY_H, tinyWidth } from '../tinyFont';
import type { Rowboat } from './rowboat';

export interface PlacedMermaid {
  m: Mermaid;
  rock: Vec;
  /** chats so far, for the next phrase */
  said: number;
}

/**
 * Mermaids on rocks just off Alki Beach (idea box #37; rocks and calls pure + tested in
 * game/mermaids.ts, words in content/mermaids.ts): one by the end of the rowboat dock at
 * 58th (reach her on foot), the others along the beach (row up). Near the shore you see
 * them call their catch phrases in bubbles; {A} close by and one chats (target `mermaid`).
 */
export class Mermaids implements CityPlugin {
  placed: PlacedMermaid[] = [];
  private sprites: HTMLCanvasElement[][] = [];
  private you: Vec = { x: 0, y: 0 };

  constructor(private rowboat: Rowboat) {}

  attach(game: CityGame) {
    const w = game.world;
    const shore = (t: number) => t === Tile.Beach;
    const taken: Vec[] = [this.rowboat.mooring];
    for (const m of mermaids) {
      let rock: Vec | null = null;
      if (m.at === 'dock') {
        // in the water beside the dock, a few planks back from the boat (so {A} by her is hers)
        const end = this.rowboat.dock.at(-4);
        if (end) rock = rockNear(w, end, Tile.Water, () => true, 2, taken, 2.5);
      } else {
        rock = rockNear(w, w.project(m.at.lat, m.at.lon), Tile.Water, shore, 12, taken, 10);
      }
      if (!rock) continue;
      taken.push(rock);
      this.placed.push({ m, rock, said: 0 });
    }
  }

  targets(): Target[] {
    return this.placed.map((p, i) => ({ key: `mermaid:${i}`, kind: 'mermaid', x: p.rock.x, y: p.rock.y, label: mermaidLabel(p.m), data: p }));
  }

  /** {A}: her next catch phrase */
  nextPhrase(p: PlacedMermaid): string {
    return p.m.phrases[p.said++ % p.m.phrases.length]!;
  }

  /** her face for the dialog box */
  portrait(p: PlacedMermaid): string {
    return buildMermaid(p.m.hair, p.m.tail)[0]!.toDataURL();
  }

  update(_dt: number, game: CityGame) {
    this.you = game.player.pos;
  }

  draw(d: DrawContext) {
    const { ctx, time } = d;
    if (!this.sprites.length) this.sprites = this.placed.map((p) => buildMermaid(p.m.hair, p.m.tail));
    this.placed.forEach((p, i) => {
      const s = d.toScreen(p.rock);
      if (!d.onScreen(s, 40)) return;
      const frames = this.sprites[i]!;
      const flick = (time * 0.9 + i * 0.7) % 3 < 0.35 ? 1 : 0;
      const near = Math.hypot(this.you.x - p.rock.x, this.you.y - p.rock.y) < SEE;
      const phrase = near ? callingAt(time, i, p.m.phrases) : null;
      d.push({
        y: p.rock.y,
        draw: () => {
          // ripples round the rock
          const r = 9 + Math.round(Math.sin(time * 2 + i) * 1);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(s.x - r, s.y + 1, 2 * r, 1);
          ctx.fillRect(s.x - r + 3, s.y + 3, 2 * r - 6, 1);
          ctx.drawImage(frames[flick]!, s.x - 8, s.y - 14);
          if (phrase) this.bubble(ctx, s.x - 1, s.y - 15, bubbleText(phrase));
        },
      });
    });
  }

  /** a speech bubble whose tail points down at (x, y), as the pegasus's */
  private bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
    const w = tinyWidth(text) + 6;
    const h = TINY_H + 4;
    const l = Math.round(x - w / 2);
    const top = Math.round(y - h - 3);
    ctx.fillStyle = INK;
    ctx.fillRect(l - 1, top - 1, w + 2, h + 2);
    ctx.fillRect(Math.round(x) - 2, top + h, 4, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(l, top, w, h);
    ctx.fillRect(Math.round(x) - 1, top + h, 2, 2);
    drawTiny(ctx, text, l + 3, top + 2, INK);
  }
}
