/**
 * Rasterizes data/osm/west-seattle.json (from fetch-osm.mjs) into the game's tile grid:
 * src/city/world/worldData.json. Also writes screenshots/map-preview.png for eyeballing.
 *
 * Tiles (see Tile in src/city/world/world.ts): water, land, park, beach, road (walkable), freeway,
 * plus buildings from OSM footprints (house / shop / block / civic) and commercial ground.
 * Roads keep a per-tile street-name index so the HUD can say where you are.
 *
 * All tunables live in scripts/city/map-config.mjs. Landmark drawings (content/landmarks.csv →
 * src/city/world/landmarksData.json via scripts/city/landmarks.mjs) get a cleared footprint beside the street.
 *
 * Usage: node scripts/city/build-map.mjs [--procedural]   (or `npm run map`, which geocodes the landmarks first)
 *   --procedural  ignore house footprints and let the renderer scatter houses instead (the old look)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DETAILED, HOUSES, MAP, ROADS } from './map-config.mjs';

const ROOT = new URL('../..', import.meta.url);
const PROCEDURAL = process.argv.includes('--procedural');
const osm = JSON.parse(readFileSync(new URL('data/osm/west-seattle.json', ROOT)));

const [S, W, N, E] = MAP.bbox;
const TILE_M = MAP.tileMeters;
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
  LANDMARK: 11, // ground under a hand-drawn landmark (src/city/render/landmarks.ts)
  LAWN: 12, // open lawn in a detailed place (DETAILED in map-config): scattered trees, painted features
  PARKING: 13, // a parking lot in a detailed place: walkable, painted with stalls
  DRAWN: 14, // ground under a building painted from its exact outline (detailed places)
};
const tiles = new Uint8Array(GW * GH).fill(T.LAND);
const road = new Uint16Array(GW * GH); // 0 = none, else 1 + names index (hundreds of streets)
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

/** Douglas–Peucker: drop points within `tol` tiles of the simplified line. */
function simplify(points, tol) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  let far = 0, at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > far) { far = d; at = i; }
  }
  if (far <= tol) return [a, b];
  return [...simplify(points.slice(0, at + 1), tol).slice(0, -1), ...simplify(points.slice(at), tol)];
}

/**
 * Tiles covered by a road of width `w` along a polyline: every tile whose centre is within
 * w/2 of the line (round caps and joins). The renderer paints the same shape per pixel from
 * the exported centrelines, so what you can walk on is exactly what's drawn as road.
 */
