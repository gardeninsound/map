/**
 * The rowboat at the end of 58th Ave SW on Alki (pure, tested): a little wooden dock runs from
 * where 58th meets Alki Ave, across the park and the sand, out to the water, and the boat is
 * tied up at its end. Climb in and you row on the water only; row up to the dock (or anywhere
 * walkable ground is right beside you) to climb out. Drawn by plugins/rowboat.ts.
 */
import { Tile, type Vec, type World } from '../city';

/** the street whose end the dock starts from */
export const DOCK_STREET = '58th Ave SW';
/** tiles a second, rowing (the rabbit walks 8) */
export const BOAT_SPEED = 3.5;
/** left this far from you, the boat drifts home to the dock */
export const BOAT_HOME = 50;
/** how close walkable ground must be to climb out (tiles) */
export const SHORE_REACH = 1.6;

type Ground = Pick<World, 'w' | 'h' | 'tileAt' | 'isWalkable' | 'roads' | 'names'>;

const inside = (world: Ground, x: number, y: number) => x >= 0.5 && y >= 0.5 && x < world.w - 0.5 && y < world.h - 0.5;

/** Open water you can row on: water tiles inside the map (the sea beyond the map's edge isn't). */
export const canRow = (world: Ground, x: number, y: number) =>
  inside(world, x, y) && world.tileAt(Math.floor(x), Math.floor(y)) === Tile.Water;

/** The northernmost tile of a street: for 58th, where it meets Alki Ave by the beach. */
export function streetEnd(world: Ground, name: string): Vec | null {
  const id = world.names.indexOf(name) + 1;
  if (!id) return null;
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (world.roads[x + y * world.w] === id) return { x, y };
  return null;
}

/**
 * The dock: from the end of the street, west along two rows, across whatever isn't road
 * (park, sand) until the water. Returns its tiles and where the boat ties up (the first water
 * tile past its end), or null if there's no water that way within reach.
 */
export function layDock(world: Ground, end: Vec, reach = 20): { tiles: Vec[]; mooring: Vec } | null {
  const tiles: Vec[] = [];
  let mooring: Vec | null = null;
  for (const y of [end.y - 1, end.y]) {
    let x = end.x;
    // across the road first (Alki Ave), then lay planks until the water
    while (x > end.x - reach && world.isWalkable(x + 0.5, y + 0.5)) x--;
    for (; x > end.x - reach; x--) {
      if (world.tileAt(x, y) === Tile.Water) {
        // tie up beside the lower row's end
        if (y === end.y || !mooring) mooring = { x: x + 0.5, y: y + 0.5 };
        break;
      }
      tiles.push({ x, y });
    }
  }
  return mooring && tiles.length ? { tiles, mooring } : null;
}

/** Somewhere to climb out onto from a boat at `at`: the nearest walkable point within SHORE_REACH. */
export function shoreNear(world: Ground, at: Vec): Vec | null {
  let best: Vec | null = null;
  let bestD = SHORE_REACH;
  for (let dy = -2; dy <= 2; dy += 0.5)
    for (let dx = -2; dx <= 2; dx += 0.5) {
      const p = { x: Math.floor(at.x + dx) + 0.5, y: Math.floor(at.y + dy) + 0.5 };
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d < bestD && world.isWalkable(p.x, p.y)) [best, bestD] = [p, d];
    }
  return best;
}
