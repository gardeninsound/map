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

/* The pelican who points out the idea box (src/ui/Pelican.tsx): white, black wingtips, a big
 * yellow pouch under an orange bill. Facing right; 24 wide. Rows are padded out to the width. */
const PEL_COLORS: Record<string, string> = { k: INK, w: '#ffffff', g: '#c9c6d6', b: '#2b2b38', o: '#f2a33a', y: '#ffd166' };
const PEL_W = 24;
const pad = (rows: string[], h: number): Grid => [...rows, ...Array(Math.max(0, h - rows.length)).fill('')].map((r) => r.padEnd(PEL_W, '.'));

const PELICAN_STAND = pad([
  '.....kkk',
  '....kwwwk',
  '...kwwwwwkkkkkkkkkk',
  '...kwwkwwoooooooooook',
  '...kwwwwkyyyyyyyyyok',
  '....kwwkkyyyyyyyyk',
  '....kwwk.kkkkkkkk',
  '....kwwk',
  '....kwwk',
  '...kwwwk',
  '..kwwwwwkk',
  '.kwwwwwwwwkk',
  'kgggwwwwwwwwk',
  'kbggggwwwwwwk',
  'kbbgggggwwwwk',
  '.kbbbggggwwk',
  '..kkkbbgwwk',
  '....kkkkkk',
  '.....ko.ko',
  '....koo.koo',
], 20);

/** in flight the neck folds back and the bill rests on the chest */
const PELICAN_BODY = pad([
  '', '', '', '', '', '', '',
  '...............kkk',
  '..............kwwwk',
  '.............kwwkwwkkkkk',
  'kk........kkwwwwwooooook',
  'kwwkkkkkkkwwwwwwkyyyyok.',
  '.kwwwwwwwwwwwwwwwkkkkk..',
  '..kkwwwwwwwwwwwwk.......',
  '....kkkkkkkkkkkk........',
], 18);
const PEL_WING_UP = pad(['...kk', '..kbbk', '..kbbgk', '...kbggk', '...kgggk', '....kgggk', '....kggggk', '.....kgggwk', '.....kggwwk', '......kgwwk', '......kkwwk'], 11);
const PEL_WING_DOWN = pad(['.....kgggggk', '......kgggggk', '......kggggk', '.......kgggk', '.......kbbk', '........kk'], 6);
/** paint a wing over the body, starting at row `y` */
const wing = (base: Grid, patch: Grid, y: number): Grid =>
  base.map((row, j) => {
    const p = patch[j - y];
    return p ? [...row].map((ch, i) => (p[i] && p[i] !== '.' ? p[i] : ch)).join('') : row;
  });

export const PELICAN_GRIDS = {
  stand: PELICAN_STAND,
  flyUp: wing(PELICAN_BODY, PEL_WING_UP, 0),
  flyDown: wing(PELICAN_BODY, PEL_WING_DOWN, 12),
};

export interface PelicanSprites {
  stand: Record<'left' | 'right', HTMLCanvasElement>;
  fly: Record<'left' | 'right', [HTMLCanvasElement, HTMLCanvasElement]>;
}

export function buildPelican(): PelicanSprites {
  const c = (g: Grid, mirror: boolean) => gridToCanvas(g, PEL_COLORS, mirror);
  const G = PELICAN_GRIDS;
  return {
    stand: { right: c(G.stand, false), left: c(G.stand, true) },
    fly: { right: [c(G.flyUp, false), c(G.flyDown, false)], left: [c(G.flyUp, true), c(G.flyDown, true)] },
  };
}
/**
 * Ham the cat, a Scottish Fold (16 wide, feet on the bottom row): orange tabby, ears folded
 * flat into a round head, big amber eyes, dark collar with a white tag. Walking side-on
 * (facing right, tail up) in two strides, and sitting square to you (also the portrait).
 */
