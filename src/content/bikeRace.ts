/**
 * The Admiral-to-Alaska bike race (src/game/plugins/bikeRace.ts): animals on bicycles wait at
 * the start line on California Ave at SW Admiral Way; ride up and join, and everyone races
 * south down California to the finish at SW Alaska St. Names and lines are Mike's to rewrite.
 */
export const RACE_NAME = 'Admiral to Alaska Bike Race';

/** where it starts and finishes, on California Ave SW */
export const RACE_START = { lat: 47.5811, lon: -122.3868 };
export const RACE_FINISH = { lat: 47.5614, lon: -122.3868 };
export const RACE_STREET = /^California Ave SW$/;

export type AnimalKind = 'fox' | 'bear' | 'cat' | 'raccoon' | 'frog' | 'duck' | 'dog';

export interface RaceAnimal {
  kind: AnimalKind;
  name: string;
  /** jersey and bike frame */
  jersey: string;
  /** their number on the jersey */
  number: number;
}

export const raceAnimals: RaceAnimal[] = [
  { kind: 'fox', name: 'Fennel the fox', jersey: '#2f4f8f', number: 1 },
  { kind: 'bear', name: 'Bruno the bear', jersey: '#e84a5f', number: 2 },
  { kind: 'cat', name: 'Miso the cat', jersey: '#ffd23f', number: 3 },
  { kind: 'raccoon', name: 'Rocket the raccoon', jersey: '#9b6ad1', number: 4 },
  { kind: 'frog', name: 'Lily the frog', jersey: '#ff7eb6', number: 5 },
  { kind: 'duck', name: 'Quincy the duck', jersey: '#2ec4b6', number: 6 },
  { kind: 'dog', name: 'Biscuit the dog', jersey: '#f47b20', number: 7 },
];

/** the target at the start line */
export const raceJoin = { name: 'Bike race', where: 'Admiral to Alaska, down California', verb: 'join' };

/** big words over the road */
export const raceBanners = { start: 'START', finish: 'FINISH' };

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
export { ordinal };

/** What the winner says when you cross the line. */
export function raceResult(place: number, total: number, winner: string, seconds: number): string[] {
  const time = `${seconds.toFixed(1)} s`;
  if (place === 1) return [`You won! First of ${total}, Admiral to Alaska in ${time}.`, 'Fastest rabbit on California Ave. We want a rematch!'];
  return [
    `${ordinal(place)} of ${total} — Admiral to Alaska in ${time}.`,
    `${winner} took it this time. The start line's at Admiral whenever you want another go.`,
  ];
}
