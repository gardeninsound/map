import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { artUrl, videoUrl } from '../content/art';
import { artManifest } from '../content/artManifest';
import { chooseTurns, slideshows, wallTurns } from '../content/wallTurns';
import type { ArtAsset } from '../content/types';
import { buttonLabel, input } from 'west-seattle-map';
import { DialogBox } from '../ui/MikeDialog';
import { sounds as sfx } from '../ui/sounds';
import type { ExperienceProps } from './registry';

const ROLL_MS = 750;
const FLIP_MS = 260;
const art = (set: string, a: ArtAsset, thumb = false) => artUrl(set, a.id, thumb);
const video = (set: string, a: ArtAsset) => videoUrl(set, a.id);
const monthYear = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Index of the milestone crossed when moving from `prev` to `next`, if any. */
export function crossedMilestone(prev: number, next: number, count: number, marks: { at: number }[]): number {
  if (next <= prev) return -1;
  return marks.findIndex((m) => {
    const i = Math.min(count - 1, Math.round(m.at * (count - 1)));
    return prev < i && next >= i;
  });
}

function Slide({ set, asset, alt }: { set: string; asset: ArtAsset; alt: string }) {
  if (asset.kind === 'video') {
    return (
      <video
        className="wall-media"
        src={video(set, asset)}
        poster={art(set, asset)}
        autoPlay
        muted
        loop
        playsInline
        aria-label={alt}
      />
    );
  }
  return <img className="wall-media" src={art(set, asset)} alt={alt} />;
}

