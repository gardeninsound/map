import { describe, expect, it } from 'vitest';
import { createWorld, fits, rng } from '../city';
import { hamHome, hamLines } from '../content/ham';
import { HAM, hamChoices, hamTick, newHam } from './ham';
import { hamGrids } from './sprites';

const world = createWorld();
const p = world.project(hamHome.lat, hamHome.lon);
const home = world.nearestWalkable(p.x, p.y);

describe('Ham the cat', () => {
  it('lives on the street in front of the hidden house', () => {
    expect(Math.hypot(home.x - p.x, home.y - p.y)).toBeLessThan(3);
    expect(world.streetAt(home.x, home.y)).toBe('45th Ave SW');
  });

  it('wanders the neighborhood, on walkable ground and on the leash', () => {
    const s = newHam(home);
    const rand = rng(1);
    const seen = new Set<string>();
    let far = 0;
    for (let i = 0; i < 20 * 60 * 10; i++) {
      hamTick(s, 1 / 20, home, null, world.isWalkable, rand);
      expect(fits(s.pos.x, s.pos.y, world.isWalkable)).toBe(true);
      const d = Math.hypot(s.pos.x - home.x, s.pos.y - home.y);
      far = Math.max(far, d);
      seen.add(`${Math.floor(s.pos.x)},${Math.floor(s.pos.y)}`);
    }
    expect(far).toBeLessThan(HAM.leash + 1.5);
    expect(far).toBeGreaterThan(HAM.leash / 2);
    expect(seen.size).toBeGreaterThan(15);
  });

  it('gets into the alley behind the house', () => {
    const rand = rng(3);
    const s = newHam(home);
    let alley = false;
    for (let i = 0; i < 20 * 60 * 30 && !alley; i++) {
      hamTick(s, 1 / 20, home, null, world.isWalkable, rand);
      alley = world.streetAt(s.pos.x, s.pos.y) === 'Alley';
    }
    expect(alley).toBe(true);
  });

  it('past the leash, only turns back toward home', () => {
    const out = { x: home.x, y: home.y + HAM.leash + 2 };
    const pos = world.nearestWalkable(out.x, out.y);
    if (Math.hypot(pos.x - home.x, pos.y - home.y) <= HAM.leash) return;
    for (const d of hamChoices(pos, home, world.isWalkable)) expect(d.x * (home.x - pos.x) + d.y * (home.y - pos.y)).toBeGreaterThan(0);
  });

  it('sits down and looks at a rabbit that comes close', () => {
    const s = newHam(home);
    s.mode = 'walk';
    s.dir = { x: 0, y: 1 };
    hamTick(s, 0.1, home, { x: s.pos.x - 1, y: s.pos.y }, world.isWalkable, rng(2));
    expect(s.mode).toBe('sit');
    expect(s.side).toBe('left');
    const at = { ...s.pos };
    hamTick(s, 0.5, home, { x: s.pos.x - 1, y: s.pos.y }, world.isWalkable, rng(2));
    expect(s.pos).toEqual(at);
  });

  it('has lines for every visit and a sprite on the 16 px grid', () => {
    expect(hamLines.length).toBeGreaterThan(1);
    for (const l of hamLines) expect(l.length).toBeGreaterThan(0);
    const grids = [hamGrids.sit, hamGrids.groom, ...hamGrids.strides.map((legs) => [...hamGrids.head, ...legs])];
    for (const g of grids) for (const row of g) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(ch === '.' || ch in hamGrids.colors, ch).toBe(true);
    }
  });
});
