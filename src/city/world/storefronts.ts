/**
 * The businesses along California Ave SW between Oregon and Edmunds (the Junction),
 * drawn by src/city/render/storefronts.ts as four block faces. Each face is a landmark
 * (content/landmarks.csv, sprite `storefronts`) whose id keys into FACES below.
 *
 * Buildings run north → south; each tenant gets a slice of its building's frontage
 * (`weight`, default 1) with its own sign and storefront. Business names and addresses
 * come from OpenStreetMap. Building looks follow street photos from December 2015
 * (Joe Mabel, Wikimedia Commons) where a building was in shot; sign colours are the
 * businesses' own where known and a guess in their spirit otherwise. Correct freely.
 */
export type Roof = 'flat' | 'gable' | 'metal' | 'modern';

export interface Tenant {
  /** the OSM name (what the HUD's "outside …" says) */
  name: string;
  /** sign text, upper case; keep it short (≈13 chars on the east side, 17 on the west) */
  sign: string;
  bg: string;
  fg: string;
  /** awning colour over its storefront (none if the building has a canopy) */
  awning?: string;
  /** share of the building's frontage (default 1) */
  weight?: number;
  /**
   * a hand-drawn front (src/city/render/facades.ts) in place of the sign: the shop is drawn
   * face-on across the whole block face. Give it weight enough for ~24–30 px of frontage.
   */
  facade?: 'duck-arcade' | 'husky-deli' | 'poggie-tavern' | 'pegasus-books' | 'bakery-nouveau' | 'antique-mall';
}

export interface Building {
  /** who/what, for people editing this file */
  note: string;
  roof: Roof;
  /** wall colour of the south face */
  wall: string;
  stories: 1 | 2 | 3;
  /** one continuous canopy along the street instead of per-shop awnings */
  canopy?: string;
  /** the Campbell Building gets its brick-and-terracotta face on Alaska */
  campbell?: boolean;
  /** green balcony accents (Junction 47) */
  balconies?: boolean;
  tenants: Tenant[];
}

export interface BlockFace {
  /** which side of California the shops are on */
  side: 'W' | 'E';
  buildings: Building[];
}

const INK = '#2a1a12';
const CREAM = '#f4ead0';

