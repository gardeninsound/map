// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySite, checkSite } from './sites.mjs';

const T = { LAWN: 12, ROAD: 4 };
const siteDir = new URL('./sites/', import.meta.url);
const sites = readdirSync(siteDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, siteDir), 'utf8')));
const world = JSON.parse(readFileSync(new URL('../../src/city/world/worldData.json', import.meta.url), 'utf8'));

/** a 10×10 test map where one tile is 1° (easy sums) */
function testMap() {
  const names = [];
  return {
    tiles: new Uint8Array(100),
    road: new Uint16Array(100),
    w: 10,
    h: 10,
    T,
    toX: (lon) => lon,
    toY: (lat) => -lat,
    names,
    nameIdx: (n) => (names.includes(n) ? names.indexOf(n) : names.push(n) - 1) + 1,
  };
}
const tiny = {
  id: 'tiny',
  name: 'Tiny Field',
  tileMeters: 12,
  anchor: { lat: -2, lon: 3 },
  grid: ['lw.', 'Wn.'],
  tag: { site: 'tiny' },
  label: { lat: -2.5, lon: 4, size: 6 },
  roadLines: [{ w: 0.5, k: 1, p: [[-2, 3], [-2, 5]] }],
  features: [{ k: 'pitch', s: '', rings: [[[-2, 3], [-3, 3], [-3, 4]]], n: 1 }],
};

describe('sites', () => {
  it('draws a site: lawn, walkable, its name in the HUD, and its lines, features and label', () => {
    const m = testMap();
    const out = applySite(tiny, m);
    const at = (x, y) => [m.tiles[x + y * 10], m.road[x + y * 10]];
    expect(at(3, 2)).toEqual([T.LAWN, 0]);
    expect(at(4, 2)).toEqual([T.ROAD, 1]);
    expect(at(3, 3)).toEqual([T.ROAD, 0]);
    expect(at(4, 3)).toEqual([0, 1]);
    expect(at(5, 2)).toEqual([0, 0]);
    expect(m.names).toEqual(['Tiny Field']);
    expect(out.cells).toBe(4);
    expect(out.roadLines).toEqual([{ w: 0.5, k: 1, p: [[3, 2], [5, 2]], site: 'tiny' }]);
    expect(out.features[0]).toMatchObject({ k: 'pitch', rings: [[[3, 2], [3, 3], [4, 3]]], site: 'tiny' });
    expect(out.label).toEqual({ name: 'Tiny Field', kind: 'park', x: 4, y: 2.5, size: 6 });
  });

  it('refuses a site drawn for another tile size, a ragged grid or an unknown cell', () => {
    expect(checkSite(tiny, 12)).toEqual([]);
    expect(checkSite(tiny, 10)[0]).toMatch(/12 m tiles, the map uses 10 m/);
    expect(checkSite({ ...tiny, grid: ['ll', 'l'] }, 12)[0]).toMatch(/same length/);
    expect(checkSite({ ...tiny, grid: ['lx'] }, 12)[0]).toMatch(/unknown grid cells: x/);
    expect(() => applySite({ ...tiny, anchor: { lat: -9, lon: 9 } }, testMap())).toThrow(/outside the map/);
  });

  it('every site file is valid', () => {
    expect(sites.length).toBeGreaterThan(0);
    for (const s of sites) expect(checkSite(s, world.tileMeters)).toEqual([]);
  });

  // The guard: worldData.json is generated, so a site missing from it means it was rebuilt
  // without the site (or hand-edited away). Run `npm run map` to put it back.
  it('the committed map has every site in it', () => {
    for (const s of sites) {
      expect(world.names, s.id).toContain(s.name);
      if (s.label) expect(world.labels.some((l) => l.name === s.name), s.id).toBe(true);
      const tagKey = Object.keys(s.tag ?? {})[0];
      if (tagKey) {
        expect(world.parkFeatures.filter((f) => f[tagKey] === s.tag[tagKey]), s.id).toHaveLength(s.features?.length ?? 0);
        expect(world.roadLines.filter((r) => r[tagKey] === s.tag[tagKey]), s.id).toHaveLength(s.roadLines?.length ?? 0);
      }
    }
  });
});
