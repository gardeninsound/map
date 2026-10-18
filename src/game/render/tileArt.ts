import { Tile, isBuilding, type World } from '../../world/world';
import { drawLandmark } from './landmarks';
import { INK, PAL } from './palette';

export const TS = 16; // pixels per tile
export const CHUNK = 32; // tiles per chunk side

/** Deterministic 0..1 hash per tile, so decoration is stable across reloads. */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

function grass(ctx: Ctx, ox: number, oy: number, tx: number, ty: number, flowers: boolean) {
  px(ctx, PAL.grass, ox, oy, TS, TS);
  for (let i = 0; i < 6; i++) {
    const r = hash(tx, ty, i + 10);
    px(ctx, r < 0.5 ? PAL.grassDark : PAL.grassLight, ox + Math.floor(hash(tx, ty, i) * 15), oy + Math.floor(r * 15), 1, 2);
  }
  if (flowers && hash(tx, ty, 3) < 0.18) {
    const c = PAL.flowers[Math.floor(hash(tx, ty, 4) * PAL.flowers.length)];
    const fx = ox + 3 + Math.floor(hash(tx, ty, 5) * 9);
    const fy = oy + 3 + Math.floor(hash(tx, ty, 6) * 9);
    px(ctx, c, fx, fy, 2, 2);
    px(ctx, c, fx + 4, fy + 3, 2, 2);
  }
}

function tree(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  const jx = Math.floor(hash(tx, ty, 7) * 3) - 1;
  const jy = Math.floor(hash(tx, ty, 8) * 3) - 1;
  const x = ox + jx;
  const y = oy + jy;
  px(ctx, 'rgba(0,0,0,0.18)', x + 3, y + 13, 11, 3);
  px(ctx, PAL.trunk, x + 7, y + 10, 2, 4);
  px(ctx, PAL.treeDark, x + 3, y + 2, 10, 10);
  px(ctx, PAL.treeDark, x + 2, y + 4, 12, 6);
  px(ctx, PAL.tree, x + 4, y + 3, 8, 8);
  px(ctx, PAL.tree, x + 3, y + 5, 10, 4);
  px(ctx, PAL.treeLight, x + 5, y + 4, 3, 2);
  px(ctx, PAL.treeLight, x + 4, y + 6, 2, 1);
}

function house(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  grass(ctx, ox, oy, tx, ty, false);
  const roof = PAL.roofs[Math.floor(hash(tx, ty, 9) * PAL.roofs.length)];
  px(ctx, 'rgba(0,0,0,0.2)', ox + 3, oy + 14, 12, 2);
  // walls
  px(ctx, INK, ox + 2, oy + 7, 12, 8);
  px(ctx, PAL.wall, ox + 3, oy + 8, 10, 6);
  px(ctx, PAL.door, ox + 7, oy + 10, 2, 4);
  px(ctx, PAL.window, ox + 4, oy + 9, 2, 2);
  px(ctx, PAL.window, ox + 10, oy + 9, 2, 2);
  // stepped roof
  px(ctx, INK, ox + 1, oy + 5, 14, 3);
  px(ctx, INK, ox + 3, oy + 3, 10, 2);
  px(ctx, INK, ox + 5, oy + 1, 6, 2);
  px(ctx, roof, ox + 2, oy + 6, 12, 1);
  px(ctx, roof, ox + 4, oy + 4, 8, 2);
  px(ctx, roof, ox + 6, oy + 2, 4, 2);
  px(ctx, 'rgba(255,255,255,0.35)', ox + 6, oy + 2, 2, 1);
}

const BUILDING_LOOK = {
  [Tile.Shop]: { roof: '#8e8ba3', roofLight: '#a9a6bd', wall: '#d6d3e3', trim: '#6f6c85' },
  [Tile.Block]: { roof: '#e0c9a6', roofLight: '#ecdcc0', wall: '#f6e7cc', trim: '#b89b72' },
  [Tile.Civic]: { roof: '#c8503d', roofLight: '#dc6a55', wall: '#e3664f', trim: '#9c3a2c' },
} as const;
const AWNINGS = ['#ff5d5d', '#2ec4b6', '#ffd166', '#ff7eb6', '#57cc99', '#3a86ff', '#a77bff'];

