# Bear Island (map) — Development Guide

A lo-fi SNES-style overworld of West Seattle. You walk a rabbit along the real main streets
(generated from OpenStreetMap); easels mark where Mike's art went up. Walk up, press A, Mike
pops in with dialog, and each spot opens its own way of exploring the work.

Sibling projects: `../bearisland` (first attempt, scrollytelling) and `../bearisland-manual`
(the written manual — source for Mike's lines and the story behind each spot).

## Commands

- `npm run dev` → http://localhost:5173/bearisland-map/ (note the base path)
- `npm test` · `npm run build` (tsc + vite) — both must be green before committing
- `npm run images [srcDir]` — raw photos/videos → `public/art/<set>/` + `src/content/artManifest.ts`
  (default src `~/Downloads/bearisland/images-merged`; macOS `sips`/`mdls` + ffmpeg; incremental via `data/art-meta.json`)
- `node scripts/fetch-osm.mjs` — refetch OSM → `data/osm/west-seattle.json` (rarely; Overpass is often busy, it retries)
- `npm run map` — geocode the sheets, then rasterize OSM → `src/world/worldData.json` +
  `screenshots/map-preview.png`. **All map knobs are in `scripts/map-config.mjs`** (tile size,
  road width per class / per street name, simplify tolerance, house size cut-off).
- `npm run map:review <label>` — with the dev server up, screenshots fixed spots (+ every landmark)
  into `screenshots/review/<label>/` via the dev-only `?at=lat,lon` URL. Run before and after a
  map tweak and compare.
- `npm run places` — also geocodes **content/landmarks.csv** (hand-drawn buildings: id, address,
  `w`/`h` in tiles, `sprite`) → `src/content/landmarksData.json`; build-map clears a footprint
  touching the street nearest the address and the renderer draws `src/game/render/landmarks.ts`.
- `npm run places` — **content/places.csv** (the art-spot spreadsheet: name, address, Mike's greeting
  with ` | ` between lines, experience key) → geocodes changed addresses via Nominatim (1 req/s) →
  writes lat/lon/status back into the CSV + `src/content/placesData.json`. Typed lat/lon with no
  address also works. Status: `geocoded` / `manual` / `approx` (still a guess).
- `npm run map -- --procedural` — the old look (invented houses) for comparison
- `node scripts/make-portrait.mjs` — Mike's tintype → 40×40 pixel portrait
- `node scripts/make-cup-rabbit.mjs` — traces the mug rabbit stencil from `data/source/cup-rabbit-photo.png` → `public/sprites/cup-rabbit.png`
- Deploy: push `main` → GitHub Pages via `.github/workflows/deploy.yml` (Pages source = GitHub Actions)

## Where things live

- `src/world/` — tile grid (12 m/tile) + street names + named storefronts (`world.ts` decodes
  `worldData.json`; tile codes must match `scripts/build-map.mjs`). Only the largest connected road
  network is walkable. Buildings come from OSM footprints: small → house, shop/commercial-zone →
  gray storefront, apartments/other big → tan block, church/school → brick. Houses come from all
  ~30k OSM house footprints, one tile at each centroid (stepped back off the sidewalk). Bridges are
  walkable roads (Admiral Way crosses Schmitz Park on one); only motorways aren't.
  Roads: each street's OSM ways are chained, cut into blocks at intersections, simplified,
  near-axis runs snapped onto the grid (tile centre for odd widths, tile edge for even, and a
  block carries its column through an intersection), then with `octilinear` rewritten as
  straight + exact-45° pieces. Turn ramps are dropped. A tile is walkable road iff its centre
  is within width/2 of a centreline (`strokeTiles`); the centrelines are exported as
  `roadLines` and the renderer paints asphalt / 1 px curb / 4 px sidewalk per pixel by distance
  (`paintRoads` in tileArt.ts; asphalt beats curb beats sidewalk across roads), then redraws
  buildings on top. So what's drawn as road is what's walkable, with no per-tile corner rules.
- First visit: after Mike's welcome a red arrow flashes 4× toward the nearest open spot
  (`Game.showDirectionHint`, remembered in localStorage). The HUD compass (`ui/Compass.tsx`)
  always points at the nearest spot with a scene.
- `src/game/` — `Game.ts` (canvas loop, camera, actors), `movement.ts` (pure, tested: per-axis
  slide + sidestep so diagonal staircase streets don't snag), `input.ts` (keyboard + touch pad
  share one controller), `render/` (palette, ASCII-grid sprites, procedural tile art in cached chunks).
- `src/game/npcs.ts` — wandering neighbors (pure `wander`, tested), crowded toward shops; their
  lines live in `src/content/neighbors.ts`.
- `src/game/busker.ts` — the keyboard busker outside Easy Street (Junction): three original
  chiptune songs (note strings, tested for whole bars) scheduled ahead through the shared
  AudioContext (`audioContext()` in ui/sfx.ts). `Game` sets `music.level` from distance
  (`EARSHOT` tiles, eased) and `quiet` mutes it inside art scenes; mute button respected.
- `src/game/crow.ts` — the snack crow (pure flight state, tested). Starts outside Les Schwab on
  Alaska; asks for snacks (choice → reply), then flies to the next perch in
  `src/content/crow.ts` (storefront regex + lat/lon fallback, lines per stop) and loops home,
  remembering how often you shared. App's `talk` overlay takes `choices` and a `then` callback.
- `src/content/` — **content is data**: `locations.ts` (spots, coords, Mike's greetings),
  `wallTurns.ts` (scene script), `artManifest.ts` (generated, date-ordered).
- `src/experiences/` — one scene per spot, lazy-loaded via `registry.ts`, wrapped in
  `SceneBoundary` (a crash drops back to the map). A location with no `experience` shows Mike's
  "coming soon" lines.
  - `WallTurns` — gas-station wall photo flipbook with a paint-roller wipe.
  - `cup/` — **three.js**: the Lulu mug in 3D (`CupScene`), rendered at 1/3 res for the pixel look.
    You paint the next version over the current one (`CupPainter`: base + next-through-mask canvas
    → CanvasTexture). Versions are data in `src/content/cupVersions.ts`, reconstructed from the
    photos (the photos themselves aren't shown).
  - `park/` — **three.js, first person**: the Seven+ Stories lot at 4731 40th Ave SW (`ParkScene`).
    Arrows/WASD walk & turn, drag to look; face a sign within ~3 m and press A for the full
    photo + Mike's line. Signs (photo crop, posts, position, facing, words) are data in
    `src/content/puppyPark.ts`; a sign whose photo isn't deployed shows its dominant colour.
- `src/ui/` — DialogBox (typewriter, portrait, choices), HUD, title, touch pad, sfx.

## Conventions

1. Pixel art: the canvas renders at native res (16px tiles) and is CSS-scaled by an integer zoom
   with `image-rendering: pixelated`. Keep new art on that grid; draw text with Press Start 2P.
2. New scene = component in `src/experiences/`, register it, set `experience` on the location,
   put its words in `src/content/`. Scenes get `{ location, onExit }` and read `input.on()` for A/B.
3. Honor `prefers-reduced-motion` (typewriter → instant, roller → cut).
4. Coordinates flagged `approx: true` are guesses until Mike confirms.
5. Mike's lines are drafts adapted from the manual — his to rewrite.
6. Never write "press A" in copy: KeyA is WASD-left. Use `{A}` / `{B}` tokens (DialogBox swaps in
   SPACE/ESC on keyboards, A/B on touch) or `buttonLabel()` in components.

Gotcha: fontsource packages with an `exports` map append `.css` themselves — import
`@fontsource/big-shoulders-stencil-display/800`, not `…/800.css` (declared in `src/fonts.d.ts`).

## Verifying

Unit tests cover movement, sprites, content invariants (every spot has art and sits by a walkable
street). For visuals, drive real Chrome: `playwright-core` from `~/code/games/arcade/node_modules`
with `channel: 'chrome'`; save shots under `screenshots/` (gitignored). In dev, `window.__game` is
the live `Game` (move the player, find NPCs) for scripted checks.
