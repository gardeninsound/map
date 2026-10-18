/**
 * The snack crow. It starts outside Les Schwab on Alaska, asks the rabbit for snacks,
 * then flies to the next stop — you find it again somewhere else. After the last stop
 * it heads home to the tire shop and starts over (remembering how often you shared).
 * `shop` matches a storefront name in worldData; lat/lon is the fallback if it's missing.
 */
export interface CrowStop {
  shop: RegExp;
  lat: number;
  lon: number;
  /** greeting — the last line is the question the choices answer */
  lines: string[];
  /** reply after you share */
  thanks: string[];
  /** reply when you don't */
  huff: string[];
}

export const CROW_NAME = 'A crow';

export const crowStops: CrowStop[] = [
  {
    shop: /les schwab/i,
    lat: 47.5612,
    lon: -122.3797,
    lines: ['Caw.', 'You. Rabbit. Got any snacks?'],
    thanks: ['A carrot?! Not what I pictured.', "...Okay, it's actually great. CAW! Gotta go."],
    huff: ['Nothing? Not even a tire crumb?', 'CAW! I know where the good stuff is.'],
  },
  {
    shop: /top pot/i,
    lat: 47.5615,
    lon: -122.3868,
    lines: ["Oh. It's you again.", 'They sweep up the sprinkles before I get here. Every morning.', 'Got any snacks?'],
    thanks: ['Another carrot. You really only carry carrots, huh.', 'Respect. CAW!'],
    huff: ["Fine. I'm off to the beach. The gulls owe me."],
  },
  {
    shop: /spud fish/i,
    lat: 47.5797,
    lon: -122.4096,
    lines: ["Keep it down. The gulls run this beach and I'm undercover.", 'Got any snacks? Fries, ideally.'],
    thanks: ["Not a fry. But I'll take it before a gull does.", 'CAW!'],
    huff: ['No fries, no cover. I\'m out.'],
  },
  {
    shop: /luna park/i,
    lat: 47.5714,
    lon: -122.3712,
    lines: ['Are you following me?', 'Because if you are... got any snacks?'],
    thanks: ["You're alright, rabbit.", "I'm heading home to the tire shop. Find me there."],
    huff: ["Typical. I'm heading home to the tire shop."],
  },
];

export const crowChoices = [
  { label: 'Share a carrot', snack: true },
  { label: 'Sorry, no snacks', snack: false },
] as const;

/** What the crow says when you walk up: back at home after a lap, it remembers you. */
export function crowGreeting(stop: number, lap: number, snacks: number): string[] {
  if (stop === 0 && lap > 0) {
    return [
      'Back at the tire shop.',
      snacks
        ? `You've fed me ${snacks === 1 ? 'once' : `${snacks} times`}. Crows remember faces, you know.`
        : 'You never share. Crows remember faces, you know.',
      'So. Got any snacks?',
    ];
  }
  return crowStops[stop].lines;
}

export function crowReply(stop: number, snack: boolean): string[] {
  return snack ? crowStops[stop].thanks : crowStops[stop].huff;
}
