# Art: from Mike's photos to the site

How a raw photo becomes a picture in a scene, and how to change which photos a scene shows.
Raw photos never go into the repo — only the small processed files the site actually shows.

## 1. The raw photos

Mike's folders live outside the repo, by default in `~/Downloads/bearisland/images-merged/`,
one folder per art spot (`Bus Wall/`, `Rush Hour/`, …). The folder name becomes the spot's
**set** (`Bus Wall` → `bus-wall`), which is what `content/places.csv` points at.

File names become ids: `IMG_4250 - Copy.HEIC` → `img-4250` (" - Copy" duplicates are skipped).

## 2. Optimizing: `npm run images [srcDir]`

`scripts/process-images.mjs` turns every photo and video into web files under
`public/art/<set>/` and writes `src/content/artManifest.ts` (each folder's assets in capture-date
order). macOS only.

| Input | Steps | Output |
|---|---|---|
| Photo (HEIC, JPG, PNG) | `sips` → JPEG (q92, temporary) → `sharp`: auto-rotate from EXIF, fit inside the box, encode AVIF, EXIF/GPS dropped | `<id>.avif` — 1200 px long side, AVIF q50, effort 6 (~100–150 KB) <br> `<id>-t.avif` — 320 px thumbnail, AVIF q45 |
| Video (MOV, MP4) | `ffmpeg`: H.264, no audio, ≤ 720 px short side, CRF 28, `preset slow`, `+faststart`; poster frame at 0.5 s | `<id>.mp4` + poster `<id>.avif` / `<id>-t.avif` (same settings as photos) |

Also recorded per asset: width/height, dominant colour (shown while it loads), and the capture
date from Spotlight (`mdls`; falls back to the file's modified time).

- The settings are the `ENCODE` block at the top of the script. Change them and rerun:
  everything re-encodes; files from old settings are deleted.
- It's incremental: `data/art-meta.json` remembers what's been encoded with which settings,
  so a rerun only does new or changed files. MP4s are never re-encoded.
- HEIC goes through `sips` because sharp's bundled libvips can't decode HEVC.

## 3. Choosing what a scene shows

Slideshow scenes (e.g. *The Wall That Kept Turning*) are set up in `src/content/wallTurns.ts`:

- `picks: []` — the slideshow takes `maxPhotos` stills spread evenly from first to last.
- `picks: ['img-4110', …]` — exactly these, in this order. Use this when a folder holds photos
  that don't belong (other walls) or the even spread misses part of the story. Keep them in
  date order; a test checks they exist and are stills.

To see what's in a folder, run `npm run images` and look in `public/art/<set>/` (the `-t`
thumbnails are quick to scan), or list `artManifest['<set>']` for ids and dates.

The *Bus Wall* folder also contains photos of the Rush Hour boards and other walls (listed in
the comment above `wallTurns.picks`); the wall's picks skip them.

## 4. Publishing: `npm run art:publish`

`public/art/` is gitignored. `scripts/publish-art.mjs` works out the files the site really
requests (using the app's own `chooseTurns`, park signs, SPOTS thumbnails, video posters —
`scripts/neededArt.mjs`), force-adds those to git and untracks the rest (they stay on disk).
`-- --dry-run` shows the changes first.

Run it after `npm run images` or after changing `picks` / `maxPhotos`, then commit. The Check
fails (`src/content/published.test.ts`) if a file the site needs isn't in git.
