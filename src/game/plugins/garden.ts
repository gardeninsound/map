import { INK, Tile, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec } from '../../city';
import { GARDEN_BOX, GARDEN_NAME, type Shape } from '../../content/garden';
import { beds, inBloom, type InBloom } from '../garden';

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, c: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};
const STEM = '#4f7a3a';
const SOIL = '#5a3d2b';
const SOIL_EDGE = '#3e2a1e';
const GRAVEL = '#d8c7a0';
const DRY = '#a07850';

/** one plant, its foot at (x, y) */
function plant(ctx: Ctx, b: InBloom, x: number, y: number, sway: number) {
  const { shape, color, height } = b.plant;
  const h = Math.max(2, Math.round(height * b.stage));
  const c = b.fading ? DRY : color;
  const top = y - h;
  const tx = x + sway;
  const draw: Record<Shape, () => void> = {
    bell: () => {
      px(ctx, STEM, x, top + 1, 1, h - 1);
      px(ctx, c, tx + 1, top + 1, 1, 2);
    },
    cup: () => {
      px(ctx, STEM, x, top + 2, 1, h - 2);
      px(ctx, c, tx - 1, top, 3, 2);
      px(ctx, c, tx, top - 1, 1, 1);
    },
    trumpet: () => {
      px(ctx, STEM, x, top + 2, 1, h - 2);
      px(ctx, '#fff1b8', tx - 1, top, 3, 3);
      px(ctx, c, tx, top + 1, 1, 1);
    },
    star: () => {
      px(ctx, STEM, x, top + 2, 1, h - 2);
      px(ctx, c, tx - 1, top + 1, 3, 1);
      px(ctx, c, tx, top, 1, 3);
      px(ctx, '#ffd23f', tx, top + 1, 1, 1);
    },
    pom: () => {
      px(ctx, STEM, x, top + 2, 1, h - 2);
      px(ctx, c, tx - 1, top, 3, 3);
      px(ctx, 'rgba(255,255,255,0.35)', tx - 1, top, 1, 1);
    },
    spike: () => {
      px(ctx, STEM, x, y - 2, 1, 2);
      px(ctx, c, tx, top, 1, h - 2);
    },
    rose: () => {
      px(ctx, '#3e6a32', x - 1, top + 2, 3, h - 2);
      px(ctx, c, tx - 1, top, 2, 2);
      px(ctx, c, tx + 1, top + 3, 1, 1);
    },
    disc: () => {
      px(ctx, STEM, x, top + 3, 1, h - 3);
      px(ctx, STEM, x + 1, top + 6, 1, 1);
      px(ctx, c, tx - 2, top, 5, 4);
      px(ctx, '#5a3a1a', tx - 1, top + 1, 3, 2);
    },
    pumpkin: () => {
      px(ctx, STEM, x - 3, y - 1, 6, 1);
      px(ctx, c, x - 2, y - 4, 5, 3);
      px(ctx, '#c85a10', x, y - 4, 1, 3);
      px(ctx, STEM, x, y - 5, 1, 1);
    },
    kale: () => {
      px(ctx, '#3e6a32', x - 2, y - 3, 5, 2);
      px(ctx, c, x - 1, y - h, 3, h - 2);
    },
  };
  draw[shape]();
}

/**
 * The seasonal garden at Dragonfly Garden (idea box #12; what's out pure + tested in
 * game/garden.ts, plantings and the sign in content/garden.ts): the park's trees cleared at
 * attach, and gravel paths between soil beds, each bed one planting that's in flower this
 * month by the real calendar — coming up, in full flower, fading at the end of its run. A
 * sign by the street ({A}, target `garden`) says what's out.
 */
export class Garden implements CityPlugin {
  /** top-left and size, tiles */
  box = { x: 0, y: 0, w: 0, h: 0 };
  sign: Vec = { x: 0, y: 0 };
  private today = '';
  private bloom: InBloom[] = [];

  attach(game: CityGame) {
    const w = game.world;
    const a = w.project(GARDEN_BOX.north, GARDEN_BOX.west), b = w.project(GARDEN_BOX.south, GARDEN_BOX.east);
    const x0 = Math.ceil(a.x), y0 = Math.ceil(a.y), x1 = Math.floor(b.x), y1 = Math.floor(b.y);
    this.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    // clear the trees: open ground the beds sit on
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (w.tileAt(x, y) === Tile.Park) w.tiles[x + y * w.w] = Tile.Landmark;
    // the sign on the street side (west), halfway down
    const mid = { x: x0 - 0.5, y: y0 + (y1 - y0) / 2 };
    this.sign = w.isWalkable(mid.x - 1, mid.y) ? { x: x0 - 0.3, y: mid.y } : w.nearestWalkable(mid.x, mid.y);
  }

  /** what's out right now (cached for the day) */
  blooming(): InBloom[] {
    const now = new Date();
    const day = now.toDateString();
    if (day !== this.today) [this.today, this.bloom] = [day, inBloom(now)];
    return this.bloom;
  }

  targets(): Target[] {
    return [{ key: 'garden', kind: 'garden', x: this.sign.x, y: this.sign.y, label: { name: GARDEN_NAME, where: "what's growing", verb: 'read' } }];
  }

  draw(d: DrawContext) {
    const { x, y, w, h } = this.box;
    if (!w || !h) return;
    const tl = d.toScreen({ x, y });
    if (!d.onScreen({ x: tl.x + w * 8, y: tl.y + h * 8 }, w * 16 + 40)) return;
    const { ctx, time } = d;
    const bloom = this.blooming();
    const sign = d.toScreen(this.sign);
    d.push({
      // the ground: under everything that walks by
      y: y - 0.5,
      draw: () => {
        px(ctx, GRAVEL, tl.x, tl.y, w * 16, h * 16);
        beds(w, h).forEach((bed, i) => {
          const bx = tl.x + bed.x * 16, by = tl.y + bed.y * 16, bw = bed.w * 16, bh = bed.h * 16;
          px(ctx, SOIL_EDGE, bx - 1, by - 1, bw + 2, bh + 2);
          px(ctx, SOIL, bx, by, bw, bh);
          const b = bloom.length ? bloom[i % bloom.length]! : null;
          if (!b) return;
          for (let row = 0; row < 2; row++) {
            for (let px0 = 3 + row * 2; px0 < bw - 2; px0 += b.plant.shape === 'disc' || b.plant.shape === 'pumpkin' ? 7 : 4) {
              const sway = Math.round(Math.sin(time * 1.5 + px0 * 0.3 + i) * 0.6);
              plant(ctx, b, bx + px0, by + 6 + row * 8, sway);
            }
          }
        });
      },
    });
    d.push({
      y: this.sign.y,
      draw: () => {
        // a little wooden sign: post and board
        px(ctx, INK, sign.x - 1, sign.y - 10, 3, 11);
        px(ctx, '#8a5a3b', sign.x, sign.y - 10, 1, 10);
        px(ctx, INK, sign.x - 6, sign.y - 16, 13, 8);
        px(ctx, '#e8d2a8', sign.x - 5, sign.y - 15, 11, 6);
        const c = bloom[0]?.plant.color ?? STEM;
        px(ctx, c, sign.x - 3, sign.y - 13, 2, 2);
        px(ctx, STEM, sign.x + 1, sign.y - 13, 3, 1);
        px(ctx, STEM, sign.x + 1, sign.y - 11, 2, 1);
      },
    });
  }
}
