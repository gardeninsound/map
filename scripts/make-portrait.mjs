/**
 * Turns Mike's tintype (public/art/other/tlne1505.webp) into the 40×40 pixel
 * dialog portrait at public/sprites/mike-portrait.png: crop to the face,
 * downsample, then posterize into a 5-tone riso palette.
 *
 * Usage: node scripts/make-portrait.mjs
 */
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const SIZE = 40;
// dark → light
const TONES = [[43, 35, 80], [122, 64, 140], [255, 126, 182], [255, 200, 170], [255, 247, 230]];

const src = sharp(`${ROOT}public/art/other/tlne1505.webp`);
const { width, height } = await src.metadata();
// Face box, as fractions of the full photo.
const box = { left: 0.34, top: 0.11, size: 0.58 };
const side = Math.round(width * box.size);
const { data } = await src
  .extract({ left: Math.round(width * box.left), top: Math.round(height * box.top), width: side, height: side })
  .greyscale()
  .normalise()
  .resize(SIZE, SIZE, { kernel: 'lanczos3' })
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(SIZE * SIZE * 3);
for (let i = 0; i < SIZE * SIZE; i++) {
  const level = Math.min(TONES.length - 1, Math.floor((data[i] / 256) * TONES.length));
  TONES[level].forEach((v, k) => { out[i * 3 + k] = v; });
}
mkdirSync(`${ROOT}public/sprites`, { recursive: true });
await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toFile(`${ROOT}public/sprites/mike-portrait.png`);
await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } }).resize(256, 256, { kernel: 'nearest' }).png()
  .toFile(`${ROOT}screenshots/mike-portrait-preview.png`);
console.log('wrote public/sprites/mike-portrait.png');
