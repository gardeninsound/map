import { describe, expect, it, vi } from 'vitest';
import { cellsIn, oncePerWorld, solid, walkway } from './edit';
import { Tile } from './world';

const grid = (w = 4, h = 3) => ({ w, h, tiles: new Uint8Array(w * h).fill(Tile.Park), roads: new Uint16Array(w * h), names: ['California Ave SW'] });

describe('changing the map from a plugin', () => {
  it('a walkway: walkable, named once (running it twice reuses the name), off-map cells skipped', () => {
    const g = grid();
    const id = walkway(g, 'Luna Park', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 9, y: 9 }]);
    expect(id).toBe(2);
    expect(g.names).toEqual(['California Ave SW', 'Luna Park']);
    expect([g.tiles[0], g.tiles[1], g.tiles[2]]).toEqual([Tile.Road, Tile.Road, Tile.Park]);
    expect([g.roads[0], g.roads[1]]).toEqual([2, 2]);
    expect(walkway(g, 'Luna Park', cellsIn(2, 0, 1, 1))).toBe(2);
    expect(g.names).toHaveLength(2);
  });

  it('solid ground, optionally only over one kind of tile', () => {
    const g = grid();
    g.tiles[1] = Tile.Road;
    solid(g, cellsIn(0, 0, 2, 1), { only: Tile.Park });
    expect([g.tiles[0], g.tiles[1]]).toEqual([Tile.Landmark, Tile.Road]);
    solid(g, cellsIn(-2, -2, 30, 30)); // past every edge: no throw, only the map changes
    expect([...g.tiles].every((t) => t === Tile.Landmark)).toBe(true);
  });

  it('once per map', () => {
    const world = {};
    const make = vi.fn(() => ({ dock: 1 }));
    const a = oncePerWorld(world, 'dock', make);
    expect(oncePerWorld(world, 'dock', make)).toBe(a);
    expect(make).toHaveBeenCalledTimes(1);
    oncePerWorld({}, 'dock', make);
    oncePerWorld(world, 'maze', make);
    expect(make).toHaveBeenCalledTimes(3);
  });
});
