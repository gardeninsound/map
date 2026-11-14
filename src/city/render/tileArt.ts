import { Tile, isBuilding, type World } from '../world/world';
import { drawLandmark } from './landmarks';
import { INK, PAL } from './palette';
import {
  paintBuildings, paintParking, paintParkFeatures, prepareBuilding, prepareFeature, prepareLot,
  type PreparedBuilding, type PreparedFeature, type PreparedLot,
} from './detailArt';

export const TS = 16; // pixels per tile
export const CHUNK = 32; // tiles per chunk side
/**
 * Chunks (and the map canvas) are kept at RES× the map's pixels: everything is drawn at map
 * size and so looks just as before, but the trees and the shoreline use the extra detail —
 * their pixels are half the size of everything else's.
 */
export const RES = 2;
/** chunks kept drawn; older ones are dropped and redrawn if you come back (each is RES² bigger) */
const KEEP_CHUNKS = 40;
/** px: a park trail's half-width (the walkable corridor round it stays lawn) */
const TRAIL_R = 2;

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

/** The old tree, one map pixel per pixel (still used where nothing draws the fine one). */
function coarseTree(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
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
  [Tile.Shop]: { roof: '#8f8076', roofLight: '#a8998a', wall: '#dccbb4', trim: '#6e6058' },
  [Tile.Block]: { roof: '#d9b98a', roofLight: '#e8cfa6', wall: '#f3e6cc', trim: '#a8814e' },
  [Tile.Civic]: { roof: '#a8362a', roofLight: '#c25040', wall: '#b8322a', trim: '#7a2318' },
} as const;
const AWNINGS = ['#b8322a', '#5fa8a0', '#e0a93a', '#e8a59a', '#2f6b48', '#d98c78', '#c8892c'];

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
      for (let i = 0; i < TS; i += 4) px(ctx, i % 8 ? '#f3e6cc' : awning, ox + i, oy + 8, 4, 3);
      px(ctx, PAL.window, ox + 2, oy + 12, 12, 3);
      if (hash(tx, ty, 32) < 0.4) px(ctx, PAL.door, ox + 7, oy + 11, 3, 5);
    } else {
      px(ctx, PAL.window, ox + 2, oy + 10, 3, 3);
      px(ctx, PAL.window, ox + 11, oy + 10, 3, 3);
      if (t === Tile.Civic) px(ctx, '#f3e6cc', ox + 7, oy + 10, 2, 6);
    }
    px(ctx, INK, ox, oy + 15, TS, 1);
  }
  if (t === Tile.Shop) {
    // awnings on side walls facing the street
    for (const [dx, x] of [[-1, 0], [1, TS - 3]] as const) {
      if (!same(dx, 0) && street(dx, 0)) for (let j = 0; j < TS; j += 4) px(ctx, j % 8 ? '#f3e6cc' : awning, ox + x, oy + j, 3, 4);
    }
  }
  if (!same(0, -1)) px(ctx, INK, ox, oy, TS, 1);
  if (!same(-1, 0)) px(ctx, INK, ox, oy, 1, TS);
  if (!same(1, 0)) px(ctx, INK, ox + TS - 1, oy, 1, TS);
}

const CARS = ['#b8322a', '#5fa8a0', '#f3e6cc', '#e0a93a', '#2a1a12', '#d98c78'];
function plaza(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, '#cbbba8', ox, oy, TS, TS);
  px(ctx, '#f3e6cc', ox, oy + 1, 1, 6);
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

function freeway(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, PAL.freeway, ox, oy, TS, TS);
  if ((tx + ty) % 3 === 0) px(ctx, PAL.freewayLine, ox + 6, oy + 7, 4, 2);
}

/** Paint one tile at (ox, oy) in a chunk canvas. Road tiles get ground; the road itself is
 * painted per pixel afterwards (see paintRoads). */
