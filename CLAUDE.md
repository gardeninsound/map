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
- `npm run smoke` (after `npm run build`) — the built site in a real browser via Playwright: title, `?at=arcade` to
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
  push/shrink, detailed places. Places OSM lacks are **sites** (`scripts/city/sites/*.json`), drawn in on
  every build; never hand-edit `worldData.json`.
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
- `npm run story -- --out .story …` — the story log by hand (it runs itself in `.github/workflows/story.yml`):
  every change to `main` with its wish, words and before/after photos, every idea-box wish, weekly
  spot portraits → the **`story` branch** (never main). → `scripts/story/README.md`
- PR previews: every same-repo PR gets `https://pr-<N>-garden-preview.gardeninsound.workers.dev`, commented on the PR by
  `preview-comment.yml` (links straight to each `Where:`, the wishes it answers, tags, whose area it touches, what the Story
  section is missing; follows description edits; words in `renderPreviewComment`, `scripts/story/lib.mjs`)
  (`.github/workflows/preview.yml` → `preview/`, a files-only Worker; `wrangler versions upload --preview-alias pr-<N>`;
  secret `CLOUDFLARE_API_TOKEN`). Previews use the real relay and idea box (issues titled `[preview pr-<N>]`). On close,
  `preview-cleanup.yml` re-uploads the alias with `preview/closed/` and marks its deployments inactive.

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
5. **Open a PR into `main`** with a **`## Story` section** in its description (the template's
   `Idea:` / `Where:` / `Tags:` / `Asked vs made:` / `Mike:` / `Note:` lines; `--fill` skips the template, so
   write the body). The story log keeps it with the change and photographs each `Where` before
   and after (`scripts/story/README.md`). Claude fills in `Idea`, `Where` and `Asked vs made` from
   the work (and `Tags: behind-the-scenes` when nothing on the site changes: a refactor, notes, CI; the /story/ page hides those at first), and leaves `Mike:` empty unless Mike said the words himself. **No "Generated with Claude Code" line
   (🤖 footer) or "made with Claude Code" credit in PR titles or descriptions**: the PR is Jim's or Mike's. The **Check** workflow
   (`.github/workflows/ci.yml`) runs the size guard, tests, build and smoke test; `main` requires it to pass.
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

This file is the index. Each area's details live in a `CLAUDE.md` in its own folder, which
Claude Code loads when it works there. **Keeping it that way:** a new feature adds one line to
its area's `CLAUDE.md` (what it is, its main file, where its words and tests are). Change this
root file only for new commands, workflow, conventions or a new area.

- `src/city/` — the city: map data, engine (`CityGame`, movement, neighbors, input), renderer,
  HUD. Import via `src/city/index.ts`. → `src/city/CLAUDE.md`
- `src/game/` — the art layer on the map: `plugins/` (`CityPlugin`s: art spots, busker, crow,
  chicken, Ham, pegasus, dinos, Luna Park, other rabbits…) + their pure, tested rules + `sprites.ts`.
  The plugin list is `src/game/plugins/index.ts` (each by id; a new one is a line there, not in App.tsx); what {A} does is each plugin's `act()` (convention 7). → `src/game/CLAUDE.md`
- `src/experiences/` — one scene per spot, lazy-loaded via `registry.ts`; the Duck Arcade,
  Cone Catch, the Luna ride. → `src/experiences/CLAUDE.md`
- `src/ui/` — React UI over the map: `MikeDialog`, title, spots menu, scene boundary, sounds,
  idea box, pelican. → `src/ui/CLAUDE.md`
- `src/content/` — **content is data** (Mike's area): `locations.ts` (spots, coords, Mike's
  greetings), each character's and scene's words, `artManifest.ts` (generated, date-ordered).
- `src/net/` + `relay/` — the live relay other rabbits share (`relay/README.md`; the client side
  is in `src/game/CLAUDE.md`), and the counts: visits per day and what people open (`src/net/counts.ts`, anonymous, live site
  only; anything opened over the map or by {A} is counted on its own, nothing to add for a new thing).
- `wish/` — the idea box's Worker, files suggestions as GitHub issues. → `wish/CLAUDE.md`
- `scripts/ai/` — **ideas → changes with free models** (an experiment, run by hand). → `scripts/ai/README.md`
- `scripts/city/` — the OSM → map pipeline (settings in `map-config.mjs`).
- `scripts/story/` — **the story log**: how the island grew, written to the `story` branch. → `scripts/story/README.md`
- `src/story/` — the **/story/** page (a second Vite entry, `story/index.html`; not linked from the map yet): reads
  `story.json` live from the story branch (`?src=<url>` for a local copy, e.g. `?src=/.story/` in dev); rules in
  `model.ts` (tested); covered by the smoke test on a made-up log.
- `src/admin/` — the **/admin/** page for Mike and Jim (a third Vite entry, `admin/index.html`; not linked, `noindex`): the
  relay's counts (`relay/README.md`, "Counts"), open PRs with their Check and preview, wishes waiting, pins to confirm and
  spots still "coming soon". Mike and Jim only (Cloudflare Access; its numbers at `/admin/api/`, `relay/README.md`, "Admin access"). `?stats=` / `?traffic=` / `?gh=` point it elsewhere; words for count keys in
  `nameOf` (`model.ts`, tested); covered by the smoke test on made-up data.

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
7. **What {A} does on a character or thing goes in its own plugin**: the plugin is an `Actor` and answers
   `act(target)` with an `Action` (a dialog with choices, a ride…; `src/game/actions.ts`), tested with
   `pick()`. Never add a branch to App.tsx's `onInteract`; `src/game/onInteract.test.ts` fails if you do.
   Every character already works this way: copy any of them (ponies: a dialog; chicken: questions, then a game).
   A new plugin is one line in `createIsland` (`src/game/plugins/index.ts`); App.tsx never imports one (the same test checks).

Gotcha: fontsource packages with an `exports` map append `.css` themselves — import
`@fontsource/big-shoulders-stencil-display/800`, not `…/800.css` (declared in `src/fonts.d.ts`).

## Verifying

Unit tests cover content invariants (every spot has art and sits by a walkable street), the
slideshows, busker songs, crow flight, sprites, and the city's own tests in `src/city/`. For visuals, drive real Chrome: `playwright-core` from `~/code/games/arcade/node_modules`
with `channel: 'chrome'`; save shots under `screenshots/` (gitignored). In dev, `window.__game` is
the live `CityGame`, plus `__<id>` for each plugin (`__art`, `__busker`, `__crow`…; ids in `src/game/plugins/index.ts`) for scripted checks;
`?at=lat,lon`, `?atTile=x,y` or `?at=arcade` (beside the Duck Arcade door) skips the title and drops you there — on the live site too.
`?open=…` goes further, into a scene, a cabinet, a ride or a character's dialog (`src/ui/CLAUDE.md`); `?time=…` and `?seed=…` pin
the game's clock and chance (`src/city/CLAUDE.md`) for screenshots that repeat.
