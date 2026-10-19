/** Bear Island's extra sounds, on top of west-seattle-map's `sfx` (which also handles mute). */
import { sfx, tone } from 'west-seattle-map';

export const sounds = {
  ...sfx,
  /** the paint roller in the slideshows */
  roll: () => tone(180, 0.35, 'sawtooth', 0.025, 160),
  /** the snack crow */
  caw: () => {
    tone(620, 0.14, 'sawtooth', 0.035, -260);
    setTimeout(() => tone(600, 0.16, 'sawtooth', 0.035, -280), 190);
  },
};
