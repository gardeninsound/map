/**
 * The forest maze in Schmitz Preserve (idea box #42; pure, tested): a perfect maze (one way
 * between any two spots) carved by a seeded depth-first walk, so it's the same maze for
 * everyone. Grid cells are tiles: odd (x, y) are rooms, the tiles between them walls or
 * passages. A clearing in the middle is the goal; the way in is on the west wall.
 */

/** `open[x + y * size]`: 1 = path, 0 = trees. `size` = 2 × cells + 1. */
export interface Maze {
  size: number;
  open: Uint8Array;
  /** the way in: a gap in the west wall at this row */
  door: number;
  /** the middle clearing's centre */
  middle: number;
}

export function makeMaze(cells: number, seed: number): Maze {
  const size = cells * 2 + 1;
  const open = new Uint8Array(size * size);
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const seen = new Uint8Array(cells * cells);
  const stack: [number, number][] = [[0, 0]];
  seen[0] = 1;
  open[1 + 1 * size] = 1;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]!;
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]) => [cx + dx, cy + dy] as const)
      .filter(([x, y]) => x >= 0 && y >= 0 && x < cells && y < cells && !seen[x + y * cells]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[Math.floor(rand() * next.length)]!;
    seen[nx + ny * cells] = 1;
    // knock through the wall between, and open the room
    open[cx + nx + 1 + (cy + ny + 1) * size] = 1;
    open[nx * 2 + 1 + (ny * 2 + 1) * size] = 1;
    stack.push([nx, ny]);
  }
  // a clearing in the middle (3×3 tiles round the middle room)
  const middle = Math.floor(cells / 2) * 2 + 1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) open[middle + dx + (middle + dy) * size] = 1;
  // the way in, on the west wall
  // a room row just south of the middle (odd, so it opens into a room)
  const door = middle + 2 < size - 1 ? middle + 2 : middle;
  open[0 + door * size] = 1;
  return { size, open, door, middle };
}

/** Steps from the door to the middle (breadth-first), or -1 if you can't get there. */
export function stepsToMiddle(m: Maze): number {
  const { size, open } = m;
  const dist = new Int32Array(size * size).fill(-1);
  const q = [m.door * size];
  dist[m.door * size] = 0;
  while (q.length) {
    const i = q.shift()!;
    const x = i % size, y = Math.floor(i / size);
    if (x === m.middle && y === m.middle) return dist[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx!, ny = y + dy!;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = nx + ny * size;
      if (!open[j] || dist[j]! >= 0) continue;
      dist[j] = dist[i]! + 1;
      q.push(j);
    }
  }
  return -1;
}
