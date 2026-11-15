/** The squirrels' sprites (plugins/squirrels.ts): an Eastern grey, facing right; rows padded to 16. */
import { gridToCanvas, INK, type Grid } from '../city';

const rows = (g: string[]): Grid => g.map((r) => r.padEnd(16, '.'));

/** g grey, l light belly, t tail, e eye */
const SIT = rows([
  '', '', '', '', '', '',
  '..kkk',
  '.kttak',
  'ktttak.....kk',
  'kttak.....kggk',
  'ktak.....kggegk',
  '.ktk....kggggk',
  '..ktk.kkgggkk',
  '...ktkggllgk',
  '....kkgkkgk',
  '......k..k',
]);
const HOP = rows([
  '', '', '', '', '',
  '..kkk',
  '.kttak',
  'ktttak',
  'kttak......kk',
  'ktak......kggk',
  '.ktk.....kggegk',
  '..ktkkkkgggggk',
  '...kttgggllgkk',
  '....kkkgkkkgk',
  '',
  '',
]);
/** up a tree: just the tail, hanging out of the leaves */
const TAIL = rows(['', '', '', '', '', '', '', '', '', '', '......k', '.....ktk', '.....ktak', '.....ktak', '......kak', '.......k']);

const COLORS: Record<string, string> = { k: INK, g: '#8e8a86', l: '#e9e1d4', t: '#a39d97', a: '#c9c3bc', e: INK };
export const SQUIRREL_GRIDS = { sit: SIT, hop: HOP, tail: TAIL };

export function buildSquirrel() {
  const both = (g: Grid) => ({ right: gridToCanvas(g, COLORS, false), left: gridToCanvas(g, COLORS, true) });
  return { sit: both(SIT), hop: both(HOP), tail: both(TAIL) };
}
