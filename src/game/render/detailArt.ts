/**
 * Detailed places (DETAILED in map-config), painted per pixel from their OSM shapes:
 * - park features (World.parkFeatures) at their true shape and angle: striped turf with field
 *   lines, baseball diamonds (clay infield, grass diamond, bases, foul lines), tennis courts
 *   with nets, the running track with lanes, playgrounds with a play structure and swings,
 *   the wading pool, bleachers;
 * - parking lots (World.parkingLots): asphalt, kerbs, stalls striped along the OSM parking
 *   aisles, some with a parked car;
 * - buildings (World.drawnBuildings) from their exact outlines, courtyards and all: flat roofs
 *   with rooftop units, and walls showing below in the SNES 3/4 view, one storey ≈ 2 px.
 */
import type { DrawnBuilding, ParkFeature } from '../../world/world';

type Pt = [number, number];
export interface PreparedFeature {
  k: ParkFeature['k'];
  s: string;
  /** rings in world pixels; the first `n` are outer */
  rings: Pt[][];
  n: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** minimum-area rectangle of the outer ring: centre, size along its axes, axis direction */
  cx: number;
  cy: number;
  w: number;
  h: number;
  cos: number;
  sin: number;
  /** baseball: home plate and the unit vector toward centre field */
  home?: Pt;
  dir?: Pt;
  reach?: number;
}

const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const C = {
  turfA: rgb('#4f9a5c'),
  turfB: rgb('#5aa868'),
  endZone: rgb('#2f6b48'),
  line: rgb('#f3e6cc'),
  clay: rgb('#c8895a'),
  clayDark: rgb('#b0744a'),
  court: rgb('#3d827d'),
  net: rgb('#2a1a12'),
  track: rgb('#b8553a'),
  trackEdge: rgb('#8a3a26'),
  chips: rgb('#c9a26b'),
  chipsDark: rgb('#b08850'),
  water: rgb('#5fa8a0'),
  waterLight: rgb('#7fc0b0'),
  rim: rgb('#f3e6cc'),
  bench: rgb('#a8a39a'),
  benchDark: rgb('#8a857c'),
  red: rgb('#b8322a'),
  yellow: rgb('#e0a93a'),
  post: rgb('#6e6058'),
};

function minRect(ring: Pt[]) {
  let best = { area: Infinity, cx: 0, cy: 0, w: 0, h: 0, cos: 1, sin: 0 };
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    if (x0 === x1 && y0 === y1) continue;
    const th = Math.atan2(y1 - y0, x1 - x0);
    const c = Math.cos(th), s = Math.sin(th);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of ring) {
      const u = x * c + y * s, v = -x * s + y * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      best = { area, cx: um * c - vm * s, cy: um * s + vm * c, w: u1 - u0, h: v1 - v0, cos: c, sin: s };
    }
  }
  return best;
}

/** Home plate: the sharpest corner of a fan-shaped field; on a plain box, the southern corner. */
function homePlate(ring: Pt[]): Pt {
  const r = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  if (r.length <= 4) return r.reduce((a, p) => (p[1] > a[1] ? p : a));
  let best = r[0], bestAngle = Infinity;
  r.forEach((p, i) => {
    const a = r[(i + r.length - 1) % r.length], b = r[(i + 1) % r.length];
    const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]];
    const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1))));
    if (ang < bestAngle) { bestAngle = ang; best = p; }
  });
  return best;
}

export function prepareFeature(f: ParkFeature, TS: number): PreparedFeature {
  const rings = f.rings.map((r) => r.map(([x, y]) => [x * TS, y * TS] as Pt));
  const all = rings.flat();
  const rect = minRect(rings[0]);
  const out: PreparedFeature = {
    k: f.k, s: f.s, rings, n: f.n,
    x0: Math.floor(Math.min(...all.map((p) => p[0]))) - 1,
    y0: Math.floor(Math.min(...all.map((p) => p[1]))) - 1,
    x1: Math.ceil(Math.max(...all.map((p) => p[0]))) + 1,
    y1: Math.ceil(Math.max(...all.map((p) => p[1]))) + 1,
    ...rect,
  };
  if (f.k === 'pitch' && f.s === 'baseball') {
    const home = homePlate(rings[0]);
    const cx = rings[0].reduce((a, p) => a + p[0], 0) / rings[0].length;
    const cy = rings[0].reduce((a, p) => a + p[1], 0) / rings[0].length;
    const d = Math.hypot(cx - home[0], cy - home[1]) || 1;
    out.home = home;
    out.dir = [(cx - home[0]) / d, (cy - home[1]) / d];
    out.reach = Math.max(...rings[0].map((p) => Math.hypot(p[0] - home[0], p[1] - home[1])));
  }
  return out;
}

