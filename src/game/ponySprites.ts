/** A meadow pony, facing right (20×16): coat c, mane m, ink k. Rows padded to 20. Two trotting frames, one grazing. */
import { gridToCanvas, INK, type Grid } from '../city';

const rows = (g: string[]): Grid => g.map((r) => r.padEnd(20, '.'));

const TOP = [
  '',
  '..............mm',
  '.............mmmk',
  '............mmcck',
  '...........mmcccck',
  '...........mcckcck',
  '...........mcccccck',
  '..m.......mmccccckk',
  '.mmm.....mmccckkk',
  'mmmmkkkkkkcccck',
  'mmmkccccccccccck',
  'mm.kcccccccccccck',
  '.m.kcccccccccccck',
  '...kcckkkkkkkcck',
];
/** head down in the grass */
const GRAZE_TOP = [
  '', '', '', '', '', '', '',
  '..m',
  '.mmm',
  'mmmmkkkkkkkkm',
  'mmmkccccccccmmk',
  'mm.kccccccccccmk',
  '.m.kcccccccccccck',
  '...kcckkkkkkkcckck',
];

export const PONY_GRIDS = {
  trotA: rows([...TOP, '...kck.......kck', '...kk........kk']),
  trotB: rows([...TOP, '..kck.........kck', '..kk..........kk']),
  graze: rows([...GRAZE_TOP, '...kck.......kckk', '...kk........kk']),
};

export interface PonySprites {
  trot: Record<'left' | 'right', HTMLCanvasElement[]>;
  graze: Record<'left' | 'right', HTMLCanvasElement>;
}

export function buildPony(coat: string, mane: string): PonySprites {
  const c: Record<string, string> = { k: INK, c: coat, m: mane };
  const side = (mirror: boolean) => [PONY_GRIDS.trotA, PONY_GRIDS.trotB].map((g) => gridToCanvas(g, c, mirror));
  return {
    trot: { right: side(false), left: side(true) },
    graze: { right: gridToCanvas(PONY_GRIDS.graze, c, false), left: gridToCanvas(PONY_GRIDS.graze, c, true) },
  };
}
