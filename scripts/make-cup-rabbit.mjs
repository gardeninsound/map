/**
 * Traces the leaping-rabbit stencil from a close-up photo of the Lulu mug
 * (data/source/cup-rabbit-photo.png) into a clean silhouette mask:
 * public/sprites/cup-rabbit.png (black where the paint is, transparent elsewhere).
 * The cup scene tints it per version.
 *
 * Usage: node scripts/make-cup-rabbit.mjs
 */
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const BOX = { left: 205, top: 220, width: 260, height: 225 }; // the rabbit, with a margin
const DARK = 110; // grey level below which a pixel is paint

const { data, info } = await sharp(`${ROOT}data/source/cup-rabbit-photo.png`)
  .extract(BOX)
  .removeAlpha()
  .greyscale()
  .blur(1.2) // soften the photo grain so the edge comes out smooth
  .raw()
  .toBuffer({ resolveWithObject: true });

const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < info.width * info.height; i++) {
  // soft edge: ramp alpha across a small band around the threshold
  const a = Math.max(0, Math.min(1, (DARK + 12 - data[i]) / 24));
  rgba[i * 4 + 3] = Math.round(a * 255);
}
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(`${ROOT}public/sprites/cup-rabbit.png`);
console.log(`wrote public/sprites/cup-rabbit.png (${info.width}×${info.height})`);
