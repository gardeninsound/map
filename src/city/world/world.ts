import data from './worldData.json';

/** Tile codes written by scripts/city/build-map.mjs — keep in sync. */
export const Tile = {
  Water: 0,
  Land: 1,
  Park: 2,
  Beach: 3,
  Road: 4,
  Freeway: 5,
  /** schools, churches, libraries */
  Civic: 6,
  /** commercial / retail ground */
  Plaza: 7,
  /** commercial building */
  Shop: 8,
  /** apartments & other big buildings */
  Block: 9,
  /** a real house footprint */
  House: 10,
  /** ground under a hand-drawn landmark */
  Landmark: 11,
  /** open lawn in a detailed park: scattered trees, painted pitches and courts */
  Lawn: 12,
  /** a surface parking lot in a detailed place: walkable, painted with stalls */
  Parking: 13,
  /** ground under a building painted from its exact outline (detailed places) */
  Drawn: 14,
} as const;
export const isBuilding = (t: number) => t === Tile.Civic || t === Tile.Shop || t === Tile.Block || t === Tile.House || t === Tile.Drawn;
/** streets, park paths and parking lots: where you (and the neighbours) can walk */
export const isWalkableTile = (t: number) => t === Tile.Road || t === Tile.Parking;
export type TileCode = (typeof Tile)[keyof typeof Tile];

export interface MapLabel {
  name: string;
  kind: 'park' | 'school' | 'hood';
  x: number;
  y: number;
  size: number;
}

export interface Storefront {
  name: string;
  kind: string;
  x: number;
  y: number;
}

/** A hand-drawn building placed on the grid (see src/city/render/landmarks.ts). */
export interface PlacedLandmark {
  id: string;
  sprite: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** the side its frontage faces; it's drawn flush with that street's sidewalk */
  street?: 'E' | 'W';
}

/** A road's centreline (tile coords) and width in tiles, for per-pixel road painting. */
export interface RoadLine {
  w: number;
  /** 1 = a park footpath: concrete only, no kerb or asphalt */
  k?: 1;
  p: [number, number][];
}

/** A building in a detailed place, painted from its exact outline (tile coords). */
export interface DrawnBuilding {
  k: 'civic' | 'block' | 'shop';
  levels: number;
  /** the first `n` rings are outer, the rest are courtyards */
  rings: [number, number][][];
  n: number;
}

/** A pitch, track, playground, pool or bleachers in a detailed park (tile coords). */
export interface ParkFeature {
  /** OSM leisure=* */
  k: 'pitch' | 'track' | 'playground' | 'swimming_pool' | 'bleachers';
  /** OSM sport=* (pitches and tracks) */
  s: string;
  /** the first `n` rings are outer, the rest are holes */
  rings: [number, number][][];
  n: number;
}

export interface World {
  w: number;
  h: number;
  tileMeters: number;
  tiles: Uint8Array;
  /** per tile: 0 = no street, else 1 + index into `names` */
  roads: Uint16Array;
  names: string[];
  labels: MapLabel[];
  shops: Storefront[];
  landmarks: PlacedLandmark[];
  roadLines: RoadLine[];
  /** 'footprints' = houses from OSM; 'procedural' = renderer scatters them */
  houseMode: 'footprints' | 'procedural';
  /**
   * Real house footprints, six numbers each (world pixels, 16 per tile): centre x, centre y,
   * width, depth (along the house's own axes), angle in degrees, 1 = garage/shed.
   */
  houses: number[];
  parkFeatures: ParkFeature[];
  drawnBuildings: DrawnBuilding[];
  parkingLots: { rings: [number, number][][]; n: number }[];
  parkingAisles: [number, number][][];
  /** per tile: steps to the nearest road (capped at 255) */
  roadDist: Uint8Array;
  attribution: string;
  tileAt(x: number, y: number): TileCode;
  isWalkable(x: number, y: number): boolean;
  streetAt(x: number, y: number): string | null;
  /** lat/lon → fractional tile coordinates */
  project(lat: number, lon: number): { x: number; y: number };
  /** nearest walkable tile center to (x, y), searching outward */
  nearestWalkable(x: number, y: number): { x: number; y: number };
}

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Where a marker (a sign, a lemon) stands beside the nearest street: never on the street
 * itself (it would block it) and always within reach of it. In order of preference: open
 * ground at the kerb; open ground a tile further in (still reachable from the sidewalk); a
 * house's corner at the kerb, rather than wandering deep into the block; and as a last resort
 * anything at the kerb that isn't water. Buildings, parking lots and landmark drawings
 * otherwise stay clear.
 */
