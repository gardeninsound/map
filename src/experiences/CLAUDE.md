# src/experiences — the scenes

One scene per spot, lazy-loaded via `registry.ts`, wrapped in
`SceneBoundary` (a crash drops back to the map). A location with no `experience` shows Mike's
"coming soon" lines. Scenes get `{ location, onExit }`; their words live in `src/content/`.

- `WallTurns` — gas-station wall photo flipbook with a paint-roller wipe.
- `cup/` — **three.js**: the Lulu mug in 3D (`CupScene`), rendered at 1/3 res for the pixel look.
  You paint the next version over the current one (`CupPainter`: base + next-through-mask canvas
  → CanvasTexture). Versions are data in `src/content/cupVersions.ts`, reconstructed from the
  photos (the photos themselves aren't shown).
- `park/` — **three.js, first person**: the Seven+ Stories lot at 4731 40th Ave SW (`ParkScene`).
  Arrows/WASD walk & turn, drag to look; face a sign within ~3 m and press A for the full
  photo + Mike's line. Signs (photo crop, posts, position, facing, words) are data in
  `src/content/puppyPark.ts`; a sign whose photo isn't deployed shows its dominant colour.
- `minigames/ConeCatch.tsx` — the chicken's mini game (rules + the App's `minigame` overlay:
  `src/game/CLAUDE.md`).
- `luna/FigureEight.tsx` — the ride from Luna Park's Figure Eight sign (the park itself:
  `src/game/CLAUDE.md`).

## Duck Arcade (`arcade/`)

In Junction 47's storefront slot, `render/facades.ts`: `src/game/plugins/arcadeDoor.ts`
puts the door target on its California side; App opens `src/experiences/arcade/DuckArcade.tsx`, a
three.js first-person room (`ArcadeScene.ts`) with a cabinet per game. The shell: cabinets are data
in `src/content/duckArcade.ts` (`ready` ones launch), `arcade/games.ts` maps id → lazy component
taking `{ onExit(result) }` (same as Cone Catch). New duck game: component + one line there + `ready: true`.
Duck Scroller and Rabbit Zapper are plain-script kits in `public/` (`duck-scroller.js`, `rabbit-zapper.js`
+ their asset folders) that a thin wrapper component loads and mounts; the kits handle their own keys.
Duck on the Moon is a port into the app (`DuckMoonScene.ts` + `DuckOnTheMoon.tsx`, words in
`src/content/duckOnTheMoon.ts`, MP3s in `public/duck-on-the-moon/`). While a game is open,
`sfx.gameSound(true)` keeps its sound on even if the map is muted. Wall posters: `POSTERS` in `ArcadeScene.ts`;
the ceiling is a looping forest video (`CEILING_VIDEO`, WebM + MP4 in `public/arcade/ceiling/`) under the fluorescent panels.

**The bear** (`arcade/ArcadeBear.ts`, low-poly three.js): after the first game of a visit it's right beside you
with a bag of licorice (`bearLines` in `content/duckArcade.ts`); click/tap the bag (or {A}) to take one, the
rabbit says "Thanks!" (`sounds.thanks`, the browser's speech pitched up), then it walks off and plays Avocado
Drop (`BEAR_GAME`, the floor cabinet by the doors) for the rest of the visit. Where it stands and walks is pure +
tested: `src/game/arcadeBear.ts`. The smoke test takes a licorice (`window.__arcade.bagOnScreen()`).
