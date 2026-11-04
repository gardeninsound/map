/**
 * Luna Park (1907–1913), the "Coney Island of the West": twelve acres of rides on pilings
 * over the tide flats at Duwamish Head, built by Charles I. D. Looff. Rebuilt on the map as a
 * pier off the tip of the Head (src/game/plugins/lunaPark.ts), with a sign at each ride.
 *
 * Sources: HistoryLink essay 1390; Wikipedia "Luna Park, Seattle"; the Log House Museum's
 * Luna Park page; Paul Dorpat, "Seattle Now & Then: Luna Park Entrance" (2011). Where nobody
 * wrote down what a ride looked like (the Giant Whirl, the Canals, the Cave), it's a guess in
 * the style of the day, and its sign says so. Pat's hall is drawn from a photograph of the
 * boardwalk (a clown band, the Comedy Company, posing in front of it); Uncle Hiram and Betsy
 * the Pig from the Log House Museum's page and a 1909 photo of a pig in harness pulling a wagon.
 *
 * Layout: tiles relative to `ORIGIN`, the tile at the tip of the Head (47.5953, −122.3876,
 * the park's coordinates), so the pier follows the shore if the map is rebuilt. The pier
 * runs north from the tip out over the water; you walk on from Alki Ave across a short
 * entrance bridge and through the gate.
 */

export const LUNA_ORIGIN = { lat: 47.5953, lon: -122.3876 };

/** A rectangle of tiles, relative to the origin tile; x/y inclusive, w/h in tiles. */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** the boardwalk */
export const LUNA_PIER: TileRect = { x: -7, y: -13, w: 25, h: 12 };
/** the entrance bridge from Alki Ave, over the beach */
export const LUNA_BRIDGE: TileRect = { x: 7, y: -1, w: 4, h: 1 };

export type LunaRideKind = 'gate' | 'figure8' | 'chutes' | 'carousel' | 'whirl' | 'natatorium' | 'booth' | 'pat';

/** Anything at Luna Park you can walk up to and read. */
export interface LunaSign {
  id: string;
  /** on the HUD card and as the sign's heading */
  name: string;
  /** what the sign says, one box at a time */
  lines: string[];
  /** a question you can ask after reading, and what comes back */
  ask?: { label: string; reply: string[]; done: string };
}

export interface LunaRide extends LunaSign {
  kind: LunaRideKind;
  /** tiles you can't walk on (the gate's two towers are listed separately) */
  blocks: TileRect[];
  /** where its sign stands (a walkable tile, relative to the origin) */
  sign: { x: number; y: number };
  /** booth fronts: the words painted over the door */
  facade?: string[];
}

