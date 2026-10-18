/**
 * Rasterizes data/osm/west-seattle.json (from fetch-osm.mjs) into the game's tile grid:
 * src/world/worldData.json. Also writes screenshots/map-preview.png for eyeballing.
 *
 * Tiles (see Tile in src/world/world.ts): water, land, park, beach, road (walkable), freeway,
 * plus buildings from OSM footprints (house / shop / block / civic) and commercial ground.
 * Roads keep a per-tile street-name index so the HUD can say where you are.
 *
 * Usage: node scripts/build-map.mjs [--procedural]
 *   --procedural  ignore house footprints and let the renderer scatter houses instead (the old look)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url);
const PROCEDURAL = process.argv.includes('--procedural');
const osm = JSON.parse(readFileSync(new URL('data/osm/west-seattle.json', ROOT)));

// Map extent (a little tighter than the fetch bbox, trimming industrial east side).
const [S, W, N, E] = [47.516, -122.422, 47.597, -122.35];
const TILE_M = 12; // ≈ one house lot per tile
const MID = ((S + N) / 2) * (Math.PI / 180);
const M_PER_LON = 111320 * Math.cos(MID);
const M_PER_LAT = 110540;
const GW = Math.round(((E - W) * M_PER_LON) / TILE_M);
const GH = Math.round(((N - S) * M_PER_LAT) / TILE_M);
const toX = (lon) => ((lon - W) * M_PER_LON) / TILE_M;
const toY = (lat) => ((N - lat) * M_PER_LAT) / TILE_M;

const T = {
  WATER: 0, LAND: 1, PARK: 2, BEACH: 3, ROAD: 4, FREEWAY: 5,
  CIVIC: 6, // schools, churches, libraries (brick)
  PLAZA: 7, // commercial / retail / industrial ground
  SHOP: 8, // commercial building
  BLOCK: 9, // apartments and other big buildings
  HOUSE: 10, // a real house footprint
};
const tiles = new Uint8Array(GW * GH).fill(T.LAND);
const road = new Uint8Array(GW * GH); // 0 = none, else 1 + names index
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;

const pts = (geom) => geom.map((p) => [toX(p.lon), toY(p.lat)]);

function strokeLine(points, radius, fn) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4));
    for (let s = 0; s <= steps; s++) {
      const cx = x0 + ((x1 - x0) * s) / steps;
      const cy = y0 + ((y1 - y0) * s) / steps;
      const r = Math.ceil(radius);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = Math.floor(cx) + dx;
          const ty = Math.floor(cy) + dy;
          if (!inGrid(tx, ty)) continue;
          if (Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) <= radius) fn(tx, ty);
        }
      }
    }
  }
}

/** Even-odd scanline fill of a set of rings (outer + holes). */
function fillRings(rings, fn) {
  let minY = Infinity, maxY = -Infinity;
  for (const r of rings) for (const [, y] of r) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let ty = Math.max(0, Math.floor(minY)); ty <= Math.min(GH - 1, Math.ceil(maxY)); ty++) {
    const sy = ty + 0.5;
    const xs = [];
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if ((yi > sy) !== (yj > sy)) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let tx = Math.max(0, Math.ceil(xs[k] - 0.5)); tx <= Math.min(GW - 1, Math.floor(xs[k + 1] - 0.5)); tx++) fn(tx, ty);
    }
  }
}

/** Join a relation's member ways into closed rings by matching endpoints. */
function assembleRings(members) {
  const segs = members.filter((m) => m.geometry?.length).map((m) => pts(m.geometry));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let grew = true;
    while (grew && !closed(ring)) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const end = ring[ring.length - 1];
        if (near(end, s[0])) ring = ring.concat(s.slice(1));
        else if (near(end, s[s.length - 1])) ring = ring.concat(s.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1);
        grew = true;
        break;
      }
    }
    rings.push(ring);
  }
  return rings;
}
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
const closed = (r) => r.length > 2 && near(r[0], r[r.length - 1]);

function areaRings(el) {
  if (el.type === 'way') return [pts(el.geometry)];
  return assembleRings(el.members.filter((m) => m.type === 'way'));
}

const els = osm.elements;
const tagged = (pred) => els.filter((e) => e.tags && pred(e.tags));

