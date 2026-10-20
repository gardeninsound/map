/**
 * Turns the lemon photo (data/source/lemon-photo.png) into the map's art-spot marker:
 * the cream backdrop is erased, the lemon and its own cast shadow are kept, and the result
 * is downsampled to a pixel sprite — four shades of lemon with an ink outline, the shadow
 * as translucent pixels. Writes it as an ASCII grid to src/game/render/lemon.ts (a ripe
 * palette for open spots, an unripe green one for coming-soon spots).
 *
 * Usage: node scripts/make-lemon.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url);
const WIDTH = 22; // sprite px across, shadow included (a tile is 16)
const KEEP = 0.3; // a cell this much lemon counts as lemon, so the pointed tips survive

const { data, info } = await sharp(fileURLToPath(new URL('data/source/lemon-photo.png', ROOT)))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const rgb = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
const lum = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;

// The backdrop: average of the four corners.
const corners = [0, W - 1, (H - 1) * W, H * W - 1].map(rgb);
const bgLum = corners.reduce((a, c) => a + lum(c), 0) / 4;

// Per photo pixel: is it lemon (saturated yellow), and how much shadow (darker than the
// backdrop, not lemon)?
const isLemon = new Uint8Array(W * H);
const shade = new Float32Array(W * H);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let i = 0; i < W * H; i++) {
  const c = rgb(i);
  if (c[0] - c[2] > 110 && c[0] > 150) isLemon[i] = 1;
  else shade[i] = Math.max(0, Math.min(1, (bgLum - lum(c) - 20) / (bgLum - 60)));
  if (isLemon[i] || shade[i] > 0.15) {
    const x = i % W, y = (i / W) | 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
}

// Downsample the bounding box to sprite cells.
const cell = (x1 - x0 + 1) / WIDTH;
const SW = WIDTH;
const SH = Math.ceil((y1 - y0 + 1) / cell);
const grid = [];
for (let sy = 0; sy < SH; sy++) {
  let row = '';
  for (let sx = 0; sx < SW; sx++) {
    let n = 0, lemon = 0, sh = 0, l = 0;
    for (let y = Math.floor(y0 + sy * cell); y < Math.min(H, Math.floor(y0 + (sy + 1) * cell)); y++) {
      for (let x = Math.floor(x0 + sx * cell); x < Math.min(W, Math.floor(x0 + (sx + 1) * cell)); x++) {
        const i = y * W + x;
        n++;
        if (isLemon[i]) { lemon++; l += lum(rgb(i)); } else sh += shade[i];
      }
    }
    if (lemon / n > KEEP) {
      // four shades by brightness: d dark, m mid, l light, h highlight
      const v = l / lemon;
      row += v > 178 ? 'h' : v > 158 ? 'l' : v > 132 ? 'm' : 'd';
    } else row += sh / n > 0.35 ? 's' : '.';
  }
  grid.push(row);
}
// Tidy stray specks: a lemon cell hanging on by one neighbour becomes shadow.
const lem = (x, y) => y >= 0 && y < SH && x >= 0 && x < SW && 'dmlh'.includes(grid[y][x]);
for (let pass = 0; pass < 2; pass++) {
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      if (!lem(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => lem(x + dx, y + dy)).length;
      if (n <= 1) grid[y] = grid[y].slice(0, x) + 's' + grid[y].slice(x + 1);
    }
  }
}
// Ink outline: lemon cells touching anything that isn't lemon.
const out = grid.map((row, y) =>
  [...row].map((ch, x) => ('dmlh'.includes(ch) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !lem(x + dx, y + dy)) ? 'k' : ch)).join(''),
);
// Where the lemon meets the ground: its lowest row.
const base = Math.max(...out.map((row, y) => (/[kdmlh]/.test(row) ? y : -1)));

const ts = `/**
 * The art-spot marker: a lemon with its own shadow, traced from data/source/lemon-photo.png
 * by scripts/make-lemon.mjs — don't edit by hand, rerun the script.
 * k outline, d/m/l/h lemon shades dark → highlight, s shadow.
 */
export const LEMON: string[] = [
${out.map((r) => `  '${r}',`).join('\n')}
];

/** row of the lemon's base (where it sits on the ground) */
export const LEMON_BASE = ${base};

export const LEMON_RIPE: Record<string, string> = {
  k: '#2a1a12',
  d: '#b8741a',
  m: '#d9951f',
  l: '#ecb52e',
  h: '#f8d873',
  s: 'rgba(42,26,18,0.45)',
};

/** coming soon: the same lemon, still green */
export const LEMON_UNRIPE: Record<string, string> = {
  ...LEMON_RIPE,
  d: '#5f8a2c',
  m: '#7aa63a',
  l: '#9cc252',
  h: '#c8e08a',
};
`;
writeFileSync(new URL('src/game/render/lemon.ts', ROOT), ts);
console.log(`wrote src/game/render/lemon.ts (${SW}×${SH}, base row ${base})\n${out.join('\n')}`);
