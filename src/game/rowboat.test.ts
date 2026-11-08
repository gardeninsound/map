import { createWorld, Tile } from '../city';
import { canRow, DOCK_STREET, layDock, shoreNear, streetEnd } from './rowboat';
import { Rowboat } from './plugins/rowboat';
import type { CityGame } from '../city';

describe('the rowboat at the end of 58th', () => {
  const world = createWorld();
  const end = streetEnd(world, DOCK_STREET)!;

  it('finds where 58th Ave SW ends on Alki', () => {
    expect(end).not.toBeNull();
    expect(world.streetAt(end.x + 0.5, end.y + 0.5)).toMatch(/58th|Alki/);
  });

  it('lays a dock from the street to the water, the boat tied up on the water at its end', () => {
    const dock = layDock(world, end)!;
    expect(dock).not.toBeNull();
    expect(dock.tiles.length).toBeGreaterThan(2);
    for (const t of dock.tiles) expect(world.tileAt(t.x, t.y)).not.toBe(Tile.Water);
    expect(canRow(world, dock.mooring.x, dock.mooring.y)).toBe(true);
  });

  it('once in place, you can walk out the dock and climb into the boat from its end', () => {
    const w = createWorld();
    const boat = new Rowboat();
    boat.attach({ world: w } as CityGame);
    // every dock tile is walkable, and joined to the street
    for (const t of boat.dock) expect(w.isWalkable(t.x + 0.5, t.y + 0.5)).toBe(true);
    // the boat is in reach of the dock: you can climb out right back onto it
    expect(shoreNear(w, boat.boat)).not.toBeNull();
  });

  it('a second game on the same map finds the same dock (React starts it twice in dev)', () => {
    const w = createWorld();
    const a = new Rowboat();
    a.attach({ world: w } as CityGame);
    const b = new Rowboat();
    b.attach({ world: w } as CityGame);
    expect(b.dock).toEqual(a.dock);
    expect(b.mooring).toEqual(a.mooring);
  });

  it('rows only on the water, and only inside the map', () => {
    expect(canRow(world, end.x + 0.5, end.y + 0.5)).toBe(false); // the street
    const dock = layDock(world, end)!;
    expect(canRow(world, dock.mooring.x - 3, dock.mooring.y)).toBe(true); // out on the Sound
    expect(canRow(world, 0.2, dock.mooring.y)).toBe(false); // off the map's edge
  });

  it('has nowhere to climb out in open water', () => {
    const dock = layDock(world, end)!;
    expect(shoreNear(world, { x: dock.mooring.x - 8, y: dock.mooring.y - 8 })).toBeNull();
  });
});
