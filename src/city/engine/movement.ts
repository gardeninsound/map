export interface Vec {
  x: number;
  y: number;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

/** Half-size of the walker's footprint, in tiles. */
export const FOOT = 0.28;

/** True if the whole footprint centred on (x, y) stands on walkable ground. */
export function fits(x: number, y: number, walkable: (x: number, y: number) => boolean): boolean {
  return (
    walkable(x - FOOT, y - FOOT) &&
    walkable(x + FOOT, y - FOOT) &&
    walkable(x - FOOT, y + FOOT) &&
    walkable(x + FOOT, y + FOOT)
  );
}

/**
 * Advance a walker by `dir` (each axis −1..1) for `dt` seconds at `speed` tiles/sec.
 *
 * Collision is per-axis so you slide along curbs, and when a move is blocked
 * outright we try sidestepping a little — that's what lets you glide along the
 * staircase edges of diagonal streets (Fauntleroy, Admiral Way) instead of snagging.
 */
export function step(
  pos: Vec,
  dir: Vec,
  dt: number,
  speed: number,
  walkable: (x: number, y: number) => boolean,
): Vec {
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return pos;
  const dist = Math.min(speed * dt, 0.45); // never tunnel through a 1-tile gap
  const mx = (dir.x / len) * dist;
  const my = (dir.y / len) * dist;

  if (fits(pos.x + mx, pos.y + my, walkable)) return { x: pos.x + mx, y: pos.y + my };
  if (mx !== 0 && fits(pos.x + mx, pos.y, walkable)) return { x: pos.x + mx, y: pos.y };
  if (my !== 0 && fits(pos.x, pos.y + my, walkable)) return { x: pos.x, y: pos.y + my };

  // Blocked going straight: look up to a tile to either side for an open lane and
  // slide perpendicular toward the nearer one.
  if ((mx === 0) === (my === 0)) return pos;
  const px = my !== 0 ? 1 : 0; // perpendicular axis
  const py = mx !== 0 ? 1 : 0;
  for (let k = 1; k <= 4; k++) {
    for (const side of [1, -1]) {
      const off = side * k * 0.25;
      if (!fits(pos.x + mx + px * off, pos.y + my + py * off, walkable)) continue;
      const sx = pos.x + px * side * dist;
      const sy = pos.y + py * side * dist;
      if (fits(sx, sy, walkable)) return { x: sx, y: sy };
    }
  }
  return pos;
}

export function facingFor(dir: Vec, current: Facing): Facing {
  if (dir.x === 0 && dir.y === 0) return current;
  if (Math.abs(dir.x) > Math.abs(dir.y)) return dir.x > 0 ? 'right' : 'left';
  return dir.y > 0 ? 'down' : 'up';
}