/**
 * A tile of a big building, drawn top-down with SNES-style 3/4 cheats: flat roof with
 * an ink outline where the footprint ends, a facade on the south edge, and striped
 * awnings on any edge that looks onto the street.
 */
function building(ctx: Ctx, world: World, t: 6 | 8 | 9, ox: number, oy: number, tx: number, ty: number) {
  const look = BUILDING_LOOK[t];
  const same = (dx: number, dy: number) => world.tileAt(tx + dx, ty + dy) === t;
  const street = (dx: number, dy: number) => {
    const n = world.tileAt(tx + dx, ty + dy);
    return n === Tile.Road || (!isBuilding(n) && world.roadDist[tx + dx + (ty + dy) * world.w] <= 1);
  };
  px(ctx, look.roof, ox, oy, TS, TS);
  if (!same(0, -1)) px(ctx, look.roofLight, ox, oy, TS, 2);
  const h = hash(tx, ty, 30);
  if (h < 0.18) {
    // rooftop AC unit
    px(ctx, look.trim, ox + 4, oy + 4, 5, 4);
    px(ctx, look.roofLight, ox + 5, oy + 5, 3, 1);
  } else if (h < 0.26) {
    px(ctx, look.trim, ox + 9, oy + 3, 2, 2);
  }
  const awning = AWNINGS[Math.floor(hash(Math.floor(tx / 3), Math.floor(ty / 3), 31) * AWNINGS.length)];
  if (!same(0, 1)) {
    // south facade
    px(ctx, look.wall, ox, oy + 8, TS, 8);
    if (t === Tile.Shop) {
      for (let i = 0; i < TS; i += 4) px(ctx, i % 8 ? '#ffffff' : awning, ox + i, oy + 8, 4, 3);
      px(ctx, PAL.window, ox + 2, oy + 12, 12, 3);
      if (hash(tx, ty, 32) < 0.4) px(ctx, PAL.door, ox + 7, oy + 11, 3, 5);
    } else {
      px(ctx, PAL.window, ox + 2, oy + 10, 3, 3);
      px(ctx, PAL.window, ox + 11, oy + 10, 3, 3);
      if (t === Tile.Civic) px(ctx, '#ffffff', ox + 7, oy + 10, 2, 6);
    }
    px(ctx, INK, ox, oy + 15, TS, 1);
  }
  if (t === Tile.Shop) {
    // awnings on side walls facing the street
    for (const [dx, x] of [[-1, 0], [1, TS - 3]] as const) {
      if (!same(dx, 0) && street(dx, 0)) for (let j = 0; j < TS; j += 4) px(ctx, j % 8 ? '#ffffff' : awning, ox + x, oy + j, 3, 4);
    }
  }
  if (!same(0, -1)) px(ctx, INK, ox, oy, TS, 1);
  if (!same(-1, 0)) px(ctx, INK, ox, oy, 1, TS);
  if (!same(1, 0)) px(ctx, INK, ox + TS - 1, oy, 1, TS);
}

const CARS = ['#ff5d5d', '#3a86ff', '#ffffff', '#ffd166', '#2b2350', '#57cc99'];
function plaza(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, '#c8c6d4', ox, oy, TS, TS);
  px(ctx, '#ffffff', ox, oy + 1, 1, 6);
  const h = hash(tx, ty, 40);
  if (h < 0.3) {
    const c = CARS[Math.floor(hash(tx, ty, 41) * CARS.length)];
    px(ctx, 'rgba(0,0,0,0.2)', ox + 3, oy + 3, 10, 6);
    px(ctx, INK, ox + 2, oy + 1, 10, 6);
    px(ctx, c, ox + 3, oy + 2, 8, 4);
    px(ctx, PAL.window, ox + 8, oy + 2, 2, 4);
  }
}