export function drawTile(ctx: Ctx, world: World, tx: number, ty: number, ox: number, oy: number, trees?: { tx: number; ty: number }[]) {
  const t = world.tileAt(tx, ty);
  // with a list to fill, trees are left for the fine 2× pass (paintFineTrees); without, drawn now
  const tree = (ctx: Ctx, ox: number, oy: number, tx: number, ty: number) => (trees ? trees.push({ tx, ty }) : coarseTree(ctx, ox, oy, tx, ty));
  switch (t) {
    case Tile.Water:
      return water(ctx, ox, oy, tx, ty, world);
    case Tile.Beach:
      return sand(ctx, ox, oy, tx, ty);
    case Tile.Road:
      return grass(ctx, ox, oy, tx, ty, false);
    case Tile.Freeway:
      return freeway(ctx, ox, oy, tx, ty);
    case Tile.Civic:
    case Tile.Shop:
    case Tile.Block:
      return building(ctx, world, t, ox, oy, tx, ty);
    case Tile.House:
      // lawn under a real footprint; the house itself is painted per pixel (paintHouses)
      return grass(ctx, ox, oy, tx, ty, false);
    case Tile.Plaza:
      return plaza(ctx, ox, oy, tx, ty);
    case Tile.Landmark:
      // the drawing covers its box; where a street-facing one slides flush to its sidewalk,
      // the strip it uncovers is lawn
      return grass(ctx, ox, oy, tx, ty, false);
    case Tile.Park:
      grass(ctx, ox, oy, tx, ty, true);
      if (hash(tx, ty, 11) < 0.82) tree(ctx, ox, oy, tx, ty);
      return;
    case Tile.Parking:
    case Tile.Drawn:
      // the lot or building is painted per pixel over this (paintParking / paintBuildings)
      return grass(ctx, ox, oy, tx, ty, false);
    case Tile.Lawn:
      // a detailed park: open lawn, a tree here and there (fields are painted over it)
      grass(ctx, ox, oy, tx, ty, true);
      if (hash(tx, ty, 11) < 0.14) tree(ctx, ox, oy, tx, ty);
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

const SIDEWALK = 6; // px: ROADS.sidewalk (~2.3 m) × ROADS.widthScale, like the rest of the street
const CURB = 1; // px

/** A road segment in world pixels: R = half the full width, A = half the asphalt. */
interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
  a: number;
  /** a park trail: a thin dirt path, under any street it meets */
  trail?: boolean;
}

/**
 * Paint roads into a chunk from their centrelines, per pixel by distance to the nearest
 * segment: asphalt, a 1 px curb, then sidewalk out to the road's full width. Across all
 * roads, asphalt beats curb beats sidewalk, so crossings merge cleanly; ends and bends come
 * out round; widths are identical everywhere and diagonals are even pixel staircases.
 */
function paintRoads(ctx: Ctx, segs: Seg[], ox: number, oy: number, size: number) {
  if (!segs.length) return;
  const img = ctx.getImageData(0, 0, size, size);
  const cls = new Uint8Array(size * size);
  /** trails: 1 = the path's worn edge, 2 = its middle */
  const trail = new Uint8Array(size * size);
  for (const g of segs) {
    const x0 = Math.max(0, Math.floor(Math.min(g.ax, g.bx) - g.r - ox));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(g.ax, g.bx) + g.r - ox));
    const y0 = Math.max(0, Math.floor(Math.min(g.ay, g.by) - g.r - oy));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(g.ay, g.by) + g.r - oy));
    const dx = g.bx - g.ax, dy = g.by - g.ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    for (let y = y0; y <= y1; y++) {
      const py = oy + y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = ox + x + 0.5;
        const t = Math.max(0, Math.min(1, ((px - g.ax) * dx + (py - g.ay) * dy) / len2));
        const d = Math.hypot(px - (g.ax + t * dx), py - (g.ay + t * dy));
        if (d >= g.r) continue;
        const i = x + y * size;
        if (g.trail) {
          const c = d < g.r - 1 ? 2 : 1;
          if (c > trail[i]) trail[i] = c;
          continue;
        }
        const c = d < g.a ? 3 : d < g.a + CURB ? 2 : 1;
        if (c > cls[i]) cls[i] = c;
      }
    }
  }
  closeHoles(cls, size);
  const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const COLORS = [null, rgb(PAL.sidewalk), rgb(PAL.curb), rgb(PAL.road)];
  const GRAIN = rgb(PAL.roadGrain);
  const TRAIL = [null, rgb(PAL.trailEdge), rgb(PAL.trail)];
  for (let i = 0; i < cls.length; i++) {
    const c = cls[i];
    if (!c) {
      // a trail, where no street is
      const t = trail[i];
      if (!t) continue;
      const col = TRAIL[t]!;
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      continue;
    }
    let col = COLORS[c]!;
    if (c === 3 && hash(((ox + (i % size)) >> 1), ((oy + ((i / size) | 0)) >> 1), 5) < 0.05) col = GRAIN;
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
  }
  ctx.putImageData(img, 0, 0);
}

const HOLE = 40; // px: biggest grass hole to fill
const SCRAP = 200; // px: biggest sidewalk/curb-only island to fill (always an overlap scrap)

