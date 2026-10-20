/**
 * Downloads the detail inside each place listed in DETAILED.places (scripts/map-config.mjs):
 * footpaths and steps, parking lots and their aisles, pitches, tracks, playgrounds, pools,
 * bleachers → data/osm/detail.json, which build-map.mjs reads alongside west-seattle.json.
 *
 * Usage: node scripts/fetch-detail.mjs   (Overpass is often busy; it retries)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { DETAILED } from './map-config.mjs';

const TARGET = new URL('../data/osm/detail.json', import.meta.url);
mkdirSync(new URL('.', TARGET), { recursive: true });
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const parts = DETAILED.places.map(({ bbox }) => {
  const b = bbox.join(',');
  return `way["highway"~"^(footway|path|steps|pedestrian|cycleway)$"](${b});
way["leisure"~"^(pitch|track|playground|swimming_pool|bleachers)$"](${b});
relation["leisure"~"^(pitch|track)$"](${b});
way["amenity"="parking"](${b});
way["service"="parking_aisle"](${b});`;
});
const query = `[out:json][timeout:120];(${parts.join('\n')});out geom;`;

for (let attempt = 0, wait = 5; attempt < 8; attempt++, wait *= 2) {
  const url = ENDPOINTS[attempt % ENDPOINTS.length];
  try {
    const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'bearisland-map' } });
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    const n = JSON.parse(text).elements.length;
    writeFileSync(TARGET, text);
    console.log(`ok from ${url}: ${n} elements → data/osm/detail.json`);
    process.exit(0);
  } catch (e) {
    console.warn(`attempt ${attempt} ${url}: ${e.message}`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}
process.exit(1);