function strokeTiles(points, w, fn) {
  const r = w / 2 - 1e-6;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    for (let ty = Math.floor(Math.min(ay, by) - r); ty <= Math.ceil(Math.max(ay, by) + r); ty++) {
      for (let tx = Math.floor(Math.min(ax, bx) - r); tx <= Math.ceil(Math.max(ax, bx) + r); tx++) {
        if (!inGrid(tx, ty)) continue;
        const px = tx + 0.5, py = ty + 0.5;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < r) fn(tx, ty);
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
// Detailed places (DETAILED in map-config: a park, a school campus…) are open lawn, not
// woods, with walkable footpaths, real parking lots, pitches and courts, and buildings
// painted from their exact outlines. The detail comes from data/osm/detail.json
// (scripts/city/fetch-detail.mjs).
const detailedEls = tagged((t) => t.name && (t.leisure === 'park' || t.amenity === 'school') && DETAILED.places.some((d) => d.name === t.name));
const detailedPlaces = detailedEls.map(areaRings);
const isWooded = (el) => DETAILED.places.some((d) => d.name === el.tags.name && d.woods);
const toLawn = (x, y) => { const i = x + y * GW; if (tiles[i] === T.PARK || tiles[i] === T.LAND) tiles[i] = T.LAWN; };
detailedEls.forEach((el, k) => { if (!isWooded(el)) fillRings(detailedPlaces[k], toLawn); });
/** even-odd point-in-polygon over a set of rings (tile coords) */
const insideRings = (rings, x, y) => {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > y) !== (r[j][1] > y) && x < r[i][0] + ((y - r[i][1]) / (r[j][1] - r[i][1])) * (r[j][0] - r[i][0])) inside = !inside;
    }
  }
  return inside;
};
const inDetailed = (x, y) => detailedPlaces.some((rings) => insideRings(rings, x, y));
// a building on a school campus is the school (brick), whatever OSM calls it
const schoolCampuses = tagged((t) => t.amenity === 'school' && DETAILED.places.some((d) => d.name === t.name)).map(areaRings);
const onCampus = (x, y) => schoolCampuses.some((rings) => insideRings(rings, x, y));
const DETAIL_DATA = new URL('data/osm/detail.json', ROOT);
const detailEls = existsSync(DETAIL_DATA) ? JSON.parse(readFileSync(DETAIL_DATA)).elements : [];
if (detailedPlaces.length && !detailEls.length) console.warn('  no data/osm/detail.json: run node scripts/city/fetch-detail.mjs for paths, lots and pitches');
// A wooded place stays woods; only its open ground — meadows, grass, fields, play areas — is lawn.
const woodedPlaces = detailedEls.filter(isWooded).map(areaRings);
const inWooded = (x, y) => woodedPlaces.some((rings) => insideRings(rings, x, y));
const OPEN_GROUND = (t) => /^(grassland|heath)$/.test(t.natural ?? '') || /^(grass|meadow|recreation_ground|village_green)$/.test(t.landuse ?? '') || /^(pitch|playground)$/.test(t.leisure ?? '');
for (const el of detailEls.filter((e) => e.tags && OPEN_GROUND(e.tags) && (e.type === 'way' ? e.geometry : e.members))) {
  const rings = areaRings(el);
  const r0 = rings[0], cx = r0.reduce((a, p) => a + p[0], 0) / r0.length, cy = r0.reduce((a, p) => a + p[1], 0) / r0.length;
  if (inWooded(cx, cy)) fillRings(rings, toLawn);
}
const round2 = (r) => r.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);
const centroid = (r) => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
for (const el of tagged((t) => ['commercial', 'retail', 'industrial'].includes(t.landuse))) {
  fillRings(areaRings(el), (x, y) => { if (tiles[x + y * GW] === T.LAND) tiles[x + y * GW] = T.PLAZA; });
}

// 2b. Buildings from footprints. Classify each, then paint.
const shopNodes = els.filter((e) => e.type === 'node' && e.tags?.name && (e.tags.shop || e.tags.amenity));
const bid = new Int32Array(GW * GH).fill(-1);
const buildings = tagged((t) => t.building && t.building !== 'roof').filter((e) => (e.type === 'way' && e.geometry) || (e.type === 'relation' && e.members));
const shoelace = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/** a building's outline(s): a plain way, or a multipolygon's outer rings and courtyards */
const partsOf = (b) => b.type === 'way'
  ? { outer: [pts(b.geometry)], inner: [] }
  : { outer: assembleRings(b.members.filter((m) => m.type === 'way' && m.role !== 'inner')), inner: assembleRings(b.members.filter((m) => m.type === 'way' && m.role === 'inner')) };
