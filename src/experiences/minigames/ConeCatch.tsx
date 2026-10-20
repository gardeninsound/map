import { useEffect, useRef, useState } from 'react';
import { INK, PAL, gridToCanvas, input, isTouch, pixelText, withButtons, type Grid } from '../../city';
import { FIELD, FIRE_LIFE, ROUND, jump, newRound, step, type ConeCatchState } from '../../game/coneCatch';
import { buildChicken } from '../../game/sprites';
import { sounds } from '../../ui/sounds';

export interface MiniGameResult {
  score: number;
  best: number;
}

const BEST_KEY = 'bearisland-cone-catch-best';
const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (n: number) => {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode: the best lasts the session */
  }
};

type Phase = 'title' | 'play' | 'over';

/** px: the Art Nouveau life bar across the top; the play field sits under it */
const BAR = 24;
const VIEW = { w: FIELD.w, h: FIELD.h + BAR };

/**
 * Cone Catch, the chicken's mini game: run left and right, catch the ice cream cones before
 * they hit the grass (they go up in flames), jump the fires, dodge the rocks. Rules in
 * src/game/coneCatch.ts; this draws them on a native 160×144 canvas (a 24 px Art Nouveau
 * life bar over the 160×120 field), integer-scaled. {A} starts / jumps / plays again, {B}
 * goes back to the map. On touch: hold the lower left or right of the screen to run, tap
 * the upper part to jump, tap to start.
 */
