# Bear Island — the map

Walk the streets of West Seattle as a small rabbit and find ten years of Mike's public
propaganda art. Bright, lo-fi, SNES-flavored. Built with Vite + React + TypeScript and a
hand-rolled Canvas 2D tile renderer.

```bash
npm install
npm run dev      # http://localhost:5173/bearisland-map/
npm test
npm run build
```

**Controls:** arrows / WASD to walk · Shift to run · Space / Enter / Z to look · Esc / X to
leave · M for the map. On touch screens a D-pad and A button appear.

**Art isn't in the repo** (it's ~200 MB of photos and video). Put the raw folders in
`~/Downloads/bearisland/images-merged/` and run `npm run images` to build `public/art/`.
Until art is hosted somewhere, the deployed site's photo scenes (the gas-station wall) have
no images; the map and the 3D cup work without it.

Map data © OpenStreetMap contributors (ODbL). Art © Mike.
See `CLAUDE.md` for how the pieces fit and how to add a new art spot.
