/**
 * Pixel sprites as ASCII grids: one char per pixel, '.' = transparent.
 * Each sprite is 16×16; `sprites.test.ts` checks the grids stay rectangular. Apps build
 * their own characters with `gridToCanvas` / `buildWalker` / `buildPerson`.
 */
import { INK } from './palette';

export type Grid = string[];

const RABBIT_COLORS: Record<string, string> = {
  k: INK,
  w: '#ffffff',
  g: '#d9d4ec',
  p: '#ff7eb6',
  t: '#2ec4b6',
};

const RABBIT_DOWN: Grid = [
  '....kk....kk....',
  '...kwwk..kwwk...',
  '...kwpk..kpwk...',
  '...kwpk..kpwk...',
  '...kwpk..kpwk...',
  '...kwwk..kwwk...',
  '...kkwkkkkwkk...',
  '..kwwwwwwwwwwk..',
  '..kwwkwwwwkwwk..',
  '..kwwwwppwwwwk..',
  '..kgwwwwwwwwgk..',
  '...kttttttttk...',
  '...kwwwwwwwwk...',
  '...kgwwwwwwgk...',
  '...kwwk..kwwk...',
  '....kk....kk....',
];

const RABBIT_UP: Grid = [
  '....kk....kk....',
  '...kwwk..kwwk...',
  '...kwgk..kgwk...',
  '...kwgk..kgwk...',
  '...kwwk..kwwk...',
  '...kwwk..kwwk...',
  '...kkwkkkkwkk...',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '..kgwwwwwwwwgk..',
  '...kttttttttk...',
  '...kwwwttwwwk...',
  '...kgwwttwwgk...',
  '...kwwk..kwwk...',
  '....kk....kk....',
];

const RABBIT_RIGHT: Grid = [
  '......kk........',
  '.....kwwk.......',
  '.....kwpk..kk...',
  '.....kwpk.kwwk..',
  '......kwkkwpk...',
  '......kkwwwkk...',
  '.....kwwwwwwwk..',
  '....kwwwwwwkwk..',
  '....kwwwwwwwwpk.',
  '....kgwwwwwwwk..',
  '.....kttttttk...',
  '...kkwwwwwwwk...',
  '..kwgwwwwwwgk...',
  '...kkgwwwwwgk...',
  '.....kwwk.kwwk..',
  '......kk...kk...',
];

const PERSON_DOWN: Grid = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....kskssksk....',
  '....kssssssk....',
  '.....kssssk.....',
  '....kkcccckk....',
  '...kcccccccck...',
  '..kcccccccccck..',
  '..ksccccccccsk..',
  '..kkjjjjjjjjkk..',
  '...kjjjjjjjjk...',
  '...kjjjkkjjjk...',
  '...kjjk..kjjk...',
  '...kbbk..kbbk...',
];

const PERSON_UP: Grid = PERSON_DOWN.map((row, y) =>
  y === 4 || y === 5 ? '....khhhhhhk....' : y === 6 ? '.....khhhhk.....' : row,
);

const PERSON_RIGHT: Grid = [
  '................',
  '.....kkkkk......',
  '....khhhhhk.....',
  '....khhhhhhk....',
  '....khhssksk....',
  '....khsssssk....',
  '.....ksssskk....',
  '.....kcccck.....',
  '....kcccccck....',
  '....kccsccck....',
  '....kccsccck....',
  '....kjjjjjjk....',
  '....kjjjjjjk....',
  '....kjjkkjjk....',
  '....kjjk.kjjk...',
  '....kbbk.kbbk...',
];

/** Pixel arrows: one pointing north, one north-east. The other six are 90° turns of these. */
export const ARROW_N = [
  '.....#.....',
  '....###....',
  '...#####...',
  '..#######..',
  '.#########.',
  '....###....',
  '....###....',
  '....###....',
  '....###....',
  '....###....',
  '...........',
];
export const ARROW_NE = [
  '...........',
  '....######.',
  '.....#####.',
  '......####.',
  '.....#####.',
  '....###.##.',
  '...###...#.',
  '..###......',
  '.###.......',
  '.##........',
  '...........',
];

