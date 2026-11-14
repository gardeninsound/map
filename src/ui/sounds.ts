/** Bear Island's extra sounds, on top of the city's `sfx` (which also handles mute). */
import { sfx, tone } from '../city';

export const sounds = {
  ...sfx,
  /** Ham the cat: a little rising-then-falling mew */
  mew: () => {
    tone(560, 0.1, 'triangle', 0.04, 300);
    setTimeout(() => tone(820, 0.2, 'triangle', 0.035, -420), 90);
  },
  /** the paint roller in the slideshows */
  roll: () => tone(180, 0.35, 'sawtooth', 0.025, 160),
  /** the snack crow */
  caw: () => {
    tone(620, 0.14, 'sawtooth', 0.035, -260);
    setTimeout(() => tone(600, 0.16, 'sawtooth', 0.035, -280), 190);
  },
  /** Ham, petted: a low rolling purr */
  purr: () => {
    for (let i = 0; i < 8; i++) setTimeout(() => tone(55 + (i % 2) * 6, 0.11, 'triangle', 0.05, 4), i * 120);
  },
  /** the chicken outside the vet */
  cluck: () => {
    tone(720, 0.05, 'square', 0.03, -220);
    setTimeout(() => tone(680, 0.07, 'square', 0.03, -260), 90);
  },
  /** Cone Catch: a cone caught, a rock on the head, a dropped cone going up in flames */
  pop: () => tone(880, 0.05, 'square', 0.03, 260),
  bonk: () => tone(170, 0.16, 'triangle', 0.06, -70),
  hop: () => tone(420, 0.12, 'square', 0.025, 320),
  /** the arcade bear, about to talk: a friendly low rumble */
  bear: () => {
    tone(130, 0.16, 'triangle', 0.07, 30);
    setTimeout(() => tone(165, 0.2, 'triangle', 0.07, -40), 150);
  },
  /** the rabbit says "Thanks!" in a small high voice (the browser's speech, sped up and pitched up) */
  thanks: () => {
    if (sfx.isMuted()) return;
    const speech = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    if (speech && typeof SpeechSynthesisUtterance !== 'undefined') {
      const u = new SpeechSynthesisUtterance('Thanks!');
      u.pitch = 2;
      u.rate = 1.3;
      u.volume = 0.9;
      speech.cancel();
      speech.speak(u);
    } else {
      // no speech here: a two-note squeak
      tone(1100, 0.07, 'square', 0.03, 200);
      setTimeout(() => tone(1400, 0.1, 'square', 0.03, 300), 90);
    }
  },
  /** the boxing bell at the stadium: ding-ding, quieter the farther you are */
  boxingBell: (loud = 1) => {
    tone(1320, 0.5, 'sine', 0.05 * loud, -20);
    setTimeout(() => tone(1320, 0.6, 'sine', 0.05 * loud, -20), 260);
  },
  /** an oar dipping in, rowing the boat at the end of 58th */
  paddle: () => tone(300, 0.12, 'triangle', 0.025, -160),
  /** the bike race: a beep on 3, 2, 1, a higher one for GO, a little fanfare at the line */
  raceBeep: () => tone(660, 0.14, 'square', 0.04),
  raceGo: () => tone(1320, 0.3, 'square', 0.045),
  raceFinish: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'square', 0.035), i * 110)),
  whoosh: () => {
    tone(320, 0.28, 'sawtooth', 0.025, -220);
    setTimeout(() => tone(140, 0.2, 'triangle', 0.03, -60), 60);
  },
  /** the bookshop pegasus says hello: a little whinny, falling */
  whinny: () => [980, 900, 820, 700].forEach((f, i) => setTimeout(() => tone(f, 0.07, 'square', 0.022, -60), i * 70)),
  /** ...and its wings on take-off */
  /** the pelican: a low, friendly gronk */
  gronk: () => {
    tone(150, 0.12, 'sawtooth', 0.03, -30);
    setTimeout(() => tone(120, 0.16, 'sawtooth', 0.03, -20), 130);
  },
  flap: () => [0, 180, 360].forEach((d) => setTimeout(() => tone(240, 0.1, 'triangle', 0.035, -120), d)),
};