const bParts = buildings.map(partsOf);
const ringsOf = (i) => [...bParts[i].outer, ...bParts[i].inner];
const outerOf = (i) => bParts[i].outer.reduce((a, r) => (shoelace(r) > shoelace(a) ? r : a), bParts[i].outer[0]);
const areaOf = (i) => bParts[i].outer.reduce((a, r) => a + shoelace(r), 0) - bParts[i].inner.reduce((a, r) => a + shoelace(r), 0);
buildings.forEach((b, i) => fillRings(ringsOf(i), (x, y) => { if (tiles[x + y * GW] !== T.WATER) bid[x + y * GW] = i; }));
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
  const area = areaOf(i) * TILE_M * TILE_M;
  if (b.type === 'relation') return t.building === 'apartments' ? T.BLOCK : ['school', 'college', 'church', 'civic', 'public'].includes(t.building) || t.amenity ? T.CIVIC : T.BLOCK;
  if (HOUSE_TAGS.has(t.building) && area < HOUSES.maxArea && t.building !== 'residential') return T.HOUSE;
  if (['church', 'school', 'college', 'kindergarten', 'civic', 'public', 'chapel'].includes(t.building) || t.amenity) return T.CIVIC;
  if (['retail', 'commercial', 'supermarket', 'office', 'industrial', 'warehouse', 'service'].includes(t.building) || hasShop.has(i)) return T.SHOP;
  if (t.building === 'apartments') return T.BLOCK;
  if (area < 380) return T.HOUSE;
  const r = outerOf(i);
  const cx = Math.floor(r.reduce((a, p) => a + p[0], 0) / r.length);
  const cy = Math.floor(r.reduce((a, p) => a + p[1], 0) / r.length);
  return inGrid(cx, cy) && tiles[cx + cy * GW] === T.PLAZA ? T.SHOP : T.BLOCK;
});
// Big buildings fill their footprint. Houses keep their real shape: the footprint's
// minimum-area rectangle (true size, true spot on the lot, true angle), drawn per pixel.
for (let i = 0; i < bid.length; i++) if (bid[i] >= 0 && kinds[bid[i]] !== T.HOUSE) tiles[i] = kinds[bid[i]];
// In detailed places, big buildings are painted from their exact outlines (courtyards and
// all) by the renderer; their tiles become DRAWN so the tile art leaves them alone.
const drawnBuildings = [];
buildings.forEach((b, i) => {
  if (kinds[i] === T.HOUSE || !inDetailed(...centroid(outerOf(i)))) return;
  const levels = parseFloat(b.tags['building:levels']) || (kinds[i] === T.CIVIC ? 3 : kinds[i] === T.BLOCK ? 2 : 1);
  drawnBuildings.push({ k: kinds[i] === T.CIVIC || onCampus(...centroid(outerOf(i))) ? 'civic' : kinds[i] === T.SHOP ? 'shop' : 'block', levels, rings: ringsOf(i).map(round2), n: bParts[i].outer.length });
  fillRings(ringsOf(i), (x, y) => { const j = x + y * GW; if (bid[j] === i) tiles[j] = T.DRAWN; });
});
// Surface parking lots in detailed places: walkable, painted with stalls along their aisles.
const parkingLots = detailEls
  .filter((e) => e.type === 'way' && e.geometry && e.tags?.amenity === 'parking' && !/rooftop|multi-storey|underground/.test(e.tags.parking ?? ''))
  .map((e) => pts(e.geometry))
  .filter((r) => inDetailed(...centroid(r)));
for (const r of parkingLots) {
  fillRings([r], (x, y) => { const i = x + y * GW; if ([T.LAND, T.LAWN, T.PLAZA, T.PARK].includes(tiles[i])) tiles[i] = T.PARKING; });
}
const parkingAisles = detailEls
  .filter((e) => e.type === 'way' && e.geometry && e.tags?.service === 'parking_aisle')
  .map((e) => pts(e.geometry))
  .filter((l) => parkingLots.some((r) => l.some(([x, y]) => insideRings([r], x, y))));

