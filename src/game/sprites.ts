/**
 * Bear Island's own sprites: Mike, the lemons that mark art spots (src/game/lemon.ts), and
 * the snack crow.
 * Same ASCII-grid format as the city's sprites (src/city/render/sprites.ts).
 */
import { gridToCanvas, hop, INK, type Grid, type Walker } from '../city';
import { LEMON, LEMON_RIPE, LEMON_UNRIPE } from './lemon';

const MIKE_COLORS: Record<string, string> = {
  k: INK,
  h: '#6b4a2b',
  s: '#f1c27d',
  c: '#9aa5bd',
  j: '#3d5a99',
  b: '#4a3426',
};

const MIKE_DOWN: Grid = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khsssshk....',
  '....kskssksk....',
  '....kssssssk....',
  '....khhsshhk....',
  '....khhhhhhk....',
  '.....khhhhk.....',
  '...kccccccccck..',
  '..kcccccccccck..',
  '..ksccccccccsk..',
  '..kkjjjjjjjjkk..',
  '...kjjjkkjjjk...',
  '...kjjjk.kjjjk..',
  '...kbbbk.kbbbk..',
];




/** The snack crow, perched (facing right): b body, s sheen, w eye, n beak and feet. */
const CROW_PERCH: Grid = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........kkk...',
  '.........kbbbk..',
  '.........kbwbkk.',
  '.........kbbbnnk',
  '.....kkkkbbbbkk.',
  '...kkbssbbbbbk..',
  '.kkbbssbbbbbbk..',
  'kbbkkbbbbbbbk...',
  '.kk..kkbbbbk....',
  '.......nk.nk....',
  '......nn.nn.....',
];

/** In flight: wings up, wings down. */
const CROW_FLY_UP: Grid = [
  '................',
  '................',
  '....kkk.........',
  '....kbbk........',
  '.....kbbk.......',
  '......kbbk..kkk.',
  '.kkk...kbk.kbwbk',
  'kbbbkkkkbbkbbbnn',
  '.kkbbbbbbbbbbbk.',
  '...kkbbbbbbbkk..',
  '.....kkkkkkk....',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const CROW_FLY_DOWN: Grid = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '............kkk.',
  '.kkk.......kbwbk',
  'kbbbkkkkkkkbbbnn',
  '.kkbbbbbbbbbbbk.',
  '...kkbbbbbbbkk..',
  '.....kkbbbbk....',
  '.......kbbk.....',
  '........kbk.....',
  '.........k......',
  '................',
  '................',
];

const CROW_COLORS: Record<string, string> = { k: INK, b: '#191526', s: '#5a4d99', w: '#ffffff', n: '#8a86a0' };


export type { Walker };

export interface CrowSprites {
  /** perched, [still, hop]; up/down reuse the side views */
  perch: Walker;
  fly: Record<'left' | 'right', HTMLCanvasElement[]>;
}

export function buildCrow(): CrowSprites {
  const side = (mirror: boolean) => [gridToCanvas(CROW_PERCH, CROW_COLORS, mirror), gridToCanvas(hop(CROW_PERCH), CROW_COLORS, mirror)];
  const right = side(false);
  const left = side(true);
  const wings = (mirror: boolean) => [CROW_FLY_UP, CROW_FLY_DOWN].map((g) => gridToCanvas(g, CROW_COLORS, mirror));
  return { perch: { right, left, down: right, up: left }, fly: { right: wings(false), left: wings(true) } };
}


export const BEAR_GRIDS = { MIKE_DOWN, CROW_PERCH, CROW_FLY_UP, CROW_FLY_DOWN };

/** Mike, standing by his art: two bob frames. */
export function buildMike(): HTMLCanvasElement[] {
  return [gridToCanvas(MIKE_DOWN, MIKE_COLORS), gridToCanvas(hop(MIKE_DOWN), MIKE_COLORS)];
}

/** The art-spot marker, a lemon with its shadow: ripe for open spots, still green for coming soon. */
export function buildLemons(): { ripe: HTMLCanvasElement; unripe: HTMLCanvasElement } {
  return { ripe: gridToCanvas(LEMON, LEMON_RIPE), unripe: gridToCanvas(LEMON, LEMON_UNRIPE) };
}
