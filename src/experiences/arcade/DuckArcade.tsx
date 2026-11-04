import { Suspense, useEffect, useRef, useState } from 'react';
import { buttonLabel, input, isTouch, TouchPad, withButtons } from '../../city';
import { ARCADE_NAME, ARCADE_WHERE, arcadeAfter, arcadeGames, arcadeIntro, arcadeSoon, type ArcadeGame } from '../../content/duckArcade';
import { DialogBox } from '../../ui/MikeDialog';
import { SceneBoundary } from '../../ui/SceneBoundary';
import { sounds as sfx } from '../../ui/sounds';
import { ArcadeScene } from './ArcadeScene';
import { arcadeComponents } from './games';

const playable = (g: ArcadeGame) => g.ready && !!arcadeComponents[g.id];

/**
 * Inside the Duck Arcade: walk the room in first person, step up to a cabinet and press
 * {A} to play its game; GAMES (or T) lists every cabinet. A game runs full screen over the
 * room and drops you back in front of its cabinet with your score. {B} walks back out.
 */
export default function DuckArcade({ onExit }: { onExit(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ArcadeScene | null>(null);
  const [near, setNear] = useState<number | null>(null);
  const [intro, setIntro] = useState(true);
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState(0);
  const [playing, setPlaying] = useState<ArcadeGame | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const s = new ArcadeScene(host.current!, { onNear: setNear }, arcadeGames);
    scene.current = s;
    let raf = 0;
    const poll = () => {
      const d = input.dir();
      s.setMove(-d.y, d.x, input.running());
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
      s.dispose();
    };
  }, []);

  useEffect(() => {
    if (scene.current) scene.current.paused = intro || menu || playing !== null;
  }, [intro, menu, playing]);

  // in the games list, arrows / WASD move the highlight
  useEffect(() => {
    if (!menu) return;
    const STEP: Record<string, number> = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 };
    const onKey = (e: KeyboardEvent) => {
      const d = STEP[e.code];
      if (!d) return;
      e.preventDefault();
      sfx.pop();
      setSel((i) => (i + d + arcadeGames.length) % arcadeGames.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  // a note fades after a few seconds
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);

  const play = (i: number) => {
    const g = arcadeGames[i];
    if (!g) return;
    setMenu(false);
    if (!playable(g)) {
      sfx.back();
      setNote(arcadeSoon(g));
      return;
    }
    sfx.confirm();
    scene.current?.faceCabinet(i);
    input.clear();
    setNote(null);
    setPlaying(g);
  };

  const state = useRef({ near, intro, menu, sel, playing, onExit, play });
  state.current = { near, intro, menu, sel, playing, onExit, play };
  useEffect(
    () =>
      input.on((b) => {
        const st = state.current;
        if (st.playing) return; // the game has the buttons
        if (st.intro && b !== 'b') return; // the dialog handles its own A; B always leaves
        if (b === 'menu') {
          input.consume('menu');
          sfx.confirm();
          setSel(st.near ?? 0);
          setMenu((m) => !m);
        } else if (b === 'a') {
          input.consume('a');
          if (st.menu) st.play(st.sel);
          else if (st.near !== null) st.play(st.near);
        } else if (b === 'b') {
          input.consume('b');
          sfx.back();
          if (st.menu) setMenu(false);
          else st.onExit();
        }
      }),
    [],
  );

  const nearGame = near !== null ? arcadeGames[near] : null;
  const Game = playing ? arcadeComponents[playing.id] : null;

  // a cabinet's game always starts with its sound on, even if the map is muted
  useEffect(() => {
    sfx.gameSound(!!Game);
    return () => sfx.gameSound(false);
  }, [Game]);

  return (
    <div className="scene park-scene arcade-scene">
      <div ref={host} className="park-stage" aria-label="Inside the Duck Arcade: rows of arcade cabinets around a giant rubber duck." />

      <header className="scene-bar park-bar">
        <div>
          <h2 className="scene-title">{ARCADE_NAME}</h2>
          <p className="scene-where">{ARCADE_WHERE}</p>
        </div>
        <div className="arcade-buttons">
          <button className="park-leave" onClick={() => { sfx.confirm(); setMenu((m) => !m); }} aria-pressed={menu}>
            GAMES {!isTouch() && <kbd>T</kbd>}
          </button>
          <button className="park-leave" onClick={() => { sfx.back(); onExit(); }}>
            LEAVE <kbd>{buttonLabel('b')}</kbd>
          </button>
        </div>
      </header>

      {nearGame && !intro && !menu && !playing && (
        <div className="nearby park-prompt">
          <div className="nearby-name">{nearGame.title}</div>
          <div className="nearby-hint">
            {playable(nearGame) ? <><kbd>{buttonLabel('a')}</kbd> play</> : 'coming soon'}
          </div>
        </div>
      )}

      {note && !playing && <p className="arcade-note" role="status">{note}</p>}

      {!intro && !menu && !playing && !isTouch() && (
        <p className="cup-hint">arrows / WASD walk &amp; turn · drag to look · T games list</p>
      )}

      {menu && (
        <div className="arcade-menu" role="dialog" aria-label="Pick a game">
          <h3>PICK A GAME</h3>
          <ul>
            {arcadeGames.map((g, i) => (
              <li key={g.id}>
                <button
                  className={i === sel ? 'on' : undefined}
                  onClick={() => play(i)}
                  onMouseEnter={() => setSel(i)}
                  style={{ borderColor: g.colors.body }}
                >
                  <span className="arcade-menu-title" style={{ color: g.colors.body }}>{g.title}</span>
                  <span className="arcade-menu-blurb">{g.blurb}</span>
                  <span className="arcade-menu-tag">{playable(g) ? 'PLAY' : 'SOON'}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="arcade-menu-hint">{withButtons('{B} back to the floor')}</p>
        </div>
      )}

      {isTouch() && !intro && !menu && !playing && <TouchPad showB />}

      {intro && (
        <div className="scene-dialog">
          <DialogBox lines={arcadeIntro} onDone={() => setIntro(false)} />
        </div>
      )}

      {Game && playing && (
        <div className="arcade-game">
          <SceneBoundary onError={() => setPlaying(null)}>
            <Suspense fallback={<div className="scene scene-loading">Loading…</div>}>
              <Game
                onExit={(r) => {
                  input.clear();
                  setPlaying(null);
                  setNote(arcadeAfter(playing, r.score, r.best));
                }}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