export function markerSpot(world: World, p: { x: number; y: number }): { x: number; y: number } {
  const r = world.nearestWalkable(p.x, p.y);
  const tx = Math.floor(r.x);
  const ty = Math.floor(r.y);
  const open = (t: number) => !isWalkableTile(t) && !isBuilding(t) && t !== Tile.Water && t !== Tile.Landmark;
  const passes: [number, (t: number) => boolean][] = [
    [1, open],
    [2, open],
    [1, (t) => t === Tile.House],
    [1, (t) => !isWalkableTile(t) && t !== Tile.Water],
  ];
  for (const [d, ok] of passes) {
    for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      if (ok(world.tileAt(tx + dx, ty + dy))) return { x: tx + dx + 0.5, y: ty + dy + 0.5 };
    }
  }
  return r;
}

/** Breadth-first distance from every tile to the nearest road tile. */
export function distanceField(w: number, h: number, isSource: (i: number) => boolean): Uint8Array {
  const dist = new Uint8Array(w * h).fill(255);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < w * h; i++) {
    if (isSource(i)) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const d = dist[i] + 1;
    if (d >= 255) continue;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of next) {
      if (j < 0 || j >= w * h || dist[j] <= d) continue;
      dist[j] = d;
      queue[tail++] = j;
    }
  }
  return dist;
}

/** Hand-placed neighborhood names (lat, lon) — the OSM labels only cover parks/schools. */
const HOODS: [string, number, number][] = [
  ['Alki', 47.5795, -122.405],
  ['Admiral', 47.5845, -122.3825],
  ['The Junction', 47.5585, -122.3825],
  ['Morgan Junction', 47.5435, -122.3815],
  ['Fauntleroy', 47.5235, -122.39],
  ['Delridge', 47.553, -122.3595],
  ['Genesee', 47.5645, -122.3755],
  ['Gatewood', 47.5365, -122.3935],
  ['Seaview', 47.5535, -122.4025],
];

export function createWorld(): World {
  const { w, h, names, projection: proj } = data;
  const tiles = decode(data.tiles);
  const raw = decode(data.roads); // little-endian uint16 per tile (hundreds of street names)
  const roads = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const roadDist = distanceField(w, h, (i) => tiles[i] === Tile.Road);

  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const tileAt = (x: number, y: number): TileCode =>
    inside(x, y) ? (tiles[x + y * w] as TileCode) : Tile.Water;
  const isWalkable = (x: number, y: number) => isWalkableTile(tileAt(Math.floor(x), Math.floor(y)));
  const project = (lat: number, lon: number) => ({
    x: ((lon - proj.west) * proj.mPerLon) / data.tileMeters,
    y: ((proj.north - lat) * proj.mPerLat) / data.tileMeters,
  });

  const labels: MapLabel[] = [
    ...(data.labels as MapLabel[]),
    ...HOODS.map(([name, lat, lon]) => ({ name, kind: 'hood' as const, ...project(lat, lon), size: 999 })),
  ];

  return {
    w,
    h,
    tileMeters: data.tileMeters,
    tiles,
    roads,
    names,
    labels,
    shops: data.shops,
    landmarks: (data.landmarks ?? []) as PlacedLandmark[],
    roadLines: (data.roadLines ?? []) as RoadLine[],
    houseMode: data.houseMode as World['houseMode'],
    houses: ((data as { houses?: number[] }).houses ?? []) as number[],
    parkFeatures: ((data as { parkFeatures?: unknown }).parkFeatures ?? []) as ParkFeature[],
    drawnBuildings: ((data as { drawnBuildings?: unknown }).drawnBuildings ?? []) as DrawnBuilding[],
    parkingLots: ((data as { parkingLots?: unknown }).parkingLots ?? []) as World['parkingLots'],
    parkingAisles: ((data as { parkingAisles?: unknown }).parkingAisles ?? []) as [number, number][][],
    roadDist,
    attribution: data.attribution,
    tileAt,
    isWalkable,
    project,
    streetAt(x, y) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (!inside(tx, ty)) return null;
      const n = roads[tx + ty * w];
      if (n) return names[n - 1];
      // Unnamed connector: borrow the nearest named neighbor.
      for (let r = 1; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (!inside(tx + dx, ty + dy)) continue;
            const m = roads[tx + dx + (ty + dy) * w];
            if (m) return names[m - 1];
          }
        }
      }
      return null;
    },
    nearestWalkable(x, y) {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      for (let r = 0; r < 40; r++) {
        let best: { x: number; y: number } | null = null;
        let bestD = Infinity;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (!isWalkableTile(tileAt(cx + dx, cy + dy))) continue;
            const d = Math.hypot(cx + dx + 0.5 - x, cy + dy + 0.5 - y);
            if (d < bestD) {
              bestD = d;
              best = { x: cx + dx + 0.5, y: cy + dy + 0.5 };
            }
          }
        }
        if (best) return best;
      }
      return { x, y };
    },
  };
}
