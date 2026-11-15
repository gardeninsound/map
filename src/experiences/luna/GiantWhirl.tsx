import { useEffect, useRef, useState } from 'react';
import { buttonLabel, input, isTouch, withButtons } from '../../city';
import { whirlScript } from '../../content/lunaPark';
import { sounds as sfx } from '../../ui/sounds';
import { GiantWhirlScene } from './GiantWhirlScene';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Riding Luna Park's Giant Whirl (idea box #41): a circle swing at dusk, flung out over the
 * boardwalk and the bay as the tower spins up. Drag to look round. With reduced motion you
 * watch from the boardwalk. {A} rides again at the end, {B} goes back to the map.
 */
export default function GiantWhirl({ onExit }: { onExit(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<GiantWhirlScene | null>(null);
  const [done, setDone] = useState(false);
  const watch = useRef(reducedMotion()).current;

  useEffect(() => {
    const s = new GiantWhirlScene(
      host.current!,
      {
        onFinished: () => setDone(true),
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
        aria-label="Riding the Giant Whirl, a circle swing on Luna Park's pier at Duwamish Head, swung out over the boardwalk and Elliott Bay at dusk."
      />
      <header className="scene-bar park-bar">
        <div>
          <h2 className="scene-title">{whirlScript.title}</h2>
          <p className="scene-where">{whirlScript.where}</p>
        </div>
        <button className="park-leave" onClick={leave}>
          LEAVE <kbd>{buttonLabel('b')}</kbd>
        </button>
      </header>
      {!done && !isTouch() && <p className="cup-hint">{watch ? 'watching from the boardwalk' : 'drag to look round'}</p>}
      {done && (
        <div className="nearby park-prompt luna-again" onClick={again}>
          <div className="nearby-name">Back on the boardwalk</div>
          <div className="nearby-hint">{withButtons(whirlScript.again)}</div>
        </div>
      )}
    </div>
  );
}
