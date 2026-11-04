/** Tiny square-wave bleeps. Lazily creates the AudioContext on first use (after a gesture).
 * Apps make their own sounds with `tone`. */
const MUTE_KEY = 'west-seattle-map-muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

/** a mini game is open: it plays its sound even if the map is muted (see `sfx.gameSound`) */
let gameOpen = false;

export function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.04, slide = 0) {
  if (muted && !gameOpen) return;
  try {
    if (!ctx && !activated()) return;
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    /* audio unavailable — stay silent */
  }
}

/** Browsers refuse to start audio before the visitor has clicked or pressed a key. */
const activated = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;

/** The shared AudioContext (created on first use, after a user gesture); null if unavailable. */
export function audioContext(): AudioContext | null {
  if (!ctx && !activated()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export const sfx = {
  text: () => tone(560 + Math.random() * 80, 0.03, 'square', 0.02),
  confirm: () => {
    tone(660, 0.06);
    setTimeout(() => tone(990, 0.09), 60);
  },
  back: () => tone(440, 0.08, 'square', 0.04, -200),
  isMuted: () => muted && !gameOpen,
  /** Mini games start with sound on: while one is open, `isMuted` is false whatever the map's
   * mute says (the game's own sound toggle still works). Not saved. */
  gameSound(open: boolean) {
    gameOpen = open;
  },
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* private mode */
    }
  },
};