/**
 * Fill tiny holes in the asphalt (classes as in paintRoads: 3 = asphalt): where two roads'
 * bands run side by side and just miss each other, the gap shows as a 1-px grass line or a
 * sidewalk-coloured scrap. Any small region walled in entirely by asphalt (and not touching
 * the chunk edge) becomes asphalt — up to HOLE px if it includes ground, SCRAP px if it's
 * only sidewalk / curb.
 */
function closeHoles(cls: Uint8Array, size: number) {
  const seen = new Uint8Array(cls.length);
  const stack: number[] = [];
  const region: number[] = [];
  for (let start = 0; start < cls.length; start++) {
    if (seen[start] || cls[start] === 3) continue;
    // only bother around roads
    if (!(start % size > 0 && cls[start - 1] === 3) && !(start >= size && cls[start - size] === 3)) continue;
    stack.length = 0;
    region.length = 0;
    stack.push(start);
    seen[start] = 1;
    let open = false;
    let ground = false;
    while (stack.length) {
      const i = stack.pop()!;
      region.push(i);
      if (cls[i] === 0) ground = true;
      const x = i % size, y = (i / size) | 0;
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1 || region.length > (ground ? HOLE : SCRAP)) open = true;
      // keep flooding even once it's open: a region left half-seen would wall off its rest,
      // which then looks enclosed and gets paved in pieces
      for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, y > 0 ? i - size : -1, y < size - 1 ? i + size : -1]) {
        if (j < 0 || cls[j] === 3 || seen[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (!open) for (const i of region) cls[i] = 3;
  }
}

const WALL = 3; // px of wall showing under a house's roof (the SNES 3/4 cheat)

/** A real house footprint in world pixels (see World.houses). */
interface HouseRect {
  x: number;
  y: number;
  w: number;
  h: number;
  cos: number;
  sin: number;
  shed: boolean;
  seed: number;
  /** world-pixel bounds of everything drawn, shadow included */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rgbOf = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const mix = (c: number[], to: number[], k: number) => c.map((v, i) => Math.round(v + (to[i] - v) * k));
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const ROOFS = PAL.roofs.map(rgbOf);
const SHED_ROOF = rgbOf('#a8998a');
const HOUSE_INK = rgbOf(INK);
const HOUSE_WALL = rgbOf(PAL.wall);
const SHED_WALL = rgbOf('#dccbb4');
const HOUSE_WINDOW = rgbOf(PAL.window);
const HOUSE_DOOR = rgbOf(PAL.door);

/**
 * Paint real house footprints into a chunk at true scale, per pixel: the footprint is the
 * ground plan; the roof is that shape lifted WALL px, with walls showing below it. Gable
 * roofs ridge along the long side (light and shaded halves); walls get windows and a door.
 */
function paintHouses(ctx: Ctx, houses: HouseRect[], ox: number, oy: number, size: number) {
  if (!houses.length) return;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const put = (x: number, y: number, c: number[]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (x + y * size) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  };
  const darken = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (x + y * size) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] * 0.78);
  };
  for (const h of houses) {
    // ground-plan mask over the drawn bounds
    const mw = h.x1 - h.x0 + 1;
    const mh = h.y1 - h.y0 + 1;
    const plan = new Uint8Array(mw * mh);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const dx = h.x0 + x + 0.5 - h.x;
        const dy = h.y0 + y + 0.5 - h.y;
        const u = dx * h.cos + dy * h.sin;
        const v = -dx * h.sin + dy * h.cos;
        if (Math.abs(u) < h.w / 2 && Math.abs(v) < h.h / 2) plan[x + y * mw] = 1;
      }
    }
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < mw && y < mh && plan[x + y * mw] === 1;
    const roof = (x: number, y: number) => at(x, y + WALL);
    const body = (x: number, y: number) => {
      for (let k = 0; k <= WALL; k++) if (at(x, y + k)) return true;
      return false;
    };
    const base = h.shed ? SHED_ROOF : ROOFS[Math.floor(h.seed * ROOFS.length)];
    const shade = mix(base, BLACK, 0.22);
    const ridge = mix(base, WHITE, 0.35);
    const wall = h.shed ? SHED_WALL : HOUSE_WALL;
    const along = h.w >= h.h; // ridge runs along the long side
    const doorX = Math.round(h.x) - h.x0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const sx = h.x0 + x - ox;
        const sy = h.y0 + y - oy;
        if (sx < -1 || sy < -1 || sx > size || sy > size) continue;
        if (roof(x, y)) {
          if (!roof(x - 1, y) || !roof(x + 1, y) || !roof(x, y - 1) || !roof(x, y + 1)) put(sx, sy, HOUSE_INK);
          else {
            // which side of the ridge (in the roof's own axes)
            const dx = h.x0 + x + 0.5 - h.x;
            const dy = h.y0 + y + WALL + 0.5 - h.y;
            const side = along ? -dx * h.sin + dy * h.cos : dx * h.cos + dy * h.sin;
            put(sx, sy, Math.abs(side) < 0.75 ? ridge : side < 0 ? base : shade);
          }
        } else if (body(x, y)) {
          const edge = !body(x - 1, y) || !body(x + 1, y) || !body(x, y + 1);
          if (edge) put(sx, sy, HOUSE_INK);
          else if (!h.shed && (x === doorX || x === doorX - 1)) put(sx, sy, HOUSE_DOOR);
          else if (!h.shed && (x + Math.floor(h.seed * 4)) % 4 < 2 && Math.abs(x - doorX) > 2) put(sx, sy, HOUSE_WINDOW);
          else put(sx, sy, wall);
        } else if (body(x - 2, y - 1)) {
          darken(sx, sy); // soft shadow to the south-east
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Lazily rendered CHUNK×CHUNK tile canvases. */
type Bare = (X: number, Y: number) => boolean;
const HI = CHUNK * TS * RES; // a fine chunk's side, px
/** a colour as [r, g, b] for the fine painters */
const rgb3 = (hex: string) => rgbOf(hex) as [number, number, number];
/** write colour `c` (with opacity `a`) into fine pixel (X, Y) */
function put(d: Uint8ClampedArray, X: number, Y: number, c: [number, number, number], a = 1) {
  if (X < 0 || Y < 0 || X >= HI || Y >= HI) return;
  const i = (Y * HI + X) * 4;
  d[i] = Math.round(d[i] * (1 - a) + c[0] * a);
  d[i + 1] = Math.round(d[i + 1] * (1 - a) + c[1] * a);
  d[i + 2] = Math.round(d[i + 2] * (1 - a) + c[2] * a);
}

/**
 * A tree at RES× — 32×32 fine pixels for its 16-px tile: a lumpy round canopy lit from the
 * top left with a dark outline and flecks of light and shade, a trunk, a soft shadow. Three
 * shapes, so a wood doesn't look stamped. Built once per palette, as colour indices.
 */
type FineTree = Int8Array; // 32×32: -1 empty, 0 shadow, 1 trunk, 2 dark, 3 mid, 4 light
let fineTrees: FineTree[] | null = null;
export function buildFineTrees(): FineTree[] {
  const shapes: [number, number, number][][] = [
    [[16, 12, 9], [10, 15, 6], [22, 15, 6], [16, 7, 6]],
    [[15, 13, 9], [21, 10, 6], [10, 11, 5], [19, 17, 5]],
    [[16, 11, 8], [11, 14, 7], [21, 14, 7], [16, 17, 5]],
  ];
  return shapes.map((blobs, v) => {
    const t = new Int8Array(32 * 32).fill(-1);
    const inCanopy = (x: number, y: number) => blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 < r * r);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const i = x + y * 32;
        // the shadow on the ground, then the trunk
        if (((x - 16) / 11) ** 2 + ((y - 27) / 2.6) ** 2 < 1) t[i] = 0;
        if (x >= 14 && x <= 17 && y >= 18 && y <= 27) t[i] = 1;
        if (!inCanopy(x, y)) continue;
        const edge = !inCanopy(x - 1, y) || !inCanopy(x + 1, y) || !inCanopy(x, y - 1) || !inCanopy(x, y + 1);
        const lit = (x - 16) + (y - 12); // < 0 toward the top left
        let c = edge ? 2 : lit < -9 ? 4 : lit > 7 ? 2 : 3;
        // leaf flecks
        const f = hash(x, y, 40 + v);
        if (!edge && f < 0.08) c = 4;
        else if (!edge && f > 0.93) c = 2;
        t[i] = c;
      }
    }
    return t;
  });
}