/** Smallest rectangle around a ring (tiles): centre, size along its own axes, angle in [0, π/2). */
function minRect(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
    if (x0 === x1 && y0 === y1) continue;
    const th = Math.atan2(y1 - y0, x1 - x0);
    const c = Math.cos(th), s = Math.sin(th);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of ring) {
      const u = x * c + y * s, v = -x * s + y * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      best = { area, th, w: u1 - u0, h: v1 - v0, cx: um * c - vm * s, cy: um * s + vm * c };
    }
  }
  if (!best) return null;
  // A rectangle looks the same turned 90°: fold the angle into [0, π/2), swapping sides.
  let { th, w, h } = best;
  th = ((th % Math.PI) + Math.PI) % Math.PI;
  if (th >= Math.PI / 2) { th -= Math.PI / 2; [w, h] = [h, w]; }
  // Square it to the grid (or to 45°) when it's nearly there, so edges are clean pixel runs.
  const snap = (HOUSES.snapAngle * Math.PI) / 180;
  if (th < snap) th = 0;
  else if (th > Math.PI / 2 - snap) { th = 0; [w, h] = [h, w]; }
  else if (Math.abs(th - Math.PI / 4) < snap / 2) th = Math.PI / 4;
  return { cx: best.cx, cy: best.cy, w, h, th };
}

const OUTBUILDINGS = new Set(['garage', 'garages', 'shed', 'carport', 'hut', 'greenhouse']);
let houses = 0;
const houseRects = [];
if (!PROCEDURAL) {
  buildings.forEach((b, i) => {
    if (kinds[i] !== T.HOUSE) return;
    const ring = outerOf(i);
    const area = shoelace(ring) * TILE_M * TILE_M;
    if (area < HOUSES.minArea) return;
    const r = minRect(ring);
    if (r) houseRects.push({ ...r, out: OUTBUILDINGS.has(b.tags.building) || (b.tags.building === 'yes' && area < 45) });
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

// Every street as OSM has it: real centrelines (only GPS jitter simplified away) and a real
// width per way, in metres — kerb to kerb plus sidewalks — from its lane count when tagged.
const roadClass = (h) => (/_link$/.test(h) ? 'link' : h);
const RANK = { living_street: 0, unclassified: 1, residential: 2, link: 3, tertiary: 4, secondary: 5, primary: 6 };
const polyLen = (l) => l.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);
/** full drawn width in metres */
function widthMetres(t, cls, name) {
  if (name && ROADS.byName[name]) return ROADS.byName[name];
  const lanes = parseFloat(t.lanes);
  if (!(lanes > 0)) return ROADS.byClass[cls];
  const sidewalks = t.sidewalk === 'no' || t.sidewalk === 'none' ? 0 : t.sidewalk === 'left' || t.sidewalk === 'right' ? ROADS.sidewalk : 2 * ROADS.sidewalk;
  return lanes * ROADS.laneWidth + (ROADS.parking[cls] ?? 0) + sidewalks;
}
const ways = tagged((t) => /^((primary|secondary|tertiary)(_link)?|residential|unclassified|living_street)$/.test(t.highway))
  .filter((w) => w.type === 'way' && w.geometry && !(ROADS.dropLinks && /_link$/.test(w.tags.highway)))
  .map((w) => {
    const cls = roadClass(w.tags.highway);
    const name = w.tags.name ? shortName(w.tags.name) : null;
    const metres = widthMetres(w.tags, cls, name) * ROADS.widthScale;
    return { w, cls, name, metres, wT: metres / TILE_M, line: simplify(pts(w.geometry), ROADS.simplify) };
  })
  .filter((r) => r.name || polyLen(r.line) >= ROADS.minUnnamedLength);
// Footpaths and steps inside detailed parks: walkable, drawn as concrete (no kerb, no asphalt).
const parkPaths = detailEls.filter((e) => e.type === 'way' && e.geometry && /^(footway|path|steps|pedestrian|cycleway)$/.test(e.tags?.highway ?? ''));
for (const w of parkPaths) {
  const line = pts(w.geometry);
  if (line.filter(([x, y]) => inDetailed(x, y)).length * 2 < line.length) continue; // a street's sidewalk, not a path through the place
  const metres = DETAILED.pathWidth * ROADS.widthScale;
  ways.push({ w, cls: 'path', path: true, name: null, metres, wT: metres / TILE_M, line: simplify(line, ROADS.simplify) });
}
RANK.path = -1;
for (const w of tagged((t) => /^motorway/.test(t.highway))) {
  strokeTiles(simplify(pts(w.geometry), ROADS.simplify), ROADS.freeway / TILE_M, (x, y) => { tiles[x + y * GW] = T.FREEWAY; road[x + y * GW] = 0; });
}
// Narrow and minor first, so wide arterials win the street name where they cross. The
// walkable band is the drawn road, but never thinner than ROADS.minWalkable tiles — any
// thinner and a slanting street breaks into tiles that only touch at their corners.
ways.sort((a, b) => a.wT - b.wT || RANK[a.cls] - RANK[b.cls]);
for (const r of ways) {
  const n = r.name ? nameIdx(r.w.tags.name) : 0;
  r.cells = [];
  strokeTiles(r.line, Math.max(r.wT, ROADS.minWalkable), (x, y) => {
    const i = x + y * GW;
    tiles[i] = T.ROAD;
    if (n || !road[i]) road[i] = n;
    r.cells.push(i);
  });
}

// 3a. Landmarks: find each drawing a clear w×h spot as close to its address as possible,
// touching a street but never covering one.
const LANDMARKS = new URL('src/city/world/landmarksData.json', ROOT);
const landmarks = [];
for (const lm of existsSync(LANDMARKS) ? JSON.parse(readFileSync(LANDMARKS)) : []) {
  const cx = toX(lm.lon), cy = toY(lm.lat);
  let best = null;
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      const x0 = Math.round(cx - lm.w / 2) + dx, y0 = Math.round(cy - lm.h / 2) + dy;
      let clear = true, touches = false;
      for (let y = y0 - 1; y <= y0 + lm.h && clear; y++) {
        for (let x = x0 - 1; x <= x0 + lm.w; x++) {
          const inside = x >= x0 && x < x0 + lm.w && y >= y0 && y < y0 + lm.h;
          const t = inGrid(x, y) ? tiles[x + y * GW] : T.WATER;
          if (inside && (t === T.ROAD || t === T.WATER || t === T.FREEWAY || t === T.LANDMARK)) { clear = false; break; }
          if (!inside && t === T.ROAD) touches = true;
        }
      }
      const d = Math.hypot(dx, dy);
      if (clear && touches && (!best || d < best.d)) best = { x: x0, y: y0, d };
    }
  }
  if (!best) { console.warn(`landmark ${lm.id}: no clear spot near its address`); continue; }
  for (let y = best.y; y < best.y + lm.h; y++) for (let x = best.x; x < best.x + lm.w; x++) tiles[x + y * GW] = T.LANDMARK;
  landmarks.push({ id: lm.id, sprite: lm.sprite, name: lm.name, x: best.x, y: best.y, w: lm.w, h: lm.h, ...(lm.street ? { street: lm.street } : {}) });
}

