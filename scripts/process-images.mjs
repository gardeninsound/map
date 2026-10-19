/**
 * Processes the artist's raw photos/videos into web assets.
 *
 *   <src>/<Folder Name>/*.{HEIC,JPG,PNG,MOV}  →  public/art/<folder-slug>/<id>{.avif,-t.avif,.mp4}
 *                                             →  src/content/artManifest.ts
 *
 * Only these processed files are used by the site; the raw photos never leave <src>.
 * `npm run art:publish` then puts just the files the scenes show into git.
 *
 * - HEIC is decoded with macOS `sips` (sharp's prebuilt libvips has no HEVC decoder),
 *   then sharp auto-orients, resizes and encodes (settings in ENCODE below — AVIF at
 *   1200 px is ~⅓ the size of the old 1400 px WebP at the same look). EXIF/GPS dropped.
 * - Videos go through ffmpeg: H.264 MP4, ≤720p, no audio, plus a poster frame.
 * - Capture dates come from Spotlight (`mdls`), so each folder can be ordered in time.
 * - Incremental: existing outputs are reused (re-encoded when ENCODE changes); files left
 *   over from older settings are deleted. Existing MP4s are never re-encoded.
 *
 * Usage: node scripts/process-images.mjs [srcDir]   (default ~/Downloads/bearisland/images-merged)
 * macOS only (sips, mdls); needs ffmpeg on PATH.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] ?? join(homedir(), 'Downloads/bearisland/images-merged');
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/art');
const MANIFEST = join(ROOT, 'src/content/artManifest.ts');
const CACHE = join(ROOT, 'data/art-meta.json'); // per-asset metadata so reruns skip encoding
const TMP = join(tmpdir(), 'bearisland-map-img');
mkdirSync(TMP, { recursive: true });

/** Encoding for every still (and video poster). Change here, rerun, everything follows. */
export const ENCODE = {
  format: 'avif',
  full: { size: 1200, quality: 50, effort: 6 },
  thumb: { size: 320, quality: 45, effort: 6 },
};
const EXT = ENCODE.format;
const SETTINGS = JSON.stringify(ENCODE);
const encode = (img, { size, quality, effort }) =>
  img.resize(size, size, { fit: 'inside', withoutEnlargement: true })[EXT]({ quality, effort });
const IMAGE_EXT = new Set(['.heic', '.jpg', '.jpeg', '.png']);
const VIDEO_EXT = new Set(['.mov', '.mp4']);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// "IMG_5188 - Copy - Copy (2).HEIC" → "img-5188"
const assetId = (file) => slug(basename(file, extname(file)).replace(/\s*-\s*Copy.*$/i, ''));

const meta = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