/** The fine trees for one chunk, each where its tile is (jittered as before), only over bare ground. */
function paintFineTrees(d: Uint8ClampedArray, trees: { tx: number; ty: number }[], cx: number, cy: number, bare: Bare) {
  if (!trees.length) return;
  const sprites = (fineTrees ??= buildFineTrees());
  const colors = [rgb3('#000000'), rgb3(PAL.trunk), rgb3(PAL.treeDark), rgb3(PAL.tree), rgb3(PAL.treeLight)];
  for (const { tx, ty } of trees) {
    const t = sprites[Math.floor(hash(tx, ty, 21) * sprites.length)]!;
    const jx = Math.floor(hash(tx, ty, 7) * 3) - 1;
    const jy = Math.floor(hash(tx, ty, 8) * 3) - 1;
    const X0 = ((tx - cx * CHUNK) * TS + jx) * RES;
    const Y0 = ((ty - cy * CHUNK) * TS + jy) * RES;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const c = t[x + y * 32]!;
        if (c < 0) continue;
        const X = X0 + x, Y = Y0 + y;
        if (X < 0 || Y < 0 || X >= HI || Y >= HI || !bare(X, Y)) continue;
        put(d, X, Y, colors[c]!, c === 0 ? 0.18 : 1);
      }
    }
  }
}

