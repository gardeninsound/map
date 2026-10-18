/**
 * The spreadsheets → the game.
 *
 *   content/places.csv     art spots   → src/content/placesData.json    (locations.ts)
 *   content/landmarks.csv  drawn buildings (76 station, Admiral Theatre…)
 *                                      → src/content/landmarksData.json (build-map.mjs)
 *
 * Edit in Numbers / Excel / Google Sheets and save back as CSV. For each sheet this
 *   → geocodes any row whose `address` changed (OpenStreetMap Nominatim, ≤1 req/s)
 *   → writes lat / lon / status / geocoded_match back into the CSV
 *   → writes the JSON the game reads
 *
 * Position precedence per row: address (geocoded) › lat+lon typed by hand › previous value.
 * Clear `geocoded_from` (or change `address`) to force a re-lookup.
 *
 * Usage: npm run places
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
// West Seattle, for biasing and sanity-checking results: west, north, east, south
const VIEWBOX = [-122.43, 47.6, -122.34, 47.51];

// ── CSV (RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes) ──
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [head, ...body] = rows;
  return { head, records: body.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (head, records) => [head.join(','), ...records.map((r) => head.map((h) => cell(r[h] ?? '')).join(','))].join('\n') + '\n';

async function geocode(address) {
  const q = /seattle/i.test(address) ? address : `${address}, Seattle, WA`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=${VIEWBOX.join(',')}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'bearisland-map/0.1 (art map build script)' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [hit] = await res.json();
  return hit ? { lat: +hit.lat, lon: +hit.lon, match: hit.display_name } : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let looked = 0;

/** Geocode one sheet in place and return its records. */
async function processSheet(csvPath) {
  const csv = new URL(csvPath, ROOT);
  const { head, records } = parseCsv(readFileSync(csv, 'utf8'));
  for (const col of ['lat', 'lon', 'status', 'geocoded_from', 'geocoded_match']) if (!head.includes(col)) head.push(col);
  for (const r of records) {
    if (r.address && r.address !== r.geocoded_from) {
      if (looked++) await sleep(1100); // Nominatim usage policy: max 1 request / second
      const hit = await geocode(r.address).catch((e) => (console.warn(`  ${r.id}: ${e.message}`), null));
      if (hit) {
        Object.assign(r, { lat: hit.lat.toFixed(6), lon: hit.lon.toFixed(6), status: 'geocoded', geocoded_from: r.address, geocoded_match: hit.match });
        console.log(`✓ ${r.id}: ${hit.match}`);
      } else {
        console.warn(`✗ ${r.id}: no match for "${r.address}" — try a street address, or type lat/lon and clear the address`);
      }
    } else if (!r.address && r.lat && r.lon && r.status === 'geocoded') {
      r.status = 'manual'; // address removed, coordinates kept by hand
    }
    if (!r.status) r.status = r.lat && r.lon ? 'manual' : 'missing';
  }
  writeFileSync(csv, toCsv(head, records));
  const missing = records.filter((r) => !(r.lat && r.lon)).map((r) => r.id);
  if (missing.length) console.log(`  ${csvPath}: skipped (no position): ${missing.join(', ')}`);
  return records.filter((r) => r.lat && r.lon);
}

const write = (path, data) => {
  writeFileSync(new URL(path, ROOT), JSON.stringify(data, null, 1) + '\n');
  console.log(`${data.length} rows → ${path}`);
};

write(
  'src/content/placesData.json',
  (await processSheet('content/places.csv')).map((r) => ({
    id: r.id,
    name: r.name,
    where: r.where,
    lat: +r.lat,
    lon: +r.lon,
    approx: r.status === 'approx',
    set: r.set,
    ...(r.experience ? { experience: r.experience } : {}),
    greeting: r.greeting.split('|').map((s) => s.trim()).filter(Boolean),
  })),
);

// Landmarks: `w`/`h` are the drawing's size in tiles; `sprite` picks the art in
// src/game/render/landmarks.ts. build-map.mjs finds them a spot beside the street.
write(
  'src/content/landmarksData.json',
  (await processSheet('content/landmarks.csv')).map((r) => ({
    id: r.id,
    name: r.name,
    sprite: r.sprite || r.id,
    lat: +r.lat,
    lon: +r.lon,
    w: +r.w || 3,
    h: +r.h || 3,
  })),
);
