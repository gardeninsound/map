/**
 * Script for the gas-station wall scene. Drafted from the manual's "The Gas Station
 * Mural" and "Keep It Moving" pages — Mike's to rewrite.
 */
export const wallTurns = {
  title: 'The Wall That Kept Turning',
  stats: ['100+ turns', '200+ painters', '2022–2025'],
  intro: [
    'From 2022 to 2025 this wall changed more than a hundred times. Painted and repainted, again and again.',
    'More than two hundred people added something — a stroke, a letter, a color they thought was missing.',
    'Your turn. Press {A} (or →) to roll on the next coat. ← goes back. Hit FLIP to watch it all go by.',
  ],
  /** Mike pipes up as you pass these points (fraction of the way through). */
  milestones: [
    { at: 0.1, line: 'Every week or two, a new word. The neighbors started checking on it like the weather.' },
    { at: 0.25, line: 'Some people came with a plan. Most just stumbled into it — saw someone painting, picked up a brush.' },
    { at: 0.5, line: 'Old layers show through the new ones. A color from six months ago surfaces under a fresh coat.' },
    { at: 0.75, line: "When something looks finished, people walk past it. A wall that's clearly unfinished says: add something." },
    { at: 1, line: '"Thanks for doing that," a man said one day. "It makes me feel like I live in a neighborhood."' },
  ],
  flipLine: "That's a year and a half of Saturdays in a few seconds.",
  outro: ['Nothing is precious. Everything is a foundation.', 'The wall is still there. Go take a turn.'],
};
