# src/ui — the app's React UI on top of the city

`MikeDialog` (the city's DialogBox with Mike as default speaker/portrait), title,
spots menu, scene boundary, `sounds` (city `sfx` + roll + caw). Styles: `src/city/ui/ui.css`
first, then `src/styles.css` (title, scenes, spots).

- **Idea box** (✿ IDEA in the HUD): "What would you love to add in the Garden in Sound?" —
  `src/ui/IdeaBox.tsx` (words in `src/content/ideas.ts`; an optional name, credited in the issue; a real
  form whose Tab order wraps inside the box) posts to the `wish/` Worker (how it files issues:
  `wish/CLAUDE.md`). `?wish=http://127.0.0.1:8791` points the site at `npm run dev` in wish/ (Turnstile's
  test key is used for a local Worker).
- **The pelican** (`src/ui/Pelican.tsx`): once a session, 2 minutes after you join (`PELICAN_AFTER`, 120 s; it waits if a dialog or scene is open), it flies in over the map and lands
  beside your rabbit ("Anything you want to add, pumpkin?"), flies up onto the ✿ IDEA button ("Dream it out!"),
  then off the screen. It's HTML laid over map and HUD (no clicks taken), placed with `CityGame.screenPoint()` and
  drawn at `CityGame.scale`; flight + timing pure and tested in `src/game/pelican.ts`, words in
  `src/content/pelican.ts`, 24-wide sprite in `sprites.ts`. Opening anything ends its visit.
