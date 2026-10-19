# Bear Island — the map

Walk the streets of West Seattle as a small rabbit and find ten years of Mike's public
propaganda art. Bright, lo-fi, SNES-flavored. Built with Vite + React + TypeScript and a
hand-rolled Canvas 2D tile renderer.

The city (map, renderer, movement, HUD) is the package
[west-seattle-map](https://github.com/vlandham/west-seattle-map), pinned to a release tag in
`package.json` (it's private, so `npm install` needs GitHub access).

```bash
npm install
npm run dev      # http://localhost:5173/bearisland-map/
npm test
npm run build
```

**Controls:** arrows / WASD to walk · Shift to run · Space / Enter / Z to look · Esc / X to
leave · M for the map. On touch screens a D-pad and A button appear.

**Art:** raw photos stay out of the repo. Put the folders in
`~/Downloads/bearisland/images-merged/`, run `npm run images` to build web-sized AVIFs in
`public/art/`, then `npm run art:publish` to stage just the files the site shows.

Map data © OpenStreetMap contributors (ODbL). Art © Mike.
See `CLAUDE.md` for how the pieces fit and how to add a new art spot.
