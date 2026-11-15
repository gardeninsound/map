/**
 * The forest maze in Schmitz Preserve (idea box #42, "forests could be like a maze, but you
 * could always teleport out"): paths wind between the old-growth trees from a gap on the
 * west side to a clearing with a fairy ring in the middle. Lost? {B} hops you back out.
 * Words are drafts — Mike's to rewrite.
 */
/** the maze's north-west corner (all forest, 29 × 29 tiles) */
export const MAZE_NW = { lat: 47.575397, lon: -122.402832 };
export const MAZE_CELLS = 14;
export const MAZE_SEED = 42;

export const MAZE_NAME = 'Schmitz Preserve maze';

/** shown at the top while you're in it; {B} is swapped for the right button */
export const mazeHint = 'Lost? {B} hops you out';

/** the fairy ring in the middle */
export const mazeMiddle = {
  label: { name: 'A fairy ring', where: 'the middle of the maze', verb: 'look' },
  lines: [
    'You found the middle! A ring of little mushrooms, right where the old trees lean together.',
    'Somebody left a lemon drop on the biggest one. It might be for you.',
  ],
};
