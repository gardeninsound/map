import { INK, type CityPlugin, type DrawContext } from '../../city';
import { cupVersions } from '../../content/cupVersions';
import type { ArtSpots } from './artSpots';

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** The leaping hare stenciled on the mug, 7×4. */
const HARE = [
  '......#',
  '.#####.',
  '######.',
  '#..##..',
];

const W = 36;
const H = 48;
/** where the pole meets the ground in the sprite */
const FOOT = { x: 4, y: 46 };
/** the mug's middle, for its shadow */
const MUG_X = 24;

/**
 * Lulu's big cup, as it stands on California Ave: a white L-shaped pole, the arm reaching
 * out toward the street, and the giant mug hanging open-end-down from it, a little tilted.
 * Painted in its latest coat from src/content/cupVersions.ts (body, dashed frame, hare).
 */
function drawBigCup(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const coat = cupVersions[cupVersions.length - 1];
  const white = '#f3f0ea';
  const shade = '#c9c4bd';

  // pole and its base plate
  px(ctx, INK, 2, 3, 4, FOOT.y - 2);
  px(ctx, white, 3, 4, 2, FOOT.y - 3);
  px(ctx, shade, 4, 6, 1, FOOT.y - 5);
  px(ctx, INK, 0, FOOT.y - 1, 8, 3);
  px(ctx, '#9a948e', 1, FOOT.y, 6, 1);
  // the arm, then the short hanger
  px(ctx, INK, 2, 2, MUG_X, 4);
  px(ctx, white, 3, 3, MUG_X - 2, 2);
  px(ctx, shade, 5, 4, MUG_X - 4, 1);
  px(ctx, INK, MUG_X - 1, 5, 3, 6);
  px(ctx, white, MUG_X, 5, 1, 5);

  // the mug, open end down: narrower at its (closed) top, widening to the rim, leaning a touch
  const top = 11;
  const bottom = 28;
  const lean = (y: number) => Math.round((y - top) * 0.1);
  for (let y = top; y <= bottom; y++) {
    const half = Math.round(6 + ((y - top) / (bottom - top)) * 2);
    const x0 = MUG_X - half + lean(y);
    px(ctx, INK, x0 - 1, y, half * 2 + 2, 1);
    if (y === top || y === bottom) continue;
    px(ctx, coat.body, x0, y, half * 2, 1);
    px(ctx, 'rgba(255,255,255,0.35)', x0 + 1, y, 1, 1);
    px(ctx, 'rgba(0,0,0,0.12)', x0 + half * 2 - 2, y, 2, 1);
  }
  px(ctx, INK, MUG_X - 7 + lean(top), top - 1, 14, 1);
  // the rim and a glimpse of the dark inside
  const rx = MUG_X - 8 + lean(bottom);
  px(ctx, white, rx, bottom - 1, 16, 1);
  px(ctx, INK, rx + 2, bottom + 1, 12, 1);

  // the handle, on the street side
  const hx = MUG_X + 7 + lean(19);
  px(ctx, INK, hx, 15, 5, 9);
  px(ctx, coat.body, hx + 1, 16, 3, 7);
  px(ctx, INK, hx, 17, 2, 5);

  // the dashed frame and the hare inside it
  const fx = MUG_X - 5 + lean(19);
  const fy = 15;
  const fw = 11;
  const fh = 9;
  if (coat.frame) {
    if (coat.frame.style === 'dashes' && coat.frame.fill) px(ctx, coat.frame.fill, fx, fy, fw, fh);
    const step = coat.frame.style === 'dots' ? 2 : 3;
    for (let i = 0; i < fw; i++) if (i % step < step - 1) {
      px(ctx, coat.frame.color, fx + i, fy);
      px(ctx, coat.frame.color, fx + i, fy + fh - 1);
    }
    for (let j = 0; j < fh; j++) if (j % step < step - 1) {
      px(ctx, coat.frame.color, fx, fy + j);
      px(ctx, coat.frame.color, fx + fw - 1, fy + j);
    }
  }
  if (coat.rabbit) {
    HARE.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && px(ctx, coat.rabbit!, fx + 2 + i, fy + 3 + j)));
  } else {
    // a word-only coat: a couple of stencil strokes in its first line's color
    const color = coat.lines?.[0]?.color ?? INK;
    for (let j = 0; j < 2; j++) px(ctx, color, fx + 2, fy + 3 + j * 3, fw - 4, 1);
  }
  return c;
}

/**
 * Lulu's big cup on the map, beside the Big Cup lemon: the pole set back from California a
 * tile behind the lemon and a tile north, the mug hanging out toward the street (east).
 */
export class BigCup implements CityPlugin {
  private sprite: HTMLCanvasElement | null = null;

  constructor(private art: ArtSpots, private spotId = 'cup') {}

  draw(d: DrawContext) {
    const spot = this.art.places.find((p) => p.id === this.spotId);
    if (!spot) return;
    const foot = { x: spot.x - 1.1, y: spot.y - 1.1 };
    const s = d.toScreen(foot);
    if (!d.onScreen(s)) return;
    this.sprite ??= drawBigCup();
    const sprite = this.sprite;
    const { ctx } = d;
    d.push({
      y: foot.y,
      draw: () => {
        // the mug's shadow on the street below it
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(s.x + MUG_X - FOOT.x - 7, s.y - 1, 15, 3);
        ctx.fillRect(s.x + MUG_X - FOOT.x - 5, s.y - 2, 11, 5);
        ctx.drawImage(sprite, s.x - FOOT.x, s.y - FOOT.y);
      },
    });
  }
}