/**
 * The beach's inland edge at the fine pixels, the same way as the waterline: where sand meets
 * lawn, each fine pixel blends the four nearest tiles (sand and water count as beach) and is
 * sand past halfway — so the beach curves instead of stepping. Only over bare ground.
 */
function paintFineBeach(d: Uint8ClampedArray, world: World, cx: number, cy: number, bare: Bare) {
  const kind = (tx: number, ty: number) => world.tileAt(tx, ty);
  const sandy = (tx: number, ty: number) => {
    const t = kind(tx, ty);
    return t === Tile.Beach || t === Tile.Water ? 1 : 0;
  };
  const F = TS * RES;
  const SAND = rgb3(PAL.sand), SAND_DARK = rgb3(PAL.sandDark), GRASS = rgb3(PAL.grass), GRASS_DARK = rgb3(PAL.grassDark);
  for (let j = 0; j < CHUNK; j++) {
    for (let i = 0; i < CHUNK; i++) {
      const tx = cx * CHUNK + i, ty = cy * CHUNK + j;
      const t = kind(tx, ty);
      if (t === Tile.Water) continue;
      const isBeach = t === Tile.Beach;
      // only where a beach meets lawn: the beach tile, or a land tile beside one
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const n = kind(tx + dx, ty + dy);
          if (n !== Tile.Water && (n === Tile.Beach) !== isBeach) { edge = true; break; }
        }
      }
      if (!edge) continue;
      for (let y = 0; y < F; y++) {
        for (let x = 0; x < F; x++) {
          const X = i * F + x, Y = j * F + y;
          if (!bare(X, Y)) continue;
          const fx = tx + (x + 0.5) / F - 0.5, fy = ty + (y + 0.5) / F - 0.5;
          const ix = Math.floor(fx), iy = Math.floor(fy), kx = fx - ix, ky = fy - iy;
          const v = (sandy(ix, iy) * (1 - kx) + sandy(ix + 1, iy) * kx) * (1 - ky) + (sandy(ix, iy + 1) * (1 - kx) + sandy(ix + 1, iy + 1) * kx) * ky;
          const sandHere = v > 0.5;
          if (sandHere === isBeach) continue;
          const h = hash(cx * 4096 + X, cy * 4096 + Y, 33);
          put(d, X, Y, sandHere ? (h < 0.05 ? SAND_DARK : SAND) : h < 0.06 ? GRASS_DARK : GRASS);
        }
      }
    }
  }
}

/**
 * The shoreline at the fine pixels: around every tile where land meets water, each fine pixel
 * asks how wet it is by blending the water/land of the four nearest tile centres, and is water
 * past halfway — so the shore runs in slopes and curves instead of whole-tile steps. Shore water
 * is repainted clean: foam right at the land, a lighter wash, then open water; land that was
 * water becomes sand (or lawn, away from a beach) with fine specks. Only over bare ground, so
 * piers, roads and drawings stay on top.
 */
