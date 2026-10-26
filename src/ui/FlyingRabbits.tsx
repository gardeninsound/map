import { useMemo } from 'react';
import { gridToCanvas, INK, type Grid } from '../city';

const COLORS: Record<string, string> = { k: INK, w: '#ffffff', g: '#d9d4ec', p: '#ff7eb6', t: '#2ec4b6' };

/** A rabbit flying right, its ears for wings: upstroke, then downstroke. 20×13 each. */
export const FLYING_RABBIT: Grid[] = [
  [
    '...........kk..kk...',
    '..........kwwkkwwk..',
    '..........kwpkkwpk..',
    '..........kwpkkwpk..',
    '...........kwkkwk...',
    '..........kkwwwwkk..',
    '..kk.....kwwwwwwkwk.',
    '.kwwkkkkkwwwwwwwwwpk',
    '.kwwwwwwwwwwwwwwwwk.',
    'ttkgwwwwwtttttwwgk..',
    '.ttkkgwwwwwwwwggk...',
    '..kwwkkkkkkkkkkwwk..',
    '...kk..........kk...',
  ],
  [
    '....................',
    '......kkkk..........',
    '.....kwwppkkkk......',
    '......kkkwwppwkk....',
    '.........kkkwwwk....',
    '..........kkwwwwkk..',
    '..kk.....kwwwwwwkwk.',
    '.kwwkkkkkwwwwwwwwwpk',
    '.kwwwwwwwwwwwwwwwwk.',
    '.tkgwwwwwtttttwwgk..',
    'tt.kkgwwwwwwwwggk...',
    '..kwwkkkkkkkkkkwwk..',
    '...kk..........kk...',
  ],
];

interface Flight {
  /** height, % of screen */
  top: number;
  /** seconds per loop (a rare one crosses in the first quarter, then stays away) */
  dur: number;
  /** seconds into its loop it starts */
  delay: number;
  scale: number;
  left: boolean;
  rare?: boolean;
}

/** The flock behind the title card. */
const FLIGHTS: Flight[] = [
  { top: 8, dur: 14, delay: 0, scale: 3, left: false },
  { top: 22, dur: 19, delay: 6, scale: 2, left: true },
  { top: 40, dur: 11, delay: 3, scale: 4, left: false },
  { top: 15, dur: 23, delay: 11, scale: 2, left: false },
  { top: 52, dur: 16, delay: 9, scale: 3, left: true },
];

/** Now and then a big one swoops past in front of the card. */
const FRONT: Flight[] = [
  { top: 30, dur: 26, delay: 22, scale: 7, left: false, rare: true },
  { top: 58, dur: 37, delay: 21, scale: 6, left: true, rare: true },
];

/** Rabbits flapping across the title sky (decorative; still under reduced motion). */
export function FlyingRabbits({ front = false }: { front?: boolean }) {
  const sheet = useMemo(() => {
    const [a, b] = FLYING_RABBIT.map((g) => gridToCanvas(g, COLORS));
    const c = document.createElement('canvas');
    c.width = a.width * 2;
    c.height = a.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(a, 0, 0);
    ctx.drawImage(b, a.width, 0);
    return c.toDataURL();
  }, []);

  return (
    <>
      {(front ? FRONT : FLIGHTS).map((f, i) => (
        <span
          key={i}
          className={`flyer${f.left ? ' flyer-left' : ''}${f.rare ? ' flyer-rare' : ''}`}
          style={{ top: `${f.top}%`, animationDuration: `${f.dur}s`, animationDelay: `-${f.delay}s` }}
        >
          <i
            style={{
              backgroundImage: `url(${sheet})`,
              width: 20 * f.scale,
              height: 13 * f.scale,
              backgroundSize: `${40 * f.scale}px ${13 * f.scale}px`,
              ['--flap' as string]: `-${40 * f.scale}px`,
              animationDelay: `-${i * 0.3}s`,
            }}
          />
        </span>
      ))}
    </>
  );
}
