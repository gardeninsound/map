/**
 * Every seeded random number and hash in the game, in one place. Each one's formula is fixed:
 * what it returns decides how houses, trees, fields and rabbits' scarves look, so changing one
 * changes the island (random.test.ts pins their values). For chance that `?seed=` should repeat,
 * use the clock's `dice('<name>')` (clock.ts), which is built on `rng`.
 */

/** a seeded stream of 0..1 (mulberry32): the neighbors, the dice, a plugin's own layout */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a seeded stream of 0..1 (Lehmer, the Park–Miller "minimal standard"): the park scene's field */
export function lehmer(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** a stable 0..1 for a tile (and a seed): decoration that looks the same every visit */
export function tileHash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** a stable 0..1 from any integers (FNV-style mixing): chicken boxing's punches and feathers */
export function intsHash(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 2246822507);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** a stable whole number for a string (×31, Java-style): a rabbit's scarf and name from its id */
export function stringHash(s: string, seed = 0): number {
  let h = seed;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** a stable whole number for a name (FNV-1a): each user of the dice gets its own stream */
export const nameHash = (s: string): number => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
