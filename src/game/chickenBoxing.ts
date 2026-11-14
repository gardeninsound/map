/**
 * The chicken boxing match in West Seattle Stadium (pure, tested): who's punching whom at
 * any moment of the bout, from the clock alone, so every rabbit on the island sees the same
 * fight. Rounds of punches on a beat, a knockdown and a count in some rounds, a break
 * between rounds, then the next bout. The plugin (plugins/chickenBoxing.ts) poses the 3D
 * chickens from it.
 */

/** seconds of fighting a round, of rest between, rounds a bout */
export const ROUND = 40;
export const BREAK = 8;
export const ROUNDS = 3;
export const BOUT = ROUNDS * (ROUND + BREAK);
/** one exchange: a punch thrown and (maybe) landed */
export const BEAT = 0.8;
/** a knockdown: seconds on the canvas, then back up */
export const DOWN = 5;

export interface Punch {
  arm: 0 | 1;
  kind: 'jab' | 'hook';
  /** 0 → 1 over the throw: out and back */
  k: number;
  lands: boolean;
}

export interface Pose {
  /** a shuffle side to side, tiles */
  step: number;
  punch: Punch | null;
  /** 0..1: rocked back by a punch that landed */
  hit: number;
  /** 0..1: lying on the canvas (1) */
  down: number;
  /** gloves up over the head: won the knockdown, or the round */
  cheer: boolean;
}

export interface Bout {
  bout: number;
  round: number;
  /** between rounds: in the corners */
  rest: boolean;
  /** seconds into the round (or the break) */
  inRound: number;
  fighters: [Pose, Pose];
  /** punches landed so far this bout */
  landed: [number, number];
  /** a punch landed in this beat, at `inRound` = this (for the thud) */
  impactAt: number | null;
}

/** a repeatable 0..1 from integers */
export function hash(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 2246822507);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** the knockdown in a round, if there is one: when it lands and who goes down */
export function knockdownOf(bout: number, round: number): { at: number; who: 0 | 1 } | null {
  if (hash(bout, round, 7) > 0.55) return null;
  return { at: 12 + Math.floor(hash(bout, round, 8) * 18) * BEAT, who: hash(bout, round, 9) < 0.5 ? 0 : 1 };
}

/** beat `i` of a round: who throws what, and whether it lands */
export function exchange(bout: number, round: number, i: number): { by: 0 | 1; punch: Omit<Punch, 'k'> } | null {
  const r = hash(bout, round, i);
  if (r < 0.12) return null; // circling, sizing each other up
  const by: 0 | 1 = hash(bout, round, i, 1) < 0.5 ? 0 : 1;
  const kind = hash(bout, round, i, 2) < 0.65 ? 'jab' : 'hook';
  return { by, punch: { arm: hash(bout, round, i, 3) < 0.5 ? 0 : 1, kind, lands: hash(bout, round, i, 4) < (kind === 'jab' ? 0.6 : 0.45) } };
}

const idle = (t: number, who: number): Pose => ({ step: Math.sin(t * 2.2 + who * 2.1) * 0.35, punch: null, hit: 0, down: 0, cheer: false });

/** The punch's throw, out and back, as a beat goes: thrown in its first 40%. */
const throwK = (u: number) => Math.max(0, Math.min(1, u / 0.4));

/** The whole bout at clock `t` (seconds, any start). */
export function boutAt(t: number): Bout {
  const bout = Math.floor(t / BOUT);
  const inBout = t - bout * BOUT;
  const round = Math.min(ROUNDS, Math.floor(inBout / (ROUND + BREAK)) + 1);
  const inRoundAll = inBout - (round - 1) * (ROUND + BREAK);
  const rest = inRoundAll >= ROUND;
  const inRound = rest ? inRoundAll - ROUND : inRoundAll;
  const fighters: [Pose, Pose] = [idle(t, 0), idle(t, 1)];
  const landed: [number, number] = [0, 0];
  let impactAt: number | null = null;
  // punches landed in rounds before this one, and in this one up to now
  for (let r = 1; r <= round; r++) {
    const ko = knockdownOf(bout, r);
    const upTo = r < round || rest ? ROUND : inRound;
    for (let i = 0; (i + 1) * BEAT <= upTo + BEAT * 0.4; i++) {
      if (i * BEAT > upTo) break;
      if (ko && i * BEAT >= ko.at - BEAT && i * BEAT < ko.at + DOWN) continue;
      const e = exchange(bout, r, i);
      if (e?.punch.lands) landed[e.by]++;
    }
    if (ko && ko.at <= upTo) landed[ko.who === 0 ? 1 : 0]++;
  }
  if (rest) {
    // in their corners; whoever's ahead raises a glove
    fighters[0].step = fighters[1].step = 0;
    if (landed[0] !== landed[1]) fighters[landed[0] > landed[1] ? 0 : 1].cheer = true;
    return { bout, round, rest, inRound, fighters, landed, impactAt };
  }
  const ko = knockdownOf(bout, round);
  if (ko && inRound >= ko.at - BEAT && inRound < ko.at + DOWN) {
    const winner = ko.who === 0 ? 1 : 0;
    if (inRound < ko.at) {
      // the big hook
      fighters[winner].punch = { arm: 1, kind: 'hook', k: throwK((inRound - (ko.at - BEAT)) / BEAT), lands: true };
    } else {
      const s = inRound - ko.at;
      impactAt = ko.at;
      // over in half a second, lies there, gets back up in the last second
      fighters[ko.who].down = Math.min(1, s / 0.5, Math.max(0, DOWN - s));
      fighters[ko.who].step = fighters[winner].step = 0;
      fighters[winner].cheer = true;
    }
    return { bout, round, rest, inRound, fighters, landed, impactAt };
  }
  const i = Math.floor(inRound / BEAT);
  const u = (inRound - i * BEAT) / BEAT;
  const e = exchange(bout, round, i);
  if (e) {
    fighters[e.by].punch = { ...e.punch, k: throwK(u) };
    if (e.punch.lands) {
      // rocked back as the glove arrives, then recovers
      fighters[e.by === 0 ? 1 : 0].hit = u < 0.25 ? 0 : Math.max(0, 1 - (u - 0.25) / 0.5);
      impactAt = i * BEAT + BEAT * 0.25;
    }
  }
  return { bout, round, rest, inRound, fighters, landed, impactAt };
}
