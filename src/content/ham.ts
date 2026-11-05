/**
 * Ham the cat (a Scottish Fold: folded ears, round face, big amber eyes, orange tabby, dark
 * collar with a white tag), who wanders the block around the hidden house at 1918 45th Ave SW
 * and the alley behind it. One set of lines per visit, in turn. Drafts — rewrite freely.
 */
export const HAM_NAME = 'Ham';

/** home: the sidewalk in front of the house (src/game/plugins/ham.ts snaps it to the street) */
export const hamHome = { lat: 47.586143, lon: -122.388734 };

export const hamLines: string[][] = [
  ['Mrrp?', '(Ham blinks slowly at you. That means you are friends now.)'],
  ['…', "(Ham's ears are folded flat. They always are. Ham is not cross, just a Scottish Fold.)"],
  ['Mrrrow.', "(Ham would like it known that the alley is Ham's alley.)"],
  ['(Ham sniffs your paw, then sits down on it.)', 'Prrrp.'],
  ['Mew!', "(There's a leaf stuck to Ham's tail. Ham does not want to talk about it.)"],
  ['(Ham is watching a crow. The crow is watching Ham.)', '…mrrp.'],
];
