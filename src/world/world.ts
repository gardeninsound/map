import data from './worldData.json';

/** Tile codes written by scripts/build-map.mjs — keep in sync. */
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
} as const;
export const isBuilding = (t: number) => t === Tile.Civic || t === Tile.Shop || t === Tile.Block || t === Tile.House;
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

/** A hand-drawn building placed on the grid (see src/game/render/landmarks.ts). */
export interface PlacedLandmark {
  id: string;
  sprite: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface World {
  w: number;
  h: number;
  tileMeters: number;
  tiles: Uint8Array;
  /** per tile: 0 = no street, else 1 + index into `names` */
  roads: Uint8Array;
  names: string[];
  labels: MapLabel[];
  shops: Storefront[];
  landmarks: PlacedLandmark[];
  /** 'footprints' = houses from OSM; 'procedural' = renderer scatters them */
  houseMode: 'footprints' | 'procedural';
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
  const roads = decode(data.roads);
  const roadDist = distanceField(w, h, (i) => tiles[i] === Tile.Road);

  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const tileAt = (x: number, y: number): TileCode =>
    inside(x, y) ? (tiles[x + y * w] as TileCode) : Tile.Water;
  const isWalkable = (x: number, y: number) => tileAt(Math.floor(x), Math.floor(y)) === Tile.Road;
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
    landmarks: data.landmarks ?? [],
    houseMode: data.houseMode as World['houseMode'],
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
            if (tileAt(cx + dx, cy + dy) !== Tile.Road) continue;
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
