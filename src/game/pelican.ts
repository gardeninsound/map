/**
 * The pelican's visit after you join (pure, tested): it flies in and lands beside your
 * rabbit, asks if you've anything to add, hops up into the air and lands on the ✿ IDEA
 * button, says "Dream it out!", then flies off the screen. Everything is in screen px (it
 * flies over the HUD as well as the map); the points it flies between are passed in each
 * frame, since your rabbit and the button can move. Drawn by src/ui/Pelican.tsx.
 */

export interface Pt {
  x: number;
  y: number;
}

/** seconds after you join (past the title) that it comes, once nothing else is open */
export const PELICAN_AFTER = 120;

export type PelicanPhase = 'arrive' | 'ask' | 'hop' | 'perch' | 'leave' | 'done';
const ORDER: Exclude<PelicanPhase, 'done'>[] = ['arrive', 'ask', 'hop', 'perch', 'leave'];

/** seconds per phase */
export type PelicanTimes = Record<Exclude<PelicanPhase, 'done'>, number>;
export const PELICAN_TIMES: PelicanTimes = { arrive: 1.8, ask: 3.6, hop: 1.5, perch: 2.8, leave: 1.6 };
/** with reduced motion: no flying across the screen, it's just there, then there */
export const PELICAN_TIMES_STILL: PelicanTimes = { arrive: 0.01, ask: 3.6, hop: 0.01, perch: 2.8, leave: 0.01 };

/** where its feet go: in from `from`, beside you at `byYou`, on the button at `button`, off to `away` */
export interface PelicanPoints {
  from: Pt;
  byYou: Pt;
  button: Pt | null;
  away: Pt;
}

export interface PelicanFrame {
  phase: PelicanPhase;
  /** its feet, screen px */
  pos: Pt;
  flying: boolean;
  facing: 'left' | 'right';
  /** which line is up, if any */
  say: 'ask' | 'dream' | null;
  /** 0..1 along the current phase */
  k: number;
}

export function phaseAt(t: number, times: PelicanTimes = PELICAN_TIMES): { phase: PelicanPhase; k: number } {
  let left = Math.max(0, t);
  for (const phase of ORDER) {
    if (left < times[phase]) return { phase, k: left / times[phase] };
    left -= times[phase];
  }
  return { phase: 'done', k: 1 };
}

export const totalTime = (times: PelicanTimes = PELICAN_TIMES) => ORDER.reduce((s, p) => s + times[p], 0);

/** A swooping flight from a to b: a curve through a point `lift` px above the higher end. */
export function arc(a: Pt, b: Pt, k: number, lift: number): Pt {
  const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift };
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
}

const easeOut = (k: number) => 1 - (1 - k) ** 2;
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const easeIn = (k: number) => k * k;
const facingFor = (from: Pt, to: Pt, was: 'left' | 'right') => (to.x > from.x + 1 ? 'right' : to.x < from.x - 1 ? 'left' : was);

/** Where the pelican is `t` seconds in. No button (it's hidden): it flies straight off from beside you. */
export function pelicanAt(t: number, pts: PelicanPoints, times: PelicanTimes = PELICAN_TIMES): PelicanFrame {
  const { phase, k } = phaseAt(t, times);
  const perch = pts.button ?? pts.byYou;
  switch (phase) {
    case 'arrive':
      return { phase, k, pos: arc(pts.from, pts.byYou, easeOut(k), 60), flying: true, facing: facingFor(pts.from, pts.byYou, 'right'), say: null };
    case 'ask':
      // turned toward you (it landed on your right, so it looks left)
      return { phase, k, pos: pts.byYou, flying: false, facing: 'left', say: 'ask' };
    case 'hop':
      return { phase, k, pos: arc(pts.byYou, perch, easeInOut(k), 90), flying: true, facing: facingFor(pts.byYou, perch, 'right'), say: null };
    case 'perch':
      return { phase, k, pos: perch, flying: false, facing: 'left', say: pts.button ? 'dream' : null };
    case 'leave':
      return { phase, k, pos: arc(perch, pts.away, easeIn(k), 40), flying: true, facing: facingFor(perch, pts.away, 'right'), say: null };
    case 'done':
      return { phase, k, pos: pts.away, flying: true, facing: 'right', say: null };
  }
}
