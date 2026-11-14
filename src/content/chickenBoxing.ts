/**
 * Giant chickens boxing in West Seattle Stadium (src/game/plugins/chickenBoxing.ts): a ring on
 * the football field, two chickens three storeys tall in gloves and trunks, going round after
 * round. Walk up ringside and {A}: the ring announcer fills you in. Names and lines are
 * Mike's to rewrite.
 */
export interface Boxer {
  name: string;
  /** gloves and corner post */
  gloves: string;
  trunks: string;
  /** feathers */
  body: string;
}

export const boxers: [Boxer, Boxer] = [
  { name: 'Henrietta "The Hammer"', gloves: '#e8333a', trunks: '#ff2e93', body: '#f6f1e6' },
  { name: 'Big Gloria', gloves: '#2f6fd8', trunks: '#ffb627', body: '#c8763a' },
];

/** where the ring stands: the middle of the stadium's field */
export const RING_AT = { lat: 47.56274, lon: -122.37489 };

export const ANNOUNCER = 'The ring announcer';

/** the target ringside */
export const boxingWatch = { name: 'Chicken boxing', where: 'West Seattle Stadium', verb: 'watch' };

/** What the announcer says, given the round and the punches landed so far. */
export function ringside(round: number, rest: boolean, landed: [number, number]): string[] {
  const [a, b] = boxers;
  const lead =
    landed[0] === landed[1]
      ? "Dead even on punches. Nobody's giving an inch."
      : `${landed[0] > landed[1] ? a.name : b.name} is ahead, ${Math.max(...landed)} punches to ${Math.min(...landed)}.`;
  return [
    rest ? `Between rounds! Round ${round} is in the books.` : `Ladies and gentle-rabbits — round ${round}!`,
    `In the red corner, ${a.name}. In the blue, ${b.name}. Fifty feet of chicken apiece.`,
    lead,
    "Stay behind the ropes, little one. When they go down, the whole field shakes.",
  ];
}
