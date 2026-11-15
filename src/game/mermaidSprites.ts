/** A mermaid on her rock, facing right: hair h, skin s, shell top p, tail t, fin f, rock r. Rows padded to 16. */
import { gridToCanvas, INK, type Grid } from '../city';

const rows = (g: string[]): Grid => g.map((r) => r.padEnd(16, '.'));

const BODY = [
  '',
  '.....kkkk',
  '....khhhhk',
  '...khhsssk',
  '...khskssk',
  '...khssssk',
  '..khhkssk',
  '..khkppsk',
  '..khksssk',
  '...kkttttk',
  '....kttttk',
];
const FIN_DOWN = [
  '..kkkkktttk..kk',
  '.krrrrrkttkkkffk',
  'krrrrrrrkttttffk',
  'krrrrrrrrkkkkkk',
  '.kkkkkkkkk',
];
const FIN_UP = [
  '..kkkkktttk.kffk',
  '.krrrrrktttttfk',
  'krrrrrrrkkkkkk',
  'krrrrrrrrk',
  '.kkkkkkkkk',
];

export const MERMAID_GRIDS = { still: rows([...BODY, ...FIN_DOWN]), flick: rows([...BODY, ...FIN_UP]) };

export function buildMermaid(hair: string, tail: string): HTMLCanvasElement[] {
  const colors: Record<string, string> = { k: INK, h: hair, s: '#f1c9a5', p: '#ffd23f', t: tail, f: tail, r: '#7d7a78' };
  return [MERMAID_GRIDS.still, MERMAID_GRIDS.flick].map((g) => gridToCanvas(g, colors, false));
}
