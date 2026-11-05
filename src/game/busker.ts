/**
 * The Junction busker's music: little original chiptune songs played through Web Audio,
 * scheduled a beat or so ahead. The game sets `level` (0..1) from how close you are, and
 * the master gain glides toward it, so the music swells as you walk up and fades away.
 *
 * Everyone hears the same thing: the playlist runs on the wall clock (`whereNow`), not on
 * when you loaded the page, so the song and the bar the busker is on "now" are the same
 * for every rabbit (to within how well their clocks agree, usually well under a second).
 */
import { audioContext, sfx } from '../city';

/** "NOTE:beats" tokens; R = rest. Lead lines are written to loop. */
export interface Song {
  name: string;
  bpm: number;
  lead: string;
  /** one chord root per bar (4 beats) */
  bass: string[];
  /** the bass's notes in each bar, from the root: [semitones, start beat, beats]. Default:
   *  root–fifth–octave–fifth in eighths */
  groove?: [number, number, number][];
  /** a soft hi-hat tick at these beats of every bar */
  hats?: number[];
  /** the lead's tone (default square) */
  wave?: OscillatorType;
  /** loudness against the bouncy songs (1) */
  gain?: number;
  /** chance of the little octave-up sparkle on short lead notes (default 0.35) */
  sparkle?: number;
  /** times through before the next song (default 1) */
  times?: number;
}

const EIGHTHS: [number, number, number][] = [0, 7, 12, 7, 0, 7, 12, 7].map((st, i) => [st, i * 0.5, 0.45]);

export const SONGS: Song[] = [
  {
    // bouncy, C major
    name: 'Trust the Flux',
    bpm: 138,
    lead:
      'E5:.5 G5:.5 C6:1 G5:.5 E5:.5 D5:1 ' +
      'F5:.5 A5:.5 D6:1 A5:.5 F5:.5 E5:1 ' +
      'G5:.5 E5:.5 C5:.5 E5:.5 G5:1 C6:1 ' +
      'B5:.5 A5:.5 G5:.5 F5:.5 E5:1.5 R:.5 ' +
      'E5:.5 G5:.5 C6:1 D6:.5 C6:.5 A5:1 ' +
      'F5:.5 A5:.5 G5:1 E5:.5 D5:.5 C5:1 ' +
      'D5:.5 E5:.5 F5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:.5 ' +
      'C5:1 G4:.5 C5:.5 C5:1.5 R:.5',
    bass: ['C3', 'F3', 'C3', 'G3', 'C3', 'F3', 'G3', 'C3'],
  },
  {
    // calm and slow, D major: long soft notes, the bass just rolls under them
    name: 'Fog on the Sound',
    bpm: 76,
    lead:
      'F#5:2 A5:1 E5:1 ' +
      'D5:3 R:1 ' +
      'B4:1 D5:1 E5:2 ' +
      'F#5:3 R:1 ' +
      'A5:2 G5:1 F#5:1 ' +
      'E5:2 D5:1 B4:1 ' +
      'C#5:1 D5:1 E5:1 A4:1 ' +
      'D5:3 R:1',
    bass: ['D3', 'B2', 'G2', 'D3', 'D3', 'E3', 'A2', 'D3'],
    groove: [[0, 0, 1.9], [7, 2, 0.9], [12, 3, 0.9]],
    wave: 'triangle',
    gain: 0.9,
    sparkle: 0,
    times: 2,
  },
  {
    // skippy, G major
    name: 'Puppies Without Pants',
    bpm: 150,
    lead:
      'G5:.5 G5:.5 B5:.5 D6:.5 B5:1 G5:1 ' +
      'A5:.5 A5:.5 C6:.5 E6:.5 C6:1 A5:1 ' +
      'B5:.5 D6:.5 G6:1 F#6:.5 E6:.5 D6:1 ' +
      'C6:.5 B5:.5 A5:.5 F#5:.5 G5:1.5 R:.5 ' +
      'D6:.5 B5:.5 G5:.5 B5:.5 C6:.5 A5:.5 F#5:.5 A5:.5 ' +
      'B5:.5 G5:.5 E5:.5 G5:.5 A5:2 ' +
      'G5:.5 A5:.5 B5:.5 C6:.5 D6:1 B5:1 ' +
      'A5:.5 F#5:.5 D5:.5 F#5:.5 G5:1.5 R:.5',
    bass: ['G2', 'D3', 'G2', 'D3', 'G2', 'C3', 'G2', 'D3'],
  },
  {
    // a low funky groove, E dorian: syncopated bass, offbeat hats, a quiet lead that
    // mostly leaves space
    name: 'Junction Strut',
    bpm: 98,
    lead:
      'R:1 E5:.25 G5:.25 R:.5 A5:.5 G5:.5 R:1 ' +
      'R:.5 B5:.25 A5:.25 G5:.5 E5:.5 R:2 ' +
      'R:1 C#6:.25 B5:.25 R:.5 A5:.5 F#5:.5 R:1 ' +
      'R:.5 E5:.5 F#5:.25 G5:.25 A5:.5 R:2 ' +
      'R:1 E5:.25 G5:.25 R:.5 A5:.5 G5:.5 R:1 ' +
      'R:.5 B5:.25 D6:.25 B5:.5 A5:.5 R:2 ' +
      'R:1 G5:.25 A5:.25 R:.5 C#6:.5 A5:.5 R:1 ' +
      'B5:.5 A5:.25 G5:.25 F#5:.5 E5:1 R:1.5',
    bass: ['E2', 'E2', 'A2', 'A2', 'E2', 'E2', 'A2', 'B2'],
    groove: [[0, 0, 0.2], [0, 0.75, 0.2], [12, 1, 0.2], [10, 1.5, 0.2], [0, 2, 0.2], [0, 2.75, 0.2], [7, 3, 0.2], [10, 3.5, 0.2]],
    hats: [0.5, 1.5, 2.5, 3.5],
    gain: 0.55,
    sparkle: 0,
    times: 2,
  },
  {
    // sunny, F major
    name: 'So Glad You Are Here',
    bpm: 126,
    lead:
      'A5:1 C6:.5 A5:.5 G5:1 F5:1 ' +
      'G5:.5 A5:.5 Bb5:.5 A5:.5 G5:2 ' +
      'C6:1 D6:.5 C6:.5 Bb5:.5 A5:.5 G5:1 ' +
      'F5:.5 G5:.5 A5:.5 C6:.5 A5:2 ' +
      'A5:1 C6:.5 A5:.5 G5:1 F5:1 ' +
      'Bb5:.5 A5:.5 G5:.5 E5:.5 F5:2 ' +
      'D6:.5 C6:.5 Bb5:.5 A5:.5 G5:.5 A5:.5 Bb5:1 ' +
      'A5:.5 G5:.5 E5:.5 G5:.5 F5:1.5 R:.5',
    bass: ['F2', 'C3', 'Bb2', 'F2', 'F2', 'Bb2', 'C3', 'F2'],
  },
];

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(name: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return NOTE[m[1]] + (Number(m[2]) + 1) * 12;
}
const freq = (n: number) => 440 * 2 ** ((n - 69) / 12);

