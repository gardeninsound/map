import type { Facing, Vec } from '../city';

/**
 * Other people on the island, as rabbits: what goes over the wire, when to send it, and
 * how a remote rabbit moves smoothly between updates. Pure, so it's tested without a
 * network (visitors.test.ts); the plugin in plugins/visitors.ts does the I/O and drawing.
 */

export interface RabbitState {
  pos: Vec;
  facing: Facing;
  moving: boolean;
  /** inside an art scene or a conversation: shown faded */
  away: boolean;
}

/** On the wire: [x, y, facing, moving, away], positions to 1/20 tile. */
export type RabbitWire = [number, number, number, 0 | 1, 0 | 1];

const FACINGS: Facing[] = ['up', 'down', 'left', 'right'];

export function encode(s: RabbitState): RabbitWire {
  const r = (v: number) => Math.round(v * 20) / 20;
  return [r(s.pos.x), r(s.pos.y), FACINGS.indexOf(s.facing), s.moving ? 1 : 0, s.away ? 1 : 0];
}

/** null for anything malformed: it came from the network. */
export function decode(d: unknown): RabbitState | null {
  if (!Array.isArray(d) || d.length < 5) return null;
  const [x, y, f, m, a] = d;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { pos: { x, y }, facing: FACINGS[f as number] ?? 'down', moving: m === 1, away: a === 1 };
}

/** At most this often while moving: the relay's free tier is metered by messages sent. */
export const SEND_INTERVAL = 0.2;

/**
 * Whether to send now: only when something visible changed, and not more than every
 * SEND_INTERVAL seconds. A rabbit standing still sends nothing (newcomers are greeted
 * with a direct hello instead).
 */
export function shouldSend(last: RabbitWire | null, now: RabbitWire, sinceLast: number): boolean {
  if (!last) return true;
  if (now.every((v, i) => v === last[i])) return false;
  // A change in state (stopped, turned, went away) goes out at once so nobody is left
  // watching a rabbit moonwalk; position updates wait for the interval.
  const stateChanged = now[2] !== last[2] || now[3] !== last[3] || now[4] !== last[4];
  return stateChanged || sinceLast >= SEND_INTERVAL;
}

/** A rabbit someone else is walking: where it's drawn, chasing where it was last seen. */
export interface Visitor {
  id: string;
  shown: Vec;
  target: RabbitState;
  walkT: number;
}

/** Farther than this (tiles) and the rabbit jumps instead of gliding: a teleport. */
const SNAP = 12;
/** Higher = tighter following. Updates arrive every 0.2 s, so it catches up in about that. */
const EASE = 12;

export function newVisitor(id: string, s: RabbitState): Visitor {
  return { id, shown: { ...s.pos }, target: s, walkT: 0 };
}

export function easeVisitor(v: Visitor, dt: number): void {
  const dx = v.target.pos.x - v.shown.x;
  const dy = v.target.pos.y - v.shown.y;
  if (Math.hypot(dx, dy) > SNAP) {
    v.shown = { ...v.target.pos };
  } else {
    const k = 1 - Math.exp(-EASE * dt);
    v.shown = { x: v.shown.x + dx * k, y: v.shown.y + dy * k };
  }
  v.walkT = v.target.moving ? v.walkT + dt : 0;
}

/** Scarves for other rabbits (yours is teal), picked from the player's id so it's stable. */
export const SCARVES = ['#ff9f1c', '#e84a5f', '#9b5de5', '#f15bb5', '#fee440', '#3a86ff', '#80ed99'];

export function scarfFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SCARVES[h % SCARVES.length]!;
}
