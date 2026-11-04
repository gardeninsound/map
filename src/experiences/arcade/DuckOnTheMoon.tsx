import { useEffect, useRef, useState } from 'react';
import { input, isTouch, sfx, withButtons } from '../../city';
import { moonSounds, moonStories, moonText as T, type MoonSound } from '../../content/duckOnTheMoon';
import { DuckMoonScene } from './DuckMoonScene';
import type { ArcadeGameProps } from './games';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const SOUNDS = `${import.meta.env.BASE_URL}duck-on-the-moon/`;

const BEST_KEY = 'bearisland-duck-moon-best';
const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

interface Card {
  speaker: string;
  text: string;
  button: string;
  next(): void;
}

/**
 * Duck on the Moon: orbit a paper-cut moon, click the three glowing sounds; Pip waddles over,
 * the sound plays and Pip says something about it. All three → a little ending. {A} steps the
 * card, or (no card up) walks Pip to the next sound; {B} leaves. Score = sounds heard (0–3).
 */
export default function DuckOnTheMoon({ onExit }: ArcadeGameProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<DuckMoonScene | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const found = useRef(new Set<MoonSound>());
  const round = useRef(0);
  const [count, setCount] = useState(0);
  const [intro, setIntro] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [hover, setHover] = useState(false);
  const exit = useRef(onExit);
  exit.current = onExit;

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
  };

  const leave = () => {
    stop();
    input.clear();
    const score = found.current.size;
    const best = Math.max(score, readBest());
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      /* private mode */
    }
    exit.current({ score, best });
  };

  const arrive = (kind: MoonSound) => {
    const s = moonStories[kind];
    stop();
    if (!sfx.isMuted()) {
      const a = new Audio(SOUNDS + s.file);
      a.volume = 0.65;
      a.play().catch(() => {});
      audio.current = a;
    }
    found.current.add(kind);
    const all = found.current.size === moonSounds.length;
    setCount(found.current.size);
    setCard({
      speaker: s.title,
      text: `“${s.heard}”`,
      button: T.listen,
      next: () =>
        setCard({
          speaker: T.pip,
          text: s.pip,
          button: all ? T.oneMore : T.keepExploring,
          next: () => setCard(all ? { speaker: T.pip, text: T.ending, button: T.stay, next: () => setCard(null) } : null),
        }),
    });
  };

  // the scene calls back into the latest closure
  const onArrive = useRef(arrive);
  onArrive.current = arrive;

  useEffect(() => {
    if (!host.current) return;
    const s = new DuckMoonScene(
      host.current,
      {
        depart: () => {
          stop();
          setCard(null);
        },
        arrive: (k) => onArrive.current(k),
        hover: setHover,
        dir: () => input.dir(),
      },
      reducedMotion(),
    );
    scene.current = s;
    return () => {
      stop();
      s.dispose();
      scene.current = null;
    };
  }, []);

  const begin = () => {
    setIntro(false);
    setCard({ speaker: T.pip, text: T.hello, button: T.explore, next: () => setCard(null) });
  };

  /** keyboard: the next sound not yet heard, else just the next one round */
  const nextSound = () => {
    const unheard = moonSounds.find((k) => !found.current.has(k));
    scene.current?.walkTo(unheard ?? moonSounds[round.current++ % moonSounds.length]);
  };

  const keys = useRef({ intro, card, begin, nextSound });
  keys.current = { intro, card, begin, nextSound };
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') {
          input.consume('a');
          const k = keys.current;
          if (k.intro) k.begin();
          else if (k.card) k.card.next();
          else k.nextSound();
        } else if (b === 'b') {
          input.consume('b');
          leave();
        }
      }),
    [],
  );

  return (
    <div className="scene duck-moon-scene">
      <div ref={host} className="duck-moon-world" />
      <div className="duck-moon-grain" />
      <header className="duck-moon-head">
        <div>
          <div className="duck-moon-eyebrow">{T.eyebrow}</div>
          <h1>{T.title}</h1>
          <div className="duck-moon-tag">{T.tag}</div>
        </div>
        <div className="duck-moon-counter" aria-live="polite">
          ✦ {count} / {moonSounds.length} sounds
        </div>
      </header>
      <div className={`duck-moon-hint${hover ? ' show' : ''}`}>
        ✦<br />
        {T.hint}
      </div>
      <p className="duck-moon-note">{isTouch() ? T.howTouch : `${T.howMouse} · ${withButtons(T.howKeys)}`}</p>
      {card && (
        <div className="duck-moon-card" role="dialog" aria-live="polite">
          <div className="duck-moon-speaker">{card.speaker}</div>
          <p>{card.text}</p>
          <button type="button" onClick={card.next}>
            {card.button}
          </button>
        </div>
      )}
      {intro && (
        <div className="duck-moon-intro">
          <div className="duck-moon-paper">
            <div className="duck-moon-eyebrow">{T.introEyebrow}</div>
            <h2>
              Duck on
              <br />
              <i>the Moon</i>
            </h2>
            {T.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <button type="button" onClick={begin} autoFocus>
              {T.begin}
            </button>
          </div>
        </div>
      )}
      <button className="minigame-back duck-moon-back" onClick={leave}>
        {isTouch() ? '◀ BACK' : withButtons('{B} BACK')}
      </button>
    </div>
  );
}
