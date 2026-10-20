/**
 * The art spots on the map. The editable source is **content/places.csv** (name, address,
 * Mike's greeting…) — run `npm run places` after editing to geocode and regenerate
 * placesData.json. Only presentation that doesn't belong in a spreadsheet lives here.
 *
 * Give a spot an `experience` key (in the CSV) once its scene exists in
 * src/experiences/registry.ts. Rows with status `approx` are pins we're still guessing.
 */
import places from './placesData.json';

export interface ArtLocation {
  id: string;
  name: string;
  /** small caption under the name, e.g. the street or the years */
  where: string;
  lat: number;
  lon: number;
  approx?: boolean;
  /** folder under public/art (see artManifest) */
  set: string;
  /** key into the experience registry; absent = "coming soon" */
  experience?: string;
  /** colours for the spot's thumbnail in the Spots menu */
  colors: { p: string; t: string; y: string; o: string };
  /** what Mike says when you walk up and press the action button */
  greeting: string[];
}

const DEFAULT_COLORS = { p: '#ff7eb6', t: '#2ec4b6', y: '#ffe066', o: '#ff8c42' };
const COLORS: Record<string, ArtLocation['colors']> = {
  'gas-station-wall': DEFAULT_COLORS,
  'rush-hour': { p: '#ff9a8b', t: '#5fb49c', y: '#ffd166', o: '#3d5a99' },
  'land-use-signs': { p: '#e3664f', t: '#2ec4b6', y: '#ffffff', o: '#3fa34d' },
  admiral: { p: '#ffc8dd', t: '#2ec4b6', y: '#c8e66b', o: '#a0522d' },
  'power-box': { p: '#ff7eb6', t: '#9be3de', y: '#ffe066', o: '#e3664f' },
  cup: { p: '#ffc8dd', t: '#9be3de', y: '#ffffff', o: '#ff7eb6' },
  'nail-salon': { p: '#ffe066', t: '#3fa34d', y: '#ff8c42', o: '#ff5d5d' },
  'puppy-park': { p: '#ffc8dd', t: '#3fa34d', y: '#ffffff', o: '#2b2350' },
  swedish: { p: '#9be3de', t: '#2c6fe0', y: '#ffffff', o: '#e3664f' },
  posters: { p: '#ff5d5d', t: '#9be3de', y: '#ffc8dd', o: '#ffffff' },
  bear: { p: '#6a4c93', t: '#2b2350', y: '#ffffff', o: '#9be3de' },
};

export const START = { lat: 47.5612, lon: -122.3868 }; // California & Alaska — the Junction

export const locations: ArtLocation[] = places.map((p) => ({ ...p, colors: COLORS[p.id] ?? DEFAULT_COLORS }));

/** First thing Mike says when you arrive on the map. */
export const welcome = [
  "Welcome to Bear Island! I'm Mike. For ten years I've been putting things up around West Seattle.",
  'Walk the streets. When you see a lemon, step up and press {A} — that is where the art lives. Say hi to the neighbors, too.',
  'Start with the gas station wall, just north of here up California Ave.',
];
