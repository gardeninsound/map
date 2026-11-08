# src/game — the art layer on the map: plugins and characters

The app's `CityPlugin`s live in `plugins/`; their pure, tested rules sit beside them in `src/game/`
(`<name>.ts` + `<name>.test.ts`); their words live in `src/content/<name>.ts`. App.tsx wires the
plugins into `CityGame` and handles `onInteract`.

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
- **The hidden house + Ham** (1918 45th Ave SW, Admiral): a nameless landmark (`craftsman-45th` in
  `content/landmarks.csv`, drawn in `render/landmarks.ts`) — no name, so it's never on the map's place
  list. The alley behind it is walkable via `ALLEYS` in `scripts/city/map-config.mjs` (listed alleys →
  concrete lanes, named "Alley"). Ham the cat (`src/game/plugins/ham.ts`, a Scottish Fold) wanders the
  street and alley within `HAM.leash` tiles of home, sits to look at a rabbit nearby, and says one set
  of lines per visit through the plain neighbor talk (words in `src/content/ham.ts`; movement pure +
  tested in `src/game/ham.ts`). `__ham` in dev.
- `src/game/plugins/rowboat.ts` — **the rowboat at the end of 58th Ave SW** on Alki: at attach a 2-wide wooden dock is
  laid from where 58th meets Alki Ave west across the park and sand to the water (tiles turned walkable, street sign
  "58th Ave Dock"; laid once per map, so React's dev double start reuses it), the boat tied up at its end. {A}
  climbs in: the plugin sets `game.vehicle` (rows on water tiles only, `BOAT_SPEED`, the rabbit drawn in the boat);
  {A} where walkable ground is within `SHORE_REACH` (the dock, a pier — not the sand) climbs out, and the boat
  stays there until you're `BOAT_HOME` tiles off, then it's back at the dock. Rules pure + tested in
  `src/game/rowboat.ts`; sprites (`buildRowboat`, drawn round the rabbit's own frames) in `sprites.ts`; words in
  `src/content/rowboat.ts`.
- `src/game/plugins/pegasus.ts` — the pegasus in Pegasus Books (Junction, west side): come within `NOTICE`
  tiles and it walks out of the door (clipped at the shop front), says hello in a tiny-font bubble
  (`src/content/pegasus.ts`, one line per visit) with a whinny, then flies off north-east; home again once
  you're `HOME` tiles away. Pure + tested in `src/game/pegasus.ts`; 24×20 sprite built from parts in
  `sprites.ts`. A shop's slice of a Junction block face: `src/game/storefrontSlot.ts` (also the arcade door).
- `src/game/plugins/dinos.ts` — **toy dinosaurs** (from Mike's GIF) plodding west along the east–west streets
  ("SW … St"): `DINO_COUNT` are always near you; each walks west until its street ends or it's `FAR` behind,
  then turns up on another east–west street nearby, out of sight. Going by you (within `HEAR` tiles) it plays
  Mike's recording once a pass (`public/sounds/dinosaur.mp3`; not two at once; quiet in scenes and when muted). Pure + tested: `src/game/dinos.ts`. Sprite:
  `node scripts/make-dino.mjs <dino.gif>` keys out the green backdrop, keeps a soft shadow, inks an outline →
  `public/sprites/dino-walk.png` + `src/game/dinoSheet.ts` (the GIF isn't kept: 5.8 MB).
- `src/game/plugins/arcadeDoor.ts` — the Duck Arcade's door target (the arcade itself:
  `src/experiences/CLAUDE.md`).
- **Luna Park** (1907–1913) on its pilings off Duwamish Head: `src/game/plugins/lunaPark.ts` turns the pier's
  water tiles walkable at attach (street name "Luna Park"), paints the boardwalk under everyone and draws the
  animated rides depth-sorted (gate, Great Figure Eight, Shoot-the-Chutes, Looff carousel, Giant Whirl,
  Natatorium, two booths, Pat the Educated Horse's hall after a photo — Pat taps out a sum if you ask). Uncle
  Hiram's Studebaker wagon, pulled by Betsy the Pig, drives back and forth along Alki Ave out front (`lunaWagon.route`,
  tested to stay on the street). Layout (tiles from the Head's tip) and sign text, with sources, in
  `src/content/lunaPark.ts`; signs (and the wagon) are targets of kind `luna`, `ask` adds a question. The Figure Eight's sign offers a ride: App's
  `ride` overlay → `src/experiences/luna/FigureEight.tsx` (three.js, first person at dusk; reduced motion
  watches from the boardwalk). Tested in `src/game/lunaPark.test.ts` (reachable from Alki Ave, signs walkable).

## Other people, live (`plugins/visitors.ts`)

Everyone on the site shares one room
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
