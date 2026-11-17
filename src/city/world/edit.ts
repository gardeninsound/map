/**
 * Changing the map when a plugin starts: a named walkway (the rowboat's dock, the forest maze, Luna
 * Park's pier), ground made solid (Luna's rides, the boxing ring, the garden's beds), and work done
 * once per map. React's dev double start makes two games on one map, so each of these is safe to
 * run twice; cells off the map are skipped.
 *
 * Plugins change tiles in the order `createIsland` lists them (src/game/plugins/index.ts): one
 * that needs another's ground (the mermaids, the rowboat's dock) comes after it.
 */
import { Tile, type TileCode, type World } from './world';

type Cell = { x: number; y: number };
type Grid = Pick<World, 'w' | 'h' | 'tiles'>;

const inside = (w: Grid, x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w.w && y < w.h;

/** the cells of a w×h rectangle with its top-left at (x, y) */
export function* cellsIn(x: number, y: number, w: number, h: number): Generator<Cell> {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) yield { x: xx, y: yy };
}

/**
 * These cells become walkable ground under a street sign, `name` (added once: running it again,
 * or a street already called that, reuses its id). Returns the street id (`world.roads`' value).
 */
export function walkway(world: Pick<World, 'w' | 'h' | 'tiles' | 'roads' | 'names'>, name: string, cells: Iterable<Cell>): number {
  let id = world.names.indexOf(name) + 1;
  if (!id) id = world.names.push(name);
  for (const { x, y } of cells) {
    if (!inside(world, x, y)) continue;
    world.tiles[x + y * world.w] = Tile.Road;
    world.roads[x + y * world.w] = id;
  }
  return id;
}

/** These cells become solid (drawn by the plugin; nobody walks through). `only` keeps it to cells now of that kind. */
export function solid(world: Grid, cells: Iterable<Cell>, { tile = Tile.Landmark, only }: { tile?: TileCode; only?: TileCode } = {}) {
  for (const { x, y } of cells) {
    if (!inside(world, x, y)) continue;
    const i = x + y * world.w;
    if (only === undefined || world.tiles[i] === only) world.tiles[i] = tile;
  }
}

const done = new WeakMap<object, Map<string, unknown>>();
/** `make()` once per map and `key`; later calls (a second game on the same map) get the same result */
export function oncePerWorld<T>(world: object, key: string, make: () => T): T {
  let m = done.get(world);
  if (!m) done.set(world, (m = new Map()));
  if (!m.has(key)) m.set(key, make());
  return m.get(key) as T;
}