// 3b. Houses at their real footprints. Streets are drawn wider than life, so a front-row
// house that would poke into the sidewalk is nudged straight back from the street
// (up to HOUSES.maxPush tiles), and dropped if that bumps it into a neighbour.
const roadSegs = new Map(); // 4-tile buckets → [ax, ay, bx, by, halfWidth]
const SEG_CELL = 4;
for (const r of ways) {
  const hw = r.wT / 2;
  for (let i = 1; i < r.line.length; i++) {
    const [ax, ay] = r.line[i - 1], [bx, by] = r.line[i];
    for (let cy = Math.floor((Math.min(ay, by) - hw - 2) / SEG_CELL); cy <= Math.floor((Math.max(ay, by) + hw + 2) / SEG_CELL); cy++) {
      for (let cx = Math.floor((Math.min(ax, bx) - hw - 2) / SEG_CELL); cx <= Math.floor((Math.max(ax, bx) + hw + 2) / SEG_CELL); cx++) {
        const k = cx * 100000 + cy;
        if (!roadSegs.has(k)) roadSegs.set(k, []);
        roadSegs.get(k).push([ax, ay, bx, by, hw]);
      }
    }
  }
}
/** Corners, edge midpoints and centre of a house rectangle (tiles). */
function rectPoints(h) {
  const c = Math.cos(h.th), s = Math.sin(h.th);
  const out = [];
  for (const [fu, fv] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [0, 0]]) {
    const u = (fu * h.w) / 2, v = (fv * h.h) / 2;
    out.push([h.cx + u * c - v * s, h.cy + u * s + v * c]);
  }
  return out;
}
/** The push (tiles) that clears the worst road overlap, or null if clear. */
function roadPush(h) {
  let worst = null;
  const seen = new Set();
  for (const [x, y] of rectPoints(h)) {
    for (const g of roadSegs.get(Math.floor(x / SEG_CELL) * 100000 + Math.floor(y / SEG_CELL)) ?? []) {
      if (seen.has(g)) continue;
      seen.add(g);
      const [ax, ay, bx, by, hw] = g;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1e-9;
      // deepest point of the house inside this road's band
      let deficit = 0;
      for (const [px, py] of rectPoints(h)) {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        deficit = Math.max(deficit, hw + HOUSES.clearance - d);
      }
      if (deficit <= 0) continue;
      // away from the road, through the house centre
      const t = Math.max(0, Math.min(1, ((h.cx - ax) * dx + (h.cy - ay) * dy) / len2));
      let nx = h.cx - (ax + t * dx), ny = h.cy - (ay + t * dy);
      const n = Math.hypot(nx, ny) || 1;
      nx /= n; ny /= n;
      if (!worst || deficit > worst.d) worst = { d: deficit, x: nx * deficit, y: ny * deficit };
    }
  }
  return worst;
}
const BLOCKED = new Set([T.WATER, T.FREEWAY, T.SHOP, T.BLOCK, T.CIVIC, T.LANDMARK, T.PARK, T.LAWN, T.PARKING, T.DRAWN]);
const placed = new Map(); // 2-tile buckets → house rects, for neighbour checks
const bucketKey = (x, y) => Math.floor(x / 2) * 100000 + Math.floor(y / 2);
const aabb = (h) => {
  const c = Math.abs(Math.cos(h.th)), s = Math.abs(Math.sin(h.th));
  const ex = (h.w * c + h.h * s) / 2, ey = (h.w * s + h.h * c) / 2;
  return [h.cx - ex, h.cy - ey, h.cx + ex, h.cy + ey];
};
function overlapsNeighbour(h) {
  const [x0, y0, x1, y1] = aabb(h);
  for (let by = Math.floor(y0 / 2) - 1; by <= Math.floor(y1 / 2) + 1; by++) {
    for (let bx = Math.floor(x0 / 2) - 1; bx <= Math.floor(x1 / 2) + 1; bx++) {
      for (const o of placed.get(bx * 100000 + by) ?? []) {
        const [p0, q0, p1, q1] = aabb(o);
        const ix = Math.min(x1, p1) - Math.max(x0, p0), iy = Math.min(y1, q1) - Math.max(y0, q0);
        if (ix > 0 && iy > 0 && ix * iy > 0.2 * Math.min(h.w * h.h, o.w * o.h)) return true;
      }
    }
  }
  return false;
}
const housesOut = [];
const pushedHouses = [];
/** Shrink a house about its centre; false once it's below HOUSES.minScale of its real size. */
const shrink = (h) => {
  h.w *= 0.85; h.h *= 0.85;
  return h.w >= h.w0 * HOUSES.minScale;
};
// Streets are wider than life, so the blocks between them give way: a house the street
// reaches is nudged back (up to HOUSES.maxPush tiles), and past that it shrinks to fit.
for (const h of houseRects) {
  h.w0 = h.w; h.h0 = h.h;
  let moved = 0;
  let fits = true;
  for (let k = 0; k < 16; k++) {
    const p = roadPush(h);
    if (!p) break;
    const room = Math.max(0, HOUSES.maxPush - moved);
    const step = Math.min(p.d, room);
    if (step > 0) { h.cx += (p.x * step) / p.d; h.cy += (p.y * step) / p.d; moved += step; }
    if (step < p.d && !(fits = shrink(h))) break;
  }
  if (!fits || roadPush(h)) continue;
  if (rectPoints(h).some(([x, y]) => !inGrid(Math.floor(x), Math.floor(y)) || BLOCKED.has(tiles[Math.floor(x) + Math.floor(y) * GW]))) continue;
  (moved || h.w < h.w0 ? pushedHouses : housesOut).push(h);
}
// Houses that sit where OSM has them go first; nudged ones squeeze in, shrinking if a
// neighbour's in the way.
const place = (h) => {
  const k = bucketKey(h.cx, h.cy);
  if (!placed.has(k)) placed.set(k, []);
  placed.get(k).push(h);
};
housesOut.forEach(place);
for (const h of pushedHouses) {
  let fits = true;
  while (overlapsNeighbour(h) && (fits = shrink(h)));
  if (fits) { place(h); housesOut.push(h); }
}
// The ground under a house is HOUSE (no trees, pink on the minimap).
for (const h of housesOut) {
  const [x0, y0, x1, y1] = aabb(h);
  const c = Math.cos(h.th), s = Math.sin(h.th);
  let marked = false;
  for (let y = Math.floor(y0); y <= Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
      const dx = x + 0.5 - h.cx, dy = y + 0.5 - h.cy;
      const inside = Math.abs(dx * c + dy * s) < h.w / 2 + 0.25 && Math.abs(-dx * s + dy * c) < h.h / 2 + 0.25;
      if (inside && inGrid(x, y) && tiles[x + y * GW] === T.LAND) { tiles[x + y * GW] = T.HOUSE; marked = true; }
    }
  }
  const cx = Math.floor(h.cx), cy = Math.floor(h.cy);
  if (!marked && tiles[cx + cy * GW] === T.LAND) tiles[cx + cy * GW] = T.HOUSE;
  houses++;
}
// For the renderer, in pixels: centre x, centre y, width, depth (along the house's own
// axes), angle in degrees, 1 = garage/shed. Flat, six numbers a house.
const PX = 16; // must match TS in src/city/render/tileArt.ts
const houseData = housesOut.flatMap((h) => [
  Math.round(h.cx * PX), Math.round(h.cy * PX),
  Math.max(HOUSES.minPx, Math.round(h.w * PX)), Math.max(HOUSES.minPx, Math.round(h.h * PX)),
  Math.round((h.th * 180) / Math.PI), h.out ? 1 : 0,
]);

