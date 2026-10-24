/**
 * What's new on the map, newest first: the RECENT button in the HUD jumps to each in turn
 * (first press → the newest, next press → the one before, wrapping round). Add a line at the
 * top when something new goes in.
 *
 * `at` says where to land: a landmark id (content/landmarks.csv), an art spot id
 * (content/places.csv), the Duck Arcade's door, or plain lat/lon.
 */
export type RecentAt = { landmark: string } | { spot: string } | { arcade: true } | { lat: number; lon: number };

export interface RecentChange {
  /** shown as you land: short */
  title: string;
  /** YYYY-MM-DD */
  date: string;
  at: RecentAt;
}

export const recentChanges: RecentChange[] = [
  { title: 'A seal in Colman Pool', date: '2026-10-24', at: { landmark: 'colman-pool' } },
  { title: 'Uptown Espresso', date: '2026-10-24', at: { landmark: 'uptown-espresso' } },
  { title: 'Admiral Bird', date: '2026-10-23', at: { landmark: 'admiral-bird' } },
  { title: 'Circa', date: '2026-10-23', at: { landmark: 'circa' } },
  { title: 'Lincoln Park trails + Colman Pool', date: '2026-10-23', at: { landmark: 'colman-pool' } },
  { title: 'BECU on Fauntleroy', date: '2026-10-22', at: { landmark: 'becu-fauntleroy' } },
  { title: 'Seven+ Stories lemon, moved', date: '2026-10-22', at: { spot: 'puppy-park' } },
  { title: 'Duck Arcade: Duck Scroller', date: '2026-10-22', at: { arcade: true } },
  { title: 'West Seattle Nursery', date: '2026-10-22', at: { landmark: 'west-seattle-nursery' } },
  { title: 'West Seattle Library', date: '2026-10-22', at: { landmark: 'west-seattle-library' } },
  { title: 'The chicken + Cone Catch', date: '2026-10-19', at: { lat: 47.56339, lon: -122.386444 } },
];
