/**
 * The chicken outside the vet on California: two questions (two answers each, with her reply to each),
 * then "want to play my mini game?" — yes opens Cone Catch (src/experiences/minigames/).
 * Lines are drafts — rewrite freely.
 */
export const CHICKEN_NAME = 'A chicken';

/**
 * where she pecks around: on California outside Greentree Animal Hospital (4440 California
 * Ave SW, the vet). It's a building in OSM, not a storefront, so lat/lon places her — off the
 * vet's south end, far enough from the Rush Hour lemon just north of it that the button
 * reaches her, not the lemon.
 */
export const chickenHome = { shop: /greentree animal hospital/i, lat: 47.56339, lon: -122.386444 };

export interface ChickenAnswer {
  label: string;
  reply: string[];
}

export interface ChickenQuestion {
  /** the last line is the question the answers answer */
  lines: string[];
  answers: [ChickenAnswer, ChickenAnswer];
}

export const chickenQuestions: ChickenQuestion[] = [
  {
    lines: ['Bawk! Oh, a rabbit. Quick question.', 'Which came first: the chicken or the egg?'],
    answers: [
      { label: 'The chicken', reply: ['Correct. Look at me. Obviously the chicken.'] },
      { label: 'The egg', reply: ['Hmph. Bold answer.', "I'll allow it."] },
    ],
  },
  {
    lines: ['Next one.', 'Why did I cross the road?'],
    answers: [
      { label: 'To get to the other side', reply: ['Everybody says that.', 'I had a vet appointment. Right there.'] },
      { label: 'To see the art', reply: ['Ha! You get it.', 'There was a new wall up. I had to see.'] },
    ],
  },
];

/** the third question */
export const chickenInvite = {
  lines: ['Last one.', 'Want to play my mini game?'],
  yes: "Let's play!",
  no: 'Maybe later',
  bye: ["Suit yourself. I'll be right here, pecking."],
};

/** what she says when you come back from Cone Catch */
export function chickenAfter(score: number, best: number): string[] {
  const verdict =
    score >= 25 ? "You're a natural. Respect, from one bird to a rabbit." : score >= 10 ? 'Not bad at all! Barely any fires.' : 'So many fires. The pigeons do better.';
  return [`${score} ${score === 1 ? 'cone' : 'cones'}! ${verdict}`, `Your best is ${best}. Come back and beat it.`];
}
