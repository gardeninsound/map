import { createWorld, Tile } from '../city';
import { PONY_MEADOW, ponies } from '../content/ponies';
import { LEASH, newPony, ponyTick } from './ponies';
import { PONY_GRIDS } from './ponySprites';

let seed = 9;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('the meadow ponies', () => {
  const w = createWorld();
  const home = w.project(PONY_MEADOW.lat, PONY_MEADOW.lon);
  const suits = (x: number, y: number) => w.tileAt(Math.floor(x), Math.floor(y)) === Tile.Lawn || w.isWalkable(x, y);

  it('graze in a meadow with a trail to walk up on', () => {
    expect(suits(home.x, home.y)).toBe(true);
    let trail = false;
    for (let dy = -LEASH; dy <= LEASH; dy++) for (let dx = -LEASH; dx <= LEASH; dx++) trail ||= w.isWalkable(home.x + dx, home.y + dy);
    expect(trail).toBe(true);
  });

  it('wander the meadow, never off it or far from home', () => {
    const p = newPony(home, rand);
    let trotted = 0;
    for (let t = 0; t < 300; t += 0.1) {
      ponyTick(p, 0.1, home, suits, rand);
      if (p.to) trotted++;
      expect(suits(p.pos.x, p.pos.y)).toBe(true);
      expect(Math.hypot(p.pos.x - home.x, p.pos.y - home.y)).toBeLessThanOrEqual(LEASH + 0.01);
    }
    expect(trotted).toBeGreaterThan(20);
  });

  it('stand still while you talk', () => {
    const p = newPony(home, rand);
    const at = { ...p.pos };
    for (let t = 0; t < 20; t += 0.1) ponyTick(p, 0.1, home, suits, rand, true);
    expect(p.pos).toEqual(at);
  });

  it('each has a name and something to say', () => {
    for (const p of ponies) expect(p.lines.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(PONY_GRIDS))('the %s sprite is 20×16', (_, g) => {
    expect(g).toHaveLength(16);
    for (const row of g) expect(row).toHaveLength(20);
  });
});
