/**
 * Sword ferns for the title screen, unfurling from fiddleheads. Pure geometry: a frond is a
 * midrib traced from the crown, bending gently outward where it's open and coiled into a
 * clothoid spiral (curvature growing toward the tip) where it isn't. Unfurling moves the
 * boundary between the two up the frond, so the coil unrolls the way a crozier does.
 */

export interface Frond {
  /** heading at the crown, radians (canvas: -π/2 is straight up) */
  angle: number;
  /** full length in pixels */
  length: number;
  /** seconds after the fern starts before this frond comes up */
  delay: number;
}

export interface RibPoint {
  x: number;
  y: number;
  /** heading here */
  a: number;
  /** distance from the crown */
  s: number;
  /** 1 where the frond has unrolled, falling toward 0 into the coil */
  open: number;
}

/** Bare stalk at the base of a frond, as a fraction of its length. */
export const STIPE = 0.18;
/** Turns the coil makes when the frond is fully rolled up. */
const COIL_TURNS = 1.9;
const STEP = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** How far along a frond is at time t: e grows the fiddlehead, u unrolls it. */
export function progress(f: Frond, t: number, dur = 6): { e: number; u: number } {
  const p = clamp01((t - f.delay) / dur);
  return { e: smooth(clamp01(p / 0.18)), u: smooth(clamp01((p - 0.12) / 0.88)) };
}

/** The frond's midrib from the crown (0,0), one point per half pixel. */
export function midrib(f: Frond, u: number, e = 1, sway = 0): RibPoint[] {
  const L = f.length * (0.25 + 0.75 * e);
  const rolled = L * (1 - STIPE);
  const straight = L - rolled * (1 - u);
  // droop away from the plant's middle; the coil curls the other way, in toward it
  const out = f.angle < -Math.PI / 2 ? -1 : 1;
  const droop = (out * (0.35 + 1.1 * Math.abs(Math.cos(f.angle)))) / L + sway * u;
  const g = (2 * COIL_TURNS * 2 * Math.PI) / (rolled * rolled);
  const pts: RibPoint[] = [];
  let x = 0;
  let y = 0;
  let a = f.angle;
  for (let s = 0; s <= L; s += STEP) {
    pts.push({ x, y, a, s, open: s <= straight ? 1 : Math.max(0, 1 - (s - straight) / 5) });
    const k = droop - (s > straight ? out * g * (s - straight) : 0);
    x += Math.cos(a) * STEP;
    y += Math.sin(a) * STEP;
    a += k * STEP;
  }
  return pts;
}

/** Leaflet length at a point on the midrib, before the coil tucks it in. */
export function pinnaLength(f: Frond, p: RibPoint, L: number): number {
  const sn = p.s / L;
  if (sn < STIPE) return 0;
  const full = f.length * 0.12;
  return full * Math.min(1, (sn - STIPE) / 0.12) * Math.min(1, (1 - sn) / 0.45 + 0.1);
}
