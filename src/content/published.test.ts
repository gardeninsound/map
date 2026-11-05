import { execFileSync } from 'node:child_process';
// @ts-expect-error plain-JS script shared with npm run art:publish
import { neededArt } from '../../scripts/neededArt.mjs';
import { CEILING_VIDEO, POSTERS } from '../experiences/arcade/ArcadeScene';
import { DINO_SHEET } from '../game/dinoSheet';
import { DINO_SOUND } from '../game/dinos';
import { arcadeGames } from './duckArcade';
import { moonStories } from './duckOnTheMoon';

/**
 * Every file the content points at must be in git: the deploy builds from a fresh checkout, so
 * one that only lives on your disk (public/art/ is gitignored) works locally and 404s online.
 * Fix a failure with `npm run art:publish` (art) or `git add` (everything else).
 */
const tracked = new Set(execFileSync('git', ['ls-files', 'public'], { encoding: 'utf8' }).split('\n').filter(Boolean));
const missing = (files: Iterable<string>) => [...files].filter((f) => !tracked.has(f));

describe('published files', () => {
  it('the art the scenes show is in git (npm run art:publish)', () => {
    expect(missing(neededArt() as Set<string>)).toEqual([]);
  });

  it('arcade posters, cabinet fronts and game sounds are in git', () => {
    const files = [
      ...POSTERS.map(([name]) => `public/arcade/posters/${name}.webp`),
      ...CEILING_VIDEO.map((file) => `public/${file}`),
      `public/${DINO_SHEET.file}`,
      `public/${DINO_SOUND}`,
      ...arcadeGames.flatMap((g) => (g.front ? [`public/${g.front}`] : [])),
      ...Object.values(moonStories).map((s) => `public/duck-on-the-moon/${s.file}`),
    ];
    expect(missing(files)).toEqual([]);
  });
});
