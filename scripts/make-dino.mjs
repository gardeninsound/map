/**
 * Cuts the walking toy dinosaur out of Mike's GIF (a green backdrop, the dino and its shadow)
 * into a small pixel sprite sheet for the map: public/sprites/dino-walk.png, frames side by
 * side, the dino facing west (left) and walking in place (the map moves it), plus
 * src/game/dinoSheet.ts with the frame size and count.
 *
 * The green goes; the shadow stays as a soft dark shadow; the dino itself is opaque.
 *
 * Usage: node scripts/make-dino.mjs <path/to/dino.gif>   (the GIF isn't kept in the repo: 5.8 MB)
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/make-dino.mjs <dino.gif>');

/** keep every STEP-th frame of the GIF (24 fps → 8 fps on the map) */
const STEP = 3;
/** sprite width in map pixels (a tile is 16): about three tiles of dinosaur */
const WIDTH = 52;
/** the shadow's darkness on the map */
const SHADOW_ALPHA = 0.32;

const img = sharp(src, { animated: true });
const meta = await img.metadata();
const pages = meta.pages ?? 1;
const W = meta.width;
const H = meta.pageHeight ?? meta.height;
const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (f, x, y) => ((f * H + y) * W + x) * 4;

// the backdrop's colour: the median of the first frame's border
const border = [];
for (let x = 0; x < W; x += 4) for (const y of [2, H - 3]) border.push(px(0, x, y));
const med = (ch) => border.map((i) => data[i + ch]).sort((a, b) => a - b)[border.length >> 1];
const bg = [med(0), med(1), med(2)];
/** how green, for its brightness (so the dark shadow on the backdrop still counts as green) */
const greenness = (r, g, b) => (g - Math.max(r, b)) / (g + 1);
const bgGreen = greenness(...bg);
const bgLum = bg[0] + bg[1] + bg[2];

/** per pixel: how much is dinosaur (0..1), how much is shadow (0..1) */
function classify(i) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const green = greenness(r, g, b) / bgGreen; // 1 = as green as the backdrop, 0 = grey
  const dino = Math.max(0, Math.min(1, (0.6 - green) / 0.25));
  const lum = (r + g + b) / bgLum;
  const shadow = (1 - dino) * Math.max(0, Math.min(1, (0.88 - lum) / 0.25));
  return { dino, shadow, r, g, b };
}

// one pass for each kept frame: where the dino is (to line the frames up) and the union box
const frames = [];
for (let f = 0; f < pages; f += STEP) {
  let sx = 0, n = 0;
  const box = { x0: W, y0: H, x1: 0, y1: 0 };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = classify(px(f, x, y));
      if (c.dino > 0.5) (sx += x), n++;
      if (c.dino > 0.5 || c.shadow > 0.3) {
        box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      }
    }
  frames.push({ f, cx: n ? sx / n : W / 2, box });
}
// walking in place: shift every frame so the dino's middle stays put
const cx0 = frames[0].cx;
const shift = (fr) => Math.round(cx0 - fr.cx);
const x0 = Math.min(...frames.map((fr) => fr.box.x0 + shift(fr))) - 2;
const x1 = Math.max(...frames.map((fr) => fr.box.x1 + shift(fr))) + 2;
const y0 = Math.min(...frames.map((fr) => fr.box.y0)) - 2;
const y1 = Math.max(...frames.map((fr) => fr.box.y1)) + 2;
const scale = WIDTH / (x1 - x0);
const FW = WIDTH;
const FH = Math.ceil((y1 - y0) * scale);

// down to map size: average each output pixel's patch, then make it crisp
const out = Buffer.alloc(FW * frames.length * FH * 4);
frames.forEach((fr, k) => {
  const s = shift(fr);
  for (let oy = 0; oy < FH; oy++)
    for (let ox = 0; ox < FW; ox++) {
      let dino = 0, shadow = 0, r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.floor(y0 + oy / scale); y < y0 + (oy + 1) / scale; y++)
        for (let x = Math.floor(x0 + ox / scale); x < x0 + (ox + 1) / scale; x++) {
          const gx = x - s;
          n++;
          if (gx < 0 || gx >= W || y < 0 || y >= H) continue;
          const c = classify(px(fr.f, gx, y));
          dino += c.dino;
          shadow += c.shadow;
          r += c.r * c.dino; g += c.g * c.dino; b += c.b * c.dino;
        }
      const o = ((oy * FW * frames.length) + k * FW + ox) * 4;
      if (dino / n >= 0.45) {
        out[o] = r / dino; out[o + 1] = g / dino; out[o + 2] = b / dino; out[o + 3] = 255;
      } else if (shadow / n >= 0.4) {
        out[o] = 16; out[o + 1] = 28; out[o + 2] = 22; out[o + 3] = Math.round(SHADOW_ALPHA * 255);
      }
    }
});

// an ink outline round the dino (not its shadow), like the map's other sprites, so it reads on the road
const SW = FW * frames.length;
const solid = (x, y) => x >= 0 && y >= 0 && x < SW && y < FH && out[(y * SW + x) * 4 + 3] === 255 && !inked.has(y * SW + x);
const inked = new Set();
const edge = [];
for (let y = 0; y < FH; y++)
  for (let x = 0; x < SW; x++) {
    if (out[(y * SW + x) * 4 + 3] === 255) continue;
    // stay inside this pixel's own frame
    const f0 = Math.floor(x / FW) * FW;
    const near = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => nx >= f0 && nx < f0 + FW && solid(nx, ny));
    if (near) edge.push(y * SW + x);
  }
for (const i of edge) {
  out[i * 4] = 0x2a; out[i * 4 + 1] = 0x1a; out[i * 4 + 2] = 0x12; out[i * 4 + 3] = 255; // INK (city/render/palette.ts)
  inked.add(i);
}

const png = `${ROOT}public/sprites/dino-walk.png`;
await sharp(out, { raw: { width: FW * frames.length, height: FH, channels: 4 } }).png({ palette: true, colours: 64 }).toFile(png);
writeFileSync(
  `${ROOT}src/game/dinoSheet.ts`,
  `/** Generated by scripts/make-dino.mjs — the walking dinosaur's sprite sheet (public/sprites/dino-walk.png). */
export const DINO_SHEET = { file: 'sprites/dino-walk.png', frameW: ${FW}, frameH: ${FH}, frames: ${frames.length}, fps: ${Math.round(24 / STEP)} } as const;
`,
);
console.log(`backdrop rgb(${bg}) → ${frames.length} frames of ${FW}×${FH} → ${png}`);
