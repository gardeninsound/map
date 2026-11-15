/**
 * Squirrels (idea box #30; pure, tested): a few always somewhere near you, scampering about
 * the ground near trees. A person (one of the neighbors walking about) coming close sends one
 * dashing up the nearest tree, where it hides, just its tail showing, until the coast is
 * clear; then it's back down. Rabbits don't bother them: you can walk right up. The plugin
 * (plugins/squirrels.ts) draws them.
 */
import type { Vec } from '../city';

/** a person this close (tiles) and it's up a tree */
export const SCARE = 3.5;
/** it comes back down once nobody's within this, for `CALM` seconds */
export const CLEAR = 5.5;
export const CALM = 2.5;
/** how far it'll run for a tree */
export const TREE_REACH = 5;
/** tiles a second, dashing */
export const DASH = 7;
/** further than this from you and it moves somewhere near you, out of view */
export const FAR = 28;

export type Mode = 'forage' | 'up' | 'hiding' | 'down';

export interface Squirrel {
  pos: Vec;
  /** where it forages */
  home: Vec;
  /** the tree it ran up */
  tree: Vec | null;
  mode: Mode;
  /** seconds: till the next scamper; up a tree, how long it's been clear */
  t: number;
  facing: 'left' | 'right';
}

export interface Ground {
  /** can it scamper here? */
  ground(x: number, y: number): boolean;
  /** is there a tree on this tile? */
  tree(tx: number, ty: number): boolean;
}

/** The nearest tree tile's middle within `TREE_REACH`, or null. */
export function nearestTree(p: Vec, g: Ground): Vec | null {
  let best: Vec | null = null;
  let bd = Infinity;
  const cx = Math.floor(p.x), cy = Math.floor(p.y);
  for (let dy = -TREE_REACH; dy <= TREE_REACH; dy++) {
    for (let dx = -TREE_REACH; dx <= TREE_REACH; dx++) {
      if (!g.tree(cx + dx, cy + dy)) continue;
      const q = { x: cx + dx + 0.5, y: cy + dy + 0.5 };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd && d <= TREE_REACH) [best, bd] = [q, d];
    }
  }
  return best;
}

/** A spot to forage near you: ground with a tree close by, between r0 and r1 tiles off. */
export function forageSpot(c: Vec, r0: number, r1: number, g: Ground, rand: () => number): Vec | null {
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2, r = r0 + rand() * (r1 - r0);
    const p = { x: Math.floor(c.x + Math.cos(a) * r) + 0.5, y: Math.floor(c.y + Math.sin(a) * r) + 0.5 };
    if (g.ground(p.x, p.y) && nearestTree(p, g)) return p;
  }
  return null;
}

export function newSquirrel(pos: Vec): Squirrel {
  return { pos, home: { ...pos }, tree: null, mode: 'forage', t: 0, facing: 'right' };
}

const toward = (s: Squirrel, to: Vec, dt: number) => {
  const dx = to.x - s.pos.x, dy = to.y - s.pos.y, d = Math.hypot(dx, dy);
  const step = DASH * dt;
  if (Math.abs(dx) > 0.05) s.facing = dx > 0 ? 'right' : 'left';
  if (d <= step) {
    s.pos = { ...to };
    return true;
  }
  s.pos = { x: s.pos.x + (dx / d) * step, y: s.pos.y + (dy / d) * step };
  return false;
};

/** One squirrel for `dt` s, with `people` walking about and you at `you`. */
export function stepSquirrel(s: Squirrel, dt: number, people: Vec[], you: Vec, g: Ground, rand: () => number) {
  const nearest = Math.min(Infinity, ...people.map((p) => Math.hypot(p.x - s.pos.x, p.y - s.pos.y)));
  switch (s.mode) {
    case 'forage': {
      if (Math.hypot(s.pos.x - you.x, s.pos.y - you.y) > FAR) {
        const p = forageSpot(you, 14, 22, g, rand);
        if (p) Object.assign(s, newSquirrel(p));
        return;
      }
      if (nearest < SCARE) {
        s.tree = nearestTree(s.pos, g);
        if (s.tree) {
          s.mode = 'up';
          return;
        }
      }
      // a scamper this way or that, never far from home
      s.t -= dt;
      if (s.t <= 0) {
        s.t = 0.6 + rand() * 1.6;
        const p = { x: s.home.x + (rand() - 0.5) * 2.4, y: s.home.y + (rand() - 0.5) * 1.6 };
        if (g.ground(p.x, p.y)) {
          s.facing = p.x > s.pos.x ? 'right' : 'left';
          s.pos = p;
        }
      }
      return;
    }
    case 'up':
      if (toward(s, s.tree!, dt)) {
        s.mode = 'hiding';
        s.t = 0;
      }
      return;
    case 'hiding':
      s.t = nearest < CLEAR ? 0 : s.t + dt;
      if (s.t >= CALM) s.mode = 'down';
      return;
    case 'down':
      if (nearest < SCARE) {
        s.mode = 'up';
        return;
      }
      if (toward(s, s.home, dt)) {
        s.mode = 'forage';
        s.tree = null;
        s.t = 1;
      }
  }
}
