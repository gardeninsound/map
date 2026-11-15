/**
 * Sites: places the map needs that OpenStreetMap doesn't have (or has wrong), as data the map
 * build draws in every time, instead of hand edits to worldData.json that the next
 * `npm run map` would erase. One JSON file per site in scripts/city/sites/.
 *
 * A site is:
 *   anchor     lat/lon of the top-left corner of its grid's first cell
 *   grid       rows of cells (the legend below), one character per map tile
 *   label      a map label (lat/lon, size in tiles, kind), optional
 *   roadLines  paths for the renderer ([lat, lon] points; `w` in tiles, `k: 1` for a path)
 *   features   pitches, tracks, bleachers… for render/detailArt.ts (rings of [lat, lon])
 *   tag        extra fields copied onto each road line and feature it adds
 * Anchored by lat/lon, a site stays put if the map's area changes; it records `tileMeters`,
 * and a build at another tile size refuses it (the grid would no longer fit).
 *
 * Pure (no files, no globals): tested in sites.test.mjs.
 */

/** what each grid character does to its tile */
export const CELLS = {
  '.': { tile: null, named: false }, // leave as built
  l: { tile: 'LAWN', named: false },
  w: { tile: 'ROAD', named: true }, // walkable, carries the site's name in the HUD
  W: { tile: 'ROAD', named: false },
  n: { tile: null, named: true },
};

/** Problems with a site file, as messages (empty = fine). */
export function checkSite(site, tileMeters) {
  const errs = [];
  if (!site.id || !site.name) errs.push('needs an id and a name');
  if (site.tileMeters !== tileMeters) errs.push(`drawn for ${site.tileMeters} m tiles, the map uses ${tileMeters} m`);
  if (!site.anchor || typeof site.anchor.lat !== 'number' || typeof site.anchor.lon !== 'number') errs.push('needs anchor { lat, lon }');
  const rows = site.grid ?? [];
  if (!rows.length) errs.push('needs a grid');
  if (rows.some((r) => r.length !== rows[0].length)) errs.push('grid rows must all be the same length');
  const bad = [...new Set(rows.join(''))].filter((c) => !(c in CELLS));
  if (bad.length) errs.push(`unknown grid cells: ${bad.join(' ')}`);
  return errs.map((e) => `site ${site.id ?? '?'}: ${e}`);
}

/**
 * Draws a site into the map being built. `map` is the build's state:
 *   { tiles (Uint8Array), road (Uint16Array), w, h, T (tile codes), toX(lon), toY(lat), nameIdx(name) }
 * Changes `tiles` and `road` in place; returns what to add to the output:
 *   { roadLines, features, label, cells } (cells = how many tiles it changed).
 */
export function applySite(site, map) {
  const { tiles, road, w, h, T, toX, toY, nameIdx } = map;
  const x0 = Math.round(toX(site.anchor.lon));
  const y0 = Math.round(toY(site.anchor.lat));
  if (x0 < 0 || y0 < 0 || x0 + site.grid[0].length > w || y0 + site.grid.length > h) throw new Error(`site ${site.id}: outside the map`);
  const name = site.grid.some((r) => /[wn]/.test(r)) ? nameIdx(site.name) : 0;
  let cells = 0;
  site.grid.forEach((row, dy) =>
    [...row].forEach((c, dx) => {
      const cell = CELLS[c];
      const i = x0 + dx + (y0 + dy) * w;
      if (cell.tile) tiles[i] = T[cell.tile];
      if (cell.named) road[i] = name;
      if (cell.tile || cell.named) cells++;
    }),
  );
  const at = ([lat, lon]) => [+toX(lon).toFixed(2), +toY(lat).toFixed(2)];
  const tag = site.tag ?? {};
  return {
    cells,
    roadLines: (site.roadLines ?? []).map((r) => ({ ...r, p: r.p.map(at), ...tag })),
    features: (site.features ?? []).map((f) => ({ ...f, rings: f.rings.map((ring) => ring.map(at)), ...tag })),
    label: site.label
      ? { name: site.name, kind: site.label.kind ?? 'park', x: +toX(site.label.lon).toFixed(1), y: +toY(site.label.lat).toFixed(1), size: site.label.size }
      : null,
  };
}
