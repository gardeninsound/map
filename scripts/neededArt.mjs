/**
 * The processed art files the deployed site actually requests, worked out with the same code
 * the app runs. Shared by `npm run art:publish` (stages exactly these) and
 * src/content/published.test.ts (fails if one isn't in git, so it would 404 online).
 *   - slideshow spots: the stills `chooseTurns` picks (full + thumbnail)
 *   - Seven+ Stories: each sign's photo
 *   - SPOTS menu: the first still's thumbnail for every spot with a scene
 *   - video spots: the poster still + the MP4
 */
import { artFormat, artManifest } from '../src/content/artManifest.ts';
import places from '../src/content/placesData.json' with { type: 'json' };
import { parkSigns } from '../src/content/puppyPark.ts';
import { chooseTurns, slideshows } from '../src/content/wallTurns.ts';

const file = (set, id, thumb = false) => `public/art/${set}/${id}${thumb ? '-t' : ''}.${artFormat}`;

/** repo-relative paths, e.g. public/art/<set>/<id>.avif */
export function neededArt() {
  const need = new Set();
  for (const p of places) {
    if (!p.experience) continue;
    const assets = artManifest[p.set] ?? [];
    const first = assets.find((a) => a.kind === 'image') ?? assets[0];
    if (first) need.add(file(p.set, first.id, true)); // SPOTS menu thumbnail (a still, else a video poster)
    const script = slideshows[p.experience];
    if (script) {
      for (const a of chooseTurns(assets, script.maxPhotos, script.picks)) {
        need.add(file(p.set, a.id));
        need.add(file(p.set, a.id, true));
      }
    }
    if (p.experience === 'park-walk') for (const s of parkSigns) need.add(file(p.set, s.asset));
    if (p.experience === 'video') {
      const v = assets.find((a) => a.kind === 'video');
      if (v) need.add(file(p.set, v.id)).add(`public/art/${p.set}/${v.id}.mp4`); // poster + video
    }
  }
  return need;
}