const inside = (rings: Pt[][], x: number, y: number) => {
  let hit = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > y) !== (r[j][1] > y) && x < r[i][0] + ((y - r[i][1]) / (r[j][1] - r[i][1])) * (r[j][0] - r[i][0])) hit = !hit;
    }
  }
  return hit;
};

const segDist = (r: Pt[], x: number, y: number) => {
  let best = Infinity;
  for (let i = 1; i < r.length; i++) {
    const [ax, ay] = r[i - 1], [bx, by] = r[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};

/** Colour of a pixel inside feature `f` (world px), or null to leave it. */
function shade(f: PreparedFeature, x: number, y: number, hashAt: (x: number, y: number) => number): number[] {
  const dx = x - f.cx, dy = y - f.cy;
  const u = dx * f.cos + dy * f.sin;
  const v = -dx * f.sin + dy * f.cos;
  const longU = f.w >= f.h;
  const along = longU ? u : v;
  const across = longU ? v : u;
  const halfL = Math.max(f.w, f.h) / 2;
  const halfS = Math.min(f.w, f.h) / 2;
  const border = Math.abs(along) > halfL - 1.5 || Math.abs(across) > halfS - 1.5;
  switch (f.k) {
    case 'track': {
      const d = segDist(f.rings[0], x, y);
      return Math.floor(d) % 3 === 2 ? C.line : C.track;
    }
    case 'swimming_pool':
      return hashAt(x >> 1, y >> 1) < 0.12 ? C.waterLight : C.water;
    case 'bleachers':
      return Math.floor(along + 100) % 2 ? C.bench : C.benchDark;
    case 'playground':
      return hashAt(x, y) < 0.15 ? C.chipsDark : C.chips;
    case 'pitch': {
      if (f.s === 'tennis') {
        if (Math.abs(along) < 0.6) return C.net;
        if (border) return C.line;
        if (Math.abs(across) < 0.5 && Math.abs(along) < halfL * 0.55) return C.line;
        if (Math.abs(Math.abs(along) - halfL * 0.55) < 0.5) return C.line;
        return C.court;
      }
      if (f.s === 'baseball' && f.home && f.dir) {
        const px = x - f.home[0], py = y - f.home[1];
        const a = px * f.dir[0] + py * f.dir[1];
        const b = -px * f.dir[1] + py * f.dir[0];
        const R = f.reach!;
        const D = R * 0.42; // home to second base
        const dist = Math.hypot(a, b);
        const bases: Pt[] = [[0, 0], [D / 2, -D / 2], [D, 0], [D / 2, D / 2]];
        if (bases.some(([ba, bb]) => Math.abs(a - ba) < 1.2 && Math.abs(b - bb) < 1.2)) return C.line;
        if (a > 0 && Math.abs(Math.abs(b) - a) < 0.6) return C.line; // foul lines
        if (Math.hypot(a - D / 2, b) < 2.2) return C.clayDark; // the mound
        if (dist < 3) return C.clay;
        if (dist < R * 0.6 && a > -2) {
          const grassDiamond = Math.abs(a - D / 2) + Math.abs(b) < D / 2 - 2.5;
          if (!grassDiamond) return C.clay;
        }
        return Math.floor(dist / 5) % 2 ? C.turfA : C.turfB; // mown in arcs
      }
      // a field: striped turf, its outline, halfway line and centre circle (or yard lines)
      if (border) return C.line;
      if (f.s === 'american_football') {
        const step = (halfL * 2) / 12;
        if (Math.abs(along) > halfL - step) return C.endZone;
        if ((along + halfL) % step < 0.8) return C.line;
      } else {
        if (Math.abs(along) < 0.5) return C.line;
        if (Math.abs(Math.hypot(along, across) - Math.min(9, halfS * 0.35)) < 0.6) return C.line;
      }
      return Math.floor((along + 1000) / 6) % 2 ? C.turfA : C.turfB;
    }
  }
}

/** Paint the features overlapping a chunk at (ox, oy), `size` px square. */
export function paintParkFeatures(
  ctx: CanvasRenderingContext2D,
  feats: PreparedFeature[],
  ox: number,
  oy: number,
  size: number,
  hashAt: (x: number, y: number) => number,
) {
  if (!feats.length) return;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const set = (x: number, y: number, c: number[]) => {
    const lx = x - ox, ly = y - oy;
    if (lx < 0 || ly < 0 || lx >= size || ly >= size) return;
    const i = (lx + ly * size) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  };
  for (const f of feats) {
    const x0 = Math.max(f.x0, ox - 1), x1 = Math.min(f.x1, ox + size);
    const y0 = Math.max(f.y0, oy - 1), y1 = Math.min(f.y1, oy + size);
    const mw = x1 - x0 + 1;
    const mask = new Uint8Array(mw * (y1 - y0 + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(f.rings, x + 0.5, y + 0.5)) mask[x - x0 + (y - y0) * mw] = 1;
    const at = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && mask[x - x0 + (y - y0) * mw] === 1;
    for (let y = Math.max(y0, oy); y <= Math.min(y1, oy + size - 1); y++) {
      for (let x = Math.max(x0, ox); x <= Math.min(x1, ox + size - 1); x++) {
        if (!at(x, y)) continue;
        const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
        if (edge && f.k === 'track') set(x, y, C.trackEdge);
        else if (edge && f.k === 'swimming_pool') set(x, y, C.rim);
        else if (edge && f.k !== 'pitch') set(x, y, C.benchDark);
        else set(x, y, shade(f, x + 0.5, y + 0.5, hashAt));
      }
    }
    if (f.k === 'playground') {
      // a play structure with its slide, and a swing set
      const cx = Math.round(f.cx), cy = Math.round(f.cy);
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 1; j++) set(cx + i, cy + j, C.red);
      for (let k = 0; k < 6; k++) set(cx + 4 + (k >> 1), cy - 1 + k, C.yellow), set(cx + 5 + (k >> 1), cy - 1 + k, C.yellow);
      for (let i = -6; i <= 2; i++) set(cx + i, cy + 5, C.post);
      for (const sx of [-5, -2, 1]) set(cx + sx, cy + 6, C.red);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------------------
// Parking lots

export interface PreparedLot {
  rings: Pt[][];
  /** aisle segments that run through this lot, world px */
  aisles: [Pt, Pt][];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LOT = {
  asphalt: rgb('#6b5a55'),
  grain: rgb('#5f4f4b'),
  kerb: rgb('#e5cdb2'),
  stripe: rgb('#f3e6cc'),
  glass: rgb('#a9d8cc'),
  cars: ['#b8322a', '#5fa8a0', '#f3e6cc', '#e0a93a', '#2a1a12', '#d98c78', '#4f8fc0'].map(rgb),
};
const AISLE_HALF = 4; // px: half an aisle (~6 m across)
const STALL_DEPTH = 7; // px (~5.5 m)
const STALL_WIDTH = 4; // px (~2.7 m)

export function prepareLot(rings: [number, number][][], aisles: [number, number][][], TS: number): PreparedLot {
  const r = rings.map((ring) => ring.map(([x, y]) => [x * TS, y * TS] as Pt));
  const all = r.flat();
  const lot: PreparedLot = {
    rings: r,
    aisles: [],
    x0: Math.floor(Math.min(...all.map((p) => p[0]))) - 1,
    y0: Math.floor(Math.min(...all.map((p) => p[1]))) - 1,
    x1: Math.ceil(Math.max(...all.map((p) => p[0]))) + 1,
    y1: Math.ceil(Math.max(...all.map((p) => p[1]))) + 1,
  };
  for (const a of aisles) {
    const pa = a.map(([x, y]) => [x * TS, y * TS] as Pt);
    if (!pa.some(([x, y]) => inside(r, x, y))) continue;
    for (let i = 1; i < pa.length; i++) lot.aisles.push([pa[i - 1], pa[i]]);
  }
  if (!lot.aisles.length) {
    // no aisle mapped: run one down the lot's long middle
    const m = minRect(r[0]);
    const long = m.w >= m.h;
    const half = Math.max(m.w, m.h) / 2;
    const [ux, uy] = long ? [m.cos, m.sin] : [-m.sin, m.cos];
    lot.aisles.push([[m.cx - ux * half, m.cy - uy * half], [m.cx + ux * half, m.cy + uy * half]]);
  }
  return lot;
}

export function paintParking(ctx: CanvasRenderingContext2D, lots: PreparedLot[], ox: number, oy: number, size: number, hashAt: (x: number, y: number) => number) {
  if (!lots.length) return;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (const lot of lots) {
    const x0 = Math.max(lot.x0, ox - 1), x1 = Math.min(lot.x1, ox + size);
    const y0 = Math.max(lot.y0, oy - 1), y1 = Math.min(lot.y1, oy + size);
    if (x0 > x1 || y0 > y1) continue;
    const mw = x1 - x0 + 1;
    const mask = new Uint8Array(mw * (y1 - y0 + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(lot.rings, x + 0.5, y + 0.5)) mask[x - x0 + (y - y0) * mw] = 1;
    const at = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && mask[x - x0 + (y - y0) * mw] === 1;
    for (let y = Math.max(y0, oy); y <= Math.min(y1, oy + size - 1); y++) {
      for (let x = Math.max(x0, ox); x <= Math.min(x1, ox + size - 1); x++) {
        if (!at(x, y)) continue;
        let c = hashAt(x >> 1, y >> 1) < 0.05 ? LOT.grain : LOT.asphalt;
        if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) c = LOT.kerb;
        else {
          // the nearest aisle: how deep into a stall this is, and how far along
          const px = x + 0.5, py = y + 0.5;
          let best = Infinity, along = 0, side = 0, seg = 0;
          lot.aisles.forEach(([[ax, ay], [bx, by]], k) => {
            const dx = bx - ax, dy = by - ay;
            const len = Math.hypot(dx, dy) || 1e-9;
            const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (len * len)));
            const dist = Math.hypot(px - ax - t * dx, py - ay - t * dy);
            if (dist < best) { best = dist; along = t * len; side = Math.sign((px - ax) * dy - (py - ay) * dx); seg = k; }
          });
          const depth = best - AISLE_HALF;
          if (depth > 0 && depth < STALL_DEPTH) {
            const slot = Math.floor(along / STALL_WIDTH);
            const inSlot = along - slot * STALL_WIDTH;
            if (inSlot < 1) c = LOT.stripe;
            else if (hashAt(slot * 3 + seg, side * 17 + 5) < 0.5 && depth > 0.5 && depth < STALL_DEPTH - 0.5) {
              // a parked car, nose to the aisle, windscreen showing
              const car = LOT.cars[Math.floor(hashAt(slot + seg * 31, side + 9) * LOT.cars.length)];
              c = depth > 1.5 && depth < 2.8 ? LOT.glass : car;
            }
          }
        }
        const i = (x - ox + (y - oy) * size) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------------------
// Buildings from exact outlines

export interface PreparedBuilding {
  rings: Pt[][];
  wall: number;
  look: { roof: number[]; roofLight: number[]; unit: number[]; wall: number[]; window: number[] };
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LOOKS: Record<DrawnBuilding['k'], PreparedBuilding['look']> = {
  // brick with cream-trimmed windows: West Seattle High is a 1917 brick school
  civic: { roof: rgb('#8f8076'), roofLight: rgb('#a8998a'), unit: rgb('#6e6058'), wall: rgb('#a8442e'), window: rgb('#efe2bf') },
  block: { roof: rgb('#d9b98a'), roofLight: rgb('#e8cfa6'), unit: rgb('#a8814e'), wall: rgb('#f3e6cc'), window: rgb('#a9d8cc') },
  shop: { roof: rgb('#8f8076'), roofLight: rgb('#a8998a'), unit: rgb('#6e6058'), wall: rgb('#dccbb4'), window: rgb('#a9d8cc') },
};
const INK_RGB = rgb('#2a1a12');

export function prepareBuilding(b: DrawnBuilding, TS: number): PreparedBuilding {
  const rings = b.rings.map((r) => r.map(([x, y]) => [x * TS, y * TS] as Pt));
  const all = rings.flat();
  const wall = Math.max(3, Math.min(8, Math.round(b.levels * 2)));
  return {
    rings,
    wall,
    look: LOOKS[b.k],
    x0: Math.floor(Math.min(...all.map((p) => p[0]))) - 1,
    y0: Math.floor(Math.min(...all.map((p) => p[1]))) - wall - 1,
    x1: Math.ceil(Math.max(...all.map((p) => p[0]))) + 3,
    y1: Math.ceil(Math.max(...all.map((p) => p[1]))) + 2,
  };
}

export function paintBuildings(ctx: CanvasRenderingContext2D, bs: PreparedBuilding[], ox: number, oy: number, size: number, hashAt: (x: number, y: number) => number) {
  if (!bs.length) return;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const put = (x: number, y: number, c: number[]) => {
    if (x < ox || y < oy || x >= ox + size || y >= oy + size) return;
    const i = (x - ox + (y - oy) * size) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  };
  const shadow = (x: number, y: number) => {
    if (x < ox || y < oy || x >= ox + size || y >= oy + size) return;
    const i = (x - ox + (y - oy) * size) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] * 0.78);
  };
  for (const b of bs) {
    // the ground plan over the drawn bounds, with a margin so neighbours can be tested
    const x0 = Math.max(b.x0, ox - 3), x1 = Math.min(b.x1, ox + size + 2);
    const y0 = Math.max(b.y0, oy - 3), y1 = Math.min(b.y1 + b.wall, oy + size + b.wall + 2);
    if (x0 > x1 || y0 > y1) continue;
    const mw = x1 - x0 + 1;
    const plan = new Uint8Array(mw * (y1 - y0 + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(b.rings, x + 0.5, y + 0.5)) plan[x - x0 + (y - y0) * mw] = 1;
    const at = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && plan[x - x0 + (y - y0) * mw] === 1;
    const roof = (x: number, y: number) => at(x, y + b.wall);
    const body = (x: number, y: number) => {
      for (let k = 0; k <= b.wall; k++) if (at(x, y + k)) return true;
      return false;
    };
    for (let y = Math.max(y0, oy); y <= Math.min(y1, oy + size - 1); y++) {
      for (let x = Math.max(x0, ox); x <= Math.min(x1, ox + size - 1); x++) {
        if (roof(x, y)) {
          if (!roof(x - 1, y) || !roof(x + 1, y) || !roof(x, y - 1) || !roof(x, y + 1)) put(x, y, INK_RGB);
          else if (!roof(x - 2, y) || !roof(x + 2, y) || !roof(x, y - 2)) put(x, y, b.look.roofLight); // parapet
          else {
            // rooftop units on a loose grid, only well inside the roof
            const gx = Math.floor(x / 14), gy = Math.floor(y / 12);
            const ux = gx * 14 + 4, uy = gy * 12 + 4;
            const unit = hashAt(gx, gy) < 0.35 && x >= ux && x < ux + 5 && y >= uy && y < uy + 3 && roof(ux - 2, uy - 2) && roof(ux + 7, uy + 5);
            put(x, y, unit ? b.look.unit : b.look.roof);
          }
        } else if (body(x, y)) {
          if (!body(x - 1, y) || !body(x + 1, y) || !body(x, y + 1)) put(x, y, INK_RGB);
          else {
            // rows of windows, one per storey
            let k = 0;
            while (k <= b.wall && !roof(x, y - k)) k++;
            const win = k % 2 === 1 && x % 4 < 2 && body(x - 1, y) && body(x + 2, y);
            put(x, y, win ? b.look.window : b.look.wall);
          }
        } else if (body(x - 2, y - 1)) shadow(x, y);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
