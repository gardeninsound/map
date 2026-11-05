/**
 * Bear Island's own sprites: Mike, the spinning lemons and their hearts that mark art spots
 * (src/game/lemonSpin.ts, colours from src/game/lemon.ts), and
 * the snack crow.
 * Same ASCII-grid format as the city's sprites (src/city/render/sprites.ts).
 */
import { gridToCanvas, hop, INK, type Grid, type Walker } from '../city';
import { LEMON_RIPE, LEMON_UNRIPE } from './lemon';
import { HEART, HEART_BEAT, lemonSpin } from './lemonSpin';

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

/** The chicken, facing right: w feathers, g shade, r comb + wattle, y beak, o feet. */
const CHICKEN: Grid = [
  '................',
  '..........rr....',
  '.........rrrr...',
  '.........kwwk...',
  '........kwwkwk..',
  '........kwwwwyy.',
  '........kwwwwk..',
  '..k.....krwwk...',
  '.kwk...kwwwwk...',
  '.kwwkkkwwwwwwk..',
  '.kwwwwwwgwwwwk..',
  '..kwwwggggwwwk..',
  '...kwwwwwwwwk...',
  '....kkkkkkkk....',
  '......o..o......',
  '.....oo.oo......',
];
const CHICKEN_COLORS: Record<string, string> = { k: INK, w: '#f6f4ef', g: '#d8d0c0', r: '#e4202c', y: '#e0a93a', o: '#e07a2a' };

/** Pecking: the head (comb to wattle, right of the body) dips two pixels to the ground. */
const peck = (g: Grid): Grid => {
  const out = g.map((row) => row.split(''));
  for (let y = 0; y < 8; y++) for (let x = 8; x < 16; x++) out[y][x] = '.';
  for (let y = 0; y < 8; y++) for (let x = 8; x < 16; x++) if (g[y][x] !== '.') out[y + 2][x] = g[y][x];
  return out.map((r) => r.join(''));
};


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


export const BEAR_GRIDS = { MIKE_DOWN, CROW_PERCH, CROW_FLY_UP, CROW_FLY_DOWN, CHICKEN, CHICKEN_PECK: peck(CHICKEN) };

/** The chicken: [standing, pecking] facing each way; up/down reuse the side views. */
export function buildChicken(): Walker {
  const frames = (mirror: boolean) => [CHICKEN, peck(CHICKEN)].map((g) => gridToCanvas(g, CHICKEN_COLORS, mirror));
  const right = frames(false);
  const left = frames(true);
  return { right, left, down: right, up: left };
}

/**
 * The pegasus from Pegasus Books (facing right, 24×20, feet on the bottom row): white, with the
 * yellow wings and teal mane of the horse painted in the shop's window. w white, g shade,
 * m mane, y/o wing, h hoof, n nose. Built from parts: a body, legs, and a wing laid over it.
 */
const PEG_COLORS: Record<string, string> = { k: INK, w: '#ffffff', g: '#d9d4ec', m: '#2ec4b6', y: '#ffd166', o: '#e8a33a', h: '#6b4a2b', n: '#f4a6b8' };

