/**
 * The art-spot marker: a lemon with its own shadow, traced from data/source/lemon-photo.png
 * by scripts/make-lemon.mjs — don't edit by hand, rerun the script.
 * k outline, d/m/l/h lemon shades dark → highlight, s shadow.
 */
export const LEMON: string[] = [
  '.......kkkkkkkk.......',
  '.....kklllllllmkk.....',
  '....kllllhhllllmmk....',
  '...klllhhhhhlllmmk....',
  '..kmllhhhhhhlllmmmk...',
  '..kmlllhhhhllllmmmdk..',
  '.kmmmllhhhhllllmmmddk.',
  '.kmmmllhhhlllmmmmmddk.',
  '.klmmlllllllmmmmddddk.',
  'kllmmmlllmmmmmmddddk..',
  'kmmmmmmmmmmmmmdddddk..',
  '.kddmmmmmmmmmdddddk...',
  '..kdmmmmmmmmddddddk...',
  '..kmmmmmmmmddddddmks..',
  '..skmmmmmdddmmmmmkssss',
  '..sskmmmmmmmmmmkkssss.',
  '.sssskkkkkkkkkkssssss.',
  '.sssssssssssssssssss..',
  '.....ssssssssssss.....',
  '.........sss..........',
];

/** row of the lemon's base (where it sits on the ground) */
export const LEMON_BASE = 16;

export const LEMON_RIPE: Record<string, string> = {
  k: '#2a1a12',
  d: '#b8741a',
  m: '#d9951f',
  l: '#ecb52e',
  h: '#f8d873',
  s: 'rgba(42,26,18,0.45)',
};

/** coming soon: the same lemon, still green */
export const LEMON_UNRIPE: Record<string, string> = {
  ...LEMON_RIPE,
  d: '#5f8a2c',
  m: '#7aa63a',
  l: '#9cc252',
  h: '#c8e08a',
};