function water(ctx: Ctx, ox: number, oy: number, tx: number, ty: number, world: World) {
  px(ctx, PAL.water, ox, oy, TS, TS);
  if (hash(tx, ty, 1) < 0.35) px(ctx, PAL.waterDeep, ox + Math.floor(hash(tx, ty, 2) * 10), oy + Math.floor(hash(tx, ty, 3) * 14), 5, 1);
  const land = (dx: number, dy: number) => world.tileAt(tx + dx, ty + dy) !== Tile.Water;
  if (land(0, -1)) px(ctx, PAL.foam, ox, oy, TS, 2);
  if (land(0, 1)) px(ctx, PAL.foam, ox, oy + 14, TS, 2);
  if (land(-1, 0)) px(ctx, PAL.foam, ox, oy, 2, TS);
  if (land(1, 0)) px(ctx, PAL.foam, ox + 14, oy, 2, TS);
}

function sand(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, PAL.sand, ox, oy, TS, TS);
  for (let i = 0; i < 4; i++) px(ctx, PAL.sandDark, ox + Math.floor(hash(tx, ty, i) * 15), oy + Math.floor(hash(tx, ty, i + 5) * 15));
}

const SIDEWALK = 4; // px of sidewalk on a road tile's outer edge (~3 m)
const BEVEL = TS / 2; // px: 45° cuts run through tile mid-edges so a 1:1 staircase is one straight line

type Corner = 'nw' | 'ne' | 'sw' | 'se';
/**
 * Paint a 45° wedge in one corner of a tile (d = manhattan distance from that corner).
 * On a road tile's outside corner (`outside`): grass beyond the diagonal, then sidewalk,
 * then curb. In the grass notch of a staircase: asphalt, curb, then sidewalk. Both wedges
 * meet the tile edges at their midpoints, so a 45° street reads as one clean slanted curb.
 */
function bevel(ctx: Ctx, ox: number, oy: number, corner: Corner, outside: boolean) {
  const cx = corner === 'nw' || corner === 'sw' ? 0 : TS - 1;
  const cy = corner === 'nw' || corner === 'ne' ? 0 : TS - 1;
  const S = SIDEWALK;
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      let color: string | null = null;
      if (outside) {
        if (d < BEVEL) color = (x + y) % 5 === 0 ? PAL.grassDark : PAL.grass;
        else if (d < BEVEL + S) color = PAL.sidewalk;
        else if (d === BEVEL + S) color = PAL.curb;
      } else {
        if (d < BEVEL - S - 1) color = PAL.road;
        else if (d === BEVEL - S - 1) color = PAL.curb;
        else if (d < BEVEL) color = PAL.sidewalk;
      }
      if (color) px(ctx, color, ox + x, oy + y);
    }
  }
}

/** Ground that fills a staircase notch with a curb wedge (see notchFill). */
const NOTCHABLE = new Set<number>([Tile.Land, Tile.Park, Tile.Plaza]);

/** Fill staircase notches: a non-road tile with road on two adjacent sides (and between them). */
function notchFill(ctx: Ctx, world: World, tx: number, ty: number, ox: number, oy: number) {
  const r = (dx: number, dy: number) => world.tileAt(tx + dx, ty + dy) === Tile.Road;
  if (r(0, -1) && r(-1, 0) && r(-1, -1)) bevel(ctx, ox, oy, 'nw', false);
  if (r(0, -1) && r(1, 0) && r(1, -1)) bevel(ctx, ox, oy, 'ne', false);
  if (r(0, 1) && r(-1, 0) && r(-1, 1)) bevel(ctx, ox, oy, 'sw', false);
  if (r(0, 1) && r(1, 0) && r(1, 1)) bevel(ctx, ox, oy, 'se', false);
}

