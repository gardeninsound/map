/**
 * Every knob for the generated map, in one place. Edit, then `npm run map` and
 * `npm run map:review <label>` to compare screenshots of the same spots.
 */
export const MAP = {
  /** south, west, north, east */
  bbox: [47.516, -122.422, 47.597, -122.35],
  /** metres per tile (16 px, so 0.75 m per pixel) */
  tileMeters: 12,
};

/**
 * Streets as they really are: every public street in OSM (arterials, residential,
 * unclassified, living streets — no alleys or driveways) on its true centreline, at its
 * true width. Widths are metres, kerb to kerb plus sidewalks, measured square to the road.
 * A way tagged with `lanes` gets lanes × laneWidth + parking + sidewalks; otherwise its
 * class default. The renderer paints exactly that width per pixel.
 */
export const ROADS = {
  /**
   * Every street is drawn (and walkable) this many times its real width, on its real
   * centreline, so there's room for characters; the blocks between give way (see HOUSES).
   */
  widthScale: 2,
  byClass: { primary: 20, secondary: 18, tertiary: 16, link: 10, residential: 12, unclassified: 11, living_street: 9 },
  /** metres; a street named here gets this width everywhere instead */
  byName: {},
  laneWidth: 3.3,
  /** metres of sidewalk (incl. planting strip) per side */
  sidewalk: 2.4,
  /** metres of parking lane across both sides, by class, when the width comes from lanes */
  parking: { primary: 2.4, secondary: 4.8, tertiary: 4.8, residential: 4.8, unclassified: 2.4 },
  /** metres: the freeway (West Seattle Bridge) — drawn, never walkable */
  freeway: 36,
  /** Douglas–Peucker tolerance in tiles: only GPS jitter (~1 m) is smoothed away */
  simplify: 0.08,
  /**
   * tiles: the walkable band is the drawn road but never thinner than this; at 12 m a
   * residential street would otherwise break into tiles touching only at corners
   */
  minWalkable: 1.5,
  /** Turn ramps (*_link) are real roads; keep them. */
  dropLinks: false,
  /** Unnamed stubs shorter than this (tiles) are left out. */
  minUnnamedLength: 2,
};

/**
 * Places drawn in detail (a park or school campus, matched by its OSM name): open lawn with
 * scattered trees instead of woods, the footpaths inside made walkable, surface parking
 * lots walkable and striped, every pitch, diamond, court, track, playground and pool painted
 * from its OSM shape, and buildings painted from their exact outlines. `bbox` (south, west,
 * north, east) is what fetch-detail.mjs downloads. `woods: true`: a forest park — it stays
 * woods, and only its open ground (grassland, grass, meadow, fields, playgrounds) is lawn.
 */
export const DETAILED = {
  places: [
    { name: 'Hiawatha Playfield', bbox: [47.5768, -122.3872, 47.5797, -122.3829] },
    { name: 'West Seattle High School', bbox: [47.5754, -122.3874, 47.5776, -122.3829] },
    // mostly forest: `woods` keeps it wooded, with only the OSM meadows, fields and play
    // areas opened up as lawn, and every trail (#1 the beach promenade … #13) walkable
    { name: 'Lincoln Park', bbox: [47.5230, -122.4030, 47.5375, -122.3915], woods: true },
  ],
  /** metres, before ROADS.widthScale: a footpath */
  pathWidth: 3,
};

/**
 * Houses come from OSM footprints, drawn at true size (16 px = 12 m, same as the roads) on
 * their real lots, as each footprint's minimum-area rectangle — never over a sidewalk.
 */
export const HOUSES = {
  maxArea: 600, // m²; bigger "house" footprints are treated as blocks
  minArea: 12, // m²; smaller footprints are left out
  /** degrees: a house this close to square-on is snapped to it (half this to 45°), for clean edges */
  snapAngle: 10,
  /** tiles of lawn kept between a house and the sidewalk's outer edge */
  clearance: 0.15,
  /** tiles a front-row house may be nudged back from a (wider than life) street; past this it shrinks */
  maxPush: 1.2,
  /** a squeezed house may shrink to this fraction of its real size before it's left out */
  minScale: 0.5,
  /** px: the smallest side a house is drawn with, so tiny ones still read */
  minPx: 6,
};

/**
 * Alleys aren't streets (fetch-osm leaves them out), but one listed here is walkable: a
 * concrete lane (like a park path: no kerb, no asphalt) on its OSM centreline. `points` are
 * [lat, lon], copied from the OSM way so it works without refetching. `name` shows in the HUD.
 */
export const ALLEYS = {
  /** metres, before ROADS.widthScale */
  width: 5,
  lanes: [
    // behind 1918 45th Ave SW (landmark `craftsman-45th`), Hill St → Holgate St; OSM way 11997225
    { name: 'Alley', points: [[47.586809, -122.388322], [47.586719, -122.388326], [47.585492, -122.388387], [47.585403, -122.388392]] },
  ],
};
