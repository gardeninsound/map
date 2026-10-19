/**
 * content/places.csv (the art spots) → src/content/placesData.json (locations.ts).
 * Geocoding + CSV handling come from west-seattle-map's shared sheet helpers; see there
 * for the column conventions. Landmarks (drawn buildings) live in west-seattle-map.
 *
 * Usage: npm run places
 */
import { writeFileSync } from 'node:fs';
import { processSheet } from 'west-seattle-map/scripts/sheet.mjs';

const rows = await processSheet(new URL('../content/places.csv', import.meta.url));
const out = rows.map((r) => ({
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
writeFileSync(new URL('../src/content/placesData.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} places → src/content/placesData.json`);
