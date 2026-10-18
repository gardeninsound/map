/** Tiny square-wave bleeps. Lazily creates the AudioContext on first use (after a gesture). */
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('bearisland-muted') === '1';
  } catch {
    return false;
  }
})();

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.04, slide = 0) {
  if (muted) return;
  try {
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

/** The shared AudioContext (created on first use, after a user gesture); null if unavailable. */
export function audioContext(): AudioContext | null {
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
  roll: () => tone(180, 0.35, 'sawtooth', 0.025, 160),
  caw: () => {
    tone(620, 0.14, 'sawtooth', 0.035, -260);
    setTimeout(() => tone(600, 0.16, 'sawtooth', 0.035, -280), 190);
  },
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem('bearisland-muted', m ? '1' : '0');
    } catch {
      /* private mode */
    }
  },
};