// 4. Keep only the largest connected network (roads + parking lots) walkable; strays become plain land.
const walkableTile = (t) => t === T.ROAD || t === T.PARKING;
const comp = new Int32Array(GW * GH).fill(-1);
const sizes = [];
for (let i = 0; i < tiles.length; i++) {
  if (!walkableTile(tiles[i]) || comp[i] >= 0) continue;
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
      if (inGrid(nx, ny) && walkableTile(tiles[j]) && comp[j] < 0) { comp[j] = id; q.push(j); }
    }
  }
  sizes.push(n);
}
const main = sizes.indexOf(Math.max(...sizes));
let dropped = 0;
const droppedNames = new Map();
for (let i = 0; i < tiles.length; i++) {
  if (walkableTile(tiles[i]) && comp[i] !== main) {
    if (road[i]) droppedNames.set(names[road[i] - 1], (droppedNames.get(names[road[i] - 1]) ?? 0) + 1);
    tiles[i] = T.LAND; road[i] = 0; dropped++;
  }
}
// Worth a look when it's large: a street cut off from the rest isn't walkable.
if (dropped > 50) console.warn(`  unreachable road tiles dropped: ${[...droppedNames].map(([n, c]) => `${n} (${c})`).join(', ') || 'unnamed'}`);

// Road centrelines for the renderer, which paints asphalt / curb / sidewalk per pixel.
const roadLines = ways
  .filter((r) => r.cells.some((i) => tiles[i] === T.ROAD))
  .map((r) => ({ w: +r.wT.toFixed(2), ...(r.path ? { k: 1 } : {}), p: r.line.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]) }));

