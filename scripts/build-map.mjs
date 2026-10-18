/**
 * Rasterizes data/osm/west-seattle.json (from fetch-osm.mjs) into the game's tile grid:
 * src/world/worldData.json. Also writes screenshots/map-preview.png for eyeballing.
 *
 * Tiles (see Tile in src/world/world.ts): water, land, park, beach, road (walkable), freeway,
 * plus buildings from OSM footprints (house / shop / block / civic) and commercial ground.
 * Roads keep a per-tile street-name index so the HUD can say where you are.
 *
 * All tunables live in scripts/map-config.mjs. Landmark drawings (content/landmarks.csv →
 * src/content/landmarksData.json via places.mjs) get a cleared footprint beside the street.
 *
 * Usage: node scripts/build-map.mjs [--procedural]   (or `npm run map`, which geocodes first)
 *   --procedural  ignore house footprints and let the renderer scatter houses instead (the old look)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { HOUSES, MAP, ROADS } from './map-config.mjs';

const ROOT = new URL('..', import.meta.url);
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
  LANDMARK: 11, // ground under a hand-drawn landmark (src/game/render/landmarks.ts)
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
 * A road of constant width: walk the segment one tile at a time along its major axis and
 * fill a fixed run of tiles across the minor axis. Unlike a round brush this never swells
 * or pinches as the line drifts across tile boundaries. The run is w / cos(angle), so a
 * diagonal street is as wide (square to its direction) as a straight one. Vertices get a
 * w×w cap so bends join.
 */
function bandLine(points, w, fn) {
  const cap = ([x, y]) => {
    const x0 = Math.floor(x - w / 2 + 0.5), y0 = Math.floor(y - w / 2 + 0.5);
    for (let j = 0; j < w; j++) for (let k = 0; k < w; k++) if (inGrid(x0 + k, y0 + j)) fn(x0 + k, y0 + j);
  };
  points.forEach(cap);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const dx = x1 - x0, dy = y1 - y0;
    const major = Math.max(Math.abs(dx), Math.abs(dy));
    const run = Math.max(w, Math.round((w * Math.hypot(dx, dy)) / (major || 1)));
    const n = Math.max(1, Math.ceil(major * 2));
    for (let s = 0; s <= n; s++) {
      const cx = x0 + (dx * s) / n, cy = y0 + (dy * s) / n;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const tx = Math.floor(cx), start = Math.floor(cy - run / 2 + 0.5);
        for (let k = 0; k < run; k++) if (inGrid(tx, start + k)) fn(tx, start + k);
      } else {
        const ty = Math.floor(cy), start = Math.floor(cx - run / 2 + 0.5);
        for (let k = 0; k < run; k++) if (inGrid(start + k, ty)) fn(start + k, ty);
      }
    }
  }
}

/** Join a street's separate OSM ways into continuous polylines (matching endpoints). */
function chainLines(lines) {
  const key = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;
  const pool = lines.map((l) => [...l]);
  const out = [];
  while (pool.length) {
    let chain = pool.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i];
        const [a, b] = [key(chain[0]), key(chain[chain.length - 1])];
        const [c, d] = [key(l[0]), key(l[l.length - 1])];
        if (b === c) chain = chain.concat(l.slice(1));
        else if (b === d) chain = chain.concat([...l].reverse().slice(1));
        else if (a === d) chain = l.concat(chain.slice(1));
        else if (a === c) chain = [...l].reverse().concat(chain.slice(1));
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(chain);
  }
  return out;
}

/**
 * Snap nearly-axis-aligned runs of a polyline dead straight: consecutive segments within
 * `maxAngle` of vertical share one x (of horizontal, one y) while every vertex stays
 * within `tolerance` of it. The shared value is rounded to a tile centre, so neighbouring
 * runs of a straight street land on exactly the same column. A vertex between a vertical
 * and a horizontal run gets both, which makes a clean right-angle corner.
 */
