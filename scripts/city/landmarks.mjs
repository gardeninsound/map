/**
 * content/landmarks.csv (hand-drawn buildings) → src/city/world/landmarksData.json, which
 * build-map.mjs reads to clear each drawing a spot beside its street. Geocoding + CSV
 * handling: scripts/sheet.mjs.
 *
 * Columns: id, name, sprite (a drawing in src/city/render/landmarks.ts), address or lat/lon,
 * w/h (size in tiles), street (optional E or W: the side its frontage faces; the renderer
 * pulls the drawing flush with that street's sidewalk).
 *
 * Usage: node scripts/city/landmarks.mjs   (or `npm run map`, which runs it first)
 */
import { writeFileSync } from 'node:fs';
import { processSheet } from '../sheet.mjs';

const rows = await processSheet(new URL('../../content/landmarks.csv', import.meta.url));
const out = rows.map((r) => ({
  id: r.id,
  name: r.name,
  sprite: r.sprite || r.id,
  lat: +r.lat,
  lon: +r.lon,
  w: +r.w || 3,
  h: +r.h || 3,
  ...(r.street ? { street: r.street } : {}),
}));
writeFileSync(new URL('../../src/city/world/landmarksData.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} landmarks → src/city/world/landmarksData.json`);
