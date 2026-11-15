/**
 * The Giant Whirl's ride (idea box #41; pure, tested): a circle swing. The tower spins up,
 * the cars on their long arms swing out over the boardwalk as it goes faster, a long
 * whirl at full speed, then it winds down and the cars hang straight again. The scene
 * (GiantWhirlScene.ts) poses the cars and your seat from this.
 */

/** metres: the hub's radius at the top of the mast, the arms' length, the mast's height */
export const HUB = 4;
export const ARM = 9;
export const MAST = 16;
/** rad/s at full speed */
export const TOP_SPEED = 1.15;
/** seconds: boarding, spinning up, full speed, winding down */
export const PHASES = { board: 2.5, up: 8, full: 16, down: 9 } as const;
export const RIDE = PHASES.board + PHASES.up + PHASES.full + PHASES.down;
const G = 9.8;

/** How fast the tower turns at `t` s into the ride (rad/s): eased up, held, eased down. */
export function spinAt(t: number): number {
  const { board, up, full, down } = PHASES;
  const ease = (k: number) => k * k * (3 - 2 * k);
  if (t < board) return 0;
  if (t < board + up) return TOP_SPEED * ease((t - board) / up);
  if (t < board + up + full) return TOP_SPEED;
  if (t < RIDE) return TOP_SPEED * ease(1 - (t - board - up - full) / down);
  return 0;
}

/**
 * How far the arms swing out from hanging straight (radians) at spin `w`: where gravity and
 * the turn balance, tan θ = w²(HUB + ARM sin θ) / g, found by iterating.
 */
export function swingOut(w: number): number {
  let th = 0;
  for (let i = 0; i < 30; i++) th = Math.atan((w * w * (HUB + ARM * Math.sin(th))) / G);
  return th;
}

/** The tower's turn (radians) at `t`: the spin, added up. */
export function turnAt(t: number, step = 1 / 60): number {
  let a = 0;
  for (let s = 0; s < Math.min(t, RIDE); s += step) a += spinAt(s) * step;
  return a;
}

/** A seat on arm `k` of `n` at tower turn `turn` with swing `th`: x, y (up), z in metres. */
export function seatAt(k: number, n: number, turn: number, th: number): { x: number; y: number; z: number; heading: number } {
  const a = turn + (k / n) * Math.PI * 2;
  const r = HUB + ARM * Math.sin(th);
  return { x: Math.cos(a) * r, y: MAST - ARM * Math.cos(th), z: Math.sin(a) * r, heading: a };
}
