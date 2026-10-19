# Bear Island (map) — Development Guide

A lo-fi SNES-style overworld of West Seattle. You walk a rabbit along the real main streets;
easels mark where Mike's art went up. Walk up, press A, Mike pops in with dialog, and each spot
opens its own way of exploring the work.

**The city itself — map, renderer, movement, neighbors, HUD — lives in `../west-seattle-map`**,
linked as `"west-seattle-map": "file:../west-seattle-map"` (edits there show up here live; map
generation, landmarks and map review all happen there). This repo is the art layer on top: art
spots, Mike, the busker and crow, and the scenes — all as `CityPlugin`s + React UI.

Sibling projects: `../bearisland` (first attempt, scrollytelling) and `../bearisland-manual`
(the written manual — source for Mike's lines and the story behind each spot).

## Commands

- `npm run dev` → http://localhost:5173/bearisland-map/ (note the base path)
- `npm test` · `npm run build` (tsc + vite) — both must be green before committing
- `npm run images [srcDir]` — raw photos/videos → `public/art/<set>/` (AVIF stills 1200 px +
  320 px thumbs, MP4 video; settings in `ENCODE` at the top of the script) + `artManifest.ts`.
  Default src `~/Downloads/bearisland/images-merged`; macOS `sips`/`mdls` + ffmpeg; incremental
  via `data/art-meta.json`; deletes outputs from older settings. Raw photos never enter the repo.
- `npm run art:publish [-- --dry-run]` — stages in git exactly the processed files the scenes show
  (slideshow picks, park signs, SPOTS thumbnails — computed with the app's own code) and untracks
  the rest. `public/art/` is gitignored; these are force-added. Code builds art URLs via
  `src/content/art.ts` (`artUrl`), never by hand.
- `npm run places` — **content/places.csv** (the art-spot spreadsheet: name, address, Mike's greeting
  with ` | ` between lines, experience key) → geocodes changed addresses via Nominatim (1 req/s) →
  writes lat/lon/status back into the CSV + `src/content/placesData.json`. Typed lat/lon with no
  address also works. Status: `geocoded` / `manual` / `approx` (still a guess). Uses
  west-seattle-map's `scripts/sheet.mjs` helpers.
- `node scripts/make-portrait.mjs` — Mike's tintype → 40×40 pixel portrait
- `node scripts/make-cup-rabbit.mjs` — traces the mug rabbit stencil from `data/source/cup-rabbit-photo.png` → `public/sprites/cup-rabbit.png`
- Deploy: push `main` → GitHub Pages via `.github/workflows/deploy.yml`, which checks out both
  repos side by side (west-seattle-map is private: read via the `WSM_DEPLOY_KEY` deploy key).
  Changes in west-seattle-map only reach the site when this repo deploys.

## Where things live

- `src/game/plugins/` — the app's `CityPlugin`s: `artSpots.ts` (easels, Mike beside live spots,
  "unvisited" beacons; targets of kind `place` carrying the `PlacedLocation`), `busker.ts`,
  `crow.ts`. App.tsx wires them into `CityGame` and handles `onInteract`.
- `src/game/sprites.ts` — Mike, the easel, the crow (same grid format as the city's sprites).
- First visit: after Mike's welcome the city's hint arrow flashes 4× toward the nearest open
  spot (remembered in localStorage). The city's `Compass` points at `ArtSpots.open`.
- `src/game/busker.ts` — the keyboard busker outside Easy Street (Junction): three original
  chiptune songs (note strings, tested for whole bars) scheduled ahead through the shared
  AudioContext (west-seattle-map's `audioContext()`). The busker plugin sets `music.level` from
  distance (`EARSHOT` tiles, eased); `game.quiet` mutes it inside art scenes; mute respected.
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
- `src/ui/` — `MikeDialog` (the city's DialogBox with Mike as default speaker/portrait), title,
  spots menu, scene boundary, `sounds` (city `sfx` + roll + caw). Styles: `west-seattle-map/ui.css`
  first, then `src/styles.css` (title, scenes, spots).

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

Unit tests cover content invariants (every spot has art and sits by a walkable street), the
slideshows, busker songs, crow flight, sprites. City tests live in west-seattle-map. For visuals, drive real Chrome: `playwright-core` from `~/code/games/arcade/node_modules`
with `channel: 'chrome'`; save shots under `screenshots/` (gitignored). In dev, `window.__game` is
the live `CityGame`, plus `__art`, `__busker`, `__crow` (the plugins) for scripted checks.
