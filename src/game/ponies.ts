/**
 * The meadow ponies (idea box #36; pure, tested): each grazes a while, then trots to another
 * spot in the meadow, never more than `LEASH` tiles from it and only where it suits them
 * (lawn, or the trails through it). The plugin (plugins/ponies.ts) draws them.
 */
import type { Vec } from '../city';

export const LEASH = 7;
/** tiles a second, trotting */
export const TROT = 2.6;

export interface PonyState {
  pos: Vec;
  to: Vec | null;
  /** seconds of grazing left */
  graze: number;
  facing: 'left' | 'right';
  /** for the trot animation */
  walkT: number;
}

export function newPony(pos: Vec, rand: () => number): PonyState {
  return { pos: { ...pos }, to: null, graze: 1 + rand() * 4, facing: rand() < 0.5 ? 'left' : 'right', walkT: 0 };
}

/** One pony for `dt` s. `stop`: a rabbit is talking to it — it stands still. */
export function ponyTick(p: PonyState, dt: number, home: Vec, suits: (x: number, y: number) => boolean, rand: () => number, stop = false) {
  if (stop) {
    p.to = null;
    return;
  }
  if (p.to) {
    const dx = p.to.x - p.pos.x, dy = p.to.y - p.pos.y, d = Math.hypot(dx, dy);
    const step = TROT * dt;
    p.walkT += dt;
    if (d <= step) {
      p.pos = p.to;
      p.to = null;
      p.graze = 2 + rand() * 5;
    } else {
      const next = { x: p.pos.x + (dx / d) * step, y: p.pos.y + (dy / d) * step };
      // something in the way: graze here instead
      if (!suits(next.x, next.y)) {
        p.to = null;
        p.graze = 1;
        return;
      }
      p.pos = next;
    }
    return;
  }
  p.graze -= dt;
  if (p.graze > 0) return;
  for (let i = 0; i < 20; i++) {
    const a = rand() * Math.PI * 2, r = rand() * LEASH;
    const to = { x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r };
    if (!suits(to.x, to.y)) continue;
    p.to = to;
    p.facing = to.x >= p.pos.x ? 'right' : 'left';
    return;
  }
  p.graze = 1;
}
