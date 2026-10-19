/**
 * Hand-drawn landmarks, painted into the map chunks over their cleared footprint
 * (placed by scripts/build-map.mjs from content/landmarks.csv). Drawn at native pixels
 * (16 px per tile), SNES-town style: the street face of the building turned toward you.
 * Add one: a draw function here keyed by the CSV's `sprite`, and a row in landmarks.csv.
 */
import { INK } from './palette';

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** 3×5 pixel letters for signs. */
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '6': ['###', '#..', '###', '#.#', '###'],
  ' ': ['...', '...', '...', '...', '...'],
};

/** Pixel text, 4 px per character (3 + 1 gap). Returns its width. */
export function pixelText(ctx: Ctx, text: string, x: number, y: number, color: string): number {
  ctx.fillStyle = color;
  [...text.toUpperCase()].forEach((ch, i) => {
    GLYPHS[ch]?.forEach((row, gy) =>
      [...row].forEach((c, gx) => c === '#' && ctx.fillRect(x + i * 4 + gx, y + gy, 1, 1)),
    );
  });
  return text.length * 4 - 1;
}
const textWidth = (t: string) => t.length * 4 - 1;

function ring(ctx: Ctx, cx: number, cy: number, outer: string, inner: string) {
  px(ctx, outer, cx - 1, cy - 2, 3, 5);
  px(ctx, outer, cx - 2, cy - 1, 5, 3);
  px(ctx, inner, cx - 1, cy - 1, 3, 3);
}

/** Admiral Theatre (1942): blue-grey deco box, red wave, portholes, the big red marquee. */
function admiralTheatre(ctx: Ctx, w: number, h: number) {
  const wall = '#c9d3e3';
  const wallHi = '#dbe3ef';
  const red = '#e0322b';
  const navy = '#2b3a6b';
  // shadow + roof
  px(ctx, 'rgba(0,0,0,0.2)', 2, h - 3, w - 2, 3);
  px(ctx, '#9aa3b5', 0, 0, w, 9);
  px(ctx, '#aeb6c6', 0, 0, w, 2);
  // the rooftop rail with its curvy middle
  px(ctx, navy, 2, 2, w - 4, 1);
  px(ctx, navy, 14, 1, w - 28, 1);
  for (let x = 4; x < w - 4; x += 6) px(ctx, navy, x, 2, 1, 4);
  px(ctx, INK, 0, 8, w, 1);
  // facade: side wings + raised centre
  px(ctx, wall, 0, 9, w, h - 12);
  px(ctx, wallHi, 13, 9, w - 26, 20);
  for (let y = 14; y < 30; y += 4) {
    px(ctx, '#b8c3d6', 0, y, 13, 1);
    px(ctx, '#b8c3d6', w - 13, y, 13, 1);
  }
  // red wave + stars across the top of the centre
  for (let x = 14; x < w - 14; x++) {
    const y = 11 + Math.round(Math.sin((x - 14) / 2.4) * 1.2);
    px(ctx, red, x, y, 1, 2);
  }
  for (let x = 17; x < w - 15; x += 6) px(ctx, navy, x, 16, 1, 1);
  // portholes
  for (const y of [14, 19, 24]) {
    ring(ctx, 6, y, red, navy);
    ring(ctx, w - 7, y, red, navy);
  }
  // anchor badge
  px(ctx, '#f4e6c8', w / 2 - 6, 22, 12, 6);
  px(ctx, '#f4e6c8', w / 2 - 4, 20, 8, 2);
  px(ctx, red, w / 2 - 4, 24, 1, 3);
  px(ctx, red, w / 2 + 3, 24, 1, 3);
  // marquee
  const my = 28;
  px(ctx, INK, 2, my - 1, w - 4, 13);
  px(ctx, red, 3, my, w - 6, 11);
  const half = (w - 6) / 2;
  pixelText(ctx, 'ADMIRAL', 3 + Math.round((half - textWidth('ADMIRAL')) / 2), my + 1, '#ffffff');
  pixelText(ctx, 'THEATRE', 3 + half + Math.round((half - textWidth('THEATRE')) / 2), my + 1, '#ffffff');
  px(ctx, '#ffffff', 5, my + 7, half - 4, 3);
  px(ctx, '#ffffff', 5 + half, my + 7, half - 4, 3);
  for (let x = 7; x < w - 7; x += 3) px(ctx, INK, x, my + 8, 2, 1);
  px(ctx, red, w / 2, my, 1, 11);
  // ground floor: columns, doors, the red ticket booth
  const gy = my + 11;
  px(ctx, '#aab4c6', 0, gy, w, h - gy - 3);
  px(ctx, INK, 10, gy, 12, h - gy - 3);
  px(ctx, INK, w - 22, gy, 12, h - gy - 3);
  px(ctx, red, w / 2 - 3, gy, 6, h - gy - 3);
  px(ctx, '#f0d8d8', w / 2 - 2, gy + 1, 4, 2);
  px(ctx, INK, 0, h - 3, w, 1);
}

