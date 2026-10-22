import { useEffect, useRef } from 'react';
import { midrib, pinnaLength, progress, STIPE, type Frond } from '../game/fern';

const W = 160;
const H = 120;
const FPS = 15;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return (0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16);
};
const SHADE = hex('#173f26');
const STEM = hex('#2b6234');
const LEAF = hex('#3b9146');
const SUN = hex('#76c85a');
const SCALE = hex('#a88d5c');
const BUD = hex('#a6cf6c');

/** A clump of sword fern: fronds fanned round the crown, the middle ones longest. */
function clump(seed: number, start: number): Frond[] {
  const n = 11;
  return Array.from({ length: n }, (_, i) => {
    const off = (i / (n - 1) - 0.5) * 2.5 + Math.sin(seed + i * 2.3) * 0.08;
    return {
      angle: -Math.PI / 2 + off,
      length: 100 - 26 * Math.abs(off) + Math.sin(seed * 3 + i) * 6,
      delay: start + ((i * 7 + seed) % n) * 0.45,
    };
  });
}

/** Draw a fern into the pixel buffer: dark outline pass, then midribs and leaflets. */
function draw(buf: Uint32Array, fronds: Frond[], t: number, still: boolean) {
  buf.fill(0);
  const shade: number[] = [];
  const color: number[] = [];
  const put = (x: number, y: number, c: number) => {
    const px = Math.round(x + W / 2);
    const py = Math.round(y + H - 2);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    shade.push(px, py);
    color.push(px, py, c);
  };
  fronds.forEach((f, i) => {
    const { e, u } = still ? { e: 1, u: 1 } : progress(f, t);
    if (e <= 0) return;
    const rib = midrib(f, u, e, still ? 0 : 0.0016 * Math.sin(t * 0.9 + i * 1.7));
    const L = rib.at(-1)!.s;
    rib.forEach((p, j) => {
      const curled = p.open < 1;
      if (curled) {
        // a plump, scaly coil: three pixels across, pale green flecked with brown
        const nx = -Math.sin(p.a);
        const ny = Math.cos(p.a);
        for (const w of [-1, 0, 1]) put(p.x + nx * w, p.y + ny * w, (j + w) % 4 ? BUD : SCALE);
        return;
      }
      put(p.x, p.y, STEM);
      if (j % 5 || p.s < STIPE * L) return;
      const side = (j / 5) % 2 ? 1 : -1;
      const len = pinnaLength(f, p, L) * e;
      const a = p.a + side * (Math.PI / 2 - 0.55);
      for (let d = 1; d <= len; d += 0.5) {
        const c = d > len - 1 || side < 0 ? SUN : LEAF;
        put(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d + d * d * 0.012, c);
      }
    });
  });
  for (let k = 0; k < shade.length; k += 2) {
    const x = shade[k];
    const y = shade[k + 1];
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) buf[ny * W + nx] = SHADE;
    }
  }
  for (let k = 0; k < color.length; k += 3) buf[color[k + 1] * W + color[k]] = color[k + 2];
}

/** One fern that comes up as fiddleheads and unfurls, then sways. */
function Fern({ seed, start, className }: { seed: number; start: number; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const buf = new Uint32Array(img.data.buffer);
    const fronds = clump(seed, start);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let last = -1;
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const n = Math.floor(t * FPS);
      if (n !== last) {
        last = n;
        draw(buf, fronds, t, still);
        ctx.putImageData(img, 0, 0);
      }
      if (!still) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seed, start]);
  return <canvas ref={ref} width={W} height={H} className={`fern ${className}`} />;
}

/** Big sword ferns in the bottom corners of the title screen (decorative). */
export function TitleFerns() {
  return (
    <>
      <Fern seed={1} start={0.3} className="fern-left" />
      <Fern seed={4} start={1.6} className="fern-right" />
    </>
  );
}
