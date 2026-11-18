/**
 * Toy dinosaurs walking west along West Seattle's east–west streets (pure, tested). A sighting
 * now and then, not a crowd: every few minutes one turns up just off the east edge of the
 * screen on a "SW … St" in view, walks west across it, and is gone when its street ends or
 * it's well behind you. Tiles as on the map (x east, y south). Drawn by plugins/dinos.ts.
 */
import type { Vec } from '../city';

/** seconds before the first sighting of a visit, then between one leaving and the next */
export const FIRST = { min: 30, max: 90 };
export const BETWEEN = { min: 120, max: 300 };
/** no street to walk in view right now: look again this many seconds later */
export const RETRY = 5;
/** tiles a second: an unhurried plod (the rabbit walks 8) */
export const DINO_SPEED = 1.6;
/** it turns up this many tiles east of you (the screen is ~14 tiles either side on a laptop) */
export const EAST = { min: 16, max: 24 };
/** on a street this many rows above or below you, so it crosses the screen */
export const ROWS = 6;
/** this far away and it's gone */
export const FAR = 40;
/** the street must run on at least this far either side (tiles) to count as east–west here */
const RUN = 5;

export interface Streets {
  w: number;
  h: number;
  isWalkable(x: number, y: number): boolean;
  streetAt(x: number, y: number): string | null;
}

export interface Dino {
  pos: Vec;
  /** seconds, so they don't all step in time */
  phase: number;
}

/** West Seattle's east–west streets are the "SW … St"s; avenues ("… Ave SW") run north–south. */
export const isEastWestName = (name: string | null) => !!name && /\bSt\b/.test(name);

/**
 * Is there an east–west street here to walk west along? On an "St", with walkable road
 * running on to the east and west at this row. Returns the spot moved to the middle of the
 * road's width (so it walks down the middle), or null.
 */
export function eastWestSpot(world: Streets, x: number, y: number): Vec | null {
  if (!world.isWalkable(x, y) || !isEastWestName(world.streetAt(x, y))) return null;
  for (let d = 1; d <= RUN; d++) if (!world.isWalkable(x - d, y) || !world.isWalkable(x + d, y)) return null;
  // the road's width here: walk up and down while it's walkable
  let top = y;
  let bottom = y;
  while (top - y > -4 && world.isWalkable(x, top - 0.5)) top -= 0.5;
  while (bottom - y < 4 && world.isWalkable(x, bottom + 0.5)) bottom += 0.5;
  // too wide to be a street (a parking lot, a plaza)
  if (bottom - top > 4) return null;
  return { x, y: (top + bottom) / 2 + 0.25 };
}

/** Seconds until the next sighting, between `w.min` and `w.max`. */
export const waitFor = (w: { min: number; max: number }, rand: () => number) => w.min + rand() * (w.max - w.min);

/**
 * A spot just off the east edge of the screen on an east–west street in view, so the dino
 * walks west across it (null if there's no such street near you).
 */
export function sightingSpot(world: Streets, you: Vec, rand: () => number): Vec | null {
  for (let tries = 0; tries < 200; tries++) {
    const x = Math.floor(you.x + EAST.min + rand() * (EAST.max - EAST.min)) + 0.5;
    const y = Math.floor(you.y - ROWS + rand() * ROWS * 2) + 0.5;
    if (x < 1 || y < 1 || x > world.w - 2 || y > world.h - 2) continue;
    const spot = eastWestSpot(world, x, y);
    if (spot) return spot;
  }
  return null;
}

/**
 * Walk west for `dt` seconds. Returns false once it's done: at the end of the street (no road
 * ahead) or `FAR` from you.
 */
export function stepDino(d: Dino, dt: number, world: Streets, you: Vec): boolean {
  const next = d.pos.x - DINO_SPEED * dt;
  if (Math.hypot(d.pos.x - you.x, d.pos.y - you.y) > FAR) return false;
  // its nose is about a tile and a half ahead of its middle
  if (!world.isWalkable(next - 1.5, d.pos.y)) return false;
  d.pos = { x: next, y: d.pos.y };
  return true;
}