function paintFineShore(d: Uint8ClampedArray, world: World, cx: number, cy: number, bare: Bare) {
  const wet = (tx: number, ty: number) => (world.tileAt(tx, ty) === Tile.Water ? 1 : 0);
  /** how wet the point (in tiles) is, blended between the four nearest tile centres */
  const wetness = (x: number, y: number) => {
    const fx = x - 0.5, fy = y - 0.5;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const kx = fx - ix, ky = fy - iy;
    const top = wet(ix, iy) * (1 - kx) + wet(ix + 1, iy) * kx;
    const bottom = wet(ix, iy + 1) * (1 - kx) + wet(ix + 1, iy + 1) * kx;
    return top * (1 - ky) + bottom * ky;
  };
  const F = TS * RES; // fine px per tile
  const fineWet = (X: number, Y: number) => wetness(cx * CHUNK + (X + 0.5) / F, cy * CHUNK + (Y + 0.5) / F) > 0.5;
  const WATER = rgb3(PAL.water), LIGHT = rgb3(PAL.waterLight), FOAM = rgb3(PAL.foam), DEEP = rgb3(PAL.waterDeep);
  const SAND = rgb3(PAL.sand), SAND_DARK = rgb3(PAL.sandDark), GRASS = rgb3(PAL.grass), GRASS_DARK = rgb3(PAL.grassDark);
  for (let j = 0; j < CHUNK; j++) {
    for (let i = 0; i < CHUNK; i++) {
      const tx = cx * CHUNK + i, ty = cy * CHUNK + j;
      const here = wet(tx, ty);
      // only tiles on the shore: their 8 neighbours aren't all like them
      let shore = false;
      for (let dy = -1; dy <= 1 && !shore; dy++) for (let dx = -1; dx <= 1; dx++) if (wet(tx + dx, ty + dy) !== here) { shore = true; break; }
      if (!shore) continue;
      // land that turns out wet or dry here: a beach's sand, else lawn
      const beach = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => world.tileAt(tx + dx!, ty + dy!) === Tile.Beach);
      const [landFill, landSpeck] = beach || here ? [SAND, SAND_DARK] : [GRASS, GRASS_DARK];
      for (let y = 0; y < F; y++) {
        for (let x = 0; x < F; x++) {
          const X = i * F + x, Y = j * F + y;
          if (!bare(X, Y)) continue;
          const w = fineWet(X, Y);
          if (!w) {
            // dry: leave a land tile's own ground alone; dry ground in a water tile is sand or lawn
            if (here) put(d, X, Y, hash(cx * 4096 + X, cy * 4096 + Y, 31) < 0.05 ? landSpeck : landFill);
            continue;
          }
          // wet: how close is the land (fine px, up to 3)?
          let near = 9;
          for (let r = 1; r <= 3 && near === 9; r++) {
            if (!fineWet(X - r, Y) || !fineWet(X + r, Y) || !fineWet(X, Y - r) || !fineWet(X, Y + r)) near = r;
          }
          const h = hash(cx * 4096 + X, cy * 4096 + Y, 32);
          put(d, X, Y, near <= 2 ? FOAM : near === 3 ? LIGHT : h < 0.01 ? DEEP : WATER);
        }
      }
    }
  }
}

export class ChunkCache {
  private cache = new Map<number, HTMLCanvasElement>();
  private segs = new Map<number, Seg[]>();
  private houses = new Map<number, HouseRect[]>();
  private parks = new Map<number, PreparedFeature[]>();
  private lots = new Map<number, PreparedLot[]>();
  private drawn = new Map<number, PreparedBuilding[]>();