// Pitches, the track, playgrounds, pools and bleachers inside detailed parks, as rings in
// tile coords (holes after the outer ring); src/city/render/detailArt.ts paints them.
const parkFeatures = detailEls
  .filter((e) => /^(pitch|track|playground|swimming_pool|bleachers)$/.test(e.tags?.leisure ?? ''))
  .map((e) => {
    const outer = e.type === 'way' ? [pts(e.geometry)] : assembleRings(e.members.filter((m) => m.type === 'way' && m.role !== 'inner'));
    const inner = e.type === 'way' ? [] : assembleRings(e.members.filter((m) => m.type === 'way' && m.role === 'inner'));
    return { k: e.tags.leisure, s: e.tags.sport ?? '', rings: [...outer, ...inner].map(round2), n: outer.length };
  })
  .filter((f) => {
    const r = f.rings[0];
    const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cy = r.reduce((a, p) => a + p[1], 0) / r.length;
    return inDetailed(cx, cy);
  })
  // fields first (biggest first, so diamonds and courts land on top), the track's ring around
  // them, then pools, playgrounds and bleachers
  .sort((a, b) => ['pitch', 'track', 'swimming_pool', 'playground', 'bleachers'].indexOf(a.k) - ['pitch', 'track', 'swimming_pool', 'playground', 'bleachers'].indexOf(b.k) || shoelace(b.rings[0]) - shoelace(a.rings[0]));

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
  roads: Buffer.from(road.buffer).toString('base64'), // little-endian uint16 per tile
  roadLines,
  names,
  labels,
  shops,
  landmarks,
  houseMode: PROCEDURAL ? 'procedural' : 'footprints',
  houses: houseData,
  parkFeatures,
  drawnBuildings,
  parkingLots: parkingLots.map((r) => ({ rings: [round2(r)], n: 1 })),
  parkingAisles: parkingAisles.map(round2),
};
writeFileSync(new URL('src/city/world/worldData.json', ROOT), JSON.stringify(out));
console.log(`${PROCEDURAL ? 'procedural houses' : `${houses} footprint houses`}, grid ${GW}x${GH}, ${buildings.length} buildings, ${shops.length} shops, ${names.length} street names, ${labels.length} labels, road components ${sizes.length} (dropped ${dropped} tiles)`);

// Preview PNG (1px per tile, scaled up).
const PAL = [[60, 140, 230], [120, 200, 90], [40, 140, 70], [240, 220, 140], [250, 250, 250], [150, 150, 160], [200, 90, 70], [200, 200, 205], [120, 120, 135], [220, 190, 150], [255, 120, 160], [255, 220, 0], [140, 210, 110], [90, 85, 85], [200, 90, 70]];
const rgb = Buffer.alloc(GW * GH * 3);
for (let i = 0; i < tiles.length; i++) PAL[tiles[i]].forEach((v, k) => { rgb[i * 3 + k] = v; });
mkdirSync(new URL('screenshots/', ROOT), { recursive: true });
await sharp(rgb, { raw: { width: GW, height: GH, channels: 3 } })
  .resize(GW * 2, GH * 2, { kernel: 'nearest' }).png().toFile(fileURLToPath(new URL('screenshots/map-preview.png', ROOT)));
