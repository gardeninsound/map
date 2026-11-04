import type { Facing, Vec } from '../city';
import { EMOTES, PLACE_NAMES, SCARF_NAMES } from '../content/emotes';

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

/**
 * Presence: are you here, away (your rabbit fades for everyone), or gone (you leave the
 * room, so your rabbit disappears and the count drops)? From how long the tab has been
 * hidden (null = visible) and how long since your last key, click or tap. Seconds.
 * Coming back (showing the tab, any input) rejoins as the same rabbit.
 */
export const PRESENCE = {
  /** a hidden tab leaves the room after this long */
  hiddenGone: 120,
  /** a visible tab with no input fades after this long… */
  idleAway: 600,
  /** …and leaves the room after this long */
  idleGone: 1800,
};
export type Presence = 'here' | 'away' | 'gone';

export function presence(hiddenFor: number | null, idleFor: number, t = PRESENCE): Presence {
  if (hiddenFor !== null) return hiddenFor >= t.hiddenGone ? 'gone' : 'away';
  if (idleFor >= t.idleGone) return 'gone';
  return idleFor >= t.idleAway ? 'away' : 'here';
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
  return SCARVES[hash(id) % SCARVES.length]!;
}

function hash(id: string, seed = 0): number {
  let h = seed;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Your own rabbit's scarf (the city's rabbit), for your own name. */
export const MY_SCARF = '#2ec4b6';

/**
 * A rabbit's name: scarf colour + a West Seattle place, both from the id ("Pink Alki").
 * Everyone derives the same name from the same id, so names are never sent.
 */
export function rabbitName(id: string, scarf = scarfFor(id)): string {
  const place = PLACE_NAMES[hash(id, 7) % PLACE_NAMES.length]!;
  return `${SCARF_NAMES[scarf] ?? 'Gray'} ${place}`;
}

/** An emote off the network: its index in EMOTES, or null if it isn't one. */
export function decodeEmote(d: unknown): number | null {
  return Number.isInteger(d) && (d as number) >= 0 && (d as number) < EMOTES.length ? (d as number) : null;
}

/** How long an emote bubble stays up, seconds. */
export const EMOTE_TIME = 2.5;

/**
 * A token bucket: `burst` at once, then one more every `every` seconds. Used to cap the
 * emotes you send (the relay is metered) and the ones shown from each other rabbit (a
 * modified client could send them as fast as it likes). Time is passed in, so it's pure.
 */
export class RateLimit {
  private tokens: number;
  private at = -Infinity;
  constructor(
    readonly burst: number,
    readonly every: number,
  ) {
    this.tokens = burst;
  }
  /** take one if there is one; `now` in seconds */
  take(now: number): boolean {
    if (this.at !== -Infinity) this.tokens = Math.min(this.burst, this.tokens + (now - this.at) / this.every);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** Yours: three in a row, then one every 2 s. */
export const sendLimit = () => new RateLimit(3, 2);
/** Theirs, as shown to you: a little looser than what an honest client sends. */
export const showLimit = () => new RateLimit(4, 1.5);

/** A speech bubble on screen: centred on x, its bottom at y. */
export interface BubbleBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lift bubbles that would overlap one already placed (rabbits standing together), lowest
 * first, so everyone can be read; `fixed` ones (the city's own '!' bubble) never move.
 * Returns each bubble's bottom y, in input order.
 */
export function stackBubbles(boxes: BubbleBox[], gap = 2, fixed: BubbleBox[] = []): number[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b]!.y - boxes[a]!.y);
  const placed = fixed.map((b) => ({ l: b.x - b.w / 2, r: b.x + b.w / 2, top: b.y - b.h, bottom: b.y }));
  const out: number[] = new Array(boxes.length);
  for (const i of order) {
    const b = boxes[i]!;
    const l = b.x - b.w / 2 - gap;
    const r = b.x + b.w / 2 + gap;
    let bottom = b.y;
    for (let moved = true; moved; ) {
      moved = false;
      for (const p of placed) {
        if (l < p.r && r > p.l && bottom > p.top - gap && bottom - b.h < p.bottom + gap) {
          bottom = p.top - gap;
          moved = true;
        }
      }
    }
    placed.push({ l, r, top: bottom - b.h, bottom });
    out[i] = bottom;
  }
  return out;
}