  constructor(private world: World) {
    // Bucket house footprints by the chunks their drawing touches.
    const span = CHUNK * TS;
    const hs = world.houses;
    for (let i = 0; i < hs.length; i += 6) {
      const [x, y, w, h, deg, shed] = hs.slice(i, i + 6);
      const a = (deg * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const ex = (w * Math.abs(cos) + h * Math.abs(sin)) / 2;
      const ey = (w * Math.abs(sin) + h * Math.abs(cos)) / 2;
      const r: HouseRect = {
        x, y, w, h, cos, sin,
        shed: shed === 1,
        seed: hash(x, y, 9),
        x0: Math.floor(x - ex) - 1,
        y0: Math.floor(y - ey) - WALL - 1,
        x1: Math.ceil(x + ex) + 2,
        y1: Math.ceil(y + ey) + 1,
      };
      for (let cy = Math.floor(r.y0 / span); cy <= Math.floor(r.y1 / span); cy++) {
        for (let cx = Math.floor(r.x0 / span); cx <= Math.floor(r.x1 / span); cx++) {
          const key = cx * 10000 + cy;
          if (!this.houses.has(key)) this.houses.set(key, []);
          this.houses.get(key)!.push(r);
        }
      }
    }
    // Parking lots and exact-outline buildings in detailed places, likewise.
    const bucket = <T extends { x0: number; y0: number; x1: number; y1: number }>(map: Map<number, T[]>, item: T) => {
      for (let cy = Math.floor(item.y0 / span); cy <= Math.floor(item.y1 / span); cy++) {
        for (let cx = Math.floor(item.x0 / span); cx <= Math.floor(item.x1 / span); cx++) {
          const key = cx * 10000 + cy;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(item);
        }
      }
    };
    for (const lot of world.parkingLots) bucket(this.lots, prepareLot(lot.rings, world.parkingAisles, TS));
    for (const b of world.drawnBuildings) bucket(this.drawn, prepareBuilding(b, TS));
    // Bucket park features (pitches, courts, the track…) the same way.
    for (const f of world.parkFeatures) {
      const p = prepareFeature(f, TS);
      for (let cy = Math.floor(p.y0 / span); cy <= Math.floor(p.y1 / span); cy++) {
        for (let cx = Math.floor(p.x0 / span); cx <= Math.floor(p.x1 / span); cx++) {
          const key = cx * 10000 + cy;
          if (!this.parks.has(key)) this.parks.set(key, []);
          this.parks.get(key)!.push(p);
        }
      }
    }
    // Bucket road segments by the chunks they touch.
    for (const line of world.roadLines) {
      const r = (line.w * TS) / 2;
      for (let i = 1; i < line.p.length; i++) {
        const g: Seg = {
          ax: line.p[i - 1][0] * TS,
          ay: line.p[i - 1][1] * TS,
          bx: line.p[i][0] * TS,
          by: line.p[i][1] * TS,
          // a park trail is a thin dirt path down the middle of its walkable corridor
          r: line.k ? TRAIL_R : r,
          a: line.k ? -1 : r - SIDEWALK,
          trail: !!line.k,
        };
        for (let cy = Math.floor((Math.min(g.ay, g.by) - r) / span); cy <= Math.floor((Math.max(g.ay, g.by) + r) / span); cy++) {
          for (let cx = Math.floor((Math.min(g.ax, g.bx) - r) / span); cx <= Math.floor((Math.max(g.ax, g.bx) + r) / span); cx++) {
            const key = cx * 10000 + cy;
            if (!this.segs.has(key)) this.segs.set(key, []);
            this.segs.get(key)!.push(g);
          }
        }
      }
    }
  }

  private gaps = new Map<string, number>();

  /**
   * Pixels between a street-facing landmark's box edge and the outer edge of the drawn
   * sidewalk it faces (negative: the sidewalk reaches into the box). Measured row by row
   * against the real road geometry; the median ignores cross streets at the corners.
   */
  private streetGap(lm: World['landmarks'][number]): number {
    if (!lm.street) return 0;
    let gap = this.gaps.get(lm.id);
    if (gap !== undefined) return gap;
    const dir = lm.street === 'E' ? 1 : -1;
    const edge = (lm.street === 'E' ? lm.x + lm.w : lm.x) * TS;
    const near = this.world.roadLines.filter((l) =>
      l.p.some(([x, y]) => Math.abs(x - (lm.x + lm.w / 2)) < lm.w + 6 && y > lm.y - 6 && y < lm.y + lm.h + 6),
    );
    const onRoad = (px: number, py: number) =>
      near.some((l) => {
        const r = (l.w * TS) / 2;
        for (let i = 1; i < l.p.length; i++) {
          const ax = l.p[i - 1][0] * TS, ay = l.p[i - 1][1] * TS;
          const dx = l.p[i][0] * TS - ax, dy = l.p[i][1] * TS - ay;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
          if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < r) return true;
        }
        return false;
      });
    const rows: number[] = [];
    for (let py = lm.y * TS + 2; py < (lm.y + lm.h) * TS - 2; py += 4) {
      for (let k = -TS; k <= TS; k++) {
        // first pixel (going from the building toward the street) that's road
        const px = edge + dir * k + (dir > 0 ? 0.5 : -0.5);
        if (onRoad(px, py + 0.5)) {
          rows.push(k);
          break;
        }
      }
    }
    rows.sort((a, b) => a - b);
    gap = rows.length ? rows[rows.length >> 1] : 0;
    this.gaps.set(lm.id, gap);
    return gap;
  }

