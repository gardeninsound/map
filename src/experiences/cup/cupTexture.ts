import type { CupVersion, Frame } from '../../content/cupVersions';

/** Texture wraps once around the mug; u = 0.5 is the side that faces you (see CupScene). */
export const TEX_W = 1024;
export const TEX_H = 512;
export const FONT = '"Big Shoulders Stencil Display", Impact, sans-serif';
/** The painted panel: centred on the front, as fractions of the texture. */
const PANEL = { w: 0.27, h: 0.66 };

/** The leaping-rabbit stencil, traced from a photo of the mug (scripts/make-cup-rabbit.mjs). */
let rabbitMask: HTMLImageElement | null = null;
export function loadRabbit(): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      rabbitMask = img;
      resolve();
    };
    img.onerror = () => resolve(); // draw without it rather than hang the scene
    img.src = `${import.meta.env.BASE_URL}sprites/cup-rabbit.png`;
  });
}

/** Stamp the rabbit mask in `color`, centred at (cx, cy), `w` wide. */
function drawRabbit(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, w: number) {
  if (!rabbitMask) return;
  const h = (w * rabbitMask.height) / rabbitMask.width;
  const tint = document.createElement('canvas');
  tint.width = Math.ceil(w);
  tint.height = Math.ceil(h);
  const t = tint.getContext('2d')!;
  t.drawImage(rabbitMask, 0, 0, w, h);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, w, h);
  ctx.drawImage(tint, cx - w / 2, cy - h / 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, x: number, y: number, w: number, h: number) {
  const r = Math.min(w, h) * 0.16;
  if (frame.style === 'dashes' && frame.fill) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = frame.fill;
    ctx.fill();
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = frame.color;
  ctx.lineCap = frame.style === 'dots' ? 'round' : 'butt';
  // dashes: the chunky hand-cut blocks of the real stencil
  ctx.lineWidth = frame.style === 'dots' ? 9 : 22;
  ctx.setLineDash(frame.style === 'dots' ? [0.1, 22] : [30, 13]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Paint one version of the mug onto a texture-sized canvas. */
export function drawVersion(ctx: CanvasRenderingContext2D, v: CupVersion) {
  ctx.fillStyle = v.body;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // a little lived-in grime near the rim (the bottom of the hanging mug)
  const grime = ctx.createLinearGradient(0, TEX_H * 0.82, 0, TEX_H);
  grime.addColorStop(0, 'rgba(0,0,0,0)');
  grime.addColorStop(1, 'rgba(60,40,40,0.12)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const pw = TEX_W * PANEL.w;
  const ph = TEX_H * PANEL.h;
  const px = TEX_W / 2 - pw / 2;
  const py = TEX_H / 2 - ph / 2;
  if (v.frame) drawFrame(ctx, v.frame, px, py, pw, ph);

  if (v.rabbit) drawRabbit(ctx, v.rabbit, TEX_W / 2, TEX_H / 2, pw * 0.72);

  if (v.lines?.length) {
    const inset = v.frame ? 0.8 : 0.95;
    const n = v.lines.length;
    // Fit the block: as tall as the panel allows, but no line wider than the panel.
    let size = (ph * inset) / (n * 0.92);
    ctx.font = `800 ${size}px ${FONT}`;
    const widest = Math.max(...v.lines.map((l) => ctx.measureText(l.text).width));
    size = Math.min(size, (size * pw * inset) / widest);
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = size * 0.92;
    const top = TEX_H / 2 - (lineH * (n - 1)) / 2;
    v.lines.forEach((l, i) => {
      ctx.fillStyle = l.color;
      // two-tone versions overlap a touch, like the layered originals
      ctx.fillText(l.text, TEX_W / 2 + (i % 2 ? size * 0.04 : -size * 0.04), top + i * lineH);
    });
  }
}

/**
 * The paint-over: `base` is the coat on the mug, `next` the one under your brush, `mask`
 * where you've painted. `display` (the actual texture) = base + next-through-mask.
 */
export class CupPainter {
  readonly display = canvas();
  private base = canvas();
  private next = canvas();
  private mask = canvas();
  private tmp = canvas();
  private last: { u: number; v: number } | null = null;
  hasNext = false;

  constructor(
    /** brush radius in texture px, horizontally and vertically (the mug isn't square) */
    private brush: { rx: number; ry: number },
  ) {}

  setVersions(current: CupVersion, upcoming: CupVersion | null) {
    drawVersion(ctx(this.base), current);
    this.hasNext = !!upcoming;
    if (upcoming) drawVersion(ctx(this.next), upcoming);
    ctx(this.mask).clearRect(0, 0, TEX_W, TEX_H);
    this.last = null;
    this.compose();
  }

  /** Brush down/drag at texture coords (u, v ∈ 0..1, v = 0 at the bottom). */
  paint(u: number, v: number) {
    if (!this.hasNext) return;
    const m = ctx(this.mask);
    m.fillStyle = '#000';
    const stamp = (su: number, sv: number) => {
      const x = su * TEX_W;
      const y = (1 - sv) * TEX_H;
      for (const dx of [-TEX_W, 0, TEX_W]) {
        m.beginPath();
        m.ellipse(x + dx, y, this.brush.rx, this.brush.ry, 0, 0, Math.PI * 2);
        m.fill();
      }
    };
    const prev = this.last;
    if (prev && Math.abs(u - prev.u) < 0.5) {
      const steps = Math.ceil(Math.hypot((u - prev.u) * TEX_W, (v - prev.v) * TEX_H) / (this.brush.rx * 0.4));
      for (let i = 1; i <= steps; i++) stamp(prev.u + ((u - prev.u) * i) / steps, prev.v + ((v - prev.v) * i) / steps);
    } else stamp(u, v);
    this.last = { u, v };
    this.compose();
  }

  lift() {
    this.last = null;
  }

  /** Fraction of the front panel area that's been painted over (sampled). */
  coverage(): number {
    const x0 = Math.floor(TEX_W * (0.5 - PANEL.w * 0.7));
    const w = Math.floor(TEX_W * PANEL.w * 1.4);
    const y0 = Math.floor(TEX_H * 0.12);
    const h = Math.floor(TEX_H * 0.76);
    const data = ctx(this.mask).getImageData(x0, y0, w, h).data;
    let on = 0;
    let all = 0;
    for (let i = 3; i < data.length; i += 4 * 7) {
      all++;
      if (data[i] > 0) on++;
    }
    return on / all;
  }

  /** Finish the coat everywhere. */
  fillAll() {
    const m = ctx(this.mask);
    m.fillStyle = '#000';
    m.fillRect(0, 0, TEX_W, TEX_H);
    this.compose();
  }

  private compose() {
    const t = ctx(this.tmp);
    t.globalCompositeOperation = 'copy';
    t.drawImage(this.mask, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.drawImage(this.next, 0, 0);
    t.globalCompositeOperation = 'source-over';
    const d = ctx(this.display);
    d.drawImage(this.base, 0, 0);
    d.drawImage(this.tmp, 0, 0);
  }
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  return c;
}
const ctx = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
