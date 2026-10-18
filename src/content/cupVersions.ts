/**
 * The giant mug outside Lulu Coffee, version by version. Reconstructed from the photos in
 * public/art/cup (dates from the photos) — the scene paints these, it never shows the photos.
 * Mike's lines are drafts drawn from the manual's notes on the mug — his to rewrite.
 */
export type Frame =
  | { style: 'dots'; color: string }
  | { style: 'dashes'; color: string; fill?: string };

export interface CupVersion {
  id: string;
  date: string; // YYYY-MM
  body: string;
  /** stenciled words, one per line; omitted for picture-only versions */
  lines?: { text: string; color: string }[];
  /** the leaping hare in the middle of the frame */
  rabbit?: string;
  frame?: Frame;
  /** what Mike says once this coat is on */
  says?: string;
}

const INK = '#1c1b22';
const PINK = '#f4b6cb';
const RED = '#c8382f';

export const cupVersions: CupVersion[] = [
  {
    id: 'ok',
    date: '2023-03',
    body: '#f3f0ea',
    lines: [{ text: 'OK', color: '#ff8fb8' }],
    frame: { style: 'dots', color: '#ff8fb8' },
    says: 'It started with one word. Just OK. Sometimes that is the whole message.',
  },
  {
    id: 'like-water',
    date: '2023-04',
    body: '#efe2d4',
    lines: [
      { text: 'ALL', color: INK },
      { text: 'LIKE', color: '#7fd9c4' },
      { text: 'WATER', color: '#7fd9c4' },
      { text: 'MAGIC', color: INK },
    ],
    frame: { style: 'dots', color: RED },
    says: 'All like water. All like magic. Two messages painted on top of each other — old layers are the backdrop for new ones.',
  },
  {
    id: 'still-moving',
    date: '2023-04',
    body: PINK,
    lines: [
      { text: 'SAYS', color: INK },
      { text: 'WE ARE', color: INK },
      { text: 'STILL', color: INK },
      { text: 'MOVING', color: INK },
    ],
    says: 'Says we are still moving. A mug can say that. A mug on a pole over California Ave, even more so.',
  },
  {
    id: 'binky-bold',
    date: '2023-04',
    body: PINK,
    lines: [
      { text: 'MY', color: INK },
      { text: 'FAVORITE', color: INK },
      { text: 'FONT IS', color: INK },
      { text: 'BINKY', color: INK },
      { text: 'BOLD', color: INK },
    ],
    frame: { style: 'dashes', color: RED },
    says: 'A binky is the jump a happy rabbit does. So yes, there is a font for that.',
  },
  {
    id: 'rabbit',
    date: '2023-04',
    body: PINK,
    rabbit: INK,
    frame: { style: 'dashes', color: RED },
    says: 'Then no words at all. Just the rabbit, mid-leap.',
  },
  {
    id: 'rabbit-pink',
    date: '2023-04',
    body: '#f2c4d4',
    rabbit: INK,
    frame: { style: 'dashes', color: RED, fill: '#f07a98' },
  },
  {
    id: 'meant-for-feeling',
    date: '2023-04',
    body: '#93e3cb',
    lines: [
      { text: 'MEANT', color: '#5d6b68' },
      { text: 'FOR', color: '#5d6b68' },
      { text: 'FEELING', color: '#5d6b68' },
      { text: 'FEELING', color: '#5d6b68' },
      { text: 'BINKY', color: '#5d6b68' },
      { text: 'BOLD.', color: '#5d6b68' },
    ],
    says: 'Meant for feeling. Not for figuring out.',
  },
  {
    id: 'not-for-meaning',
    date: '2023-04',
    body: '#4fc8c1',
    lines: [
      { text: 'HEY,', color: '#1f3550' },
      { text: 'THESE', color: '#1f3550' },
      { text: 'WORDS', color: '#1f3550' },
      { text: 'NOT FOR', color: '#1f3550' },
      { text: 'MEANING', color: '#1f3550' },
    ],
    says: 'Hey, these words not for meaning. Leave room, and people bring their own.',
  },
  {
    id: 'rabbit-cream',
    date: '2023-12',
    body: '#ebe4da',
    rabbit: INK,
    frame: { style: 'dashes', color: '#e0675f', fill: '#f39ab0' },
    says: "We asked permission for this one. Once you've asked, someone else gets to steer — that came with its own trouble.",
  },
];

export const cupScript = {
  title: 'The Big Cup',
  intro: [
    "Lulu's mug hangs right over the sidewalk. It's big — walk around it. Drag the sky to circle, scroll or pinch to get closer.",
    'Now drag across the cup to paint the next coat. Cover enough of it and the new version takes over. Or press {A} to roll it on.',
  ],
  outro: ['Nine coats in one year. One person complained.', 'Nothing is precious. It just keeps moving.'],
};
