# Bear Island — the map

Walk the streets of West Seattle as a small rabbit and find ten years of Mike's public
propaganda art. Bright, lo-fi, SNES-flavored. Built with Vite + React + TypeScript and a
hand-rolled Canvas 2D tile renderer.

**Live at https://gardeninsound.website.** Other visitors' rabbits walk around with you, and
**✿ IDEA** in the top bar sends a suggestion for what to add next. Suggestions become
[issues labelled `suggestion`](https://github.com/gardeninsound/map/issues?q=label%3Asuggestion).

The city (map, renderer, movement, HUD) lives in `src/city/` — Bear Island's own copy, from
[west-seattle-map](https://github.com/vlandham/west-seattle-map) v0.1.0, which is now a
separate project.

```bash
npm install
npm run dev      # http://localhost:5173/
npm test
npm run build
```

**Controls:** arrows / WASD to walk · Shift to run · Space / Enter / Z to look · Esc / X to
leave · M for the map. On touch screens a D-pad and A button appear.

**Art:** raw photos stay out of the repo. Put the folders in
`~/Downloads/bearisland/images-merged/`, run `npm run images` to build web-sized AVIFs in
`public/art/`, then `npm run art:publish` to stage just the files the site shows.

**Hosting:** GitHub Pages behind Cloudflare, plus two small Cloudflare Workers: `relay/` for the
other rabbits and `wish/` for the idea box. See [`docs/hosting.md`](docs/hosting.md) for what runs
where, how changes go live, and common jobs.

Map data © OpenStreetMap contributors (ODbL). Art © Mike.
See `CLAUDE.md` for how the pieces fit and how to add a new art spot.
