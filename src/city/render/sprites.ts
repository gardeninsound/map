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
  /** the player while Shift is held: the rabbit on a bicycle */
  bike: Walker;
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
  return { rabbit: buildRabbit(), bike: buildBikeRabbit() };
}

/* The rabbit on a bicycle (hold Shift): 20×18 side on, 16×20 head on. r frame, m hub/tyre, y lamp. */
const BIKE_COLORS: Record<string, string> = { ...RABBIT_COLORS, r: '#e84a5f', m: '#9a98b0', y: '#ffd23f' };

const BIKE_RIGHT: Grid = [
  '........kk..........',
  '.......kwwk.........',
  '.......kwpk..kk.....',
  '.......kwpk.kwwk....',
  '........kwkkwpk.....',
  '........kkwwwkk.....',
  '.......kwwwwwwwk....',
  '......kwwwwwwkwk....',
  '......kwwwwwwwwpk...',
  '......kgwwwwwwwk....',
  '.......kttttttk.....',
  '......kgwwwwgwwk....',
  '..kkkk..rrrrrrrrkkk.',
  '.k....kr.r...rk.r..k',
  '.k.m.rk...r.r.k.m..k',
  '.k..mrkrrrkr..k..m.k',
  '.k....k.......k....k',
  '..kkkk.........kkkk.',
];

/** [x, y, colour char] pixels painted over a grid */
type Patch = [number, number, string][];
const paint = (g: Grid, patch: Patch): Grid => {
  const rows = g.map((r) => [...r]);
  for (const [x, y, ch] of patch) rows[y]![x] = ch;
  return rows.map((r) => r.join(''));
};
/** the two pedalling frames: the leg down and forward, then up; the hubs turn a notch */
const BIKE_RIGHT_A = paint(BIKE_RIGHT, [
  [10, 12, 'w'], [10, 13, 'w'], [11, 13, 'w'], [11, 14, 'w'], [11, 15, 'w'], [11, 16, 'k'], [12, 16, 'k'], [9, 14, 'k'],
]);
const BIKE_RIGHT_B = paint(BIKE_RIGHT, [
  [10, 12, 'w'], [11, 12, 'w'], [11, 13, 'k'], [12, 13, 'k'], [9, 16, 'k'],
  [3, 14, '.'], [4, 14, 'm'], [4, 15, '.'], [3, 15, 'm'], [16, 14, '.'], [17, 14, 'm'], [17, 15, '.'], [16, 15, 'm'],
]);

/** head on: the top of the rabbit, handlebars (with a headlight, or none from behind), knees, the tyre */
const bikeFront = (top: Grid, bar: string, legs: Grid): Grid => [...top.slice(0, 12), bar, '..kk.kwrrwk.kk..', ...legs];
const BAR_FRONT = 'kwwkkkkyykkkkwwk';
const BAR_BACK = 'kwwkkkkkkkkkkwwk';
/** one foot down, the other up, either side of the tyre */
const LEGS_A: Grid = ['....kwkmmkkk....', '....kwkmmk......', '....kkkmmk......', '......kmmk......', '......kmmk......', '.......kk.......'];
const LEGS_B: Grid = ['....kkkmmkwk....', '......kmmkwk....', '......kmmkkk....', '......kmmk......', '......kmmk......', '.......kk.......'];
/** from behind, a red reflector on the mudguard */
const reflector = (g: Grid) => paint(g, [[7, 14, 'r'], [8, 14, 'r']]);

export const BIKE_GRIDS = {
  BIKE_RIGHT_A,
  BIKE_RIGHT_B,
  BIKE_DOWN_A: bikeFront(RABBIT_DOWN, BAR_FRONT, LEGS_A),
  BIKE_DOWN_B: bikeFront(RABBIT_DOWN, BAR_FRONT, LEGS_B),
  BIKE_UP_A: reflector(bikeFront(RABBIT_UP, BAR_BACK, LEGS_A)),
  BIKE_UP_B: reflector(bikeFront(RABBIT_UP, BAR_BACK, LEGS_B)),
};

/** The rabbit riding a bicycle, two pedalling frames per direction, optionally in another scarf. */
export function buildBikeRabbit(scarf?: string): Walker {
  const colors = scarf ? { ...BIKE_COLORS, t: scarf } : BIKE_COLORS;
  const G = BIKE_GRIDS;
  const pair = (a: Grid, b: Grid, mirror = false) => [gridToCanvas(a, colors, mirror), gridToCanvas(b, colors, mirror)];
  return {
    down: pair(G.BIKE_DOWN_A, G.BIKE_DOWN_B),
    up: pair(G.BIKE_UP_A, G.BIKE_UP_B),
    right: pair(G.BIKE_RIGHT_A, G.BIKE_RIGHT_B),
    left: pair(G.BIKE_RIGHT_A, G.BIKE_RIGHT_B, true),
  };
}

/** Draw a walker frame standing at screen point (x, y): centred, feet (or wheels) on the spot. */
export function drawStanding(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number) {
  ctx.drawImage(img, x - (img.width >> 1), y - img.height + 2);
}