// 1. Water: rasterize coastline as a barrier, flood-fill the sea from known open-water seeds.
const BARRIER = 255;
for (const w of tagged((t) => t.natural === 'coastline')) {
  strokeLine(pts(w.geometry), 0.75, (x, y) => { tiles[x + y * GW] = BARRIER; });
}
const seeds = [[-122.421, 47.55], [-122.421, 47.52], [-122.395, 47.596], [-122.37, 47.596]];
const stack = seeds.map(([lon, lat]) => [Math.floor(toX(lon)), Math.floor(toY(lat))]);
while (stack.length) {
  const [x, y] = stack.pop();
  if (!inGrid(x, y)) continue;
  const i = x + y * GW;
  if (tiles[i] !== T.LAND) continue;
  tiles[i] = T.WATER;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
for (let i = 0; i < tiles.length; i++) if (tiles[i] === BARRIER) tiles[i] = T.BEACH;
// Lakes, ponds, the Duwamish.
for (const el of tagged((t) => t.natural === 'water')) fillRings(areaRings(el), (x, y) => { tiles[x + y * GW] = T.WATER; });

// 2. Green space, beaches, schools (only over land).
const paint = (type) => (x, y) => { if (tiles[x + y * GW] !== T.WATER) tiles[x + y * GW] = type; };
for (const el of tagged((t) => ['park', 'golf_course', 'nature_reserve'].includes(t.leisure) || t.natural === 'wood')) {
  fillRings(areaRings(el), paint(T.PARK));
}
for (const el of tagged((t) => t.natural === 'beach')) fillRings(areaRings(el), paint(T.BEACH));
for (const el of tagged((t) => ['commercial', 'retail', 'industrial'].includes(t.landuse))) {
  fillRings(areaRings(el), (x, y) => { if (tiles[x + y * GW] === T.LAND) tiles[x + y * GW] = T.PLAZA; });
}

// 2b. Buildings from footprints. Classify each, then paint.
const shopNodes = els.filter((e) => e.type === 'node' && e.tags?.name && (e.tags.shop || e.tags.amenity));
const bid = new Int32Array(GW * GH).fill(-1);
const buildings = tagged((t) => t.building && t.building !== 'roof').filter((e) => e.type === 'way' && e.geometry);
const shoelace = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
buildings.forEach((b, i) => fillRings([pts(b.geometry)], (x, y) => { if (tiles[x + y * GW] !== T.WATER) bid[x + y * GW] = i; }));
const hasShop = new Set();
for (const n of shopNodes) {
  const x = Math.floor(toX(n.lon)), y = Math.floor(toY(n.lat));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (inGrid(x + dx, y + dy) && bid[x + dx + (y + dy) * GW] >= 0) hasShop.add(bid[x + dx + (y + dy) * GW]);
  }
}
const HOUSE_TAGS = new Set(['house', 'detached', 'semidetached_house', 'terrace', 'residential', 'bungalow']);
const kinds = buildings.map((b, i) => {
  const t = b.tags;
  const area = shoelace(pts(b.geometry)) * TILE_M * TILE_M;
  if (HOUSE_TAGS.has(t.building) && area < 600 && t.building !== 'residential') return T.HOUSE;
  if (['church', 'school', 'college', 'kindergarten', 'civic', 'public', 'chapel'].includes(t.building) || t.amenity) return T.CIVIC;
  if (['retail', 'commercial', 'supermarket', 'office', 'industrial', 'warehouse', 'service'].includes(t.building) || hasShop.has(i)) return T.SHOP;
  if (t.building === 'apartments') return T.BLOCK;
  if (area < 380) return T.HOUSE;
  const r = pts(b.geometry);
  const cx = Math.floor(r.reduce((a, p) => a + p[0], 0) / r.length);
  const cy = Math.floor(r.reduce((a, p) => a + p[1], 0) / r.length);
  return inGrid(cx, cy) && tiles[cx + cy * GW] === T.PLAZA ? T.SHOP : T.BLOCK;
});
// Big buildings fill their footprint. Houses get one tile at their centroid — at 12 m a
// tile is about a lot, so this keeps one house per real house instead of merged blobs.
for (let i = 0; i < bid.length; i++) if (bid[i] >= 0 && kinds[bid[i]] !== T.HOUSE) tiles[i] = kinds[bid[i]];
let houses = 0;
const houseAt = [];
if (!PROCEDURAL) {
  buildings.forEach((b, i) => {
    if (kinds[i] !== T.HOUSE) return;
    const r = pts(b.geometry);
    const x = Math.floor(r.reduce((a, p) => a + p[0], 0) / r.length);
    const y = Math.floor(r.reduce((a, p) => a + p[1], 0) / r.length);
    houseAt.push([x, y]);
  });
}

// (Houses are placed after roads, below, so they can step back off the sidewalk.)

// 3. Roads. Lower classes first so arterials win the street-name.
const shortName = (n) => n
  .replace(/^Southwest (.*?) (Street|Way|Place|Road|Drive)$/, (_, a, b) => `SW ${a} ${{ Street: 'St', Way: 'Way', Place: 'Pl', Road: 'Rd', Drive: 'Dr' }[b]}`)
  .replace(/ Avenue Southwest$/, ' Ave SW')
  .replace(/ (Way|Drive|Place) Southwest$/, (_, b) => ` ${{ Way: 'Way', Drive: 'Dr', Place: 'Pl' }[b]} SW`);
const names = [];
const nameIdx = (n) => { const s = shortName(n); let i = names.indexOf(s); if (i < 0) { names.push(s); i = names.length - 1; } return i + 1; };

const CLASS = [
  { re: /^tertiary/, radius: 0.85 },
  { re: /^secondary/, radius: 1.15 },
  { re: /^primary/, radius: 1.3 },
];
for (const w of tagged((t) => /^motorway/.test(t.highway))) {
  strokeLine(pts(w.geometry), 1.3, (x, y) => { tiles[x + y * GW] = T.FREEWAY; road[x + y * GW] = 0; });
}
for (const { re, radius } of CLASS) {
  for (const w of tagged((t) => re.test(t.highway))) {
    const n = w.tags.name ? nameIdx(w.tags.name) : 0;
    strokeLine(pts(w.geometry), radius, (x, y) => {
      const i = x + y * GW;
      tiles[i] = T.ROAD;
      if (n || !road[i]) road[i] = n;
    });
  }
}

