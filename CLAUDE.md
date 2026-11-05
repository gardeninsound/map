# Bear Island (map) — Development Guide

A lo-fi SNES-style overworld of West Seattle. You walk a rabbit along the real main streets;
lemons mark where Mike's art went up (ripe = open, green = coming soon). Walk up, press A, Mike pops in with dialog, and each spot
opens its own way of exploring the work.

**The city itself — map, renderer, movement, neighbors, HUD — lives in `src/city/`**: Bear
Island's own copy, taken from [west-seattle-map](https://github.com/vlandham/west-seattle-map)
v0.1.0 and now maintained here independently. The two projects are disconnected on purpose:
west-seattle-map is its own site and goes its own way; nothing flows between them
automatically. To bring a city improvement over, port it by hand. The map data
(`src/city/world/worldData.json`) is generated here by `scripts/city/` (the OSM pipeline,
brought back from before the split; settings in `scripts/city/map-config.mjs`). On top of the
city sits the art layer: art spots, Mike, the busker and crow, and the scenes — all as
`CityPlugin`s + React UI.

Sibling projects: `../bearisland` (first attempt, scrollytelling) and `../bearisland-manual`
(the written manual — source for Mike's lines and the story behind each spot).

## Commands

- `npm run dev` → http://localhost:5173/
- `npm test` · `npm run build` (tsc + vite) — both must be green before committing (and in CI on every PR, see Git workflow)
- `npm run smoke` (after `npm run build`) — the built site in a real browser via Playwright: title, RECENT to
  the Duck Arcade, opens + closes every playable cabinet; fails on any page error, console error or 404
  (`scripts/smoke.mjs`; failure shot in `screenshots/smoke/`). Uses your Chrome locally, Chromium in CI.
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
  address also works. Status: `geocoded` / `manual` / `approx` (still a guess). CSV +
  geocoding helpers: `scripts/sheet.mjs`. `pinned`: the lemon stands exactly at the typed lat/lon
  (e.g. on a sidewalk) instead of being moved beside the nearest street.
- `npm run map:fetch` — refetch OpenStreetMap → `data/osm/` (gitignored; Overpass is often busy, it
  retries): `scripts/city/fetch-osm.mjs` (streets, buildings incl. multipolygons, parks, water…) and
  `fetch-detail.mjs` (paths, parking lots, pitches inside `DETAILED.places`).
- `npm run map` — `content/landmarks.csv` → `src/city/world/landmarksData.json` (geocoded,
  `scripts/city/landmarks.mjs`), then rasterize OSM → `src/city/world/worldData.json` +
  `screenshots/map-preview.png` (`scripts/city/build-map.mjs`). All knobs in
  `scripts/city/map-config.mjs`: street widths (true width from lanes, × `widthScale` 2), house
  push/shrink, detailed places.
- `npm run audit [-- N]` — with `npm run dev` up (set `MAP_URL` if Vite isn't on 5173): renders
  every chunk at `?audit` and counts road-drawing glitches (slivers walled in by road, loose road
  fragments; detailed places skipped), writes `screenshots/audit/audit.json` + shots of the N biggest.
- `node scripts/make-lemon.mjs` — traces the art-spot lemon + shadow from `data/source/lemon-photo.png`
  → `src/game/lemon.ts` (ASCII grid, ripe + unripe palettes)
- `node scripts/make-portrait.mjs` — Mike's tintype → 40×40 pixel portrait
- `node scripts/make-cup-rabbit.mjs` — traces the mug rabbit stencil from `data/source/cup-rabbit-photo.png` → `public/sprites/cup-rabbit.png`
- Deploy: merge to `main` → GitHub Pages via `.github/workflows/deploy.yml`. Repo: github.com/gardeninsound/map,
  live at https://gardeninsound.website (custom domain from `public/CNAME`, served at the root, `base: '/'`).
  To move it to gardeninsound.website/map/ later: `base: '/map/'`, drop `public/CNAME`, and give the
  domain to an org `gardeninsound.github.io` repo (every asset URL already uses `BASE_URL`).
- PR previews: every same-repo PR gets `https://pr-<N>-garden-preview.gardeninsound.workers.dev`, commented on the PR
  (`.github/workflows/preview.yml` → `preview/`, a files-only Worker; `wrangler versions upload --preview-alias pr-<N>`;
  secret `CLOUDFLARE_API_TOKEN`). Previews use the real relay and idea box (issues titled `[preview pr-<N>]`).

## Git workflow (everyone, Claude included)

`main` is always deployable: every merge to it goes live. Work reaches it only through a pull request.

1. **One short branch per feature, cut from fresh `main`**: `git fetch origin && git switch -c <feature> origin/main`.
   Name it for the feature (`duck-moon`, `arcade-posters`), never a catch-all. Unrelated work → its own branch.
2. **Merge within a day or two.** Bigger than that → split it, or merge the parts hidden behind a switch
   (`ready: false` cabinets, a location with no `experience`, a dev-only `?flag`) and turn it on last.
3. **Bring in `main` at the start of each session** (`git pull origin main`) and before opening the PR;
   resolve conflicts on the branch, keeping both sides' features.
4. **Small commits**, each with `npm test` + `npm run build` green (and `npm run smoke` for anything
   you can see or hear).
5. **Open a PR into `main`** (`gh pr create --fill`). The **Check** workflow (`.github/workflows/ci.yml`)
   runs the size guard, tests, build and smoke test; `main` requires it to pass.
6. **Every PR auto-merges**: `gh pr merge --auto --squash --delete-branch` — GitHub merges (= deploys)
   the moment Check is green and never if it fails; fix on the branch and it goes in. Nobody waits for
   an OK. When a PR touches the other person's area, add them as a reviewer so they hear about it — a
   heads-up, not a gate: they comment or follow up with a fix after it's live.
   - **Jim's area** (tech lead, `vlandham`): `src/city/`, `App.tsx`, `relay/`, `wish/`, `.github/`,
     `package.json` dependencies, the map data pipeline (`scripts/city/`), CLAUDE.md's dev notes.
   - **Mike's area** (`exit320-stack`): the art and the words — what a scene shows, Mike's lines and
     other copy in `src/content/`, which spots and art appear.
7. **Never push to `main` directly**, and never force-push a branch someone else is working on.

What the Check catches, so keep it that way:
- **Files the content points at must be in git** (`src/content/published.test.ts`): the deploy builds
  from a fresh checkout. Art → `npm run art:publish`; anything else → `git add`. A new kind of
  asset (a new cabinet's files, new posters) → add its paths to that test.
- **No file over 2 MB** added or changed unless listed in `.github/large-files.txt`. Compress first
  (WebP/AVIF images, MP3 audio, MP4 video); never commit raw WAVs or HTML with embedded media.
  Same for chat: give Claude a big file's *path* — attaching a multi-MB file to a message
  overflows the context and the session fails with "prompt is too long".
- **New logic gets a unit test** (pure rules/state, as for Cone Catch, the crow, Luna Park).
  A new arcade game is covered by the smoke test automatically once it's `ready`.

Claude: start new work by branching as in 1 (even if the session opened on another branch). Commit when a
piece is done and green. When asked to push/ship: push the branch, open (or update) its PR, and turn on
auto-merge (every PR, see 6); if it touches the other person's area, add them as reviewer (`--reviewer`).
`gh` on Windows: if `gh` isn't on PATH in a fresh install, use `"C:\Program Files\GitHub CLI\gh.exe"`.

## Where things live

- `src/game/plugins/` — the app's `CityPlugin`s: `artSpots.ts` (spinning lemons with a beating heart above, from `src/game/lemonSpin.ts`;
  "unvisited" beacons; targets of kind `place` carrying the `PlacedLocation`), `busker.ts`,
  `crow.ts`. App.tsx wires them into `CityGame` and handles `onInteract`.
- `src/game/sprites.ts` — Mike, the lemons (`src/game/lemon.ts`), the crow (same grid format as the city's sprites).
- First visit: after Mike's welcome the city's hint arrow flashes 4× toward the nearest open
  spot (remembered in localStorage). The city's `Compass` points at `ArtSpots.open`.
- `src/game/busker.ts` — the keyboard busker outside Easy Street (Junction): five original
  chiptune songs — bouncy ones, a calm slow one ("Fog on the Sound") and a low funky groove
  ("Junction Strut") — as note strings with per-song tone/loudness/bass groove/hats (tested for
  whole bars), scheduled ahead through the shared AudioContext (the city's `audioContext()`).
  The playlist runs on the **wall clock** (`whereNow`), so every rabbit hears the same song and bar
  "now"; drift (a sleeping tab) snaps back to it. `__busker.song` in dev. The busker plugin sets `music.level` from
  distance (`EARSHOT` tiles, eased); `game.quiet` mutes it inside art scenes; mute respected.
- `src/game/crow.ts` — the snack crow (pure flight state, tested). Starts outside Les Schwab on
  Alaska; asks for snacks (choice → reply), then flies to the next perch in
  `src/content/crow.ts` (storefront regex + lat/lon fallback, lines per stop) and loops home,
  remembering how often you shared. App's `talk` overlay takes `choices` and a `then` callback.
- `src/game/plugins/chicken.ts` — the chicken on California outside Greentree Animal Hospital: two questions with two answers
  each and her reply to each, then "Want to play my mini game?" (all lines in `src/content/chicken.ts`).
  Yes opens **Cone Catch** (catch falling ice cream cones; missed ones burst into flames on the grass —
  running into a burning fire or taking a rock costs one of three lives, {A} jumps the fires; lives sit in
  a 24 px Art Nouveau bar over the 160×120 field;
  `src/experiences/minigames/ConeCatch.tsx`, rules pure + tested in
  `src/game/coneCatch.ts`; best score in localStorage) via the App's `minigame` overlay, whose `then`
  gets `{ score, best }` back for her closing line. A new character mini game: same overlay, its own component.
- `src/game/plugins/visitors.ts` — **other people, live**: everyone on the site shares one room
  on the island's relay (`src/net/relay.ts` client; the Worker is `relay/`, its own npm project
  deployed to the gardeninsound Cloudflare account — see `relay/README.md`; its ALLOWED_ORIGINS
  must include this site's origin; `?relay=ws://127.0.0.1:8790` points the site at `npm run dev`). Each rabbit gets a
  scarf from its id and fades while its player is in a scene. The minimap shows them, and so does
  "N OTHER RABBITS HERE". Your rabbit is sent only when it changes, at most 5×/s, because the free
  relay is metered by messages sent (wire format and easing are pure and tested:
  `src/game/visitors.ts`). `?solo` walks alone; dev-only `?island=<name>` uses a private room.
  Each rabbit has a name from its id (scarf colour + West Seattle place, never sent), shown when
  you're close on a dark tag under its feet (a 3×5 pixel font, `src/game/tinyFont.ts`, also used for
  bubble text — so it never reads as a map place label) and in the list behind the "N OTHER RABBITS" button, where clicking a rabbit hops you beside it (`Visitors.where`), and which also has the remembered
  "hide other rabbits" toggle. They talk only in **emotes** from the fixed list in
  `src/content/emotes.ts` (SAY button, keys 1–9, or walk up to a rabbit — it's a `rabbit` target with
  a lavender '…' bubble (`Target.bubbleColor`) — and {A} opens the picker, {B} closes it; after you
  emote, rabbits stop being targets for `TALK_QUIET` s; append only, the wire sends the index), rate-limited
  when sent and when shown (`RateLimit`), bubbles stacked clear of each other (`stackBubbles`). No free
  text, and rabbits pass through each other on purpose.
  **Presence** (`presence()` in `src/game/visitors.ts`, pure + tested): a hidden tab fades your rabbit at
  once and leaves the room after 2 min; 10 min without input (keys, mouse, taps) fades, 30 min leaves;
  showing the tab or any input rejoins as the same rabbit (`RelayRoom.pause/resume` keep the id).
  Dev: `?presence=N` shortens those to N / 2N / 4N s. The relay sweeps sockets silent > 90 s (no
  message, no ping) every 30 s via a Durable Object alarm, and the client replaces a socket that hears
  no pong for ~a minute.
- **Idea box** (✿ IDEA in the HUD): "What would you love to add in the Garden in Sound?" —
  `src/ui/IdeaBox.tsx` (words in `src/content/ideas.ts`; an optional name, credited in the issue; a real
  form whose Tab order wraps inside the box) posts to the `wish/` Worker
  (wish.gardeninsound.website, gardeninsound Cloudflare account), which checks origin + a
  Cloudflare Turnstile token + 3 ideas/min per address, then files a GitHub issue labelled
  `suggestion` on the public repo (mentions defused; formatting pure + tested in
  `wish/src/issue.ts`, run by the root `npm test`; `cd wish && npm test` runs the Worker against a
  fake GitHub). Issues are filed by the org's **Garden in Sound Wishes GitHub App**
  (github.com/apps/garden-in-sound-wishes, Issues: write only) so they show as `garden-in-sound-wishes[bot]`:
  `wish/src/githubApp.ts` signs a JWT with the app key and caches an installation token. App and
  installation ids are vars in `wish/wrangler.jsonc`; secrets: `TURNSTILE_SECRET`, `GITHUB_APP_KEY`
  (PKCS#8 PEM). `?wish=http://127.0.0.1:8791` points the site at `npm run dev` in wish/ (Turnstile's
  test key is used for a local Worker).
- **Duck Arcade** (in Junction 47's storefront slot, `render/facades.ts`): `src/game/plugins/arcadeDoor.ts`
  puts the door target on its California side; App opens `src/experiences/arcade/DuckArcade.tsx`, a
  three.js first-person room (`ArcadeScene.ts`) with a cabinet per game. The shell: cabinets are data
  in `src/content/duckArcade.ts` (`ready` ones launch), `arcade/games.ts` maps id → lazy component
  taking `{ onExit(result) }` (same as Cone Catch). New duck game: component + one line there + `ready: true`.
  Duck Scroller and Rabbit Zapper are plain-script kits in `public/` (`duck-scroller.js`, `rabbit-zapper.js`
  + their asset folders) that a thin wrapper component loads and mounts; the kits handle their own keys.
  Duck on the Moon is a port into the app (`DuckMoonScene.ts` + `DuckOnTheMoon.tsx`, words in
  `src/content/duckOnTheMoon.ts`, MP3s in `public/duck-on-the-moon/`). While a game is open,
  `sfx.gameSound(true)` keeps its sound on even if the map is muted. Wall posters: `POSTERS` in `ArcadeScene.ts`.
- **Luna Park** (1907–1913) on its pilings off Duwamish Head: `src/game/plugins/lunaPark.ts` turns the pier's
  water tiles walkable at attach (street name "Luna Park"), paints the boardwalk under everyone and draws the
  animated rides depth-sorted (gate, Great Figure Eight, Shoot-the-Chutes, Looff carousel, Giant Whirl,
  Natatorium, two booths, Pat the Educated Horse's hall after a photo — Pat taps out a sum if you ask). Uncle
  Hiram's Studebaker wagon, pulled by Betsy the Pig, drives back and forth along Alki Ave out front (`lunaWagon.route`,
  tested to stay on the street). Layout (tiles from the Head's tip) and sign text, with sources, in
  `src/content/lunaPark.ts`; signs (and the wagon) are targets of kind `luna`, `ask` adds a question. The Figure Eight's sign offers a ride: App's
  `ride` overlay → `src/experiences/luna/FigureEight.tsx` (three.js, first person at dusk; reduced motion
  watches from the boardwalk). Tested in `src/game/lunaPark.test.ts` (reachable from Alki Ave, signs walkable).
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
- `src/city/` — the city (see above): `world/` (tile grid + map data), `engine/` (`CityGame`,
  movement, neighbors, input), `render/` (palette, sprites, per-pixel roads, tile art,
  landmarks), `ui/` (HUD, dialog box, touch pad, sounds, `ui.css`). Import it via
  `src/city/index.ts`. Its unit tests run with the rest. Holding Shift puts the rabbit on a
  bicycle at RUN speed (`buildBikeRabbit` in `render/sprites.ts`, `player.riding`; other rabbits
  see it through a sixth field on the visitors wire). What the map draws:
  - every public street (no alleys) on its real centreline, at its real width × 2; walkable
    band ≥ 1.5 tiles; ~300 street names (uint16 per tile)
  - ~27k houses at their true OSM size/angle (`paintHouses`), nudged back or shrunk where a
    street reaches them; other buildings as tiles
  - landmarks (`render/landmarks.ts`): 76 station, Admiral Theatre, Easy Street, the Undersea
    Aviary, the 7-Eleven, Admiral Safeway, Shadowland, West Seattle Library, and the Junction block faces (`render/storefronts.ts`, data in
    `world/storefronts.ts`, shop fronts in `render/facades.ts`); a landmark with a `street`
    side is pulled flush with that street's sidewalk at render time
  - detailed places (Hiawatha Playfield, West Seattle High School): lawn, walkable footpaths
    and parking lots (Tile.Parking), pitches/track/courts/pool, buildings from exact
    outlines (`render/detailArt.ts`)
- `src/ui/` — `MikeDialog` (the city's DialogBox with Mike as default speaker/portrait), title,
  spots menu, scene boundary, `sounds` (city `sfx` + roll + caw). Styles: `src/city/ui/ui.css`
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
slideshows, busker songs, crow flight, sprites, and the city's own tests in `src/city/`. For visuals, drive real Chrome: `playwright-core` from `~/code/games/arcade/node_modules`
with `channel: 'chrome'`; save shots under `screenshots/` (gitignored). In dev, `window.__game` is
the live `CityGame`, plus `__art`, `__busker`, `__crow` (the plugins) for scripted checks;
`?at=lat,lon` or `?atTile=x,y` skips the title and drops you there.
