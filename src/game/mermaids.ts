/**
 * Mermaids off Alki (idea box #37; pure, tested): where each one's rock is — a water tile
 * right off the sand — and which catch phrase she's calling out when. The plugin
 * (plugins/mermaids.ts) draws them; words in content/mermaids.ts.
 */
import type { Vec } from '../city';

/** seconds between one mermaid's calls, and how long each bubble shows */
export const CALL_EVERY = 9;
export const CALL_FOR = 4;
/** you see them calling within this many tiles */
export const SEE = 11;

type Map = { tileAt(x: number, y: number): number };

/**
 * A rock for a mermaid near `p`: the water tile within `reach` tiles with sand (or `shore`)
 * within two tiles of it, nearest `p`. Null if there's none.
 */
export function rockNear(w: Map, p: Vec, water: number, shore: (t: number) => boolean, reach = 12, taken: Vec[] = [], gap = 3): Vec | null {
  let best: Vec | null = null;
  let bd = Infinity;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (w.tileAt(x, y) !== water) continue;
      let near = false;
      for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2 && !near; i++) near = shore(w.tileAt(x + i, y + j));
      if (!near) continue;
      const q = { x: x + 0.5, y: y + 0.5 };
      if (taken.some((t) => Math.hypot(t.x - q.x, t.y - q.y) < gap)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) [best, bd] = [q, d];
    }
  }
  return best;
}

/** The phrase mermaid `i` is calling at clock `t` (s), or null between calls. */
export function callingAt(t: number, i: number, phrases: string[]): string | null {
  const s = t + i * (CALL_EVERY / 3);
  if (s % CALL_EVERY >= CALL_FOR) return null;
  return phrases[Math.floor(s / CALL_EVERY) % phrases.length] ?? null;
}

/** For the 3×5 bubble font: letters, spaces, ! and ? only. */
export const bubbleText = (s: string) => s.toUpperCase().replace(/[^A-Z !?]/g, '').replace(/\s+/g, ' ').trim();
