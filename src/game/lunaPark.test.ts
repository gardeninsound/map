import { describe, expect, it } from 'vitest';
import { createWorld, type CityGame } from '../city';
import { LUNA_BRIDGE, LUNA_PIER, lunaRides, lunaWagon, type TileRect } from '../content/lunaPark';
import { LunaPark, elevation } from './plugins/lunaPark';

const world = createWorld();
const luna = new LunaPark();
luna.attach({ world } as CityGame);
const o = luna.origin;
const cells = (r: TileRect) =>
  Array.from({ length: r.w * r.h }, (_, i) => ({ x: o.x + r.x + (i % r.w), y: o.y + r.y + Math.floor(i / r.w) }));
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('Luna Park', () => {
  it('stands over the water off the tip of Duwamish Head, inside the map', () => {
    expect(o.y + LUNA_PIER.y).toBeGreaterThanOrEqual(0);
    // the pier is out in the bay: north of the shore, and the bridge lands on Alki Ave
    const below = cells({ ...LUNA_BRIDGE, y: LUNA_BRIDGE.y + 1 });
    expect(below.some((p) => world.streetAt(p.x + 0.5, p.y + 0.5)?.includes('Alki'))).toBe(true);
  });

  it('keeps its rides on the pier, apart, and its signs on the boardwalk', () => {
    const pier = new Set(cells(LUNA_PIER).map(key));
    const taken = new Set<string>();
    for (const r of lunaRides) {
      for (const b of r.blocks) {
        for (const c of cells(b)) {
          expect(pier.has(key(c)), `${r.id} off the pier at ${key(c)}`).toBe(true);
          expect(taken.has(key(c)), `${r.id} overlaps at ${key(c)}`).toBe(false);
          taken.add(key(c));
        }
      }
      expect(world.isWalkable(o.x + r.sign.x + 0.5, o.y + r.sign.y + 0.5), `${r.id}'s sign`).toBe(true);
    }
  });

  it('can all be walked to from Alki Ave, through the gate', () => {
    const start = cells(LUNA_BRIDGE)[0];
    const seen = new Set([key(start)]);
    const queue = [start];
    while (queue.length) {
      const p = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (seen.has(key(q)) || !world.isWalkable(q.x + 0.5, q.y + 0.5)) continue;
        seen.add(key(q));
        queue.push(q);
      }
    }
    // every boardwalk tile, and the street beyond the bridge
    for (const c of cells(LUNA_PIER)) if (world.isWalkable(c.x + 0.5, c.y + 0.5)) expect(seen.has(key(c)), key(c)).toBe(true);
    expect([...seen].some((k) => world.streetAt(+k.split(',')[0] + 0.5, +k.split(',')[1] + 0.5)?.includes('Alki'))).toBe(true);
    expect(world.streetAt(o.x + 0.5, o.y + LUNA_PIER.y + 5.5)).toBe('Luna Park');
  });

  it('drives Uncle Hiram\'s wagon along the street in front, never off it', () => {
    const r = lunaWagon.route;
    for (let i = 1; i < r.length; i++) {
      for (let k = 0; k <= 1; k += 0.1) {
        const x = o.x + r[i - 1].x + (r[i].x - r[i - 1].x) * k;
        const y = o.y + r[i - 1].y + (r[i].y - r[i - 1].y) * k;
        expect(world.isWalkable(x, y), `route at ${x.toFixed(1)},${y.toFixed(1)}`).toBe(true);
      }
    }
    expect(r.some((p) => world.streetAt(o.x + p.x, o.y + p.y)?.includes('Alki'))).toBe(true);
  });

  it('has a Figure Eight whose loops cross at different heights', () => {
    // the loops cross at s = 0 and s = π: low by the station, high mid-ride
    expect(elevation(Math.PI) - elevation(0)).toBeGreaterThan(8);
    // nothing after the lift goes higher than its top
    const top = elevation(0.7);
    for (let s = 0.71; s < Math.PI * 2; s += 0.05) expect(elevation(s)).toBeLessThanOrEqual(top);
  });
});
