/**
 * The snack crow's travels (pure, tested). It sits at a perch until you've talked to it,
 * then flies in a straight line — crows don't take the streets — to the next one.
 */
import type { Vec } from 'west-seattle-map';

const SPEED = 30; // tiles / second
const MIN_FLIGHT = 3; // seconds, so even a short hop reads as a flight

export interface Flight {
  from: Vec;
  to: Vec;
  t: number;
  dur: number;
}

export interface CrowState {
  /** index of the perch it's at (or flying to) */
  stop: number;
  /** how many times it has come back around to the first perch */
  lap: number;
  /** times the rabbit shared */
  snacks: number;
  pos: Vec;
  flight: Flight | null;
}

export function newCrow(perches: Vec[]): CrowState {
  return { stop: 0, lap: 0, snacks: 0, pos: { ...perches[0] }, flight: null };
}

/** Leave for the next perch (wrapping back to the first). */
export function takeOff(c: CrowState, perches: Vec[]) {
  const next = (c.stop + 1) % perches.length;
  if (next === 0) c.lap++;
  const to = perches[next];
  const dur = Math.max(MIN_FLIGHT, Math.hypot(to.x - c.pos.x, to.y - c.pos.y) / SPEED);
  c.flight = { from: { ...c.pos }, to, t: 0, dur };
  c.stop = next;
}

export function flyTick(c: CrowState, dt: number) {
  const f = c.flight;
  if (!f) return;
  f.t += dt;
  if (f.t >= f.dur) {
    c.pos = { ...f.to };
    c.flight = null;
    return;
  }
  const k = f.t / f.dur;
  c.pos = { x: f.from.x + (f.to.x - f.from.x) * k, y: f.from.y + (f.to.y - f.from.y) * k };
}

/** 0 on the ground, 1 at cruising height: a quick climb, a long glide, a quick landing. */
export function altitude(f: Flight): number {
  const k = Math.min(1, f.t / f.dur);
  return Math.min(1, k * 4, (1 - k) * 4);
}