function axisSnap(points, { maxAngle, tolerance }) {
  const t = Math.tan((maxAngle * Math.PI) / 180);
  const kind = (a, b) => {
    const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
    return dx <= t * dy ? 1 : dy <= t * dx ? 0 : -1; // 1 = vertical → snap x (index 0)
  };
  const p = points.map((q) => [...q]);
  let i = 0;
  while (i < p.length - 1) {
    const k = kind(p[i], p[i + 1]);
    if (k < 0) { i++; continue; }
    const axis = k === 1 ? 0 : 1;
    let j = i + 1;
    let sum = 0, len = 0;
    const add = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); sum += ((a[axis] + b[axis]) / 2) * l; len += l; };
    add(p[i], p[i + 1]);
    while (j < p.length - 1 && kind(p[j], p[j + 1]) === k) {
      const [s0, l0] = [sum, len];
      add(p[j], p[j + 1]);
      const mean = sum / len;
      if (p.slice(i, j + 2).some((q) => Math.abs(q[axis] - mean) > tolerance)) { sum = s0; len = l0; break; }
      j++;
    }
    const mean = Math.floor(sum / (len || 1)) + 0.5;
    for (let v = i; v <= j; v++) p[v][axis] = mean;
    i = j;
  }
  return p;
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
  if (HOUSE_TAGS.has(t.building) && area < HOUSES.maxArea && t.building !== 'residential') return T.HOUSE;
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

// One width per street: its most common class (by length) or a byName override.
const roadClass = (h) => (/_link$/.test(h) ? 'link' : h.replace(/_link$/, ''));
const RANK = { link: 0, tertiary: 1, secondary: 2, primary: 3 };
const rawWays = tagged((t) => /^(primary|secondary|tertiary)(_link)?$/.test(t.highway))
  .filter((w) => !(ROADS.dropLinks && /_link$/.test(w.tags.highway)))
  .map((w) => ({ w, cls: roadClass(w.tags.highway), name: w.tags.name ? shortName(w.tags.name) : null, line: pts(w.geometry) }));
const polyLen = (l) => l.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);
// Each named street becomes a few continuous chains (so it can be straightened as a whole);
// a chain takes the class of the way that contributes most of its length.
const ways = [];
const byStreet = new Map();
for (const r of rawWays) {
  if (!r.name) {
    if (polyLen(r.line) >= ROADS.minUnnamedLength) ways.push({ ...r, line: simplify(r.line, ROADS.simplify) });
    continue;
  }
  if (!byStreet.has(r.name)) byStreet.set(r.name, []);
  byStreet.get(r.name).push(r);
}
// Intersections: points shared by two or more streets (OSM ways share nodes there).
const ptKey = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;
const streetsAt = new Map();
for (const r of rawWays) {
  for (const q of r.line) {
    const k = ptKey(q);
    if (!streetsAt.has(k)) streetsAt.set(k, new Set());
    streetsAt.get(k).add(r.name ?? `#${r.w.id}`);
  }
}
const isJunction = (q) => (streetsAt.get(ptKey(q))?.size ?? 0) > 1;
/** Cut a chain into block-length pieces at intersections (each piece keeps the junction ends). */
const splitAtJunctions = (line) => {
  const pieces = [];
  let cur = [line[0]];
  for (let i = 1; i < line.length; i++) {
    cur.push(line[i]);
    if (i < line.length - 1 && isJunction(line[i])) { pieces.push(cur); cur = [line[i]]; }
  }
  pieces.push(cur);
  return pieces;
};
for (const [name, rs] of byStreet) {
  const sample = rs.slice().sort((a, b) => polyLen(b.line) - polyLen(a.line))[0];
  for (const chain of chainLines(rs.map((r) => r.line))) {
    // Straighten block by block: any one-tile drift of a long street then happens at an
    // intersection, hidden under the cross street, instead of mid-block.
    for (const piece of splitAtJunctions(chain)) {
      ways.push({ w: sample.w, cls: sample.cls, name, line: axisSnap(simplify(piece, ROADS.simplify), ROADS.axisSnap) });
    }
  }
}
const lengthByName = new Map();
for (const r of ways) {
  if (!r.name || r.cls === 'link') continue;
  const len = r.line.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - r.line[i - 1][0], p[1] - r.line[i - 1][1]) : 0), 0);
  const m = lengthByName.get(r.name) ?? {};
  m[r.cls] = (m[r.cls] ?? 0) + len;
  lengthByName.set(r.name, m);
}
const widthOf = (r) => {
  if (r.cls === 'link') return ROADS.byClass.link;
  if (r.name && ROADS.byName[r.name]) return ROADS.byName[r.name];
  const m = r.name && lengthByName.get(r.name);
  const cls = m ? Object.entries(m).sort((a, b) => b[1] - a[1])[0][0] : r.cls;
  return ROADS.byClass[cls];
};
for (const w of tagged((t) => /^motorway/.test(t.highway))) {
  bandLine(simplify(pts(w.geometry), ROADS.simplify), 3, (x, y) => { tiles[x + y * GW] = T.FREEWAY; road[x + y * GW] = 0; });
}
// Narrow and minor first, so wide arterials win the street name where they cross.
ways.sort((a, b) => widthOf(a) - widthOf(b) || RANK[a.cls] - RANK[b.cls]);
for (const r of ways) {
  const n = r.name ? nameIdx(r.w.tags.name) : 0;
  bandLine(r.line, widthOf(r), (x, y) => {
    const i = x + y * GW;
    tiles[i] = T.ROAD;
    if (n || !road[i]) road[i] = n;
  });
}