const HAM_COLORS: Record<string, string> = { k: INK, o: '#c27c3e', d: '#8f5428', l: '#e3ad6c', e: '#f0b81c', p: '#1a1a1a', n: '#d98a80', c: '#2c2c30', t: '#f2f2f2' };
const HAM_HEAD: Grid = [
  '..kk............',
  '.kook...........',
  '.kok......kkkk..',
  '.kok.....kdoddk.',
  '..kok...kooooook',
  '..kokkkkkoepoepk',
  '..kooddodokolnok',
  '..koooooookoook.',
  '..koodoodoocctk.',
  '..kollllllllkk..',
];
const HAM_STRIDES: Grid[] = [
  ['...kok.kok.kok..', '...kok..kokkok..', '...kk...kk.kk...'],
  ['..kok..kok..kok.', '.kok....kok.kok.', '.kk......kk..kk.'],
];
const HAM_SIT: Grid = [
  '................',
  '....kkkkkkkk....',
  '...kddoddoddk...',
  '..kooooooooook..',
  '..koeepooeepok..',
  '..koeeppoeepok..',
  '..koooolnooook..',
  '...kooolloook...',
  '....kccctcck....',
  '...kooolloook...',
  '..koooollooook..',
  '..koodollodook..',
  '..koooollooookd.',
  '..kllookkoollkdk',
  '...kkkk..kkkkkk.',
];
/** a paw up to the face, licking */
const HAM_GROOM: Grid = HAM_SIT.map((row, y) => (y === 7 ? '...koollllook...' : y === 8 ? '....kcclllck....' : y === 9 ? '...koolllook....' : row));

export interface HamSprites {
  walk: { left: HTMLCanvasElement[]; right: HTMLCanvasElement[] };
  sit: HTMLCanvasElement;
  groom: HTMLCanvasElement;
}

export function buildHam(): HamSprites {
  const walk = (mirror: boolean) => HAM_STRIDES.map((legs) => gridToCanvas([...HAM_HEAD, ...legs], HAM_COLORS, mirror));
  return { walk: { right: walk(false), left: walk(true) }, sit: gridToCanvas(HAM_SIT, HAM_COLORS), groom: gridToCanvas(HAM_GROOM, HAM_COLORS) };
}

export const hamGrids = { head: HAM_HEAD, strides: HAM_STRIDES, sit: HAM_SIT, groom: HAM_GROOM, colors: HAM_COLORS };

/*
 * The rowboat at the end of 58th (plugins/rowboat.ts), with or without the rabbit aboard: a
 * wooden hull, the rabbit sitting in it from the waist up, oars forward and back for the two
 * rowing frames. Side on 26×16; end on 18×22. Feet (keel) on the bottom row like any walker.
 */
const HULL = '#8a5a3a', HULL_DARK = '#6b4226', DECK = '#c08a52', OAR = '#d9b07a', SPLASH = '#e8f6fb';

function boatCanvas(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, mirror = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (mirror) {
    g.translate(w, 0);
    g.scale(-1, 1);
  }
  paint(g);
  return c;
}
const fill = (g: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};
/** a 1-px line of `color` from (x0, y0) to (x1, y1) */
function line(g: CanvasRenderingContext2D, color: string, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) fill(g, color, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n));
}