export default function WallTurns({ location, onExit }: ExperienceProps) {
  const script = slideshows[location.experience ?? ''] ?? wallTurns;
  const assets = useMemo(() => chooseTurns(artManifest[location.set] ?? [], script.maxPhotos, script.picks), [location.set, script]);
  const [index, setIndex] = useState(0);
  const [incoming, setIncoming] = useState<number | null>(null);
  const [intro, setIntro] = useState(true);
  const [outro, setOutro] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const busy = incoming !== null;
  const reduced = useRef(reducedMotion());
  const said = useRef(new Set<number>());

  const say = useCallback((line: string) => {
    setQuip(line);
  }, []);

  useEffect(() => {
    if (!quip) return;
    const id = setTimeout(() => setQuip(null), 6000);
    return () => clearTimeout(id);
  }, [quip]);

  // Preload the next couple of photos so the roller never waits.
  useEffect(() => {
    for (const a of assets.slice(index + 1, index + 3)) {
      if (a.kind === 'image') new Image().src = art(location.set, a);
    }
  }, [index, assets, location.set]);

  const goTo = useCallback(
    (next: number, animate = true) => {
      if (next < 0 || next >= assets.length || next === index || incoming !== null) return;
      const m = crossedMilestone(index, next, assets.length, script.milestones);
      if (m >= 0 && !said.current.has(m) && !flipping) {
        said.current.add(m);
        say(script.milestones[m].line);
      }
      if (!animate || reduced.current || next < index) {
        setIndex(next);
        return;
      }
      sfx.roll();
      setIncoming(next);
    },
    [assets.length, index, incoming, flipping, say],
  );

  // Finish the roll: the incoming coat becomes the wall.
  useEffect(() => {
    if (incoming === null) return;
    const id = setTimeout(() => {
      setIndex(incoming);
      setIncoming(null);
    }, flipping ? FLIP_MS : ROLL_MS);
    return () => clearTimeout(id);
  }, [incoming, flipping]);

  // Flipbook: keep rolling until the end.
  useEffect(() => {
    if (!flipping || busy) return;
    if (index >= assets.length - 1) {
      setFlipping(false);
      setOutro(true);
      return;
    }
    const id = setTimeout(() => setIncoming(index + 1), 60);
    return () => clearTimeout(id);
  }, [flipping, busy, index, assets.length]);

  const next = useCallback(() => {
    if (index >= assets.length - 1) setOutro(true);
    else goTo(index + 1);
  }, [index, assets.length, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);
  const toggleFlip = useCallback(() => {
    setFlipping((f) => {
      if (!f) {
        say(script.flipLine);
        if (index >= assets.length - 1) setIndex(0);
      }
      return !f;
    });
  }, [index, assets.length, say]);

  const dialogOpen = intro || outro;
  const handlers = useRef({ next, prev, toggleFlip, onExit, dialogOpen });
  handlers.current = { next, prev, toggleFlip, onExit, dialogOpen };

  useEffect(() => {
    const off = input.on((b) => {
      const h = handlers.current;
      if (b === 'b') {
        input.consume('b');
        sfx.back();
        h.onExit();
      } else if (b === 'a' && !h.dialogOpen) {
        input.consume('a');
        h.next();
      }
    });
    const key = (e: KeyboardEvent) => {
      const h = handlers.current;
      if (h.dialogOpen) return;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') h.next();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') h.prev();
      else if (e.code === 'KeyF' || e.code === 'KeyP') h.toggleFlip();
    };
    window.addEventListener('keydown', key);
    return () => {
      off();
      window.removeEventListener('keydown', key);
    };
  }, []);

  // Keep the current frame centred in the filmstrip.
  useEffect(() => {
    const el = strip.current?.children[incoming ?? index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced.current || flipping ? 'auto' : 'smooth' });
  }, [index, incoming, flipping]);

  if (!assets.length) return null;
  const current = assets[index];
  const shownIndex = incoming ?? index;
  const shown = assets[shownIndex];

  return (
    <div className="scene wall-scene">
      <header className="scene-bar">
        <div>
          <h2 className="scene-title">{script.title}</h2>
          <p className="scene-where">{location.where}</p>
        </div>
        <div className="scene-counter" aria-live="polite">
          <span className="scene-count">
            № {String(shownIndex + 1).padStart(2, '0')}/{assets.length}
          </span>
          <span className="scene-date">{monthYear(shown.date)}</span>
        </div>
      </header>

      <div className="wall-stage">
        <div className="wall-frame" style={{ background: current.color }}>
          <Slide key={current.id} set={location.set} asset={current} alt={script.labels.photo} />
          {incoming !== null && (
            <div
              className="wall-roll"
              style={{ ['--coat' as string]: assets[incoming].color, ['--roll-ms' as string]: `${flipping ? FLIP_MS : ROLL_MS}ms` }}
            >
              <div className="wall-coat">
                <Slide set={location.set} asset={assets[incoming]} alt={script.labels.photo} />
              </div>
              <div className="roller" aria-hidden>
                <span className="roller-head" />
                <span className="roller-handle" />
              </div>
            </div>
          )}
        </div>
        {quip && (
          <div className="quip" role="status">
            <img src={`${import.meta.env.BASE_URL}sprites/mike-portrait.png`} alt="" />
            <p>{quip}</p>
          </div>
        )}
      </div>

      <div className="scene-controls">
        <button onClick={prev} disabled={index === 0 || busy} aria-label="Previous version">◀</button>
        <button className="primary" onClick={next} disabled={busy && !flipping}>
          {index >= assets.length - 1 ? 'THE END' : script.labels.next} <kbd>{buttonLabel('a')}</kbd>
        </button>
        <button onClick={toggleFlip} aria-pressed={flipping}>
          {flipping ? '❚❚ STOP' : '▶▶ FLIP'}
        </button>
        <button onClick={() => { sfx.back(); onExit(); }}>LEAVE <kbd>{buttonLabel('b')}</kbd></button>
      </div>

      <div className="filmstrip" ref={strip} role="listbox" aria-label={script.labels.strip}>
        {assets.map((a, i) => (
          <button
            key={a.id}
            role="option"
            aria-selected={i === shownIndex}
            className={i === shownIndex ? 'on' : i < shownIndex ? 'past' : ''}
            style={{ background: a.color }}
            onClick={() => goTo(i, Math.abs(i - index) === 1)}
            aria-label={`Version ${i + 1}, ${monthYear(a.date)}`}
          >
            <img src={art(location.set, a, true)} alt="" loading="lazy" />
            {a.kind === 'video' && <span className="film-badge">▶</span>}
          </button>
        ))}
      </div>

      {intro && (
        <div className="scene-dialog">
          <div className="stat-chips">
            {script.stats.map((s) => <span key={s}>{s}</span>)}
          </div>
          <DialogBox lines={script.intro} onDone={() => setIntro(false)} />
        </div>
      )}
      {outro && (
        <div className="scene-dialog">
          <DialogBox
            lines={script.outro}
            onDone={() => setOutro(false)}
            choices={[
              { label: 'Start over', onPick: () => { setOutro(false); said.current.clear(); setIndex(0); } },
              { label: 'Back to the streets', onPick: onExit },
            ]}
          />
        </div>
      )}
    </div>
  );
}