// 3b. Houses: one per footprint centroid; a house touching the street steps back a tile.
const isRoad = (x, y) => inGrid(x, y) && tiles[x + y * GW] === T.ROAD;
const open = (x, y) => inGrid(x, y) && (tiles[x + y * GW] === T.LAND || tiles[x + y * GW] === T.PLAZA);
for (let [x, y] of houseAt) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (isRoad(x + dx, y + dy) && open(x - dx, y - dy)) { x -= dx; y -= dy; break; }
  }
  if (open(x, y) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(x + dx, y + dy))) {
    tiles[x + y * GW] = T.HOUSE;
    houses++;
  }
}

// 4. Keep only the largest connected road network walkable; strays become plain land.
const comp = new Int32Array(GW * GH).fill(-1);
const sizes = [];
for (let i = 0; i < tiles.length; i++) {
  if (tiles[i] !== T.ROAD || comp[i] >= 0) continue;
  const id = sizes.length;
  let n = 0;
  const q = [i];
  comp[i] = id;
  while (q.length) {
    const c = q.pop();
    n++;
    const x = c % GW, y = (c / GW) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const j = nx + ny * GW;
      if (inGrid(nx, ny) && tiles[j] === T.ROAD && comp[j] < 0) { comp[j] = id; q.push(j); }
    }
  }
  sizes.push(n);
}
const main = sizes.indexOf(Math.max(...sizes));
let dropped = 0;
for (let i = 0; i < tiles.length; i++) {
  if (tiles[i] === T.ROAD && comp[i] !== main) { tiles[i] = T.LAND; road[i] = 0; dropped++; }
}

// 5. Labels: named parks & schools at their area-weighted centre; `size` = area in tiles.
// Pieces sharing a name (Lincoln Park is several polygons) merge into one label.
const byName = new Map();
for (const el of tagged((t) => t.name && (['park', 'nature_reserve', 'golf_course'].includes(t.leisure) || t.amenity === 'school'))) {
  let n = 0, sx = 0, sy = 0;
  fillRings(areaRings(el), (x, y) => { n++; sx += x + 0.5; sy += y + 0.5; });
  if (!n) continue;
  const key = el.tags.name;
  const acc = byName.get(key) ?? { name: key, kind: el.tags.amenity === 'school' ? 'school' : 'park', n: 0, sx: 0, sy: 0 };
  acc.n += n; acc.sx += sx; acc.sy += sy;
  byName.set(key, acc);
}
const labels = [...byName.values()].map((a) => ({ name: a.name, kind: a.kind, x: +(a.sx / a.n).toFixed(1), y: +(a.sy / a.n).toFixed(1), size: a.n }));

// 6. Named storefronts, for "you're outside …" in the HUD.
const shops = shopNodes
  .map((n) => ({ name: n.tags.name, kind: n.tags.shop ?? n.tags.amenity, x: +toX(n.lon).toFixed(1), y: +toY(n.lat).toFixed(1) }))
  .filter((s) => inGrid(Math.floor(s.x), Math.floor(s.y)));

const out = {
  attribution: 'Map data © OpenStreetMap contributors (ODbL)',
  w: GW, h: GH, tileMeters: TILE_M,
  projection: { west: W, north: N, mPerLon: M_PER_LON, mPerLat: M_PER_LAT },
  tiles: Buffer.from(tiles).toString('base64'),
  roads: Buffer.from(road).toString('base64'),
  names,
  labels,
  shops,
  houseMode: PROCEDURAL ? 'procedural' : 'footprints',
};
writeFileSync(new URL('src/world/worldData.json', ROOT), JSON.stringify(out));
console.log(`${PROCEDURAL ? 'procedural houses' : `${houses} footprint houses`}, grid ${GW}x${GH}, ${buildings.length} buildings, ${shops.length} shops, ${names.length} street names, ${labels.length} labels, road components ${sizes.length} (dropped ${dropped} tiles)`);

// Preview PNG (1px per tile, scaled up).
const PAL = [[60, 140, 230], [120, 200, 90], [40, 140, 70], [240, 220, 140], [250, 250, 250], [150, 150, 160], [200, 90, 70], [200, 200, 205], [120, 120, 135], [220, 190, 150], [255, 120, 160]];
const rgb = Buffer.alloc(GW * GH * 3);
for (let i = 0; i < tiles.length; i++) PAL[tiles[i]].forEach((v, k) => { rgb[i * 3 + k] = v; });
mkdirSync(new URL('screenshots/', ROOT), { recursive: true });
await sharp(rgb, { raw: { width: GW, height: GH, channels: 3 } })
  .resize(GW * 2, GH * 2, { kernel: 'nearest' }).png().toFile(new URL('screenshots/map-preview.png', ROOT).pathname);
