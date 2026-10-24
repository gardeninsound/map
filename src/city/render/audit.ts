import { CHUNK, ChunkCache, TS } from './tileArt';
import { PAL } from './palette';
import { Tile, type World } from '../world/world';

/** One flagged spot, in tile coords. */
export interface Artifact {
  kind: 'sliver' | 'fragment';
  x: number;
  y: number;
  area: number;
}

const MAX_AREA = 30; // px: anything this small is a drawing glitch, not a feature
/** Detailed places paint concrete paths beside parked cars and pitches: small patches within 2 tiles of them are real. */
const DETAILED = new Set<number>([Tile.Lawn, Tile.Parking, Tile.Drawn]);
const NEAR = [-2, -1, 0, 1, 2].flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => [dx, dy]));

/**
 * Render every chunk and look for road-drawing glitches:
 *  - sliver: a small patch of non-road pixels completely surrounded by road
 *  - fragment: a small blob of road pixels not attached to any other road
 * Run via the app at ?audit (scripts/city/road-audit.mjs).
 */
export function auditRoads(world: World): Artifact[] {
  const hex = (h: string) => parseInt(h.slice(1), 16);
  const ROAD = new Set([PAL.road, PAL.roadGrain, PAL.curb, PAL.sidewalk].map(hex));
  const chunks = new ChunkCache(world);
  const size = CHUNK * TS;
  const out: Artifact[] = [];
  for (let cy = 0; cy * CHUNK < world.h; cy++) {
    for (let cx = 0; cx * CHUNK < world.w; cx++) {
      const data = chunks.get(cx, cy).getContext('2d')!.getImageData(0, 0, size, size).data;
      const isRoad = new Uint8Array(size * size);
      for (let i = 0; i < size * size; i++) isRoad[i] = ROAD.has((data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2]) ? 1 : 0;
      const seen = new Uint8Array(size * size);
      for (let start = 0; start < size * size; start++) {
        if (seen[start]) continue;
        const want = isRoad[start];
        const stack = [start];
        seen[start] = 1;
        let area = 0, sx = 0, sy = 0, edge = false;
        // always flood the whole region, or its leftovers would show up as fake tiny islands
        while (stack.length) {
          const i = stack.pop()!;
          area++;
          const x = i % size, y = (i / size) | 0;
          sx += x;
          sy += y;
          if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edge = true;
          for (const j of [x > 0 ? i - 1 : -1, x < size - 1 ? i + 1 : -1, y > 0 ? i - size : -1, y < size - 1 ? i + size : -1]) {
            if (j < 0 || isRoad[j] !== want || seen[j]) continue;
            seen[j] = 1;
            stack.push(j);
          }
        }
        if (edge || area > MAX_AREA) continue;
        const x = (cx * size + sx / area) / TS, y = (cy * size + sy / area) / TS;
        if (NEAR.some(([dx, dy]) => DETAILED.has(world.tileAt(Math.floor(x) + dx, Math.floor(y) + dy)))) continue;
        out.push({ kind: want ? 'fragment' : 'sliver', x: +x.toFixed(1), y: +y.toFixed(1), area });
      }
    }
  }
  return out;
}