export interface ScheduledNote {
  t: number; // beats from song start
  dur: number; // beats
  midi: number; // (0 for a hat)
  voice: 'lead' | 'bass' | 'hat';
}

/** Flatten a song into timed notes (pure, so it's testable). */
export function score(song: Song): { notes: ScheduledNote[]; beats: number } {
  const notes: ScheduledNote[] = [];
  let t = 0;
  for (const tok of song.lead.trim().split(/\s+/)) {
    const [n, d] = tok.split(':');
    const dur = Number(d);
    if (n !== 'R') notes.push({ t, dur, midi: midi(n), voice: 'lead' });
    t += dur;
  }
  const bars = song.bass.length;
  song.bass.forEach((root, bar) => {
    const r = midi(root);
    for (const [st, at, dur] of song.groove ?? EIGHTHS) notes.push({ t: bar * 4 + at, dur, midi: r + st, voice: 'bass' });
    for (const at of song.hats ?? []) notes.push({ t: bar * 4 + at, dur: 0.1, midi: 0, voice: 'hat' });
  });
  return { notes: notes.sort((a, b) => a.t - b.t), beats: Math.max(t, bars * 4) };
}

export const SONG_COUNT = SONGS.length;

/** a beat's breath between songs */
const GAP_BEATS = 1;

/** Each song's slot in the playlist: its notes repeated `times`, then the gap. */
const SLOTS = SONGS.map((song) => {
  const one = score(song);
  const times = song.times ?? 1;
  const notes = Array.from({ length: times }, (_, r) => one.notes.map((n) => ({ ...n, t: n.t + r * one.beats }))).flat();
  const spb = 60 / song.bpm;
  return { song, notes, spb, seconds: (one.beats * times + GAP_BEATS) * spb };
});
const SLOT_START = SLOTS.map((_, i) => SLOTS.slice(0, i).reduce((a, s) => a + s.seconds, 0));
/** seconds for the whole playlist, once round */
export const CYCLE = SLOTS.reduce((a, s) => a + s.seconds, 0);
export const slotSeconds = (i: number) => SLOTS[i].seconds;

/**
 * What the busker is playing at this wall-clock moment (seconds since 1970), the same for
 * everyone: which song, and how many seconds into its slot.
 */
