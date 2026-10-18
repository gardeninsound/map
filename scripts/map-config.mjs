/**
 * Every knob for the generated map, in one place. Edit, then `npm run map` and
 * `npm run map:review <label>` to compare screenshots of the same spots.
 */
export const MAP = {
  /** south, west, north, east */
  bbox: [47.516, -122.422, 47.597, -122.35],
  /** metres per tile. 12 m ≈ a house lot; a house sprite fills ~9 m of it */
  tileMeters: 12,
};

/**
 * Road widths in whole tiles (sidewalks included — they're drawn on the road's edge tiles).
 * A street keeps ONE width along its whole length: its most common class by length decides,
 * unless it's named in `byName`. Real rights-of-way here are ~18–25 m, so 2 tiles (24 m)
 * is honest for most streets, California included, next to 12 m house lots.
 */
export const ROADS = {
  byClass: { primary: 2, secondary: 2, tertiary: 2, link: 2 },
  byName: {
    'Fauntleroy Way SW': 3, // divided four-lane — genuinely wider
  },
  /** Douglas–Peucker tolerance in tiles: straightens GPS wobble so widths stay even */
  simplify: 0.6,
};

/** Houses come from OSM footprints, one tile each, never touching the street. */
export const HOUSES = {
  maxArea: 600, // m²; bigger "house" footprints are treated as blocks
};
