/**
 * The spinning art-spot lemon (pure, tested): a little 3D lemon — an ellipsoid body with a
 * pointed tip at each end — turned about its vertical axis and rendered to pixel-art frames
 * in the same characters as src/game/lemon.ts (k outline, d/m/l/h shades dark → highlight,
 * s shadow). The light stays put while the lemon turns, so the shine slides across it and
 * the tips swing round to face you; end-on it's round, side-on it's long.
 */
export const SPIN_FRAMES = 16;
const W = 24; // frame width, px
const H = 20; // frame height, px
const CX = 11.5; // the lemon's centre in the frame
const CY = 8.5;
const A = 9; // half-length (along the tips), px
const B = 6.6; // half-height
const C = 7; // half-depth
const TIP = 1.9; // the tips' radius
const LIGHT = norm([-0.55, -0.65, 0.52]); // from the upper left, toward the viewer
/** the lemon's lowest row (it sits on the ground there, its shadow just below) */
export const SPIN_BASE = Math.floor(CY + B) - 1;

function norm(v: number[]) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

/**
 * Implicit lemon in its own frame (x along the tips): ≤ 0 inside. The body is an ellipsoid
 * blended (smooth min) with a small sphere at each end, so the tips grow out of it.
 */
function lemon(x: number, y: number, z: number): number {
  const body = Math.sqrt((x / A) ** 2 + (y / B) ** 2 + (z / C) ** 2) - 1;
  const tip = Math.min(Math.hypot(Math.abs(x) - (A - 0.4), y, z) / TIP - 1, 9);
  const k = 0.35; // blend
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (tip - body)) / k));
  return tip * (1 - h) + body * h - k * h * (1 - h);
}

/** One frame at turn angle `theta` (radians) as a grid of characters. */
export function lemonFrame(theta: number): string[] {
  const c = Math.cos(theta), s = Math.sin(theta);
  // world → lemon frame (rotate about the vertical axis)
  const f = (x: number, y: number, z: number) => lemon(x * c + z * s, y, -x * s + z * c);
  const cells: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  const solid: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = px + 0.5 - CX, y = py + 0.5 - CY;
      // march from the viewer into the scene; the first point inside is the surface
      for (let z = A + 2; z > -A - 2; z -= 0.25) {
        if (f(x, y, z) > 0) continue;
        solid[py][px] = true;
        const e = 0.05;
        const n = norm([f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)]);
        const lit = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
        // a tight shine where the surface faces the light squarely, then three bands of shade
        const shine = lit > 0.9;
        cells[py][px] = shine ? 'h' : lit > 0.45 ? 'l' : lit > 0.05 ? 'm' : 'd';
        break;
      }
    }
  }
  // ink outline: lemon cells touching empty ones
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      if (!solid[py][px]) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !solid[py + dy]?.[px + dx]);
      if (edge) cells[py][px] = 'k';
    }
  }
  // the shadow on the ground, as wide as the lemon looks from here, a touch to the right
  const half = Math.sqrt((A * c) ** 2 + (C * s) ** 2) * 0.85;
  for (let py = SPIN_BASE + 1; py < H; py++) {
    const dy = (py + 0.5 - SPIN_BASE - 1.3) / 1.4;
    for (let px = 0; px < W; px++) {
      const dx = (px + 0.5 - CX - 1.5) / half;
      if (cells[py][px] === '.' && dx * dx + dy * dy <= 1) cells[py][px] = 's';
    }
  }
  return cells.map((r) => r.join(''));
}

/** The whole turn: SPIN_FRAMES frames, starting side-on. */
export function lemonSpin(): string[][] {
  return Array.from({ length: SPIN_FRAMES }, (_, i) => lemonFrame((i / SPIN_FRAMES) * Math.PI * 2));
}

/** A little heart above the lemon, and its bigger beat (h shine, r red, k outline). */
export const HEART = [
  '.kk...kk.',
  'krrk.krrk',
  'krhrkrrrk',
  'krrrrrrrk',
  '.krrrrrk.',
  '..krrrk..',
  '...krk...',
  '....k....',
];
export const HEART_BEAT = [
  '.kkk...kkk.',
  'krrrk.krrrk',
  'krhhrkrrrrk',
  'krhrrrrrrrk',
  'krrrrrrrrrk',
  '.krrrrrrrk.',
  '..krrrrrk..',
  '...krrrk...',
  '....krk....',
  '.....k.....',
];
