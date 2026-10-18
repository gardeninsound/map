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
 * unless it's named in `byName`. Widths are measured square to the road, so a diagonal
 * street is as wide as a straight one.
 */
export const ROADS = {
  byClass: { primary: 3, secondary: 3, tertiary: 3, link: 2 },
  byName: {
    'California Ave SW': 4, // the spine of it all
  },
  /** Douglas–Peucker tolerance in tiles: straightens GPS wobble so widths stay even */
  simplify: 0.8,
  /**
   * Runs of a street within `maxAngle`° of north–south / east–west are snapped dead
   * straight (one shared x or y) as long as no point moves more than `tolerance` tiles.
   * This is what lines up both halves of California at the Junction.
   */
  axisSnap: { maxAngle: 14, tolerance: 1.5 },
  /** Turn ramps (*_link) clutter intersections at this scale; leave them out. */
  dropLinks: true,
  /** Unnamed stubs shorter than this (tiles) are left out too. */
  minUnnamedLength: 8,
};

/** Houses come from OSM footprints, one tile each, never touching the street. */
export const HOUSES = {
  maxArea: 600, // m²; bigger "house" footprints are treated as blocks
};
