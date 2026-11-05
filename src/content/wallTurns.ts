/**
 * Scripts for the photo-slideshow scenes (WallTurns.tsx), one per spot, keyed by the
 * spot's `experience` in content/places.csv. Drafted from the manual and Mike's notes —
 * his to rewrite.
 */
import type { ArtAsset } from './types';

export interface SlideshowScript {
  title: string;
  /** How many photos the slideshow shows, spread evenly over the whole run. */
  maxPhotos: number;
  /** Hand-picked asset ids, in order — when set, these are used instead of the even spread. */
  picks: string[];
  stats: string[];
  intro: string[];
  /** Mike pipes up as you pass these points (fraction of the way through). */
  milestones: { at: number; line: string }[];
  flipLine: string;
  outro: string[];
  /** words for the controls and screen readers */
  labels: { next: string; photo: string; strip: string };
}

/** The gas-station wall (from "The Gas Station Mural" and "Keep It Moving"). */
export const wallTurns: SlideshowScript = {
  title: 'The Wall That Kept Turning',
  maxPhotos: 24,
  // Hand-picked so every photo is this wall (the Bus Wall folder also holds shots of the
  // Rush Hour boards and other walls: img-4403, 4446, 4450, 4510, empk1123, 4962–4964,
  // 5208, 5226, 5272, 5273 — never pick those) and the run covers the whole timeline:
  // Nov '23 ×5, Jan–Feb ×3, Mar–May ×7, Jul–Aug ×4, Sep–Nov ×4, Mar '25 ×1.
  picks: [
    'img-4110', 'img-4133', 'img-4149', 'img-4197', 'img-4250', // Nov 2023
    'img-0680', 'img-4501', 'img-4531', // Jan–Feb 2024
    'img-4593', 'img-4700', 'img-4793', 'img-4850', 'img-4928', 'img-4961', 'img-4995', // Mar–May
    'img-5211', 'img-5243', 'img-5263', 'img-5356', // Jul–Aug
    'img-5449', 'img-5516', 'img-5577', 'img-5683', // Sep–Nov
    'img-6758', // Mar 2025
  ],
  stats: ['100+ turns', '200+ painters', '2022–2025'],
  intro: [
    'From 2022 to 2025 this wall changed more than a hundred times. Painted and repainted, again and again.',
    'More than two hundred people added something — a stroke, a letter, a color they thought was missing.',
    'Your turn. Press {A} (or →) to roll on the next coat. ← goes back. Hit FLIP to watch it all go by.',
  ],
  milestones: [
    { at: 0.1, line: 'Every week or two, a new word. The neighbors started checking on it like the weather.' },
    { at: 0.25, line: 'Some people came with a plan. Most just stumbled into it — saw someone painting, picked up a brush.' },
    { at: 0.5, line: 'Old layers show through the new ones. A color from six months ago surfaces under a fresh coat.' },
    { at: 0.75, line: "When something looks finished, people walk past it. A wall that's clearly unfinished says: add something." },
    { at: 1, line: '"Thanks for doing that," a man said one day. "It makes me feel like I live in a neighborhood."' },
  ],
  flipLine: "That's a year and a half of Saturdays in a few seconds.",
  outro: ['Nothing is precious. Everything is a foundation.', 'The wall is still there. Go take a turn.'],
  labels: { next: 'ROLL NEXT COAT', photo: 'The gas-station wall, one of its many versions', strip: 'Every version of the wall' },
};

/**
 * Rush Hour (4454 California Ave SW): the boarded-up storefront in the Junction. From
 * Mike's notes: "rush hour building in junction — changed for a year"; "rush hour had
 * already moved out. Could have asked. But danger in that."
 */
export const rushHourTurns: SlideshowScript = {
  title: 'The Rush Hour Boards',
  maxPhotos: 24,
  picks: [],
  stats: ['Boarded storefront', 'The Junction', '4454 California Ave SW'],
  intro: [
    'Rush Hour had already moved out. The windows were boarded up — so the boards became the wall.',
    'We could have asked. But once you ask, someone gets to say no, or steer. So we just kept it changing.',
    'Press {A} (or →) to paint the next version. ← goes back. Hit FLIP to watch it all go by.',
  ],
  milestones: [
    { at: 0.15, line: 'One word at a time, right on the corner where everyone waits for the bus.' },
    { at: 0.4, line: 'The birds and the dogs came later. Collage on top of paint on top of plywood.' },
    { at: 0.7, line: 'A boarded window says: nothing here. We wanted it to say: something is still going on.' },
    { at: 1, line: 'Can do.' },
  ],
  flipLine: 'Every coat on those boards, in a few seconds.',
  outro: ['A building waiting for its next life is a canvas waiting for its next coat.', 'Nothing is precious. Keep it moving.'],
  labels: { next: 'PAINT NEXT VERSION', photo: 'The Rush Hour boards, one of their many versions', strip: 'Every version of the boards' },
};

/** experience key (places.csv) → script */
export const slideshows: Record<string, SlideshowScript> = {
  'wall-turns': wallTurns,
  'rush-hour-turns': rushHourTurns,
};

/**
 * The slideshow's photos: stills only (no videos), `max` of them spread evenly from the
 * first photo to the last so the whole run is represented. `picks` overrides the spread.
 */
export function chooseTurns(assets: ArtAsset[], max: number, picks: string[] = []): ArtAsset[] {
  if (picks.length) return picks.map((id) => assets.find((a) => a.id === id)).filter((a): a is ArtAsset => !!a);
  const stills = assets.filter((a) => a.kind === 'image');
  if (stills.length <= max) return stills;
  return Array.from({ length: max }, (_, i) => stills[Math.round((i * (stills.length - 1)) / (max - 1))]);
}
