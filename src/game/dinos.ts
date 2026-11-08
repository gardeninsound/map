/**
 * Toy dinosaurs walking west along West Seattle's east–west streets (pure, tested). A few are
 * always somewhere near you: each walks west along its "SW … St" until the street ends or
 * it's far behind you, then turns up on another east–west street nearby, out of sight.
 * Tiles as on the map (x east, y south). Drawn by plugins/dinos.ts.
 */
import type { Vec } from '../city';

/** how many are out at once */
export const DINO_COUNT = 2;
/** tiles a second: an unhurried plod (the rabbit walks 8) */
export const DINO_SPEED = 1.6;
/** a new one turns up this far from you: past the edge of the screen, not too far to meet */
export const SPAWN = { min: 18, max: 50 };
/** this far away and it's gone: it turns up somewhere nearer */
export const FAR = 70;
/** it's heard going by once it's this close (tiles), once per pass */
export const HEAR = 6;
/** never two at once: seconds after one plays before another can */
export const HEAR_GAP = 6;
/** the sound it makes going by (public/) */
export const DINO_SOUND = 'sounds/dinosaur.mp3';
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
  /** already heard on this pass (cleared when it turns up somewhere new) */
  heard?: boolean;
}

/**
 * Should this one be heard now? Once it comes within HEAR of you, once per pass, and only if
 * no other has been heard in the last HEAR_GAP seconds (`sinceLast`). Marks it heard.
 */
export function hearDino(d: Dino, you: Vec, sinceLast: number): boolean {
  if (d.heard || sinceLast < HEAR_GAP) return false;
  if (Math.hypot(d.pos.x - you.x, d.pos.y - you.y) > HEAR) return false;
  d.heard = true;
  return true;
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

/** A spot on an east–west street, SPAWN tiles from `around` (null if it can't find one). */
export function spawnSpot(world: Streets, around: Vec, rand: () => number): Vec | null {
  for (let tries = 0; tries < 300; tries++) {
    const a = rand() * Math.PI * 2;
    const r = SPAWN.min + rand() * (SPAWN.max - SPAWN.min);
    const x = Math.floor(around.x + Math.cos(a) * r) + 0.5;
    const y = Math.floor(around.y + Math.sin(a) * r) + 0.5;
    if (x < 1 || y < 1 || x > world.w - 2 || y > world.h - 2) continue;
    const spot = eastWestSpot(world, x, y);
    if (spot) return spot;
  }
  return null;
}

/**
 * Walk west for `dt` seconds. At the end of the street (no road ahead), or once far behind
 * you, it turns up on another east–west street near you instead. Returns true if it moved there.
 */
export function stepDino(d: Dino, dt: number, world: Streets, you: Vec, rand: () => number): boolean {
  const next = d.pos.x - DINO_SPEED * dt;
  const far = Math.hypot(d.pos.x - you.x, d.pos.y - you.y) > FAR;
  // its nose is about a tile and a half ahead of its middle
  if (!far && world.isWalkable(next - 1.5, d.pos.y)) {
    d.pos = { x: next, y: d.pos.y };
    return false;
  }
  const spot = spawnSpot(world, you, rand);
  if (spot) d.pos = spot;
  d.heard = false;
  return true;
}
