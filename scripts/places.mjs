/**
 * The art-spot spreadsheet → the game.
 *
 *   content/places.csv  (edit in Numbers / Excel / Google Sheets, export back as CSV)
 *     → geocodes any row whose `address` changed (OpenStreetMap Nominatim, ≤1 req/s)
 *     → writes lat / lon / status / geocoded_match back into the CSV
 *     → writes src/content/placesData.json, which locations.ts reads
 *
 * Position precedence per row: address (geocoded) › lat+lon typed by hand › previous value.
 * Clear `geocoded_from` (or change `address`) to force a re-lookup.
 *
 * Usage: npm run places
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const CSV = new URL('content/places.csv', ROOT);
const OUT = new URL('src/content/placesData.json', ROOT);
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

const { head, records } = parseCsv(readFileSync(CSV, 'utf8'));
for (const col of ['lat', 'lon', 'status', 'geocoded_from', 'geocoded_match']) if (!head.includes(col)) head.push(col);

let looked = 0;
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
writeFileSync(CSV, toCsv(head, records));

const places = records
  .filter((r) => r.lat && r.lon)
  .map((r) => ({
    id: r.id,
    name: r.name,
    where: r.where,
    lat: +r.lat,
    lon: +r.lon,
    approx: r.status === 'approx',
    set: r.set,
    ...(r.experience ? { experience: r.experience } : {}),
    greeting: r.greeting.split('|').map((s) => s.trim()).filter(Boolean),
  }));
writeFileSync(OUT, JSON.stringify(places, null, 1) + '\n');
const missing = records.filter((r) => !(r.lat && r.lon)).map((r) => r.id);
console.log(`${places.length} places → src/content/placesData.json${missing.length ? ` (skipped, no position: ${missing.join(', ')})` : ''}`);