export function whereNow(nowSec: number): { song: number; at: number } {
  let pos = ((nowSec % CYCLE) + CYCLE) % CYCLE;
  for (let i = 0; i < SLOTS.length; i++) {
    if (pos < SLOTS[i].seconds) return { song: i, at: pos };
    pos -= SLOTS[i].seconds;
  }
  return { song: 0, at: 0 }; // float edge at the very end of the cycle
}

export class BuskerMusic {
  /** 0..1 — how loud the busker should be right now (distance-based) */
  level = 0;
  /** seconds to add to this device's clock (e.g. from a server's time), if it's known to be off */
  clockOffset = 0;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private song = -1;
  private slotStart = 0; // AudioContext time the current song's slot began
  private cursor = 0; // index of the next note to schedule

  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 90);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.master?.gain.setTargetAtTime(0, this.master.context.currentTime, 0.1);
  }

  private wall() {
    return Date.now() / 1000 + this.clockOffset;
  }

  /** seconds per beat of the song playing now */
  get beat() {
    return SLOTS[this.song >= 0 ? this.song : whereNow(this.wall()).song].spb;
  }

  /** the song playing now (for dev tools / tests) */
  get songName() {
    return SONGS[whereNow(this.wall()).song].name;
  }

  /** Jump to where the wall clock says the busker is, from the next note on. */
  private sync(ac: AudioContext) {
    const { song, at } = whereNow(this.wall());
    this.song = song;
    this.slotStart = ac.currentTime - at;
    const { notes, spb } = SLOTS[song];
    this.cursor = notes.findIndex((n) => this.slotStart + n.t * spb >= ac.currentTime + 0.02);
    if (this.cursor < 0) this.cursor = notes.length;
  }

  private tick() {
    const ac = audioContext();
    if (!ac) return;
    if (!this.master) {
      this.master = ac.createGain();
      this.master.gain.value = 0;
      this.master.connect(ac.destination);
    }
    const target = sfx.isMuted() ? 0 : 0.11 * this.level;
    this.master.gain.setTargetAtTime(target, ac.currentTime, 0.25);

    // Stay on the shared clock: on the first tick, and whenever we've drifted (a tab that
    // slept, a suspended AudioContext), jump back to where everyone else is.
    if (this.song < 0) this.sync(ac);
    else {
      const ours = SLOT_START[this.song] + (ac.currentTime - this.slotStart);
      let drift = (ours - (this.wall() % CYCLE)) % CYCLE;
      if (drift > CYCLE / 2) drift -= CYCLE;
      if (drift < -CYCLE / 2) drift += CYCLE;
      if (Math.abs(drift) > 0.25) this.sync(ac);
    }

    // Keep the song's clock running even when you can't hear it, so walking back up
    // drops you into the middle of a tune like a real busker.
    const ahead = ac.currentTime + 0.35;
    while (true) {
      const slot = SLOTS[this.song];
      if (this.cursor >= slot.notes.length) {
        // next song, after the gap
        this.slotStart += slot.seconds;
        this.song = (this.song + 1) % SLOTS.length;
        this.cursor = 0;
        continue;
      }
      const n = slot.notes[this.cursor];
      const when = this.slotStart + n.t * slot.spb;
      if (when > ahead) break;
      if (when >= ac.currentTime && target > 0.0005) this.play(ac, n, when);
      this.cursor++;
    }
  }

  private play(ac: AudioContext, n: ScheduledNote, when: number) {
    const { song, spb } = SLOTS[this.song];
    const loud = song.gain ?? 1;
    if (n.voice === 'hat') return this.hat(ac, when, loud);
    const osc = ac.createOscillator();
    const env = ac.createGain();
    const dur = n.dur * spb;
    osc.type = n.voice === 'lead' ? (song.wave ?? 'square') : 'triangle';
    osc.frequency.setValueAtTime(freq(n.midi), when);
    const peak = (n.voice === 'lead' ? 0.35 : 0.55) * loud;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.01);
    env.gain.exponentialRampToValueAtTime(peak * 0.4, when + Math.min(0.12, dur * 0.5));
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95);
    osc.connect(env).connect(this.master!);
    osc.start(when);
    osc.stop(when + dur);
    if (n.voice === 'lead' && n.dur <= 0.5 && Math.random() < (song.sparkle ?? 0.35)) {
      // a little sparkle an octave up
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = 'square';
      o2.frequency.setValueAtTime(freq(n.midi + 12), when);
      g2.gain.setValueAtTime(0.08, when);
      g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
      o2.connect(g2).connect(this.master!);
      o2.start(when);
      o2.stop(when + 0.13);
    }
  }

  /** a soft closed hi-hat: a whisper of filtered noise */
  private hat(ac: AudioContext, when: number, loud: number) {
    if (!this.noise) {
      this.noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25 * loud, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(when);
    src.stop(when + 0.05);
  }
}
