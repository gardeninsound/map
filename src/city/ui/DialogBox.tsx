import { useEffect, useRef, useState } from 'react';
import { input, withButtons } from '../engine/input';
import { sfx } from './sfx';

const CPS = 45; // characters per second

interface Props {
  lines: string[];
  speaker?: string;
  /** portrait image URL (shown pixelated); none if omitted */
  portrait?: string;
  /** called after the last line is dismissed */
  onDone(): void;
  /** optional choice buttons shown on the last line */
  choices?: { label: string; onPick(): void }[];
}

/** keys that move the highlighted choice: back (-1) or forward (+1) */
const CHOICE_KEYS: Record<string, number> = {
  ArrowLeft: -1, ArrowUp: -1, KeyA: -1, KeyW: -1,
  ArrowRight: 1, ArrowDown: 1, KeyD: 1, KeyS: 1,
};

/**
 * SNES-style text box with an optional portrait. A / Space / Enter / tap: finish the
 * line, then advance. Lines type out unless the viewer prefers reduced motion. On the last
 * line, choices: ← / → (or ↑ / ↓, WASD) move the highlight, A picks it; or click / tap one.
 */
export function DialogBox({ lines, speaker = '', portrait, onDone, choices }: Props) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const line = withButtons(lines[index] ?? '');
  const complete = shown >= line.length;
  const last = index === lines.length - 1;
  const showChoices = complete && last && !!choices?.length;
  const reduced = useRef(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  // a fresh set of choices starts on the first one (compared by label: callers often rebuild
  // the same choices array on every render)
  const choiceKey = choices?.map((c) => c.label).join('\n') ?? '';
  useEffect(() => setSelected(0), [choiceKey]);
  // keep the browser's focus on the highlighted choice, so Space / Enter press that one
  useEffect(() => {
    if (showChoices) buttons.current[selected]?.focus();
  }, [showChoices, selected]);
  // arrows move the highlight (the game's controller keeps them for walking otherwise)
  const count = choices?.length ?? 0;
  useEffect(() => {
    if (!showChoices) return;
    const n = count;
    const onKey = (e: KeyboardEvent) => {
      const step = CHOICE_KEYS[e.code];
      if (!step || e.repeat) return;
      e.preventDefault();
      setSelected((i) => (i + step + n) % n);
      sfx.text();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showChoices, count]);

  const pick = (i: number) => {
    sfx.confirm();
    choices![i].onPick();
  };

  useEffect(() => {
    setShown(reduced.current ? line.length : 0);
  }, [line]);

  useEffect(() => {
    if (complete) return;
    const id = setInterval(() => {
      setShown((s) => {
        if (s % 3 === 0) sfx.text();
        return Math.min(line.length, s + 1);
      });
    }, 1000 / CPS);
    return () => clearInterval(id);
  }, [complete, line]);

  const advance = () => {
    if (!complete) return setShown(line.length);
    // with choices up, A (Z / E, or Space when focus wandered off) picks the highlighted one
    if (last && choices?.length) return pick(selected);
    sfx.confirm();
    if (last) onDone();
    else setIndex((i) => i + 1);
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') {
          input.consume('a');
          advanceRef.current();
        }
      }),
    [],
  );

  return (
    <div className="dialog" role="dialog" aria-live="polite" aria-label={`${speaker} says`} onClick={advance}>
      {portrait && <img className="dialog-portrait" src={portrait} alt="" />}
      <div className="dialog-body">
        <div className="dialog-name">{speaker}</div>
        <p className="dialog-text">
          {line.slice(0, shown)}
          <span className="dialog-ghost" aria-hidden>{line.slice(shown)}</span>
        </p>
        {showChoices ? (
          <div className="dialog-choices" role="group" aria-label="Choose one">
            {choices!.map((c, i) => (
              <button
                key={c.label}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                className={i === selected ? 'is-selected' : undefined}
                aria-pressed={i === selected}
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(i);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          complete && <span className="dialog-next" aria-hidden>▼</span>
        )}
      </div>
    </div>
  );
}
