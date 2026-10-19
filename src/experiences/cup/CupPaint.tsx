import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/big-shoulders-stencil-display/800';
import { cupScript, cupVersions } from '../../content/cupVersions';
import { buttonLabel, input } from '../../city';
import { buildSprites } from '../../city';
import { DialogBox } from '../../ui/MikeDialog';
import { sounds as sfx } from '../../ui/sounds';
import type { ExperienceProps } from '../registry';
import { CupScene } from './CupScene';
import { FONT, loadRabbit } from './cupTexture';

/** Paint over this much of the front and the rest of the coat rolls on by itself. */
const DONE_AT = 0.55;
const ROLL_MS = 1100;

const monthYear = (d: string) =>
  new Date(`${d}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const words = (i: number) => cupVersions[i].lines?.map((l) => l.text).join(' ') ?? '(the rabbit)';

/**
 * The Big Cup: a 3D mug you circle and paint. Each finished coat reveals the next
 * version it actually wore, in order.
 */
export default function CupPaint({ location, onExit }: ExperienceProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CupScene | null>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [coverage, setCoverage] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [intro, setIntro] = useState(true);
  const [outro, setOutro] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  const finishing = useRef(false);
  const last = index >= cupVersions.length - 1;

  // Mount the 3D scene once.
  useEffect(() => {
    const rabbit = buildSprites().rabbit.up[0];
    const s = new CupScene(host.current!, { onPaint: setCoverage }, rabbit);
    scene.current = s;
    let alive = true;
    Promise.allSettled([document.fonts.load(`800 64px ${FONT}`), loadRabbit()]).then(() => {
      if (!alive) return;
      s.painter.setVersions(cupVersions[0], cupVersions[1]);
      s.setHandleColor(cupVersions[0].body);
      s.refresh();
      setReady(true);
    });
    return () => {
      alive = false;
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    if (!quip) return;
    const id = setTimeout(() => setQuip(null), 7000);
    return () => clearTimeout(id);
  }, [quip]);

  /** The coat is on: the next version becomes the mug. */
  const commit = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    const next = index + 1;
    s.painter.setVersions(cupVersions[next], cupVersions[next + 1] ?? null);
    s.setHandleColor(cupVersions[next].body);
    s.refresh();
    setIndex(next);
    setCoverage(0);
    finishing.current = false;
    setRolling(false);
    sfx.confirm();
    const line = cupVersions[next].says;
    if (line) setQuip(line);
    if (next >= cupVersions.length - 1) setTimeout(() => setOutro(true), line ? 4500 : 800);
  }, [index]);

  /** Roll the rest of the coat on: a zig-zag of strokes over the front, then everywhere. */
  const rollOn = useCallback(() => {
    const s = scene.current;
    if (!s || !s.painter.hasNext || finishing.current) return;
    finishing.current = true;
    setRolling(true);
    sfx.roll();
    if (reducedMotion()) {
      s.painter.fillAll();
      s.refresh();
      setTimeout(commit, 150);
      return;
    }
    const rows = 6;
    const t0 = performance.now();
    s.painter.lift();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ROLL_MS);
      const row = Math.min(rows - 1, Math.floor(p * rows));
      const along = (p * rows) % 1;
      const dir = row % 2 ? -1 : 1;
      const u = 0.5 + dir * (along - 0.5) * 0.46;
      const v = 0.86 - (row / (rows - 1)) * 0.72;
      s.painter.paint(u, v);
      s.refresh();
      if (p < 1) requestAnimationFrame(tick);
      else {
        s.painter.fillAll();
        s.refresh();
        setTimeout(commit, 250);
      }
    };
    requestAnimationFrame(tick);
  }, [commit]);

  // Painted enough by hand? Finish it.
  useEffect(() => {
    if (coverage >= DONE_AT) rollOn();
  }, [coverage, rollOn]);

  const restart = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    s.painter.setVersions(cupVersions[0], cupVersions[1]);
    s.setHandleColor(cupVersions[0].body);
    s.refresh();
    setIndex(0);
    setCoverage(0);
    setOutro(false);
  }, []);

  // Buttons + keyboard orbit.
  const handlers = useRef({ rollOn, onExit, dialogOpen: intro || outro });
  handlers.current = { rollOn, onExit, dialogOpen: intro || outro };
  useEffect(() => {
    const off = input.on((b) => {
      const h = handlers.current;
      if (b === 'b') {
        input.consume('b');
        sfx.back();
        h.onExit();
      } else if (b === 'a' && !h.dialogOpen) {
        input.consume('a');
        h.rollOn();
      }
    });
    let raf = 0;
    const poll = () => {
      const d = input.dir();
      scene.current?.setOrbitInput(d.x, -d.y);
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, []);

  const v = cupVersions[index];
  return (
    <div className="scene cup-scene">
      <div ref={host} className="cup-stage" aria-label="A 3D model of the giant mug outside Lulu Coffee. Drag the cup to paint it." />

      <header className="scene-bar cup-bar">
        <div>
          <h2 className="scene-title">{cupScript.title}</h2>
          <p className="scene-where">{location.where}</p>
        </div>
        <div className="scene-counter" aria-live="polite">
          <span className="scene-count">
            COAT {index + 1}/{cupVersions.length}
          </span>
          <span className="scene-date">{monthYear(v.date)}</span>
        </div>
      </header>

      <p className="cup-words" aria-live="polite">“{words(index)}”</p>

      {ready && !last && !intro && (
        <div className="cup-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, (coverage / DONE_AT) * 100)}%`, background: cupVersions[index + 1].body }} />
        </div>
      )}

      {quip && (
        <div className="quip cup-quip" role="status">
          <img src={`${import.meta.env.BASE_URL}sprites/mike-portrait.png`} alt="" />
          <p>{quip}</p>
        </div>
      )}

      <div className="scene-controls cup-controls">
        <button className="primary" onClick={rollOn} disabled={last || rolling || !ready}>
          ROLL ON NEXT COAT <kbd>{buttonLabel('a')}</kbd>
        </button>
        <button onClick={() => { sfx.back(); onExit(); }}>
          LEAVE <kbd>{buttonLabel('b')}</kbd>
        </button>
      </div>
      <p className="cup-hint">drag the cup to paint · drag the sky to walk around · scroll / pinch to zoom</p>

      {intro && (
        <div className="scene-dialog">
          <DialogBox lines={cupScript.intro} onDone={() => setIntro(false)} />
        </div>
      )}
      {outro && (
        <div className="scene-dialog">
          <DialogBox
            lines={cupScript.outro}
            onDone={() => setOutro(false)}
            choices={[
              { label: 'Paint it again', onPick: restart },
              { label: 'Back to the streets', onPick: onExit },
            ]}
          />
        </div>
      )}
    </div>
  );
}
