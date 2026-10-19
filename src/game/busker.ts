/**
 * The Junction busker's music: little original chiptune songs played through Web Audio,
 * scheduled a beat or so ahead. The game sets `level` (0..1) from how close you are, and
 * the master gain glides toward it, so the music swells as you walk up and fades away.
 */
import { audioContext, sfx } from 'west-seattle-map';

/** "NOTE:beats" tokens; R = rest. Lead lines are written to loop. */
interface Song {
  bpm: number;
  lead: string;
  /** one chord root per bar (4 beats), bass plays root–fifth–octave–fifth in eighths */
  bass: string[];
}

export const SONGS: Song[] = [
  {
    // "Trust the Flux" — bouncy, C major
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
    // "Puppies Without Pants" — skippy, G major
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
    // "So Glad You Are Here" — sunny, F major
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
  midi: number;
  voice: 'lead' | 'bass';
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
    [r, r + 7, r + 12, r + 7, r, r + 7, r + 12, r + 7].forEach((m, i) =>
      notes.push({ t: bar * 4 + i * 0.5, dur: 0.45, midi: m, voice: 'bass' }),
    );
  });
  return { notes: notes.sort((a, b) => a.t - b.t), beats: Math.max(t, bars * 4) };
}

export const SONG_COUNT = SONGS.length;

export class BuskerMusic {
  /** 0..1 — how loud the busker should be right now (distance-based) */
  level = 0;
  private master: GainNode | null = null;
  private timer = 0;
  private song = 0;
  private songStart = 0; // AudioContext time the current song began
  private cursor = 0; // index of the next note to schedule
  private scored = score(SONGS[0]);

  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 90);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.master?.gain.setTargetAtTime(0, this.master.context.currentTime, 0.1);
  }

  /** seconds per beat of the current song */
  get beat() {
    return 60 / SONGS[this.song].bpm;
  }

  private tick() {
    const ac = audioContext();
    if (!ac) return;
    if (!this.master) {
      this.master = ac.createGain();
      this.master.gain.value = 0;
      this.master.connect(ac.destination);
      this.songStart = ac.currentTime + 0.1;
    }
    const target = sfx.isMuted() ? 0 : 0.11 * this.level;
    this.master.gain.setTargetAtTime(target, ac.currentTime, 0.25);

    // Keep the song's clock running even when you can't hear it, so walking back up
    // drops you into the middle of a tune like a real busker.
    const ahead = ac.currentTime + 0.35;
    const spb = this.beat;
    const { notes, beats } = this.scored;
    while (true) {
      if (this.cursor >= notes.length) {
        // next song, after a beat's breath
        this.songStart += (beats + 1) * spb;
        this.song = (this.song + 1) % SONGS.length;
        this.scored = score(SONGS[this.song]);
        this.cursor = 0;
        continue;
      }
      const n = this.scored.notes[this.cursor];
      const when = this.songStart + n.t * this.beat;
      if (when > ahead) break;
      if (when >= ac.currentTime && target > 0.0005) this.play(ac, n, when);
      this.cursor++;
    }
  }

  private play(ac: AudioContext, n: ScheduledNote, when: number) {
    const osc = ac.createOscillator();
    const env = ac.createGain();
    const dur = n.dur * this.beat;
    osc.type = n.voice === 'lead' ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(freq(n.midi), when);
    const peak = n.voice === 'lead' ? 0.35 : 0.55;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.01);
    env.gain.exponentialRampToValueAtTime(peak * 0.4, when + Math.min(0.12, dur * 0.5));
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95);
    osc.connect(env).connect(this.master!);
    osc.start(when);
    osc.stop(when + dur);
    if (n.voice === 'lead' && n.dur <= 0.5 && Math.random() < 0.35) {
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
}
