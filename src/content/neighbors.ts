/**
 * Folks wandering the streets. Lines marked (manual) are drawn from the manual;
 * the rest are invented neighbor-voices in its spirit — swap in real ones as they're
 * collected (the manual wants to "collect stories of interpretations").
 */
export interface NeighborVoice {
  name: string;
  lines: string[];
}

export const neighborVoices: NeighborVoice[] = [
  { name: 'A man on the street', lines: ['Thanks for doing that. It makes me feel like I live in a neighborhood.'] }, // (manual)
  { name: 'A neighbor', lines: ['Could you paint a duck?', "No, I don't know what the duck would say. That's your job."] }, // request (manual)
  { name: 'A kid', lines: ['Who gives you the right to tear down art?', 'My mom helped me write that one.'] }, // (manual)
  { name: 'Bill', lines: ['Hmph. More posters.', "Regular flyers are fine. It's the art that bothers me."] }, // (manual)
  { name: 'A commuter', lines: ['I saw a new word on the wall on my way to work. It made my whole week.'] },
  { name: 'A painter', lines: ['I painted a letter on that wall once. Just the S.', 'I think about it every time I drive by.'] },
  { name: 'A dog walker', lines: ['"Trust the flux." Somebody put that on a telephone pole.', "I've been trying ever since."] },
  { name: 'A neighbor', lines: ['All are worthy. That one was on a pole by the bus stop.'] },
  { name: 'A shopkeeper', lines: ['The Junction feels different when the walls are talking.'] },
  { name: 'A collector', lines: ['I keep a photo of every version of the wall. Is that weird?'] },
  { name: 'A neighbor', lines: ['Hey! We live here.'] },
  { name: 'A stranger', lines: ['So glad you are here.'] },
  { name: 'A teenager', lines: ['I thought the posters were a band at first.', 'Honestly they kind of are.'] },
  { name: 'A grandparent', lines: ['They handed me a roller and I froze. What if I mess it up?', 'Turns out you can\'t. They just paint over it next week.'] },
];

export const NPC_PALETTES = {
  hair: ['#2b1d0e', '#6b4a2b', '#e8c170', '#c0392b', '#9a9aa8', '#ff7eb6', '#2ec4b6'],
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'],
  shirt: ['#ff5d5d', '#2ec4b6', '#ffd166', '#ff7eb6', '#57cc99', '#3a86ff', '#a77bff', '#ffffff'],
  pants: ['#3d5a99', '#2b2350', '#6b6880', '#57cc99', '#a0522d'],
  shoes: ['#2b2350', '#ffffff', '#ff5d5d'],
};