export const lunaRides: LunaRide[] = [
  {
    id: 'gate',
    kind: 'gate',
    name: 'Luna Park',
    blocks: [{ x: 5, y: -2, w: 2, h: 1 }, { x: 11, y: -2, w: 2, h: 1 }],
    sign: { x: 6, y: -3 },
    lines: [
      'LUNA PARK, 1907–1913. It opened here on June 27, 1907: twelve acres of rides on pilings over the tide flats at Duwamish Head.',
      'Charles I. D. Looff built it and called it the Coney Island of the West. Most people came over from Seattle by ferry.',
      'At night every building and every ride was outlined in bulbs. You could watch the lights dance on the water from downtown.',
      'The rides were sold or torn down in 1913. At the very lowest tides, the old pilings still show.',
    ],
  },
  {
    id: 'figure8',
    kind: 'figure8',
    name: 'The Great Figure Eight',
    blocks: [{ x: 11, y: -12, w: 7, h: 9 }],
    sign: { x: 13, y: -3 },
    lines: [
      'THE GREAT FIGURE EIGHT. A wooden scenic railway built by Arthur Looff, Charles\'s son, just to the right of the gate.',
      'The park said it climbed 150 feet at its highest and wound nearly half a mile through the air.',
    ],
  },
  {
    id: 'chutes',
    kind: 'chutes',
    name: 'Shoot-the-Chutes',
    blocks: [{ x: -7, y: -13, w: 5, h: 10 }],
    sign: { x: -2, y: -5 },
    lines: [
      'SHOOT-THE-CHUTES. Your boat is pulled up the tower, you get one look out over Elliott Bay…',
      '…and then it\'s 200 feet of track straight down into the splash pool.',
      'A white bridge crossed the pool, so everyone could watch the boats land.',
    ],
  },
  {
    id: 'carousel',
    kind: 'carousel',
    name: 'Looff Carousel',
    blocks: [{ x: 4, y: -8, w: 2, h: 2 }],
    sign: { x: 5, y: -6 },
    lines: [
      'THE CAROUSEL, hand-carved by Charles Looff under a green pagoda roof. He made it for San Francisco; after the 1906 earthquake, it came here instead.',
      'Reach out as you go round: grab a brass ring from the arm and your next ride is free.',
      'It\'s said to be turning still, at Yerba Buena Gardens in San Francisco.',
    ],
  },
  {
    id: 'whirl',
    kind: 'whirl',
    name: 'The Giant Whirl',
    blocks: [{ x: -1, y: -8, w: 2, h: 2 }],
    sign: { x: 0, y: -6 },
    lines: [
      'THE GIANT WHIRL. It\'s in the photographs from 1911, but nobody wrote down how it worked.',
      'So it\'s drawn here as a circle swing, the big thrill of the day: cars on long arms, flung out over the boardwalk.',
    ],
  },
  {
    id: 'natatorium',
    kind: 'natatorium',
    name: 'Natatorium',
    blocks: [{ x: 1, y: -13, w: 9, h: 3 }],
    sign: { x: 5, y: -10 },
    lines: [
      'THE NATATORIUM. Heated pools, two salt water and one fresh, with room for 1,000 bathers. Lockers, lessons, swimsuits to rent.',
      'Next door: the dance hall, and the longest bar on the bay.',
      'It outlived the park as Luna Pool, until a fire on April 14, 1931. Anchor Park stands on its spot today.',
    ],
  },
  {
    id: 'canals',
    kind: 'booth',
    name: 'Canals of Venice',
    blocks: [{ x: -2, y: -4, w: 3, h: 2 }],
    sign: { x: 1, y: -3 },
    facade: ['CANALS', 'OF VENICE'],
    lines: ['CANALS OF VENICE. Little boats through painted canals, indoors. That\'s about all anyone wrote down.'],
  },
  {
    id: 'cave',
    kind: 'booth',
    name: 'Cave of Mystery',
    blocks: [{ x: 2, y: -4, w: 3, h: 2 }],
    sign: { x: 3, y: -2 },
    facade: ['CAVE OF', 'MYSTERY'],
    lines: ['CAVE OF MYSTERY. A dark ride. What was inside is still a mystery.'],
  },
  {
    id: 'pat',
    kind: 'pat',
    name: 'Pat, the Educated Horse',
    blocks: [{ x: 7, y: -9, w: 3, h: 2 }],
    sign: { x: 7, y: -7 },
    lines: [
      'PAT, THE EDUCATED HORSE. Pat had a hall of his own on the boardwalk, his name painted big across the front.',
      'Educated horses of the day counted, spelled and did sums by tapping a hoof. Exactly what Pat could do, nobody wrote down.',
      'Next door: the Infant Electrobator. Most likely babies in incubators, a common sideshow of the day.',
    ],
    ask: {
      label: 'Ask Pat: 2 + 2?',
      reply: ['Pat looks you over. Tap. Tap. Tap. Tap.', 'Four. Pat takes a bow.'],
      done: 'Good horse',
    },
  },
];

/**
 * Uncle Hiram (Carl Hinckley, the park's clown) driving his Studebaker wagon along Alki Ave
 * in front of the gate, Betsy the Pig in harness pulling it. The route runs along the street,
 * in tiles from the origin: round the Head from the Alki side to the Harbor Ave side and back.
 */
export const lunaWagon: LunaSign & { route: { x: number; y: number }[] } = {
  id: 'hiram',
  name: 'Uncle Hiram & Betsy',
  lines: [
    "UNCLE HIRAM, the park's clown: Carl Hinckley, in costume. He paraded round Luna Park with his animals.",
    'His sidekick was Betsy the Pig. Harnessed up, she pulled his Studebaker wagon.',
  ],
  route: [
    { x: -12, y: 12.5 },
    { x: -7.5, y: 8.5 },
    { x: -2, y: 4.5 },
    { x: 3, y: 2 },
    { x: 9, y: 1.4 },
    { x: 14, y: 2 },
    { x: 17, y: 3.5 },
    { x: 19.5, y: 5.5 },
    { x: 22, y: 8.5 },
    { x: 23.5, y: 11.5 },
  ],
};

/** The Figure Eight's sign offers the ride. */
export const lunaRideInvite = { yes: 'Ride it', no: 'Not today' };

/** Shown in the ride scene. */
export const figureEightScript = {
  title: 'THE GREAT FIGURE EIGHT',
  where: 'Luna Park · Duwamish Head · 1907',
  again: '{A} ride again · {B} back to the boardwalk',
};