/**
 * Asphalt, with the sidewalk drawn on the road's own edge tiles: every edge that meets
 * something other than road gets the same strip + curb, whatever is next door (grass,
 * a house, a storefront, a park). Inner corners get a nub so staircase diagonals stay joined.
 */
function road(ctx: Ctx, ox: number, oy: number, tx: number, ty: number, world: World) {
  px(ctx, PAL.road, ox, oy, TS, TS);
  for (let i = 0; i < 3; i++) px(ctx, PAL.roadGrain, ox + Math.floor(hash(tx, ty, i) * 15), oy + Math.floor(hash(tx, ty, i + 3) * 15), 2, 1);
  const open = (dx: number, dy: number) => {
    const t = world.tileAt(tx + dx, ty + dy);
    return t === Tile.Road || t === Tile.Freeway;
  };
  const S = SIDEWALK;
  const n = !open(0, -1), s = !open(0, 1), w = !open(-1, 0), e = !open(1, 0);
  if (n) px(ctx, PAL.sidewalk, ox, oy, TS, S);
  if (s) px(ctx, PAL.sidewalk, ox, oy + TS - S, TS, S);
  if (w) px(ctx, PAL.sidewalk, ox, oy, S, TS);
  if (e) px(ctx, PAL.sidewalk, ox + TS - S, oy, S, TS);
  // Inner corners: a nub of sidewalk, unless the tile there fills its own notch wedge.
  const nub = (dx: number, dy: number) => !open(dx, dy) && !NOTCHABLE.has(world.tileAt(tx + dx, ty + dy));
  if (!n && !w && nub(-1, -1)) px(ctx, PAL.sidewalk, ox, oy, S, S);
  if (!n && !e && nub(1, -1)) px(ctx, PAL.sidewalk, ox + TS - S, oy, S, S);
  if (!s && !w && nub(-1, 1)) px(ctx, PAL.sidewalk, ox, oy + TS - S, S, S);
  if (!s && !e && nub(1, 1)) px(ctx, PAL.sidewalk, ox + TS - S, oy + TS - S, S, S);
  // curb line between sidewalk and asphalt
  if (n) px(ctx, PAL.curb, ox + (w ? S : 0), oy + S, TS - (w ? S : 0) - (e ? S : 0), 1);
  if (s) px(ctx, PAL.curb, ox + (w ? S : 0), oy + TS - S - 1, TS - (w ? S : 0) - (e ? S : 0), 1);
  if (w) px(ctx, PAL.curb, ox + S, oy + (n ? S : 0), 1, TS - (n ? S : 0) - (s ? S : 0));
  if (e) px(ctx, PAL.curb, ox + TS - S - 1, oy + (n ? S : 0), 1, TS - (n ? S : 0) - (s ? S : 0));
  // outside corners: cut at 45°
  if (n && w) bevel(ctx, ox, oy, 'nw', true);
  if (n && e) bevel(ctx, ox, oy, 'ne', true);
  if (s && w) bevel(ctx, ox, oy, 'sw', true);
  if (s && e) bevel(ctx, ox, oy, 'se', true);
  // On a 45° street the edge strip doesn't run on past the slant — the road carries on
  // diagonally — so trim strip + curb beyond the cut back to asphalt.
  const trim = (corner: Corner, edge: 'h' | 'v') => {
    const cx = corner === 'nw' || corner === 'sw' ? 0 : TS - 1;
    const cy = corner === 'nw' || corner === 'ne' ? 0 : TS - 1;
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        const inStrip = edge === 'h' ? Math.abs(y - cy) <= S : Math.abs(x - cx) <= S;
        if (inStrip && Math.abs(x - cx) + Math.abs(y - cy) > BEVEL + S) px(ctx, PAL.road, ox + x, oy + y);
      }
    }
  };
  if (n && w && open(1, -1)) trim('nw', 'h');
  if (n && w && open(-1, 1)) trim('nw', 'v');
  if (n && e && open(-1, -1)) trim('ne', 'h');
  if (n && e && open(1, 1)) trim('ne', 'v');
  if (s && w && open(1, 1)) trim('sw', 'h');
  if (s && w && open(-1, -1)) trim('sw', 'v');
  if (s && e && open(-1, 1)) trim('se', 'h');
  if (s && e && open(1, -1)) trim('se', 'v');
}