/** Side on, bow to the right. `rabbit`: its right-facing frame, or null for the empty boat. */
function sideBoat(g: CanvasRenderingContext2D, rabbit: HTMLCanvasElement | null, stroke: 0 | 1 | null) {
  // the oar behind the hull
  if (stroke !== null) {
    const [x0, x1] = stroke ? [15, 21] : [11, 4];
    line(g, OAR, x0, 9, x1, 14);
    fill(g, SPLASH, x1 - 1, 15, 3, 1);
  }
  // the rabbit, from the waist up (the hull hides the rest)
  if (rabbit) g.drawImage(rabbit, 0, 0, 16, 11, 5, -1, 16, 11);
  // the hull: gunwale, planks, pointed ends
  fill(g, INK, 1, 9, 24, 1);
  fill(g, INK, 0, 10, 1, 1);
  fill(g, INK, 25, 10, 1, 1);
  fill(g, HULL, 1, 10, 24, 2);
  fill(g, INK, 1, 12, 1, 1);
  fill(g, INK, 24, 12, 1, 1);
  fill(g, HULL_DARK, 2, 12, 22, 2);
  fill(g, INK, 2, 14, 1, 1);
  fill(g, INK, 23, 14, 1, 1);
  fill(g, INK, 3, 14, 20, 1);
  fill(g, DECK, 2, 10, 22, 1);
  // the oar's blade in front of the hull on the near side
  if (stroke !== null) {
    const [x0, x1] = stroke ? [13, 19] : [13, 7];
    line(g, OAR, x0, 10, x1, 15);
  }
}

/** End on (seen from behind going up, from the front going down): pointed both ends, oars out to the sides. */
function endBoat(g: CanvasRenderingContext2D, rabbit: HTMLCanvasElement | null, stroke: 0 | 1 | null) {
  const rows: [number, number][] = [[3, 2], [3, 3], [2, 4], [2, 5], [1, 6], [1, 6], [1, 6], [1, 6], [1, 6], [1, 6], [1, 6], [1, 6], [1, 6], [2, 5], [2, 5], [3, 4], [3, 3], [4, 2]];
  rows.forEach(([inset, half], j) => {
    const y = 3 + j;
    const x0 = 9 - half - (inset > 2 ? 0 : 1);
    const w = (half + (inset > 2 ? 0 : 1)) * 2;
    fill(g, INK, x0 - 1, y, w + 2, 1);
    fill(g, j < 2 || j > rows.length - 3 ? HULL : DECK, x0, y, w, 1);
  });
  // the seat
  fill(g, HULL, 3, 13, 12, 1);
  // oars out to either side
  if (stroke !== null) {
    const dy = stroke ? 2 : -2;
    for (const [x0, x1] of [[4, 0], [13, 17]] as const) {
      line(g, OAR, x0, 12, x1, 12 + dy);
      fill(g, SPLASH, x1 - 1, 13 + dy, 2, 1);
    }
  }
  if (rabbit) g.drawImage(rabbit, 0, 0, 16, 12, 1, 2, 16, 12);
}

export interface RowboatSprites {
  /** the rabbit rowing, two strokes per direction (a Walker for the city's Vehicle) */
  rowing: Walker;
  /** the empty boat, tied up */
  empty: { side: HTMLCanvasElement; end: HTMLCanvasElement };
}

export function buildRowboat(rabbit: Walker): RowboatSprites {
  const side = (stroke: 0 | 1, mirror: boolean) => boatCanvas(26, 16, (g) => sideBoat(g, rabbit.right[0]!, stroke), mirror);
  const end = (r: HTMLCanvasElement, stroke: 0 | 1) => boatCanvas(18, 22, (g) => endBoat(g, r, stroke));
  return {
    rowing: {
      right: [side(0, false), side(1, false)],
      left: [side(0, true), side(1, true)],
      up: [end(rabbit.up[0]!, 0), end(rabbit.up[0]!, 1)],
      down: [end(rabbit.down[0]!, 0), end(rabbit.down[0]!, 1)],
    },
    empty: {
      side: boatCanvas(26, 16, (g) => sideBoat(g, null, null)),
      // from above, oars shipped: lying along the seat, blades past either end
      end: boatCanvas(18, 22, (g) => {
        endBoat(g, null, null);
        line(g, OAR, 6, 6, 6, 19);
        line(g, OAR, 11, 6, 11, 19);
        fill(g, OAR, 5, 18, 3, 2);
        fill(g, OAR, 10, 18, 3, 2);
      }),
    },
  };
}
