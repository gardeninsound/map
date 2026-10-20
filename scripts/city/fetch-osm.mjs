/**
 * Fetches raw West Seattle geography from OpenStreetMap (Overpass API, ODbL) into
 * data/osm/west-seattle.json. Run rarely; `build-map.mjs` turns it into the game grid.
 *
 * Usage: node scripts/city/fetch-osm.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';

// south, west, north, east
export const BBOX = [47.515, -122.425, 47.598, -122.345];
const TARGET = new URL('../../data/osm/west-seattle.json', import.meta.url);
mkdirSync(new URL('.', TARGET), { recursive: true }); // data/osm/ is gitignored, so a fresh clone lacks it
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const b = BBOX.join(',');
const query = `[out:json][timeout:180];(
way["highway"~"^((motorway|trunk|primary|secondary|tertiary)(_link)?|residential|unclassified|living_street)$"](${b});
way["natural"="coastline"](${b});
way["natural"="water"](${b});relation["natural"="water"](${b});
way["leisure"~"^(park|golf_course|nature_reserve)$"](${b});relation["leisure"="park"](${b});
way["natural"~"^(wood|beach)$"](${b});
way["amenity"~"^(school|place_of_worship|library|community_centre)$"](${b});
way["landuse"~"^(commercial|retail|industrial)$"](${b});
way["building"]["building"!~"^(garage|garages|shed|carport|hut|roof)$"](${b});
relation["building"]["type"="multipolygon"](${b});
node["shop"]["name"](${b});
node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|cinema|theatre|library|bank|pharmacy|fuel)$"]["name"](${b});
);out geom;`;

for (let attempt = 0, wait = 5; attempt < 10; attempt++, wait *= 2) {
  const url = ENDPOINTS[attempt % ENDPOINTS.length];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'bearisland-map/0.1' },
      body: 'data=' + encodeURIComponent(query),
    });
    const text = await res.text();
    if (res.ok && text.startsWith('{')) {
      writeFileSync(TARGET, text);
      console.log(`ok from ${url}: ${JSON.parse(text).elements.length} elements`);
      process.exit(0);
    }
    console.log(`attempt ${attempt} ${url}: ${res.status}`);
  } catch (e) {
    console.log(`attempt ${attempt} ${url}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, Math.min(wait, 120) * 1000));
}
console.error('gave up');
process.exit(1);
