import type { CityGame, CityPlugin, DrawContext, PlacedLandmark } from '../../city';

/** The water inside the Colman Pool drawing, in its pixels (see `colmanPool` in src/city/render/landmarks.ts). */
const WATER = { x: 5, y: 17, w: 70, h: 37 };
/** the seal's frame on the map, scaled from the 191×125 source to the 16 px grid */
const SEAL_W = 42;
const SEAL_H = 27;
/** headings snap to 16 steps, so the turn reads as pixel art instead of shimmering */
const STEP = Math.PI / 8;

interface Sheet { frameWidth: number; frameHeight: number; frames: number; columns: number; frameDurationMs: number }

/**
 * Cut the swim spritesheet into frames, each scaled down to SEAL_W × SEAL_H through a
 * half-size step (smoother than one big jump) with its alpha cut to on/off so the edge is crisp.
 */
function cutFrames(img: HTMLImageElement, sheet: Sheet): HTMLCanvasElement[] {
  const mid = document.createElement('canvas');
  mid.width = SEAL_W * 3;
  mid.height = SEAL_H * 3;
  const m = mid.getContext('2d')!;
  m.imageSmoothingQuality = 'high';
  return Array.from({ length: sheet.frames }, (_, i) => {
    const sx = (i % sheet.columns) * sheet.frameWidth, sy = Math.floor(i / sheet.columns) * sheet.frameHeight;
    m.clearRect(0, 0, mid.width, mid.height);
    m.drawImage(img, sx, sy, sheet.frameWidth, sheet.frameHeight, 0, 0, mid.width, mid.height);
    const c = document.createElement('canvas');
    c.width = SEAL_W;
    c.height = SEAL_H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mid, 0, 0, SEAL_W, SEAL_H);
    const px = ctx.getImageData(0, 0, SEAL_W, SEAL_H);
    for (let k = 3; k < px.data.length; k += 4) px.data[k] = px.data[k] < 110 ? 0 : 255;
    ctx.putImageData(px, 0, 0);
    return c;
  });
}

/**
 * A seal swimming laps in Colman Pool: the swim loop from public/seal/ (spritesheet + its
 * JSON), circling the pool counter-clockwise, turned to its heading, kept inside the water.
 * Honors prefers-reduced-motion (one frame, resting mid-pool).
 */
export class Seal implements CityPlugin {
  private pool: PlacedLandmark | undefined;
  private frames: HTMLCanvasElement[] = [];
  private frameMs = 40;
  private still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private landmarkId = 'colman-pool') {}

  attach(game: CityGame) {
    this.pool = game.world.landmarks.find((l) => l.id === this.landmarkId);
    if (!this.pool) return;
    const base = `${import.meta.env.BASE_URL}seal/seal-swim-spritesheet_2`;
    const img = new Image();
    img.src = `${base}.png`;
    Promise.all([fetch(`${base}.json`).then((r) => r.json() as Promise<Sheet>), img.decode()])
      .then(([sheet]) => {
        this.frameMs = sheet.frameDurationMs;
        this.frames = cutFrames(img, sheet);
      })
      .catch(() => {}); // no seal, still a pool
  }

  draw(d: DrawContext) {
    const pool = this.pool;
    if (!pool || !this.frames.length) return;
    const o = d.toScreen(pool);
    const water = { x: o.x + WATER.x, y: o.y + WATER.y };
    if (!d.onScreen({ x: water.x + WATER.w / 2, y: water.y + WATER.h / 2 }, WATER.w)) return;
    const { ctx, time } = d;
    // counter-clockwise around an ellipse sized so the seal stays in the water; the art
    // faces left, so it turns to the tangent
    const t = this.still ? Math.PI / 2 : time * 0.22;
    const rx = Math.max(2, (WATER.w - SEAL_W) / 2), ry = Math.max(2, (WATER.h - SEAL_H) / 2);
    const x = Math.round(water.x + WATER.w / 2 + rx * Math.cos(t));
    const y = Math.round(water.y + WATER.h / 2 - ry * Math.sin(t));
    const dx = -rx * Math.sin(t), dy = -ry * Math.cos(t);
    const left = dx < 0;
    const heading = Math.round((Math.atan2(dy, dx) + (left ? Math.PI : 0)) / STEP) * STEP;
    const frame = this.frames[this.still ? 0 : Math.floor((time * 1000) / this.frameMs) % this.frames.length];
    d.push({
      y: pool.y + pool.h, // in the water, under anyone walking by on the deck
      draw: () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(water.x, water.y, WATER.w, WATER.h);
        ctx.clip();
        ctx.translate(x, y);
        ctx.rotate(heading);
        if (!left) ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(frame, -SEAL_W / 2, -SEAL_H / 2);
        ctx.restore();
      },
    });
  }
}
