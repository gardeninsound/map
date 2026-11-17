/**
 * The game's one clock and its dice. Everything on the map that goes by the time of day, the
 * date or chance asks here instead of `Date.now()` / `Math.random()`, so a review link or a
 * story-log photo can pin them:
 *
 *   ?time=2026-03-15T19:30   the clock starts at that moment (your local time; add Z or -08:00
 *                            for an exact instant) and runs on from there. A date alone means noon.
 *   ?seed=7                  chance plays out the same way every time (which dinosaurs, which
 *                            way the race goes, where the cones fall…)
 *
 * With neither, it's the real clock and real chance. The parsing is pure (clock.test.ts).
 */
import { nameHash, rng } from './random';

export type ClockSettings = { at: number | null; seed: number | null };

/** `?time=` / `?seed=` from a query string; anything unreadable is ignored (the real clock). */
export function clockFromSearch(search: string): ClockSettings {
  const q = new URLSearchParams(search);
  const t = q.get('time');
  let at: number | null = null;
  if (t) {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(t);
    const ms = Date.parse(dateOnly ? `${t}T12:00:00` : t);
    if (Number.isFinite(ms)) at = ms;
  }
  const s = q.get('seed');
  const seed = s !== null && /^-?\d+$/.test(s) ? Number(s) : null;
  return { at, seed };
}


let offset = 0;
let seed: number | null = null;
const streams = new Map<string, () => number>();

/** Pins the clock and/or the dice (App calls this once with `clockFromSearch(location.search)`). */
export function setClock(s: Partial<ClockSettings>) {
  if (s.at !== undefined) offset = s.at === null ? 0 : s.at - Date.now();
  if (s.seed !== undefined) {
    seed = s.seed;
    streams.clear();
  }
}

/** the game's "now", ms since 1970 */
export const now = () => Date.now() + offset;
/** the game's "now" as a Date (local calendar: month, day, hour) */
export const today = () => new Date(now());
/** whether a review link pinned anything (so the app can say so) */
export const clockPinned = () => offset !== 0 || seed !== null;

/**
 * A random source for one part of the game, named so a seed gives each its own repeatable
 * stream (the dinosaurs don't change if the race draws one more number). Unseeded: real chance.
 */
export function dice(name: string): () => number {
  if (seed === null) return Math.random;
  let r = streams.get(name);
  if (!r) streams.set(name, (r = rng((seed ^ nameHash(name)) >>> 0)));
  return r;
}