const PEG_BODY: Grid = [
  '........................',
  '..................k.....',
  '.................kwk....',
  '................kwwwwk..',
  '...............kmwwkwwk.',
  '...............kmwwwwwwk',
  '..............kmmwwwwwnk',
  '..............kmwwkkkkk.',
  '.............kmmwwk.....',
  '....kkkkkkkkkmwwwwk.....',
  '.kkkwwwwwwwwwwwwwwk.....',
  'kmmkwwwwwwwwwwwwwwk.....',
  'kmk.kwwwwwwwwwwwwgk.....',
  'km..kgwwwwwwwwwwggk.....',
  '.k..kggwwwwwwwwwggk.....',
  '....kkkkkkkkkkkkkkk.....',
];
/** rows 16–19: standing, mid-stride, and tucked up in flight */
const PEG_LEGS = {
  stand: ['.....kwkkwk..kwkkwk.....', '.....kwkkwk..kwkkwk.....', '.....kwkkwk..kwkkwk.....', '.....khkkhk..khkkhk.....'],
  stride: ['.....kwkkwk..kwkkwk.....', '....kwk..kwkkwk..kwk....', '...kwk....kwkkwk...kwk..', '...khk....khkkhk...khk..'],
  tucked: ['....kwk.......kwwk......', '...kwk.........kwwk.....', '..khk...........khk.....', '........................'],
};
/** wings, laid over the body at [x, y]; '.' lets the body show through */
const PEG_WINGS: Record<'folded' | 'up' | 'down', [number, number, Grid]> = {
  folded: [6, 10, ['.yyyyyyy', 'yooyyyyy', '..yyyyyy', '..kkkkkk']],
  up: [3, 0, ['.kk........', '.kyyk......', '..kyyyk....', '...kyoyyk..', '....kyoyyk.', '.....kyyoyk', '......kyyyk', '.......kyyk', '........kyk', '.........yy']],
  down: [6, 13, ['..yyyyy..', '.kyoyyyk.', '.kyyoyyk.', '..kyyok..', '...kyk...', '....k....']],
};

function overlay(base: Grid, [x, y, patch]: [number, number, Grid]): Grid {
  return base.map((row, j) => {
    const p = patch[j - y];
    if (!p) return row;
    return [...row].map((ch, i) => (i >= x && i < x + p.length && p[i - x] !== '.' ? p[i - x] : ch)).join('');
  });
}

const pegasus = (legs: keyof typeof PEG_LEGS, wing: keyof typeof PEG_WINGS): Grid => overlay([...PEG_BODY, ...PEG_LEGS[legs]], PEG_WINGS[wing]);

export const PEGASUS_GRIDS = {
  stand: pegasus('stand', 'folded'),
  stride: pegasus('stride', 'folded'),
  flyUp: pegasus('tucked', 'up'),
  flyDown: pegasus('tucked', 'down'),
};

export interface PegasusSprites {
  /** [stand, stride] */
  walk: Record<'left' | 'right', HTMLCanvasElement[]>;
  /** [wings up, wings down] */
  fly: Record<'left' | 'right', HTMLCanvasElement[]>;
}

export function buildPegasus(): PegasusSprites {
  const G = PEGASUS_GRIDS;
  const frames = (grids: Grid[], mirror: boolean) => grids.map((g) => gridToCanvas(g, PEG_COLORS, mirror));
  return {
    walk: { right: frames([G.stand, G.stride], false), left: frames([G.stand, G.stride], true) },
    fly: { right: frames([G.flyUp, G.flyDown], false), left: frames([G.flyUp, G.flyDown], true) },
  };
}

/** Mike, standing by his art: two bob frames. */
export function buildMike(): HTMLCanvasElement[] {
  return [gridToCanvas(MIKE_DOWN, MIKE_COLORS), gridToCanvas(hop(MIKE_DOWN), MIKE_COLORS)];
}

/** The art-spot marker, a lemon with its shadow: ripe for open spots, still green for coming soon. */
export function buildLemons(): { ripe: HTMLCanvasElement[]; unripe: HTMLCanvasElement[] } {
  const frames = lemonSpin();
  return { ripe: frames.map((g) => gridToCanvas(g, LEMON_RIPE)), unripe: frames.map((g) => gridToCanvas(g, LEMON_UNRIPE)) };
}

/** The little heart over each lemon, [resting, mid-beat]: red over open spots, pale for coming soon. */
export function buildHearts(): { open: HTMLCanvasElement[]; soon: HTMLCanvasElement[] } {
  const colors = (r: string, h: string) => ({ k: INK, r, h });
  return {
    open: [HEART, HEART_BEAT].map((g) => gridToCanvas(g, colors('#e4202c', '#ffd0c8'))),
    soon: [HEART, HEART_BEAT].map((g) => gridToCanvas(g, colors('#e8a59a', '#ffffff'))),
  };
}