// 3a. Landmarks: find each drawing a clear w×h spot as close to its address as possible,
// touching a street but never covering one.
const LANDMARKS = new URL('src/content/landmarksData.json', ROOT);
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
          if (inside && (t === T.ROAD || t === T.WATER || t === T.FREEWAY)) { clear = false; break; }
          if (!inside && t === T.ROAD) touches = true;
        }
      }
      const d = Math.hypot(dx, dy);
      if (clear && touches && (!best || d < best.d)) best = { x: x0, y: y0, d };
    }
  }
  if (!best) { console.warn(`landmark ${lm.id}: no clear spot near its address`); continue; }
  for (let y = best.y; y < best.y + lm.h; y++) for (let x = best.x; x < best.x + lm.w; x++) tiles[x + y * GW] = T.LANDMARK;
  landmarks.push({ id: lm.id, sprite: lm.sprite, name: lm.name, x: best.x, y: best.y, w: lm.w, h: lm.h });
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
const droppedNames = new Map();
for (let i = 0; i < tiles.length; i++) {
  if (tiles[i] === T.ROAD && comp[i] !== main) {
    if (road[i]) droppedNames.set(names[road[i] - 1], (droppedNames.get(names[road[i] - 1]) ?? 0) + 1);
    tiles[i] = T.LAND; road[i] = 0; dropped++;
  }
}
// Worth a look when it's large: a street cut off from the rest isn't walkable.
if (dropped > 50) console.warn(`  unreachable road tiles dropped: ${[...droppedNames].map(([n, c]) => `${n} (${c})`).join(', ') || 'unnamed'}`);

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
  landmarks,
  houseMode: PROCEDURAL ? 'procedural' : 'footprints',
};
writeFileSync(new URL('src/world/worldData.json', ROOT), JSON.stringify(out));
console.log(`${PROCEDURAL ? 'procedural houses' : `${houses} footprint houses`}, grid ${GW}x${GH}, ${buildings.length} buildings, ${shops.length} shops, ${names.length} street names, ${labels.length} labels, road components ${sizes.length} (dropped ${dropped} tiles)`);

// Preview PNG (1px per tile, scaled up).
const PAL = [[60, 140, 230], [120, 200, 90], [40, 140, 70], [240, 220, 140], [250, 250, 250], [150, 150, 160], [200, 90, 70], [200, 200, 205], [120, 120, 135], [220, 190, 150], [255, 120, 160], [255, 220, 0]];
const rgb = Buffer.alloc(GW * GH * 3);
for (let i = 0; i < tiles.length; i++) PAL[tiles[i]].forEach((v, k) => { rgb[i * 3 + k] = v; });
mkdirSync(new URL('screenshots/', ROOT), { recursive: true });
await sharp(rgb, { raw: { width: GW, height: GH, channels: 3 } })
  .resize(GW * 2, GH * 2, { kernel: 'nearest' }).png().toFile(new URL('screenshots/map-preview.png', ROOT).pathname);
