/**
 * The Admiral-to-Alaska bike race (pure, tested): the course down California Ave, how the
 * animals ride it, and who's where. Tiles as on the map (x east, y south). The plugin
 * (plugins/bikeRace.ts) draws it and runs the clock.
 */
import type { Vec } from '../city';

/** your bike in the race, tiles a second (racers ride round this) */
export const RACE_SPEED = 15.5;
/** seconds of 3-2-1 before GO */
export const COUNTDOWN = 3;
/** this far off the course and you've left the race */
export const OFF_COURSE = 8;

type Streets = { isWalkable(x: number, y: number): boolean; streetAt(x: number, y: number): string | null };

export interface Course {
  /** the middle of the road, a point a row */
  line: Vec[];
  /** distance along it at each point */
  at: number[];
  length: number;
}

/**
 * The course: down the street from `start` to `finish` (tile rows, south), following the
 * middle of its road row by row (smoothed), so it bends with California.
 */
export function buildCourse(world: Streets, start: Vec, finish: Vec, street: RegExp): Course | null {
  const raw: Vec[] = [];
  let x = start.x;
  for (let y = Math.floor(start.y); y <= Math.floor(finish.y); y++) {
    // the run of street on this row nearest where it was on the last — only that run, so a
    // parking lot or plaza beside it (named for the street too) doesn't pull the line off
    const on = (px: number) => world.isWalkable(px, y + 0.5) && street.test(world.streetAt(px, y + 0.5) ?? '');
    let seed: number | null = null;
    for (let dx = 0; dx <= 8 && seed === null; dx += 0.5) {
      if (on(x - dx)) seed = x - dx;
      else if (on(x + dx)) seed = x + dx;
    }
    if (seed !== null) {
      let l = seed, r = seed;
      while (on(l - 0.5) && seed - l < 10) l -= 0.5;
      while (on(r + 0.5) && r - seed < 10) r += 0.5;
      // a row much wider than the street is a crossing: keep the line where it was
      if (r - l <= 5) x = (l + r) / 2;
    }
    raw.push({ x, y: y + 0.5 });
  }
  if (raw.length < 10) return null;
  // smooth the wobble out of it
  const line = raw.map((p, i) => {
    const near = raw.slice(Math.max(0, i - 3), i + 4);
    return { x: near.reduce((s, q) => s + q.x, 0) / near.length, y: p.y };
  });
  const at = [0];
  for (let i = 1; i < line.length; i++) at.push(at[i - 1]! + Math.hypot(line[i]!.x - line[i - 1]!.x, line[i]!.y - line[i - 1]!.y));
  return { line, at, length: at[at.length - 1]! };
}

/** The point `d` along the course, moved `lane` tiles to the side (+ = west, the riders' right going south). */
export function courseAt(c: Course, d: number, lane = 0): Vec {
  const dd = Math.max(0, Math.min(c.length, d));
  let i = 1;
  while (i < c.at.length - 1 && c.at[i]! < dd) i++;
  const a = c.line[i - 1]!, b = c.line[i]!;
  const seg = c.at[i]! - c.at[i - 1]! || 1;
  const k = (dd - c.at[i - 1]!) / seg;
  const dx = (b.x - a.x) / seg, dy = (b.y - a.y) / seg;
  // the side: perpendicular to the way it runs
  return { x: a.x + (b.x - a.x) * k - dy * lane, y: a.y + (b.y - a.y) * k + dx * lane };
}

/** How far along the course `p` is, and how far off it. */
export function progressOf(c: Course, p: Vec): { d: number; off: number } {
  let best = { d: 0, off: Infinity };
  for (let i = 1; i < c.line.length; i++) {
    const a = c.line[i - 1]!, b = c.line[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const off = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (off < best.off) best = { d: c.at[i - 1]! + t * Math.sqrt(len2), off };
  }
  return best;
}

export interface Racer {
  /** distance along the course */
  d: number;
  /** tiles a second, before surges */
  base: number;
  /** side-to-side place on the road, tiles */
  lane: number;
  /** so their surges don't line up */
  phase: number;
  /** race-clock seconds when they crossed the line */
  finished: number | null;
}

/** The field: `n` riders a little either side of your speed, two rows on the line. */
export function lineUp(n: number, rand: () => number): Racer[] {
  return Array.from({ length: n }, (_, i) => ({
    d: i < Math.ceil(n / 2) ? 1.6 : 0.4,
    // a couple are quicker than you, most a touch slower: it's a race
    base: RACE_SPEED * (0.86 + rand() * 0.17),
    lane: ((i % Math.ceil(n / 2)) - (Math.ceil(n / 2) - 1) / 2) * 0.75,
    phase: rand() * Math.PI * 2,
    finished: null,
  }));
}

/** A rider's speed right now: surges and lulls, and a kick in the last stretch. */
export function speedOf(r: Racer, t: number, c: Course): number {
  const surge = 1 + 0.1 * Math.sin(t * 0.8 + r.phase) + 0.04 * Math.sin(t * 2.3 + r.phase * 2);
  const kick = c.length - r.d < 25 ? 1.08 : 1;
  return r.base * surge * kick;
}

/** Ride `dt` seconds at race-clock `t`; marks the finish. */
export function ride(r: Racer, dt: number, t: number, c: Course) {
  if (r.finished !== null) return;
  r.d += speedOf(r, t, c) * dt;
  if (r.d >= c.length) {
    r.d = c.length;
    r.finished = t;
  }
}

/** Your place (1-based) among the riders, given how far along you are (or when you finished). */
export function placeOf(you: { d: number; finished: number | null }, racers: Racer[]): number {
  const ahead = racers.filter((r) =>
    you.finished !== null ? r.finished !== null && r.finished < you.finished : r.finished !== null || r.d > you.d,
  ).length;
  return ahead + 1;
}
