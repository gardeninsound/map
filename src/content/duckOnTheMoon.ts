/**
 * Duck on the Moon (Duck Arcade cabinet): Pip the duck has collected three sounds on a
 * paper-cut moon. Every word of the game lives here; the scene is
 * src/experiences/arcade/DuckOnTheMoon.tsx, the recordings are in public/duck-on-the-moon/.
 */
export type MoonSound = 'wolves' | 'rain' | 'storm';

export interface MoonStory {
  /** who's "speaking" on the card while the sound plays */
  title: string;
  /** what you hear */
  heard: string;
  /** what Pip says after */
  pip: string;
  /** file under public/duck-on-the-moon/ */
  file: string;
}

/** In the order a keyboard player visits them. */
export const moonSounds: MoonSound[] = ['wolves', 'rain', 'storm'];

export const moonStories: Record<MoonSound, MoonStory> = {
  wolves: {
    title: 'Wolves in a distant forest',
    heard: 'A chorus of wolves calls out from a forest very far away.',
    pip: '“Do you think they are calling to each other, or to the moon?”',
    file: 'wolves.mp3',
  },
  rain: {
    title: 'Rain on an umbrella',
    heard: 'Rain taps a little rhythm on an umbrella somewhere below.',
    pip: '“I like to imagine someone is walking home underneath it,” Pip says.',
    file: 'rain.mp3',
  },
  storm: {
    title: 'A rain and thunder storm',
    heard: 'Rain gathers, and thunder rolls across a distant sky.',
    pip: 'Pip scoots a little closer. “A big sound can make a small place feel very cozy.”',
    file: 'storm.mp3',
  },
};

export const moonText = {
  eyebrow: 'A little listening adventure',
  title: 'Duck on the Moon',
  tag: 'An observatory at the edge of everywhere',
  introEyebrow: 'A small game about listening',
  intro: [
    'Somewhere between here and the stars, a little duck has been collecting sounds. Tonight, one of them needs your help.',
    'Explore the moon, listen closely, and see what you and Pip discover together.',
  ],
  begin: 'Begin the night ✦',
  pip: 'Pip the duck',
  hello: '“I found three sounds tonight. I think they might be trying to find their way home.”',
  explore: "Let's explore →",
  listen: 'Listen with Pip →',
  keepExploring: 'Keep exploring →',
  oneMore: 'One more thing →',
  ending:
    '“Maybe home is just a place where someone listens to you.” Pip places the three sounds in the observatory, where they glow together like a little constellation.',
  stay: 'Stay a little longer ✦',
  hint: 'Click to listen',
  howMouse: 'Drag to orbit · scroll to zoom · click the glowing things to listen',
  howKeys: '{A} next sound · arrows orbit',
  howTouch: 'Drag to orbit · pinch to zoom · tap the glowing things',
};
