/**
 * Birds about the island (pure, tested): crows on the streets and gulls on the beaches.
 * A few of each (`CROWS`, `GULLS`) are always somewhere near you, pecking about; come too close and one
 * takes off and lands a way off, away from you. Left far behind, a bird turns up again
 * near you, out of sight. The plugin (plugins/flock.ts) draws them.
 */
import type { Vec } from '../city';

/** how many of each are about at once: few enough that they don't crowd the screen */
export const CROWS = 3;
export const GULLS = 3;
/** you're this close (tiles) and it's off */
export const STARTLE = 2.6;
/** it lands this far from where it took off */
export const FLEE = [7, 13] as const;
/** tiles a second in the air */
export const FLY_SPEED = 9;
/** further than this from you and it's moved somewhere near you, out of view */
export const FAR = 30;
/** where the first ones land as you go: around the edge of the view (it's ~8 tiles to the top, ~14 to the side) */
export const ARRIVE = [8, 16] as const;
/** where a bird turns up: this far from you (just off screen) */
export const SPAWN = [13, 22] as const;

export interface Bird {
  pos: Vec;
  facing: 'left' | 'right';
  /** in the air from → to, `t` 0..1 */
  flight: { from: Vec; to: Vec; t: number; len: number } | null;
  /** seconds until it hops or turns */
  idle: number;
}

/** Somewhere `suits` between r0 and r1 tiles from `c` (or null after a few tries). */
export function spotNear(c: Vec, r0: number, r1: number, suits: (x: number, y: number) => boolean, rand: () => number, away?: Vec): Vec | null {
  for (let i = 0; i < 40; i++) {
    let a = rand() * Math.PI * 2;
    // fleeing: roughly away from `away`
    if (away) a = Math.atan2(c.y - away.y, c.x - away.x) + (rand() - 0.5) * 1.6;
    const r = r0 + rand() * (r1 - r0);
    const p = { x: Math.floor(c.x + Math.cos(a) * r) + 0.5, y: Math.floor(c.y + Math.sin(a) * r) + 0.5 };
    if (suits(p.x, p.y)) return p;
  }
  return null;
}

export function newBird(pos: Vec, rand: () => number): Bird {
  return { pos, facing: rand() < 0.5 ? 'left' : 'right', flight: null, idle: rand() * 3 };
}

/** height in the air, 0..1, along a flight */
export const altitude = (t: number) => Math.sin(Math.PI * t);

/**
 * One bird for `dt` seconds with you at `you`. Returns 'flew' the moment it takes off
 * (for a caw), 'moved' if it was sent somewhere near you, else null.
 */
export function stepBird(b: Bird, dt: number, you: Vec, suits: (x: number, y: number) => boolean, rand: () => number): 'flew' | 'moved' | null {
  if (b.flight) {
    const f = b.flight;
    f.t = Math.min(1, f.t + (dt * FLY_SPEED) / f.len);
    b.pos = { x: f.from.x + (f.to.x - f.from.x) * f.t, y: f.from.y + (f.to.y - f.from.y) * f.t };
    if (f.t >= 1) b.flight = null;
    return null;
  }
  const d = Math.hypot(b.pos.x - you.x, b.pos.y - you.y);
  if (d > FAR) {
    const p = spotNear(you, SPAWN[0], SPAWN[1], suits, rand);
    if (!p) return null;
    b.pos = p;
    return 'moved';
  }
  if (d < STARTLE) {
    const to = spotNear(b.pos, FLEE[0], FLEE[1], suits, rand, you);
    if (!to) return null;
    b.flight = { from: { ...b.pos }, to, t: 0, len: Math.hypot(to.x - b.pos.x, to.y - b.pos.y) };
    b.facing = to.x >= b.pos.x ? 'right' : 'left';
    return 'flew';
  }
  b.idle -= dt;
  if (b.idle <= 0) {
    // a hop, or a turn to look the other way
    b.idle = 1 + rand() * 3;
    if (rand() < 0.5) b.facing = b.facing === 'left' ? 'right' : 'left';
    else {
      const p = { x: b.pos.x + (b.facing === 'right' ? 0.3 : -0.3), y: b.pos.y + (rand() - 0.5) * 0.3 };
      if (suits(p.x, p.y)) b.pos = p;
    }
  }
  return null;
}
