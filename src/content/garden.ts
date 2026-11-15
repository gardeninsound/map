/**
 * The seasonal garden at Dragonfly Garden (idea box #12, from Jimmy: "to see a garden with
 * flowers growing — appropriate to the season"). The beds grow what a Seattle garden grows
 * that month, by the real calendar: snowdrops and hellebores in late winter, crocus,
 * daffodils and tulips in spring, roses, lavender and sunflowers in summer, dahlias, asters,
 * mums and pumpkins in fall, kale through the winter. Read the sign ({A}) for what's out.
 * Words are drafts — Mike's to rewrite.
 */
export const GARDEN_NAME = 'Dragonfly Garden';
/** the park's corners (OSM) */
export const GARDEN_BOX = { south: 47.56628, west: -122.36807, north: 47.56734, east: -122.36709 };

/** how a plant is drawn */
export type Shape = 'bell' | 'cup' | 'trumpet' | 'star' | 'pom' | 'spike' | 'rose' | 'disc' | 'pumpkin' | 'kale';

export interface Planting {
  name: string;
  shape: Shape;
  color: string;
  /** months it's in flower (1 = Jan) */
  months: number[];
  /** tallest it gets, px */
  height: number;
}

export const plantings: Planting[] = [
  { name: 'snowdrops', shape: 'bell', color: '#f6f4ee', months: [1, 2], height: 4 },
  { name: 'hellebores', shape: 'bell', color: '#b8608a', months: [1, 2, 3], height: 5 },
  { name: 'crocus', shape: 'cup', color: '#9b6ad1', months: [2, 3], height: 4 },
  { name: 'daffodils', shape: 'trumpet', color: '#ffd23f', months: [3, 4], height: 7 },
  { name: 'tulips', shape: 'cup', color: '#e8333a', months: [4, 5], height: 7 },
  { name: 'rhododendrons', shape: 'pom', color: '#ff7eb6', months: [5], height: 8 },
  { name: 'roses', shape: 'rose', color: '#e84a5f', months: [6, 7, 8, 9], height: 8 },
  { name: 'lavender', shape: 'spike', color: '#8e7cc3', months: [6, 7, 8], height: 6 },
  { name: 'sunflowers', shape: 'disc', color: '#ffb627', months: [7, 8, 9], height: 13 },
  { name: 'dahlias', shape: 'pom', color: '#ff2e93', months: [8, 9, 10], height: 9 },
  { name: 'asters', shape: 'star', color: '#7a6ad8', months: [9, 10], height: 7 },
  { name: 'mums', shape: 'pom', color: '#e07a2a', months: [10, 11], height: 6 },
  { name: 'pumpkins', shape: 'pumpkin', color: '#f47b20', months: [10], height: 4 },
  { name: 'kale', shape: 'kale', color: '#6a5a9a', months: [11, 12, 1, 2], height: 5 },
];

const SEASON = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The garden sign: what's out this month. */
export function gardenSign(month: number, out: string[]): string[] {
  const list = out.length > 1 ? `${out.slice(0, -1).join(', ')} and ${out.at(-1)}` : (out[0] ?? 'nothing yet — just soil and worms');
  return [
    `${GARDEN_NAME} — ${MONTHS[month - 1]}, ${SEASON[month - 1]}.`,
    `In bloom now: ${list}.`,
    'Come back next month. It changes.',
  ];
}