export default function ConeCatch({ onExit }: { onExit(result: MiniGameResult): void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('title');
  const phaseRef = useRef<Phase>('title');
  phaseRef.current = phase;
  const state = useRef<ConeCatchState>(newRound());
  const best = useRef(readBest());
  const facing = useRef<'left' | 'right'>('right');
  const [zoom, setZoom] = useState(3);
  const exit = useRef(onExit);
  exit.current = onExit;

  // integer zoom that fits the screen, with room for the back button
  useEffect(() => {
    const fit = () => setZoom(Math.max(2, Math.floor(Math.min(window.innerWidth / VIEW.w, (window.innerHeight - 64) / VIEW.h))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const begin = () => {
    state.current = newRound();
    input.clear();
    sounds.cluck();
    setPhase('play');
  };
  const leave = () => {
    input.clear();
    exit.current({ score: state.current.score, best: best.current });
  };

  const hop = () => {
    if (jump(state.current)) sounds.hop();
  };

  // buttons: A starts / jumps / restarts, B leaves
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') {
          input.consume('a');
          if (phaseRef.current === 'play') hop();
          else begin();
        } else if (b === 'b') {
          input.consume('b');
          leave();
        }
      }),
    [],
  );

  // the loop: step the rules while playing (fires burn on after), draw every frame
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const art = { chicken: buildChicken(), cones: buildCones(), rock: gridToCanvas(ROCK, ROCK_COLORS) };
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      const s = state.current;
      const playing = phaseRef.current === 'play';
      const dir = playing ? input.dir().x : 0;
      if (dir) facing.current = dir < 0 ? 'left' : 'right';
      step(s, dt, dir, Math.random);
      if (playing) {
        if (s.caught) sounds.pop();
        if (s.hit || s.scorched) sounds.bonk();
        if (s.burst) sounds.whoosh();
        if (s.over) {
          if (s.score > best.current) {
            best.current = s.score;
            saveBest(s.score);
          }
          setPhase('over');
        }
      }
      draw(ctx, s, art, art.chicken[facing.current][dir ? Math.floor(t / 120) % 2 : 0], phaseRef.current, best.current, t / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // touch: hold the lower left / right of the screen to run that way, tap the upper part to
  // jump; a tap starts
  const press = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'play') return begin();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientY < r.top + r.height * 0.4) return hop();
    input.hold(e.clientX < r.left + r.width / 2 ? 'left' : 'right', true);
  };
  const release = () => {
    input.hold('left', false);
    input.hold('right', false);
  };

  return (
    <div className="scene minigame-scene" onPointerDown={press} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
      <canvas
        ref={canvas}
        width={VIEW.w}
        height={VIEW.h}
        className="minigame-canvas"
        style={{ width: VIEW.w * zoom, height: VIEW.h * zoom }}
        aria-label="Cone Catch: run left and right to catch falling ice cream cones before they hit the ground, jump over the fires, and dodge the rocks"
      />
      <button className="minigame-back" onClick={leave} onPointerDown={(e) => e.stopPropagation()}>
        {isTouch() ? '◀ BACK' : withButtons('{B} BACK')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Art

/** An ice cream cone, tip down: s scoop, d its shade, h shine, c waffle, w waffle lines. */
const CONE: Grid = [
  '..kkkkk..',
  '.ksshssk.',
  'kssshsssk',
  'ksssssssk',
  'kdsssdssk',
  'kkkkkkkkk',
  '.kcwcwck.',
  '.kwcwcwk.',
  '..kcwck..',
  '..kwcwk..',
  '...kck...',
  '...kwk...',
  '....k....',
];
/** strawberry, mint, vanilla, chocolate: [scoop, shade] */
const SCOOPS = [['#e8a59a', '#d98c78'], ['#9be1c0', '#6fb8a0'], ['#f6efd8', '#e0d2b0'], ['#8a5a3a', '#6b4228']];
const buildCones = () =>
  SCOOPS.map(([s, d]) => gridToCanvas(CONE, { k: INK, s, d, h: '#ffffff', c: '#e0a93a', w: '#b8792a' }));

const ROCK: Grid = ['.kkkk.', 'kgglgk', 'kgggdk', 'kgdggk', '.kkkk.'];
const ROCK_COLORS = { k: INK, g: '#8a857c', l: '#b8b3aa', d: '#6e6a62' };

const SKY = '#7fc0b0';
const STRIPES = ['#b8322a', '#f3e6cc'];
const FLAME = ['#fff4c0', '#ffd166', '#f47b20', '#e4202c'];

function draw(
  ctx: CanvasRenderingContext2D,
  s: ConeCatchState,
  art: { cones: HTMLCanvasElement[]; rock: HTMLCanvasElement },
  chicken: HTMLCanvasElement,
  phase: Phase,
  best: number,
  time: number,
) {
  const { w, h, ground } = FIELD;
  // the field sits under the life bar
  ctx.save();
  ctx.translate(0, BAR);
  // the market: sky, a striped awning along the top, grass underfoot
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) {
    ctx.fillStyle = STRIPES[(x / 8) % 2];
    ctx.fillRect(x, 12, 8, 6);
  }
  ctx.fillStyle = INK;
  ctx.fillRect(0, 18, w, 1);
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = PAL.grassDark;
  for (let x = 3; x < w; x += 9) ctx.fillRect(x, ground + 3 + (x % 3), 2, 1);
  ctx.fillStyle = INK;
  ctx.fillRect(0, ground, w, 1);

  // fires where cones hit the grass (behind everything that's still falling)
  for (const f of s.fires) drawFire(ctx, Math.round(f.x), ground, f.age, f.flavor, time);

  // falling cones (wobbling a little) and rocks
  for (const d of s.drops) {
    const x = Math.round(d.x), y = Math.round(d.y);
    if (d.kind === 'cone') ctx.drawImage(art.cones[d.flavor], x - 4 + Math.round(Math.sin(time * 9 + d.x) * 0.6), y - 12);
    else ctx.drawImage(art.rock, x - 3, y - 4);
  }

  // the chicken (up in her jump, blinking just after a hit) and her shadow on the grass
  const z = Math.round(s.z);
  const sw = z > 12 ? 6 : 10;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(Math.round(s.x) - sw / 2, ground + 1, sw, 2);
  if (!(s.grace > 0 && Math.floor(time * 12) % 2)) ctx.drawImage(chicken, Math.round(s.x) - 8, ground - 15 - z);

  if (phase !== 'play') {
    // title and game-over cards
    ctx.fillStyle = 'rgba(42,26,18,0.85)';
    ctx.fillRect(14, 26, w - 28, 68);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const start = isTouch() ? 'TAP TO PLAY' : withButtons('{A} TO PLAY');
    const keys = isTouch() ? 'TAP HIGH TO JUMP' : withButtons('ARROWS RUN, {A} JUMPS');
    const lines =
      phase === 'title'
        ? [['CONE CATCH', '#e6b23a'], ['catch the cones,', '#f3e6cc'], ['jump the fires!', '#f3e6cc'], [keys, '#e8a59a'], [start, '#7fc0b0']]
        : [[s.lives <= 0 ? 'OUCH! GAME OVER' : "TIME'S UP!", '#e6b23a'], [`${s.score} CONES`, '#f3e6cc'], [`BEST ${best}`, '#e8a59a'], ['', ''], [isTouch() ? 'TAP TO PLAY AGAIN' : withButtons('{A} AGAIN'), '#7fc0b0']];
    lines.forEach(([text, color], i) => {
      ctx.fillStyle = color;
      ctx.font = i === 0 ? '8px "Press Start 2P"' : '6px "Press Start 2P"';
      ctx.fillText(text, w / 2, 31 + i * 12);
    });
  }
  ctx.restore();
  drawLifeBar(ctx, s, time);
}

// ---------------------------------------------------------------------------------------
// The life bar: 24 px of Art Nouveau across the top — a cream panel between whiplash vines,
// spiral flourishes at the ends, three arched medallions each holding a heart (a lost life
// leaves an empty arch), the cone count on the left and time running down a gold stem on
// the right that ends in a bud.

const NOUVEAU = {
  panel: '#f3e6cc',
  panelShade: '#e5d6b4',
  gold: '#c89834',
  goldLight: '#e6c26a',
  sage: '#4f8f63',
  sageDark: '#2f6b48',
  heart: '#b8322a',
  heartLight: '#e8a59a',
  lost: '#d8c8a8',
};

const px = (ctx: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** A spiral curl (the ends of the bar), turning `dir` 1 or -1. */
function curl(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: number, color: string) {
  for (let a = 0; a < Math.PI * 3.2; a += 0.12) {
    const r = 5.5 - a * 0.5;
    if (r < 0.6) break;
    px(ctx, color, Math.round(cx + dir * Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
  }
}

/** A horseshoe arch medallion, 15×19, at (x, y), holding a heart if `full`. */
function medallion(ctx: CanvasRenderingContext2D, x: number, y: number, full: boolean) {
  const inside = (i: number, j: number, r: number) => (j >= 7 ? Math.abs(i - 7) <= r : (i - 7) ** 2 + (j - 7) ** 2 <= r * r + r);
  for (let j = 0; j < 19; j++) {
    for (let i = 0; i < 15; i++) {
      if (!inside(i, j, 7)) continue;
      // ink rim, gold band, then the field: deep sage behind a heart, pale where one is lost
      const c = !inside(i, j, 6) ? INK : !inside(i, j, 5) ? (j < 5 && i < 7 ? NOUVEAU.goldLight : NOUVEAU.gold) : full ? NOUVEAU.sageDark : NOUVEAU.lost;
      px(ctx, c, x + i, y + j);
    }
  }
  // the keystone: a small gold drop at the crown
  px(ctx, NOUVEAU.goldLight, x + 7, y - 1);
  const HEART = ['.rr.rr.', 'rhrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  HEART.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const c = full ? (ch === 'h' ? NOUVEAU.heartLight : NOUVEAU.heart) : NOUVEAU.panelShade;
      px(ctx, c, x + 4 + i, y + 7 + j);
    }),
  );
}

function drawLifeBar(ctx: CanvasRenderingContext2D, s: ConeCatchState, time: number) {
  const w = FIELD.w;
  px(ctx, NOUVEAU.panel, 0, 0, w, BAR);
  // whiplash vines along the top and bottom, a slow wave in gold and sage
  for (let x = 0; x < w; x++) {
    px(ctx, NOUVEAU.gold, x, 2 + Math.round(Math.sin(x / 7) * 1.2));
    px(ctx, NOUVEAU.sage, x, 21 + Math.round(Math.sin(x / 7 + Math.PI) * 1.2));
  }
  px(ctx, INK, 0, 0, w, 1);
  px(ctx, INK, 0, BAR - 1, w, 1);
  // spiral flourishes at both ends
  curl(ctx, 7, 12, 1, NOUVEAU.sage);
  curl(ctx, w - 8, 12, -1, NOUVEAU.sage);
  // three lives in arched medallions, sprigs of leaves between
  const mx = w / 2 - 7;
  [-20, 0, 20].forEach((dx, i) => medallion(ctx, mx + dx, 3, i < s.lives));
  for (const lx of [mx - 4, mx + 16, mx + 36]) {
    px(ctx, NOUVEAU.sage, lx, 12, 1, 4);
    px(ctx, NOUVEAU.sage, lx - 1, 11, 1, 1);
    px(ctx, NOUVEAU.sage, lx + 1, 13, 1, 1);
  }
  // left: the cone count (labels in the crisp 3×5 pixel font)
  pixelText(ctx, 'CONES', 15, 4, NOUVEAU.sageDark);
  ctx.save();
  ctx.translate(15, 10);
  ctx.scale(2, 2); // the count, big: the same font at exactly double size
  pixelText(ctx, String(s.score), 0, 0, INK);
  ctx.restore();
  // right: time left, a gold stem shrinking toward its bud
  const left = Math.max(0, 1 - s.t / ROUND);
  const x0 = mx + 38, x1 = w - 16;
  pixelText(ctx, 'TIME', x0 + 2, 6, NOUVEAU.sageDark);
  px(ctx, NOUVEAU.panelShade, x0 + 2, 15, x1 - x0 - 2, 1);
  const len = Math.round((x1 - x0 - 2) * left);
  px(ctx, NOUVEAU.gold, x0 + 2, 15, len, 1);
  px(ctx, NOUVEAU.goldLight, x0 + 2, 14, len, 1);
  // the bud at the end of the stem, pulsing gently
  const bx = x0 + 2 + len;
  const pulse = Math.floor(time * 3) % 2;
  px(ctx, NOUVEAU.heart, bx - 1, 13 - pulse, 3, 3 + pulse);
  px(ctx, NOUVEAU.heartLight, bx, 13 - pulse, 1, 1);
}

/**
 * A cone gone up in flames on the grass: flames flare up, flicker and burn down, sparks rise,
 * and a scorch mark with a puddle of melted scoop is left to fade.
 */
function drawFire(ctx: CanvasRenderingContext2D, x: number, ground: number, age: number, flavor: number, time: number) {
  const life = age / FIRE_LIFE; // 0 → 1
  // the scorch and the melted scoop
  ctx.globalAlpha = Math.min(1, 1.6 - life * 1.4);
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(x - 8, ground + 1, 17, 2);
  ctx.fillStyle = SCOOPS[flavor][0];
  ctx.fillRect(x - 3, ground + 1, 6, 1);
  ctx.globalAlpha = 1;
  // the burst: a bright flash and embers flung out the moment it lands
  if (age < 0.22) {
    const r = 3 + age * 40;
    ctx.fillStyle = age < 0.08 ? FLAME[0] : FLAME[1];
    ctx.fillRect(Math.round(x - r / 2), Math.round(ground - r / 2 - 2), Math.round(r), Math.round(r / 2) + 2);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.1 + (0.8 * i) / 7); // fanned upward
      const d = age * 70;
      ctx.fillStyle = FLAME[1 + (i % 3)];
      ctx.fillRect(Math.round(x + Math.cos(a) * d * (i % 2 ? 1 : -1)), Math.round(ground - 2 - Math.sin(a) * d), 1, 1);
    }
  }
  // flame height: flares fast, then dies down
  const height = Math.round(20 * Math.min(1, life * 6) * Math.max(0, 1 - life) ** 0.7);
  if (height <= 0) return;
  for (let dx = -7; dx <= 7; dx++) {
    // each column licks up and down on its own
    const lick = 0.55 + 0.45 * Math.sin(time * 18 + dx * 1.9 + x);
    const colH = Math.round(height * (1 - (dx / 8) ** 2) * lick);
    for (let k = 0; k < colH; k++) {
      const f = k / Math.max(1, colH); // 0 at the base → 1 at the tip
      const centre = Math.abs(dx) < 2 && f < 0.5;
      ctx.fillStyle = centre ? FLAME[0] : f < 0.35 ? FLAME[1] : f < 0.7 ? FLAME[2] : FLAME[3];
      ctx.fillRect(x + dx, ground - 1 - k, 1, 1);
    }
  }
  // sparks floating up
  for (let i = 0; i < 3; i++) {
    const sy = ground - height - ((time * 30 + i * 7 + x) % 12);
    const sx = x + Math.round(Math.sin(time * 5 + i * 2.1) * 4);
    ctx.fillStyle = i % 2 ? FLAME[1] : FLAME[2];
    ctx.fillRect(sx, Math.round(sy), 1, 1);
  }
}
