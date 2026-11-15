# src/ui — the app's React UI on top of the city

`MikeDialog` (the city's DialogBox with Mike as default speaker/portrait), title,
spots menu, scene boundary, `sounds` (city `sfx` + roll + caw). Styles: `src/city/ui/ui.css`
first, then `src/styles.css` (title, scenes, spots).

- **Idea box** (✿ IDEA in the HUD): "What would you love to add in the Garden in Sound?" —
  `src/ui/IdeaBox.tsx` (words in `src/content/ideas.ts`; an optional name, credited in the issue; a real
  form whose Tab order wraps inside the box) posts to the `wish/` Worker (how it files issues:
  `wish/CLAUDE.md`). `?wish=http://127.0.0.1:8791` points the site at `npm run dev` in wish/ (Turnstile's
  test key is used for a local Worker).
- **The pelican** (`src/ui/Pelican.tsx`): once a session, 5 minutes after you join (`PELICAN_AFTER`, 300 s; it waits if a dialog or scene is open), it flies in over the map and lands
  beside your rabbit ("Anything you want to add, pumpkin?"), flies up onto the ✿ IDEA button ("Dream it out!"),
  then off the screen. Tap {A} (Space) while it's flying in or asking and it heads for the button right away
  (`skipAhead`; that press is the pelican's alone). It's HTML laid over map and HUD (no clicks taken), placed with `CityGame.screenPoint()` and
  drawn at `CityGame.scale`; flight + timing pure and tested in `src/game/pelican.ts`, words in
  `src/content/pelican.ts`, 24-wide sprite in `sprites.ts`. Opening anything ends its visit.
- `LookPicker.tsx` — the ◆ LOOK panel: fur, scarf and hat for your rabbit (rules in `src/game/look.ts`), each hat previewed on your rabbit.
- **`?open=` links** (`openLink.ts`, pure + tested; App acts on them through the same paths {A} takes): `?open=garden` /
  `boat` / `sundrop` (any target by kind, key or name: walks up and presses {A}), `scene:<spot id>`, `arcade`,
  `arcade:<cabinet id>`, `ride:figure8|whirl`, `minigame:cone-catch`, `idea`, `spots`. The smoke test tries one of each kind.