function captureDate(path) {
  try {
    const out = execFileSync('mdls', ['-raw', '-name', 'kMDItemContentCreationDate', path], { encoding: 'utf8' });
    const d = new Date(out.trim().replace(' +0000', 'Z').replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* fall through */ }
  return statSync(path).mtime.toISOString().slice(0, 10);
}

const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

async function processImage(src, dir, id) {
  const jpg = join(TMP, `${dir.split("/").pop()}-${id}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', src, '--out', jpg], { stdio: 'ignore' });
  const base = sharp(jpg).rotate();
  const full = await encode(base.clone(), ENCODE.full).toFile(join(dir, `${id}.${EXT}`));
  await encode(base.clone(), ENCODE.thumb).toFile(join(dir, `${id}-t.${EXT}`));
  const { dominant } = await sharp(jpg).stats();
  rmSync(jpg);
  return { kind: 'image', w: full.width, h: full.height, color: hex(dominant) };
}

async function processVideo(src, dir, id) {
  const mp4 = join(dir, `${id}.mp4`);
  if (!existsSync(mp4)) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-an',
    '-vf', "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)',format=yuv420p",
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-movflags', '+faststart', mp4]);
  const poster = join(TMP, `${dir.split("/").pop()}-${id}.png`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '0.5', '-i', mp4, '-frames:v', '1', poster]);
  // Clips shorter than the seek point produce nothing — fall back to the first frame.
  if (!existsSync(poster)) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-frames:v', '1', poster]);
  const full = await encode(sharp(poster), ENCODE.full).toFile(join(dir, `${id}.${EXT}`));
  await encode(sharp(poster), ENCODE.thumb).toFile(join(dir, `${id}-t.${EXT}`));
  const { dominant } = await sharp(poster).stats();
  rmSync(poster);
  return { kind: 'video', w: full.width, h: full.height, color: hex(dominant) };
}

const jobs = [];
for (const folder of readdirSync(SRC, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const set = slug(folder.name);
  const dir = join(OUT, set);
  mkdirSync(dir, { recursive: true });
  const seen = new Set();
  for (const file of readdirSync(join(SRC, folder.name)).sort()) {
    const ext = extname(file).toLowerCase();
    const isVideo = VIDEO_EXT.has(ext);
    if (!isVideo && !IMAGE_EXT.has(ext)) continue;
    const id = assetId(file);
    if (seen.has(id)) continue; // "- Copy" duplicates within a folder
    seen.add(id);
    jobs.push({ set, dir, id, isVideo, src: join(SRC, folder.name, file) });
  }
}

let done = 0;
async function run(job) {
  const key = `${job.set}/${job.id}`;
  const outFiles = [`${job.id}.${EXT}`, `${job.id}-t.${EXT}`, ...(job.isVideo ? [`${job.id}.mp4`] : [])];
  const current = meta[key]?.settings === SETTINGS && outFiles.every((f) => existsSync(join(job.dir, f)));
  if (!current) {
    try {
      const info = await (job.isVideo ? processVideo : processImage)(job.src, job.dir, job.id);
      meta[key] = { ...info, date: captureDate(job.src), source: basename(job.src), settings: SETTINGS };
    } catch (e) {
      console.warn(`skip ${key}: ${e.message.split('\n')[0]}`);
    }
  }
  done++;
  if (done % 20 === 0) console.log(`${done}/${jobs.length}`);
}

const queue = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) await run(queue.shift());
}));
writeFileSync(CACHE, JSON.stringify(meta, null, 1));

// Delete outputs from older settings (e.g. .webp after the switch to AVIF).
const keep = new Set(jobs.flatMap((j) => [`${j.set}/${j.id}.${EXT}`, `${j.set}/${j.id}-t.${EXT}`, `${j.set}/${j.id}.mp4`]));
let removed = 0;
for (const set of readdirSync(OUT, { withFileTypes: true })) {
  if (!set.isDirectory()) continue;
  for (const f of readdirSync(join(OUT, set.name))) {
    if (!keep.has(`${set.name}/${f}`)) { rmSync(join(OUT, set.name, f)); removed++; }
  }
}
if (removed) console.log(`removed ${removed} stale files`);

// Manifest: sets → assets ordered by capture date.
const sets = {};
for (const job of jobs) {
  const m = meta[`${job.set}/${job.id}`];
  if (!m) continue;
  (sets[job.set] ??= []).push({ id: job.id, kind: m.kind, w: m.w, h: m.h, date: m.date, color: m.color });
}
for (const list of Object.values(sets)) list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

writeFileSync(MANIFEST,
  `// AUTO-GENERATED by scripts/process-images.mjs — do not edit by hand.\n` +
  `import type { ArtAsset } from './types';\n\n` +
  `/** file extension of every still / poster / thumbnail */\n` +
  `export const artFormat = '${EXT}';\n\n` +
  `export const artManifest: Record<string, ArtAsset[]> = ${JSON.stringify(sets, null, 1)};\n`);
console.log(`done: ${Object.entries(sets).map(([k, v]) => `${k}=${v.length}`).join(' ')}`);