  /**
   * A chunk at RES× (what the map draws): the 1× chunk scaled up, then the trees and the
   * shoreline drawn finer on top — only where nothing (a road, a house, a field, a dock)
   * was painted over the ground. The most recent KEEP_CHUNKS are kept.
   */
  get(cx: number, cy: number): HTMLCanvasElement {
    const key = cx * 10000 + cy;
    const hit = this.cache.get(key);
    if (hit) {
      // most recently used goes to the back of the line
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }
    const size = CHUNK * TS;
    const { canvas: base, trees, ground } = this.build(cx, cy);
    const fin = base.getContext('2d')!.getImageData(0, 0, size, size).data;
    const c = document.createElement('canvas');
    c.width = c.height = size * RES;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, size * RES, size * RES);
    const hi = ctx.getImageData(0, 0, size * RES, size * RES);
    /** is the 1× pixel under hi pixel (X, Y) still bare ground (nothing painted over it)? */
    const bare = (X: number, Y: number) => {
      const i = ((Y >> 1) * size + (X >> 1)) * 4;
      return fin[i] === ground[i] && fin[i + 1] === ground[i + 1] && fin[i + 2] === ground[i + 2];
    };
    paintFineBeach(hi.data, this.world, cx, cy, bare);
    paintFineShore(hi.data, this.world, cx, cy, bare);
    paintFineTrees(hi.data, trees, cx, cy, bare);
    ctx.putImageData(hi, 0, 0);
    this.cache.set(key, c);
    if (this.cache.size > KEEP_CHUNKS) this.cache.delete(this.cache.keys().next().value!);
    return c;
  }

  /** A chunk at the map's own 1× pixels, trees left out (as the road audit reads it). */
  base(cx: number, cy: number): HTMLCanvasElement {
    return this.build(cx, cy).canvas;
  }

  private build(cx: number, cy: number): { canvas: HTMLCanvasElement; trees: { tx: number; ty: number }[]; ground: Uint8ClampedArray } {
    const key = cx * 10000 + cy;
    const trees: { tx: number; ty: number }[] = [];
    let ground: Uint8ClampedArray;
    {
      const c = document.createElement('canvas');
      c.width = c.height = CHUNK * TS;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      // 1. ground and everything flat (the trees are noted, for the fine pass)
      for (let y = 0; y < CHUNK; y++) {
        for (let x = 0; x < CHUNK; x++) drawTile(ctx, this.world, cx * CHUNK + x, cy * CHUNK + y, x * TS, y * TS, trees);
      }
      // the bare ground, before anything is painted over it
      ground = ctx.getImageData(0, 0, CHUNK * TS, CHUNK * TS).data;
      // 1b. park features: fields, courts, the track, playgrounds, the pool
      paintParkFeatures(ctx, this.parks.get(key) ?? [], cx * CHUNK * TS, cy * CHUNK * TS, CHUNK * TS, (x, y) => hash(x, y, 13));
      // 1c. parking lots: asphalt, stalls along the aisles, parked cars
      paintParking(ctx, this.lots.get(key) ?? [], cx * CHUNK * TS, cy * CHUNK * TS, CHUNK * TS, (x, y) => hash(x, y, 14));
      // 2. roads, per pixel, at their true width: where a building's tile pokes past the
      // street's real edge, the sidewalk wins
      paintRoads(ctx, this.segs.get(key) ?? [], cx * CHUNK * TS, cy * CHUNK * TS, CHUNK * TS);
      // 3. houses at their real footprints, then big buildings drawn from their exact outlines
      paintHouses(ctx, this.houses.get(key) ?? [], cx * CHUNK * TS, cy * CHUNK * TS, CHUNK * TS);
      paintBuildings(ctx, this.drawn.get(key) ?? [], cx * CHUNK * TS, cy * CHUNK * TS, CHUNK * TS, (x, y) => hash(x, y, 15));
      // Landmarks overlapping this chunk (they can straddle chunk edges; each draws its part).
      // A landmark facing a street is pulled flush with its real sidewalk (it may reach up to
      // a tile past its box, hence the margin): a block face stretches or trims to meet it,
      // any other drawing slides over.
      for (const lm of this.world.landmarks) {
        if (lm.x + lm.w + 1 <= cx * CHUNK || lm.x - 1 >= (cx + 1) * CHUNK || lm.y + lm.h <= cy * CHUNK || lm.y >= (cy + 1) * CHUNK) continue;
        const s = this.streetGap(lm);
        const toward = lm.street === 'E' ? 1 : lm.street === 'W' ? -1 : 0;
        ctx.save();
        ctx.translate((lm.x - cx * CHUNK) * TS, (lm.y - cy * CHUNK) * TS);
        if (lm.sprite === 'storefronts') {
          if (toward < 0) ctx.translate(-s, 0);
          drawLandmark(ctx, lm.sprite, lm.w * TS + s, lm.h * TS, lm.id);
        } else {
          ctx.translate(toward * s, 0);
          drawLandmark(ctx, lm.sprite, lm.w * TS, lm.h * TS, lm.id);
        }
        ctx.restore();
      }
      return { canvas: c, trees, ground };
    }
  }
}
