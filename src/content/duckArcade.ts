/**
 * The Duck Arcade (in place of Junction 47, entrance on California): its cabinets and what's
 * said inside. Each cabinet is one game; `ready` ones launch from the shell
 * (src/experiences/arcade/games.ts maps the id to its component), the rest say "coming soon".
 * Add a duck game: write the component, register it under its id in games.ts, set `ready`.
 * Mike's lines are drafts — his to rewrite.
 */
export interface ArcadeGame {
  id: string;
  /** on the marquee and the menu: short, upper case */
  title: string;
  /** one line for the prompt and the menu */
  blurb: string;
  /** cabinet body, screen glow and marquee trim */
  colors: { body: string; screen: string; trim: string };
  ready: boolean;
  /** what's said back on the floor, for a game without a score to read out (see `arcadeAfter`) */
  after?: (score: number, best: number) => string;
}

export const ARCADE_NAME = 'Duck Arcade';
export const ARCADE_WHERE = 'California & Alaska · the Junction';

export const arcadeGames: ArcadeGame[] = [
  {
    id: 'cone-catch',
    title: 'CONE CATCH',
    blurb: "Guest cabinet: the chicken's game. Catch the cones, jump the fires.",
    colors: { body: '#c8382f', screen: '#f4b6cb', trim: '#ffd23f' },
    ready: true,
  },
  {
    id: 'duck-scroller',
    title: 'DUCK SCROLLER',
    blurb: 'Walk the duck through the painted world until it finds the pineapple.',
    colors: { body: '#2e8f8a', screen: '#7fd9c4', trim: '#ffd23f' },
    ready: true,
    after: (found, times) =>
      found ? `DUCK SCROLLER: the pineapple, found${times > 1 ? ` (${times} times now)` : ''}. Lucky duck.` : 'DUCK SCROLLER: the pineapple is still out there.',
  },
  {
    id: 'bread-toss',
    title: 'BREAD TOSS',
    blurb: 'Feed the flock without feeding the gulls. Coming soon.',
    colors: { body: '#e8a33a', screen: '#fff3b0', trim: '#ff7eb6' },
    ready: false,
  },
  {
    id: 'quack-hero',
    title: 'QUACK HERO',
    blurb: 'Quack along to the busker’s songs. Coming soon.',
    colors: { body: '#9b6ad1', screen: '#d9c4f4', trim: '#7fd9c4' },
    ready: false,
  },
  {
    id: 'duck-derby',
    title: 'DUCK DERBY',
    blurb: 'Rubber ducks race down Longfellow Creek. Coming soon.',
    colors: { body: '#3a6fd8', screen: '#a9d8ff', trim: '#ffd23f' },
    ready: false,
  },
  {
    id: 'ferry-flap',
    title: 'FERRY FLAP',
    blurb: 'Flap over the Fauntleroy ferry lanes. Coming soon.',
    colors: { body: '#2b2b38', screen: '#ffd23f', trim: '#ff7eb6' },
    ready: false,
  },
];

/** What Mike says as you walk in. */
export const arcadeIntro = [
  'Welcome to the Duck Arcade! Every cabinet in here is a duck game — or will be.',
  'Walk up to one and press {A} to play. {B} takes you back out to California Ave.',
];

/** When you try a cabinet that isn't plugged in yet. */
export const arcadeSoon = (g: ArcadeGame) => `${g.title}: still being wired up. Come back soon!`;

/** Back from a game. */
export const arcadeAfter = (g: ArcadeGame, score: number, best: number) =>
  g.after ? g.after(score, best)
  : score >= best && score > 0 ? `${g.title}: ${score} — a new best!` : `${g.title}: ${score}. Best so far ${best}.`;
