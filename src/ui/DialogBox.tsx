import { useEffect, useRef, useState } from 'react';
import { input, withButtons } from '../game/input';
import { sfx } from './sfx';

const CPS = 45; // characters per second

interface Props {
  lines: string[];
  speaker?: string;
  /** portrait image URL; defaults to Mike */
  portrait?: string;
  /** called after the last line is dismissed */
  onDone(): void;
  /** optional choice buttons shown on the last line */
  choices?: { label: string; onPick(): void }[];
}

/**
 * SNES-style text box with Mike's portrait. A / Space / Enter / tap: finish the
 * line, then advance. Lines type out unless the viewer prefers reduced motion.
 */
export function DialogBox({ lines, speaker = 'Mike', portrait, onDone, choices }: Props) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line = withButtons(lines[index] ?? '');
  const complete = shown >= line.length;
  const last = index === lines.length - 1;
  const reduced = useRef(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

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
    if (last && choices) return;
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
      <img
        className="dialog-portrait"
        src={portrait ?? `${import.meta.env.BASE_URL}sprites/mike-portrait.png`}
        alt={portrait ? '' : 'Mike, pixelated'}
      />
      <div className="dialog-body">
        <div className="dialog-name">{speaker}</div>
        <p className="dialog-text">
          {line.slice(0, shown)}
          <span className="dialog-ghost" aria-hidden>{line.slice(shown)}</span>
        </p>
        {complete && last && choices ? (
          <div className="dialog-choices">
            {choices.map((c, i) => (
              <button
                key={c.label}
                autoFocus={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  sfx.confirm();
                  c.onPick();
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
