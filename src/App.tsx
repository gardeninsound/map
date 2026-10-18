import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { START, locations, welcome } from './content/locations';
import { experiences } from './experiences/registry';
import { Game, type PlacedLocation, type Target } from './game/Game';
import { bindKeyboard, input, isTouch } from './game/input';
import { DialogBox } from './ui/DialogBox';
import { Compass } from './ui/Compass';
import { Minimap, NearbyCard, StreetSign } from './ui/Hud';
import { SceneBoundary } from './ui/SceneBoundary';
import { SpotsMenu } from './ui/SpotsMenu';
import { TitleScreen } from './ui/TitleScreen';
import { TouchPad } from './ui/TouchPad';
import { sfx } from './ui/sfx';
import { createWorld } from './world/world';

type Overlay =
  | { kind: 'none' }
  | { kind: 'talk'; lines: string[]; loc?: PlacedLocation; speaker?: string; portrait?: string; firstVisit?: boolean }
  | { kind: 'scene'; loc: PlacedLocation }
  | { kind: 'spots' };

/** Remember (per browser) that the first-visit direction arrow has been shown. */
const HINT_KEY = 'bearisland-direction-hint';
const hintSeen = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};
const markHintSeen = () => {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* private mode: they'll just see it again next time */
  }
};

export default function App() {
  const world = useMemo(() => createWorld(), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [street, setStreet] = useState<string | null>(null);
  const [storefront, setStorefront] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Target | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const overlayKind = useRef<Overlay['kind']>('none');
  overlayKind.current = overlay.kind;
  const [mapOpen, setMapOpen] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());
  const touch = isTouch();

  useEffect(() => bindKeyboard(), []);

  useEffect(() => {
    const c = canvas.current!;
    const g = new Game(c, world, locations, world.project(START.lat, START.lon), {
      onStreet: setStreet,
      onStorefront: setStorefront,
      onNearby: setNearby,
      onInteract: (t) => {
        sfx.confirm();
        if (t.kind === 'place') setOverlay({ kind: 'talk', lines: t.loc.greeting, loc: t.loc });
        else setOverlay({ kind: 'talk', lines: t.npc.voice.lines, speaker: t.npc.voice.name, portrait: g.portraitOf(t.npc) });
      },
    });
    g.paused = true;
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = g; // test hook
    // Dev review hook: ?at=lat,lon skips the title and drops you there (see scripts/review-map.mjs).
    const at = import.meta.env.DEV && new URLSearchParams(location.search).get('at');
    if (at) {
      const [lat, lon] = at.split(',').map(Number);
      g.teleport(world.project(lat, lon));
      setStarted(true);
    }
    const onResize = () => g.resize();
    window.addEventListener('resize', onResize);
    // Canvas text needs the pixel font before the first frame that draws labels.
    document.fonts.load('8px "Press Start 2P"').finally(() => g.start());
    setGame(g);
    return () => {
      g.stop();
      window.removeEventListener('resize', onResize);
    };
  }, [world]);

  // The world only moves when nothing is on top of it.
  useEffect(() => {
    if (game) {
      game.paused = !started || overlay.kind !== 'none';
      // street sounds stay on while you chat on the street, hush inside an art scene
      game.quiet = !started || overlay.kind === 'scene';
    }
  }, [game, started, overlay]);

  useEffect(
    () =>
      input.on((b) => {
        if (b === 'map') {
          input.consume('map');
          setMapOpen((o) => !o);
        } else if (b === 'spots' && overlayKind.current === 'none') {
          // Only from the open map; the menu closes itself on a second T.
          input.consume('spots');
          sfx.confirm();
          setOverlay({ kind: 'spots' });
        }
      }),
    [],
  );

  const start = useCallback(() => {
    setStarted(true);
    setOverlay({ kind: 'talk', lines: welcome, firstVisit: true });
  }, []);

  const closeOverlay = useCallback(() => {
    input.clear();
    game?.endTalk();
    setOverlay({ kind: 'none' });
  }, [game]);

  /** Shortcut travel: land beside the easel, optionally straight into its scene. */
  const travel = useCallback(
    (loc: PlacedLocation, open: boolean) => {
      if (!game) return;
      game.teleport(loc);
      game.visited.add(loc.id);
      input.clear();
      setMapOpen(false);
      setOverlay(open && loc.experience ? { kind: 'scene', loc } : { kind: 'none' });
    },
    [game],
  );
  const openSpots = game?.places.filter((p) => p.experience) ?? [];

  const Scene = overlay.kind === 'scene' && overlay.loc.experience ? experiences[overlay.loc.experience] : null;
  const talkLoc = overlay.kind === 'talk' ? overlay.loc : undefined;

  return (
    <main className="app">
      <canvas ref={canvas} className="world" aria-label="A pixel map of West Seattle. Walk with the arrow keys." />

      {started && overlay.kind !== 'scene' && (
        <>
          <StreetSign name={street} storefront={storefront} />
          {overlay.kind === 'none' && <NearbyCard target={nearby} />}
          <div className="hud-right">
          <div className="hud-buttons">
            <button
              className="hud-spots"
              onClick={() => { sfx.confirm(); setOverlay({ kind: 'spots' }); }}
              aria-pressed={overlay.kind === 'spots'}
            >
              ★ SPOTS {!touch && <kbd>T</kbd>}
            </button>
            <button onClick={() => setMapOpen((o) => !o)} aria-pressed={mapOpen}>
              MAP {!touch && <kbd>M</kbd>}
            </button>
            <button
              onClick={() => {
                sfx.setMuted(!muted);
                setMuted(!muted);
              }}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            >
              {muted ? '♪ OFF' : '♪ ON'}
            </button>
          </div>
          {game && overlay.kind === 'none' && (
            <Compass game={game} onClick={() => { sfx.confirm(); setOverlay({ kind: 'spots' }); }} />
          )}
          {game && <Minimap game={game} open={mapOpen} />}
          </div>
          <p className="attribution">{world.attribution}</p>
        </>
      )}

      {started && touch && overlay.kind !== 'scene' && <TouchPad />}

      {overlay.kind === 'talk' && (
        <div className="talk-layer">
          <DialogBox
            key={overlay.lines[0]}
            lines={overlay.lines}
            speaker={overlay.speaker}
            portrait={overlay.portrait}
            onDone={() => {
              if (overlay.firstVisit && game && !hintSeen()) {
                markHintSeen();
                game.showDirectionHint();
              }
              closeOverlay();
            }}
            choices={
              talkLoc?.experience
                ? [
                    { label: "Let's see it", onPick: () => setOverlay({ kind: 'scene', loc: talkLoc }) },
                    { label: 'Maybe later', onPick: closeOverlay },
                  ]
                : undefined
            }
          />
        </div>
      )}

      {overlay.kind === 'spots' && game && (
        <SpotsMenu
          spots={openSpots}
          visited={game.visited}
          onOpen={(loc) => travel(loc, true)}
          onGo={(loc) => travel(loc, false)}
          onClose={closeOverlay}
        />
      )}

      {Scene && overlay.kind === 'scene' && (
        <SceneBoundary onError={closeOverlay}>
          <Suspense fallback={<div className="scene scene-loading">Loading…</div>}>
            <Scene location={overlay.loc} onExit={closeOverlay} />
          </Suspense>
        </SceneBoundary>
      )}

      {!started && <TitleScreen onStart={start} />}
    </main>
  );
}
