import { useEffect, useRef, useState } from 'react';
import { buttonLabel, input, isTouch, tone, withButtons } from '../../city';
import { figureEightScript } from '../../content/lunaPark';
import { sounds as sfx } from '../../ui/sounds';
import { FigureEightScene } from './FigureEightScene';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Riding Luna Park's Great Figure Eight (1907): up the chain lift, 150 feet over Elliott Bay
 * at dusk, and round both loops. Drag to look round. With reduced motion you watch the train
 * go round from the boardwalk instead. {A} rides again at the end, {B} goes back to the map.
 */
export default function FigureEight({ onExit }: { onExit(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FigureEightScene | null>(null);
  const [done, setDone] = useState(false);
  const watch = useRef(reducedMotion()).current;

  useEffect(() => {
    const s = new FigureEightScene(
      host.current!,
      {
        onFinished: () => setDone(true),
        onClack: () => tone(180, 0.03, 'square', 0.02),
      },
      watch,
    );
    scene.current = s;
    return () => s.dispose();
  }, [watch]);

  const again = () => {
    sfx.confirm();
    scene.current?.restart();
    setDone(false);
  };
  const leave = () => {
    sfx.back();
    input.clear();
    onExit();
  };

  const state = useRef({ done, again, leave });
  state.current = { done, again, leave };
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a') {
          input.consume('a');
          if (state.current.done) state.current.again();
        } else if (b === 'b') {
          input.consume('b');
          state.current.leave();
        }
      }),
    [],
  );

  return (
    <div className="scene park-scene luna-ride">
      <div
        ref={host}
        className="park-stage"
        aria-label="Riding the Great Figure Eight, a wooden roller coaster on Luna Park's pier at Duwamish Head, over Elliott Bay at dusk."
      />
      <header className="scene-bar park-bar">
        <div>
          <h2 className="scene-title">{figureEightScript.title}</h2>
          <p className="scene-where">{figureEightScript.where}</p>
        </div>
        <button className="park-leave" onClick={leave}>
          LEAVE <kbd>{buttonLabel('b')}</kbd>
        </button>
      </header>
      {!done && !isTouch() && <p className="cup-hint">{watch ? 'watching from the boardwalk' : 'drag to look round'}</p>}
      {done && (
        <div className="nearby park-prompt luna-again" onClick={again}>
          <div className="nearby-name">Back in the station</div>
          <div className="nearby-hint">{withButtons(figureEightScript.again)}</div>
        </div>
      )}
    </div>
  );
}