export const FACES: Record<string, BlockFace> = {
  // West side, Oregon → the Hamm Building (Easy Street has its own drawing at the corner).
  'junction-w-north': {
    side: 'W',
    buildings: [
      {
        note: 'Oregon corner, green awning (photo)',
        roof: 'flat', wall: '#e9dcc8', stories: 1,
        tenants: [{ name: 'Verity Credit Union', sign: 'VERITY CU', bg: '#1f6fb2', fg: '#ffffff', awning: '#3f9e5a' }],
      },
      {
        note: 'tan building, orange storefronts, the round Beer Junction sign (photo)',
        roof: 'flat', wall: '#d8c39a', stories: 2,
        tenants: [
          { name: 'Bonjour Việt Nam', sign: 'BONJOUR VIETNAM', bg: '#c8102e', fg: '#ffe066', awning: '#e0832b' },
          { name: 'The Beer Junction', sign: 'BEER JUNCTION', bg: '#1b1b1b', fg: '#e8b33a', awning: '#e0832b' },
          { name: 'Vain', sign: 'VAIN', bg: INK, fg: '#ff7eb6' },
        ],
      },
      {
        note: 'one-storey row',
        roof: 'flat', wall: '#cfc7d8', stories: 1,
        tenants: [
          { name: 'Rush Hour', sign: 'RUSH HOUR', bg: '#2ec4b6', fg: '#ffffff', awning: '#2ec4b6' },
          { name: 'A-Plus Hearing Aid', sign: 'HEARING AID', bg: '#ffffff', fg: INK },
          { name: 'Supreme', sign: 'SUPREME', bg: '#1d1d1d', fg: '#ffffff', awning: '#1d1d1d' },
          { name: 'Lady Jaye', sign: 'LADY JAYE', bg: '#1a1a1a', fg: '#f2c14e' },
        ],
      },
      {
        note: 'two-storey brick',
        roof: 'flat', wall: '#b5654a', stories: 2,
        tenants: [
          { name: 'Capers', sign: 'CAPERS', bg: '#6b8f71', fg: '#ffffff', awning: '#6b8f71' },
          { name: 'The Brocante Beach House', sign: 'BROCANTE', bg: CREAM, fg: '#4a6b8a' },
          { name: 'Azuma Sushi', sign: 'AZUMA SUSHI', bg: '#c0392b', fg: '#ffffff', awning: '#1b1b1b' },
        ],
      },
      {
        note: 'one-storey shops',
        roof: 'flat', wall: '#e3d6bf', stories: 1,
        tenants: [
          { name: 'Discovery Shop', sign: 'DISCOVERY SHOP', bg: '#5b2a86', fg: '#ffffff' },
          { name: 'Mystery Made', sign: 'MYSTERY MADE', bg: INK, fg: '#a77bff' },
          { name: 'The Camp West', sign: 'CAMP WEST', bg: '#3d5a3d', fg: CREAM, awning: '#3d5a3d' },
          { name: 'The Hydrant', sign: 'HYDRANT', bg: '#e0322b', fg: '#ffffff' },
          { name: 'Next to Nature', sign: 'NEXT TO NATURE', bg: '#57cc99', fg: INK, awning: '#57cc99' },
        ],
      },
      {
        note: 'dark one-storey next to the Hamm Building, purple Optix awning (photo)',
        roof: 'flat', wall: '#3a3340', stories: 1,
        tenants: [
          { name: 'Revelry Room', sign: 'REVELRY ROOM', bg: '#1b1b1b', fg: '#ff5d5d' },
          { name: "Russell's Jewelry", sign: "RUSSELL'S", bg: CREAM, fg: '#7a5a3a' },
          // dark board siding, stone piers, the pegasus sign, a BOOKS blade and a painted window (photos, Aug 2026)
          { name: 'Pegasus Book Exchange', sign: 'PEGASUS BOOKS', bg: '#1f2a5a', fg: '#ffffff', weight: 2.85, facade: 'pegasus-books' },
          { name: 'West Seattle Optix', sign: 'OPTIX', bg: '#6b3a8f', fg: '#ffffff', awning: '#6b3a8f' },
        ],
      },
    ],
  },

  // East side, Oregon → Alaska, ending with the Campbell Building on the corner.
  'junction-e-north': {
    side: 'E',
    buildings: [
      {
        note: 'Oregon corner',
        roof: 'flat', wall: '#e9dcc8', stories: 1,
        tenants: [{ name: 'Snapdragon West Seattle', sign: 'SNAPDRAGON', bg: CREAM, fg: '#c2185b', awning: '#7aa36b', weight: 1.4 }],
      },
      {
        note: 'small shops',
        roof: 'flat', wall: '#d6cfe0', stories: 1,
        tenants: [
          { name: 'By And By', sign: 'BY AND BY', bg: '#d8c3a5', fg: INK },
          { name: 'Stop and Shop', sign: 'STOP & SHOP', bg: '#ffd166', fg: INK, awning: '#ffd166' },
          { name: 'Snip-its', sign: 'SNIP-ITS', bg: '#2ec4b6', fg: '#ffffff' },
        ],
      },
      {
        note: 'the Antique Mall, a big old storefront',
        roof: 'flat', wall: '#b5654a', stories: 2,
        // no photo found: an old brick front with its name board and a window of vintage finds (a guess)
        tenants: [{ name: 'Antique Mall', sign: 'ANTIQUE MALL', bg: '#7a3a30', fg: CREAM, awning: '#7a3a30', weight: 2.4, facade: 'antique-mall' }],
      },
      {
        note: 'tan stone storefronts under one dark metal canopy (photo)',
        roof: 'flat', wall: '#d9c9a8', stories: 1, canopy: '#2b2b33',
        tenants: [
          { name: 'Pegasus Pizza', sign: 'PEGASUS PIZZA', bg: '#1f3a7a', fg: '#ffe066' },
          { name: 'Paper Boat Booksellers', sign: 'PAPER BOAT', bg: CREAM, fg: '#2160d8' },
          { name: "Carmilia's", sign: "CARMILIA'S", bg: '#9fd8d0', fg: INK },
          { name: 'Menashe & Sons Jewelers', sign: 'MENASHE', bg: '#1e4d3a', fg: CREAM },
          { name: 'Willow', sign: 'WILLOW', bg: '#57cc99', fg: '#ffffff' },
        ],
      },
      {
        note: 'restaurants',
        roof: 'flat', wall: '#cfc7d8', stories: 1,
        tenants: [
          { name: 'Maharaja Cuisine of India', sign: 'MAHARAJA', bg: '#b5651d', fg: '#ffe066', awning: '#b5651d' },
          { name: 'Matador', sign: 'MATADOR', bg: '#1b1b1b', fg: '#e0322b' },
        ],
      },
      {
        note: 'the Campbell Building: dark red brick, cream terracotta, green awnings on Alaska (photo)',
        roof: 'flat', wall: '#8a3a2e', stories: 2, campbell: true,
        tenants: [{ name: 'Molly Moon’s Homemade Ice Cream', sign: "MOLLY MOON'S", bg: '#bfe3f2', fg: '#2b5a8a', weight: 3.2 }],
      },
    ],
  },

  // West side, Alaska → Edmunds.
  'junction-w-south': {
    side: 'W',
    buildings: [
      {
        note: 'KeyBank on the corner',
        roof: 'modern', wall: '#d6d3e3', stories: 1,
        tenants: [{ name: 'KeyBank', sign: 'KEYBANK', bg: '#cc0000', fg: '#ffffff', weight: 1.4 }],
      },
      {
        note: 'shops and the theatre',
        roof: 'flat', wall: '#d8c39a', stories: 1,
        tenants: [
          { name: 'Emerald Water Anglers', sign: 'EMERALD ANGLERS', bg: '#1e6b4a', fg: '#ffffff', awning: '#1e6b4a' },
          { name: 'Top Pot Doughnuts', sign: 'TOP POT', bg: '#5a3a22', fg: '#ffd8a8', awning: '#e9b4c8' },
          { name: 'ArtsWest', sign: 'ARTSWEST', bg: '#e0322b', fg: '#ffffff', weight: 1.5 },
        ],
      },
      {
        note: 'restaurant row',
        roof: 'flat', wall: '#e3d6bf', stories: 1,
        tenants: [
          // teal-green wood frame, green slate bulkhead, the red box sign, 4717 (photo, Aug 2026)
          { name: 'Poggie Tavern', sign: 'POGGIE TAVERN', bg: '#ffffff', fg: '#c8102e', weight: 2.9, facade: 'poggie-tavern' },
          { name: 'Indofusion', sign: 'INDOFUSION', bg: '#ff8c42', fg: INK, awning: '#ff8c42' },
          // gold HUSKY on purple blocks, purple frame + yellow trim, fan-braced bulkhead, striped canopy (photos, Aug 2026)
          { name: 'Husky  Delicatessen', sign: 'HUSKY DELI', bg: '#4b2e83', fg: '#e8b33a', weight: 2.9, facade: 'husky-deli' },
          { name: 'Mashiko', sign: 'MASHIKO', bg: '#1b1b1b', fg: '#ff7eb6' },
        ],
      },
      {
        note: 'red-and-black front with a steel awning grid (photo)',
        roof: 'flat', wall: '#c8102e', stories: 1,
        tenants: [{ name: 'Puerto Vallarta', sign: 'PUERTO VALLARTA', bg: '#1b1b1b', fg: '#ffe066', awning: '#c8102e', weight: 1.4 }],
      },
      {
        note: 'south end to Edmunds',
        roof: 'flat', wall: '#cfc7d8', stories: 1,
        tenants: [
          { name: 'Northwest Art &Frame', sign: 'ART & FRAME', bg: CREAM, fg: INK },
          // the cream oval sign with brown scrollwork (their other shop's photos), a restored 1926 front, glowing pastry cases
          { name: 'Bakery Nouveau', sign: 'BAKERY NOUVEAU', bg: '#efe2cf', fg: '#5a3a22', weight: 2.9, facade: 'bakery-nouveau' },
          { name: 'Sleepers in Seattle', sign: 'SLEEPERS', bg: '#3a86ff', fg: '#ffffff' },
          { name: 'Savvy Home Store', sign: 'SAVVY HOME', bg: '#a77bff', fg: '#ffffff' },
        ],
      },
    ],
  },

  // East side, Alaska → Edmunds.
  'junction-e-south': {
    side: 'E',
    buildings: [
      {
        note: 'Duck Arcade (made up: duck-themed mini games), in place of Junction 47',
        roof: 'modern', wall: '#2e8f8a', stories: 3,
        tenants: [{ name: 'Duck Arcade', sign: 'DUCK ARCADE', bg: '#2a1f3a', fg: '#ffd23f', weight: 3, facade: 'duck-arcade' }],
      },
      {
        note: "Talarico's, PIZZA LOUNGE sign (photo)",
        roof: 'flat', wall: '#6b3a3a', stories: 2,
        tenants: [{ name: "Talarico's Pizzeria", sign: "TALARICO'S", bg: '#1b1b1b', fg: '#ff5d5d', awning: '#5a1f1a', weight: 1.5 }],
      },
      {
        note: 'Elliott Bay Brewery: dark red, pitched roof (photo)',
        roof: 'gable', wall: '#5a1f1a', stories: 2,
        tenants: [{ name: 'Elliott Bay Brewery and Pub', sign: 'ELLIOTT BAY', bg: '#5a1f1a', fg: '#ffd166', weight: 2 }],
      },
      {
        note: 'brick with a standing-seam metal roof, Chipotle sign (photo)',
        roof: 'metal', wall: '#9a5040', stories: 1,
        tenants: [
          { name: 'Chipotle', sign: 'CHIPOTLE', bg: '#8b1e1e', fg: '#ffffff' },
          { name: 'Gene Juarez Salons & Spas', sign: 'GENE JUAREZ', bg: '#1b1b1b', fg: '#ffffff' },
        ],
      },
      {
        note: 'south end to Edmunds',
        roof: 'flat', wall: '#e3d6bf', stories: 1,
        tenants: [
          { name: 'Curious Kidstuff', sign: 'KIDSTUFF', bg: '#ffd166', fg: '#e0322b', awning: '#3a86ff' },
          { name: 'Alex Dry Cleaners', sign: 'DRY CLEANERS', bg: '#3a86ff', fg: '#ffffff' },
        ],
      },
    ],
  },
};