/** Turn a square grid 90° clockwise. */
const turn = (g: Grid): Grid => g.map((_, y) => g.map((row) => row[y]).reverse().join(''));

/**
 * The direction arrow in 8 directions (0 = N, clockwise), red with an ink outline,
 * for drawing on the map at native pixels.
 */
export function buildArrows(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let dir = 0; dir < 8; dir++) {
    let g = dir % 2 === 0 ? ARROW_N : ARROW_NE;
    for (let k = 0; k < Math.floor(dir / 2); k++) g = turn(g);
    const c = document.createElement('canvas');
    c.width = c.height = g.length + 2;
    const ctx = c.getContext('2d')!;
    for (const [ox, oy, color] of [[0, 1, INK], [2, 1, INK], [1, 0, INK], [1, 2, INK], [1, 1, '#ff5d5d']] as const) {
      ctx.fillStyle = color;
      g.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && ctx.fillRect(x + ox, y + oy, 1, 1)));
    }
    out.push(c);
  }
  return out;
}

/** A musical note to float above the busker (two shapes: ♪ and ♫). */
export const NOTE_GRIDS: Grid[] = [
  ['..##', '..#.', '..#.', '..#.', '###.', '###.'],
  ['.###', '.#.#', '.#.#', '.#.#', '##.#', '#####'.slice(0, 4)],
];

export function noteCanvases(colors: string[]): HTMLCanvasElement[] {
  return colors.flatMap((c) => NOTE_GRIDS.map((g) => gridToCanvas(g, { '#': c })));
}

export const SPRITE_GRIDS = { RABBIT_DOWN, RABBIT_UP, RABBIT_RIGHT, PERSON_DOWN, PERSON_UP, PERSON_RIGHT };

export type Walker = Record<'up' | 'down' | 'left' | 'right', HTMLCanvasElement[]>;

/** A neighbor in four directions, recolored: h hair, s skin, c shirt, j pants, b shoes. */
export function buildPerson(colors: { h: string; s: string; c: string; j: string; b: string }): Walker {
  const pal = { k: INK, ...colors };
  const pair = (g: Grid, mirror = false) => [gridToCanvas(g, pal, mirror), gridToCanvas(hop(g), pal, mirror)];
  return {
    down: pair(PERSON_DOWN),
    up: pair(PERSON_UP),
    right: pair(PERSON_RIGHT),
    left: pair(PERSON_RIGHT, true),
  };
}

export function gridToCanvas(grid: Grid, colors: Record<string, string>, mirror = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = grid[0].length;
  c.height = grid.length;
  const ctx = c.getContext('2d')!;
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = colors[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(mirror ? c.width - 1 - x : x, y, 1, 1);
    });
  });
  return c;
}

/** Second walk frame: the whole body hops up a pixel. */
export const hop = (g: Grid): Grid => [...g.slice(1), '.'.repeat(g[0].length)];

export interface SpriteSet {
  /** the default player: a rabbit in a teal scarf */
  rabbit: Walker;
}

/** A sprite in four directions with a hop frame each, from a down/up/side grid set. */
export function buildWalker(grids: { down: Grid; up: Grid; right: Grid }, colors: Record<string, string>): Walker {
  const pair = (g: Grid, mirror = false) => [gridToCanvas(g, colors, mirror), gridToCanvas(hop(g), colors, mirror)];
  return { down: pair(grids.down), up: pair(grids.up), right: pair(grids.right), left: pair(grids.right, true) };
}

/** The rabbit, optionally in a different scarf (the default is teal). */
export function buildRabbit(scarf?: string): Walker {
  const colors = scarf ? { ...RABBIT_COLORS, t: scarf } : RABBIT_COLORS;
  return buildWalker({ down: RABBIT_DOWN, up: RABBIT_UP, right: RABBIT_RIGHT }, colors);
}

export function buildSprites(): SpriteSet {
  return { rabbit: buildRabbit() };
}