function freeway(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, PAL.freeway, ox, oy, TS, TS);
  if ((tx + ty) % 3 === 0) px(ctx, PAL.freewayLine, ox + 6, oy + 7, 4, 2);
}

/** Paint one tile at (ox, oy) in a chunk canvas. */
export function drawTile(ctx: Ctx, world: World, tx: number, ty: number, ox: number, oy: number) {
  drawBase(ctx, world, tx, ty, ox, oy);
  const t = world.tileAt(tx, ty);
  if (NOTCHABLE.has(t)) notchFill(ctx, world, tx, ty, ox, oy);
}

function drawBase(ctx: Ctx, world: World, tx: number, ty: number, ox: number, oy: number) {
  const t = world.tileAt(tx, ty);
  switch (t) {
    case Tile.Water:
      return water(ctx, ox, oy, tx, ty, world);
    case Tile.Beach:
      return sand(ctx, ox, oy, tx, ty);
    case Tile.Road:
      return road(ctx, ox, oy, tx, ty, world);
    case Tile.Freeway:
      return freeway(ctx, ox, oy, tx, ty);
    case Tile.Civic:
    case Tile.Shop:
    case Tile.Block:
      return building(ctx, world, t, ox, oy, tx, ty);
    case Tile.House:
      return house(ctx, ox, oy, tx, ty);
    case Tile.Plaza:
      return plaza(ctx, ox, oy, tx, ty);
    case Tile.Landmark:
      return px(ctx, '#c8c6d4', ox, oy, TS, TS); // the landmark drawing covers it
    case Tile.Park:
      grass(ctx, ox, oy, tx, ty, true);
      if (hash(tx, ty, 11) < 0.82) tree(ctx, ox, oy, tx, ty);
      return;
    default: {
      const d = world.roadDist[tx + ty * world.w];
      const r = hash(tx, ty, 12);
      if (world.houseMode === 'procedural') {
        if (d <= 3 && r < 0.55) return house(ctx, ox, oy, tx, ty);
        if (d > 3 && r < 0.3) return house(ctx, ox, oy, tx, ty);
      }
      grass(ctx, ox, oy, tx, ty, true);
      if (r > (world.houseMode === 'procedural' ? 0.82 : 0.72)) tree(ctx, ox, oy, tx, ty);
    }
  }
}

/** Lazily rendered CHUNK×CHUNK tile canvases. */
export class ChunkCache {
  private cache = new Map<number, HTMLCanvasElement>();
  constructor(private world: World) {}

  get(cx: number, cy: number): HTMLCanvasElement {
    const key = cx * 10000 + cy;
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = CHUNK * TS;
      const ctx = c.getContext('2d')!;
      for (let y = 0; y < CHUNK; y++) {
        for (let x = 0; x < CHUNK; x++) drawTile(ctx, this.world, cx * CHUNK + x, cy * CHUNK + y, x * TS, y * TS);
      }
      // Landmarks overlapping this chunk (they can straddle chunk edges; each draws its part).
      for (const lm of this.world.landmarks) {
        if (lm.x + lm.w <= cx * CHUNK || lm.x >= (cx + 1) * CHUNK || lm.y + lm.h <= cy * CHUNK || lm.y >= (cy + 1) * CHUNK) continue;
        ctx.save();
        ctx.translate((lm.x - cx * CHUNK) * TS, (lm.y - cy * CHUNK) * TS);
        drawLandmark(ctx, lm.sprite, lm.w * TS, lm.h * TS);
        ctx.restore();
      }
      this.cache.set(key, c);
    }
    return c;
  }
}