/** The 76 on California: canopy with the orange ball, Food Mart, and the mural wall. */
function gasStation76(ctx: Ctx, w: number, h: number) {
  // lot
  px(ctx, '#8b88a0', 0, 0, w, h);
  for (let x = 18; x < w; x += 9) px(ctx, '#ffffff', x, h - 7, 1, 5);
  // THE WALL: retaining wall under the fence along the west edge, painted
  px(ctx, '#a07850', 0, 0, 3, h);
  for (let y = 1; y < h; y += 3) px(ctx, '#7a5a3a', 0, y, 3, 1);
  const coats = ['#ff7eb6', '#ffe066', '#2ec4b6', '#ff8c42', '#a77bff', '#57cc99'];
  px(ctx, '#ff9ac0', 3, 0, 6, h);
  for (let y = 2; y < h - 2; y += 6) px(ctx, coats[(y / 6) % coats.length | 0], 4, y, 4, 4);
  px(ctx, INK, 9, 0, 1, h);
  // Food Mart along the back
  const bx = 14;
  px(ctx, 'rgba(0,0,0,0.2)', bx + 2, 22, w - bx - 2, 3);
  px(ctx, '#e9e9ee', bx, 0, w - bx - 2, 10);
  px(ctx, '#f6f6f9', bx, 0, w - bx - 2, 2);
  px(ctx, INK, bx, 9, w - bx - 2, 1);
  px(ctx, '#ffffff', bx, 10, w - bx - 2, 12);
  const label = 'FOOD MART';
  pixelText(ctx, label, bx + Math.round((w - bx - 2 - textWidth(label)) / 2), 11, '#e0322b');
  px(ctx, '#2b3b5c', bx + 3, 17, w - bx - 8, 4);
  px(ctx, '#8a4f2a', bx + (w - bx) / 2 - 2, 16, 4, 6);
  px(ctx, INK, bx, 22, w - bx - 2, 1);
  // pump islands
  for (const x of [24, w - 18]) {
    px(ctx, '#c9c6d4', x - 3, 45, 9, 4);
    px(ctx, '#ff6a1a', x, 40, 3, 7);
    px(ctx, '#ffffff', x, 41, 3, 2);
  }
  // canopy (and its shadow)
  const cy = 26;
  px(ctx, 'rgba(0,0,0,0.22)', 14, cy + 16, w - 14, 4);
  px(ctx, INK, 12, cy - 1, w - 13, 18);
  px(ctx, '#f7f7fa', 13, cy, w - 15, 16);
  px(ctx, '#ffffff', 13, cy, w - 15, 2);
  px(ctx, '#f2a35a', 30, cy + 12, w - 34, 2);
  px(ctx, '#3b6fd8', 46, cy + 14, w - 50, 1);
  // the 76 ball
  const bx76 = 21;
  const by76 = cy + 8;
  px(ctx, INK, bx76 - 6, by76 - 5, 13, 11);
  px(ctx, INK, bx76 - 5, by76 - 6, 11, 13);
  px(ctx, '#ff6a1a', bx76 - 5, by76 - 4, 11, 9);
  px(ctx, '#ff6a1a', bx76 - 4, by76 - 5, 9, 11);
  pixelText(ctx, '76', bx76 - 3, by76 - 2, '#ffffff');
}

const SPRITES: Record<string, (ctx: Ctx, w: number, h: number) => void> = {
  'admiral-theatre': admiralTheatre,
  'gas-station-76': gasStation76,
};

export const hasLandmarkSprite = (sprite: string) => sprite in SPRITES;

/** Draw landmark `sprite` with its top-left at the current origin, `w`×`h` px. */
export function drawLandmark(ctx: Ctx, sprite: string, w: number, h: number) {
  SPRITES[sprite]?.(ctx, w, h);
}
