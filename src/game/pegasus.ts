/**
 * The bookshop pegasus's visit (pure, tested): waits inside Pegasus Books until you come by,
 * walks out of the door onto the sidewalk, turns to you and says hello, then takes off and
 * flies away over the rooftops. Once you've wandered off, it's back inside for next time.
 */
import type { Vec } from '../city';

/** you within this many tiles of the doorstep → it comes out */
export const NOTICE = 4;
/** once gone, you this far from the doorstep → it's home again */
export const HOME = 14;
export const WALK_TIME = 1.4;
export const HELLO_TIME = 2.6;
export const FLY_TIME = 4;
/** where it flies: up and away to the north-east, tiles */
const AWAY = { x: 30, y: -30 };

export type PegasusPhase = 'inside' | 'out' | 'hello' | 'flying' | 'gone';

export interface PegasusState {
  phase: PegasusPhase;
  /** seconds into the phase */
  t: number;
  pos: Vec;
  facing: 'left' | 'right';
  /** visits so far (picks the hello line) */
  visits: number;
}

export function newPegasus(door: Vec): PegasusState {
  return { phase: 'inside', t: 0, pos: { ...door }, facing: 'right', visits: 0 };
}

const lerp = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Advance by `dt` seconds. `door` is just inside the shop front, `step` the sidewalk
 * outside it; `player` is the rabbit. Returns the phase it just entered, if it changed.
 */
export function pegasusTick(s: PegasusState, dt: number, player: Vec, door: Vec, step: Vec): PegasusPhase | null {
  s.t += dt;
  const enter = (phase: PegasusPhase) => {
    s.phase = phase;
    s.t = 0;
    return phase;
  };
  switch (s.phase) {
    case 'inside':
      if (dist(player, step) > NOTICE) return null;
      s.pos = { ...door };
      s.facing = step.x >= door.x ? 'right' : 'left';
      return enter('out');
    case 'out':
      s.pos = lerp(door, step, Math.min(1, s.t / WALK_TIME));
      if (s.t < WALK_TIME) return null;
      s.facing = player.x >= s.pos.x ? 'right' : 'left';
      return enter('hello');
    case 'hello':
      if (s.t < HELLO_TIME) return null;
      s.facing = AWAY.x >= 0 ? 'right' : 'left';
      return enter('flying');
    case 'flying': {
      // lifts off almost on the spot, then speeds away
      const k = Math.min(1, s.t / FLY_TIME);
      s.pos = lerp(step, { x: step.x + AWAY.x, y: step.y + AWAY.y }, k * k * k);
      if (s.t < FLY_TIME) return null;
      s.visits++;
      return enter('gone');
    }
    case 'gone':
      if (dist(player, step) < HOME) return null;
      s.pos = { ...door };
      return enter('inside');
  }
}

/** Height above the ground in flight, 0..1: straight up off the sidewalk, still climbing as it goes. */
export function altitude(s: PegasusState): number {
  if (s.phase !== 'flying') return 0;
  const k = Math.min(1, s.t / FLY_TIME);
  return Math.sqrt(k);
}
