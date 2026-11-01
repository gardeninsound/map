import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bindKeyboard,
  CityGame,
  Compass,
  createWorld,
  input,
  isTouch,
  Minimap,
  NearbyCard,
  nearestSpot,
  StreetSign,
  TouchPad,
  type Target,
} from './city';
import { START, locations, welcome } from './content/locations';
import { CROW_NAME, crowChoices, crowGreeting, crowReply } from './content/crow';
import { CHICKEN_NAME, chickenAfter, chickenInvite, chickenQuestions } from './content/chicken';
import { neighborVoices } from './content/neighbors';
import { experiences } from './experiences/registry';
import { ArtSpots, type PlacedLocation } from './game/plugins/artSpots';
import { Busker } from './game/plugins/busker';
import { Crow } from './game/plugins/crow';
import { Chicken } from './game/plugins/chicken';
import { Visitors } from './game/plugins/visitors';
import type { MiniGameResult } from './experiences/minigames/ConeCatch';
import { DialogBox } from './ui/MikeDialog';
import { SceneBoundary } from './ui/SceneBoundary';
import { SpotsMenu } from './ui/SpotsMenu';
import { TitleScreen } from './ui/TitleScreen';
import { sounds } from './ui/sounds';

type Overlay =
  | { kind: 'none' }
  | {
      kind: 'talk';
      lines: string[];
      loc?: PlacedLocation;
      speaker?: string;
      portrait?: string;
      firstVisit?: boolean;
      choices?: { label: string; onPick(): void }[];
      /** runs when the last line is dismissed */
      then?: () => void;
    }
  | { kind: 'scene'; loc: PlacedLocation }
  /** a character's mini game; `then` gets the result when you come back to the map */
  | { kind: 'minigame'; then(result: MiniGameResult): void }
  | { kind: 'spots' };

const ConeCatch = lazy(() => import('./experiences/minigames/ConeCatch'));

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
  const [game, setGame] = useState<CityGame | null>(null);
  const [spots, setSpots] = useState<ArtSpots | null>(null);
  const [visitors, setVisitors] = useState<Visitors | null>(null);
  const [others, setOthers] = useState(0);
  const [started, setStarted] = useState(false);
  const [street, setStreet] = useState<string | null>(null);
  const [storefront, setStorefront] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Target | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const overlayKind = useRef<Overlay['kind']>('none');
  overlayKind.current = overlay.kind;
  const [mapOpen, setMapOpen] = useState(false);
  const [muted, setMuted] = useState(sounds.isMuted());
  const touch = isTouch();

  useEffect(() => bindKeyboard(), []);

  useEffect(() => {
    const art = new ArtSpots(locations);
    const busker = new Busker();
    const crow = new Crow();
    const chicken = new Chicken();
    // Everyone else on the island, live. `?solo` walks alone; `?relay=` points at another
    // relay; in dev, `?island=<name>` uses a private room so tests don't walk onto the real one.
    const params = new URLSearchParams(location.search);
    const island = (import.meta.env.DEV && params.get('island')) || undefined;
    const live = params.has('solo') ? null : new Visitors(params.get('relay') ?? undefined, island);
    if (live) live.onCount = setOthers;
    const g = new CityGame(canvas.current!, world, {
      start: world.project(START.lat, START.lon),
      voices: neighborVoices,
      plugins: [art, busker, crow, chicken, ...(live ? [live] : [])],
      events: {
        onStreet: setStreet,
        onStorefront: setStorefront,
        onNearby: setNearby,
        onInteract: (t) => {
          sounds.confirm();
          if (t.kind === 'place') {
            const loc = t.data as PlacedLocation;
            art.visited.add(loc.id);
            setOverlay({ kind: 'talk', lines: loc.greeting, loc });
          } else if (t.npc === crow.npc) {
            // Snacks? Either way it says its piece, then flies off to the next perch.
            const { stop, lap, snacks } = crow.state;
            const talk = { kind: 'talk', speaker: CROW_NAME, portrait: g.portraitOf(crow.npc) } as const;
            setOverlay({
              ...talk,
              lines: crowGreeting(stop, lap, snacks),
              choices: crowChoices.map((c) => ({
                label: c.label,
                onPick: () => setOverlay({ ...talk, lines: crowReply(stop, c.snack), then: () => crow.flyAway(c.snack) }),
              })),
            });
          } else if (t.npc === chicken.npc) {
            // Two questions (two answers each, with her reply), then the mini-game invitation.
            sounds.cluck();
            const talk = { kind: 'talk', speaker: CHICKEN_NAME, portrait: g.portraitOf(chicken.npc) } as const;
            const ask = (i: number) => {
              const q = chickenQuestions[i];
              if (!q) return invite();
              setOverlay({
                ...talk,
                lines: q.lines,
                choices: q.answers.map((a) => ({ label: a.label, onPick: () => setOverlay({ ...talk, lines: a.reply, then: () => ask(i + 1) }) })),
              });
            };
            const invite = () =>
              setOverlay({
                ...talk,
                lines: chickenInvite.lines,
                choices: [
                  { label: chickenInvite.yes, onPick: () => setOverlay({ kind: 'minigame', then: (r) => setOverlay({ ...talk, lines: chickenAfter(r.score, r.best) }) }) },
                  { label: chickenInvite.no, onPick: () => setOverlay({ ...talk, lines: chickenInvite.bye }) },
                ],
              });
            ask(0);
          } else if (t.npc) {
            setOverlay({ kind: 'talk', lines: t.npc.voice.lines, speaker: t.npc.voice.name, portrait: g.portraitOf(t.npc) });
          }
        },
      },
    });
    g.paused = true;
    if (import.meta.env.DEV) Object.assign(window, { __game: g, __busker: busker, __crow: crow, __chicken: chicken, __art: art, __visitors: live }); // test hooks
    // Dev review hooks: ?at=lat,lon (or ?atTile=x,y) skips the title and drops you there;
    // ?audit scans the whole map for road-drawing glitches (scripts/city/road-audit.mjs).
    const q = new URLSearchParams(location.search);
    const at = import.meta.env.DEV && q.get('at');
    const atTile = import.meta.env.DEV && q.get('atTile');
    if (at || atTile) {
      const [a, b] = (at || atTile || '').split(',').map(Number);
      g.teleport(at ? world.project(a, b) : { x: a, y: b });
      setStarted(true);
    }
    if (import.meta.env.DEV && q.has('audit')) {
      void import('./city/render/audit').then(({ auditRoads }) => {
        (window as unknown as { __audit: unknown }).__audit = auditRoads(world);
      });
    }
    const onResize = () => g.resize();
    window.addEventListener('resize', onResize);
    // Canvas text needs the pixel font before the first frame that draws labels.
    document.fonts.load('8px "Press Start 2P"').finally(() => g.start());
    setGame(g);
    setSpots(art);
    setVisitors(live);
    return () => {
      g.stop();
      window.removeEventListener('resize', onResize);
    };
  }, [world]);

  // Show up on everyone else's map once past the title screen.
  useEffect(() => {
    if (started) visitors?.join();
  }, [started, visitors]);

  // The world only moves when nothing is on top of it.
  useEffect(() => {
    if (game) {
      game.paused = !started || overlay.kind !== 'none';
      // street sounds stay on while you chat on the street, hush inside an art scene
      game.quiet = !started || overlay.kind === 'scene' || overlay.kind === 'minigame';
    }
  }, [game, started, overlay]);

  useEffect(
    () =>
      input.on((b) => {
        if (b === 'map') {
          input.consume('map');
          setMapOpen((o) => !o);
        } else if (b === 'menu' && overlayKind.current === 'none') {
          // Only from the open map; the menu closes itself on a second T.
          input.consume('menu');
          sounds.confirm();
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

  /** Shortcut travel: land beside the lemon, optionally straight into its scene. */
  const travel = useCallback(
    (loc: PlacedLocation, open: boolean) => {
      if (!game || !spots) return;
      game.teleport(loc);
      spots.visited.add(loc.id);
      input.clear();
      setMapOpen(false);
      setOverlay(open && loc.experience ? { kind: 'scene', loc } : { kind: 'none' });
    },
    [game, spots],
  );
  const openSpots = spots?.open ?? [];

  const Scene = overlay.kind === 'scene' && overlay.loc.experience ? experiences[overlay.loc.experience] : null;
  const talkLoc = overlay.kind === 'talk' ? overlay.loc : undefined;

  return (
    <main className="app">
      <canvas ref={canvas} className="world" aria-label="A pixel map of West Seattle. Walk with the arrow keys." />

      {started && overlay.kind !== 'scene' && overlay.kind !== 'minigame' && (
        <>
          <StreetSign name={street} storefront={storefront} />
          {overlay.kind === 'none' && <NearbyCard target={nearby} />}
          <div className="hud-right">
            <div className="hud-buttons">
              <button
                className="hud-spots"
                onClick={() => { sounds.confirm(); setOverlay({ kind: 'spots' }); }}
                aria-pressed={overlay.kind === 'spots'}
              >
                ★ SPOTS {!touch && <kbd>T</kbd>}
              </button>
              <button onClick={() => setMapOpen((o) => !o)} aria-pressed={mapOpen}>
                MAP {!touch && <kbd>M</kbd>}
              </button>
              <button
                onClick={() => {
                  sounds.setMuted(!muted);
                  setMuted(!muted);
                }}
                aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              >
                {muted ? '♪ OFF' : '♪ ON'}
              </button>
            </div>
            {others > 0 && (
              <p className="hud-visitors" aria-live="polite">
                {others === 1 ? '1 OTHER RABBIT HERE' : `${others} OTHER RABBITS HERE`}
              </p>
            )}
            {game && spots && overlay.kind === 'none' && (
              <Compass game={game} spots={() => spots.open} onClick={() => { sounds.confirm(); setOverlay({ kind: 'spots' }); }} />
            )}
            {game && spots && (
              <Minimap
                game={game}
                open={mapOpen}
                markers={() => [
                  ...spots.places.map((loc) => ({
                    x: loc.x,
                    y: loc.y,
                    color: spots.visited.has(loc.id) ? '#ffffff' : loc.experience ? '#ffe066' : '#ff7eb6',
                  })),
                  ...(visitors?.markers() ?? []),
                ]}
                legend={[
                  { color: '#ffe066', label: 'open' },
                  { color: '#ff7eb6', label: 'soon' },
                ]}
              />
            )}
          </div>
          <p className="attribution">{world.attribution}</p>
        </>
      )}

      {started && touch && overlay.kind !== 'scene' && overlay.kind !== 'minigame' && <TouchPad />}

      {overlay.kind === 'talk' && (
        <div className="talk-layer">
          <DialogBox
            key={overlay.lines[0]}
            lines={overlay.lines}
            speaker={overlay.speaker}
            portrait={overlay.portrait}
            onDone={() => {
              if (overlay.firstVisit && game && spots && !hintSeen()) {
                markHintSeen();
                const near = nearestSpot(spots.open, game.player.pos.x, game.player.pos.y);
                if (near) game.showDirectionHint(near.loc);
              }
              closeOverlay();
              overlay.then?.();
            }}
            choices={
              overlay.choices ??
              (talkLoc?.experience
                ? [
                    { label: "Let's see it", onPick: () => setOverlay({ kind: 'scene', loc: talkLoc }) },
                    { label: 'Maybe later', onPick: closeOverlay },
                  ]
                : undefined)
            }
          />
        </div>
      )}

      {overlay.kind === 'spots' && spots && (
        <SpotsMenu
          spots={openSpots}
          visited={spots.visited}
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

      {overlay.kind === 'minigame' && (
        <SceneBoundary onError={closeOverlay}>
          <Suspense fallback={<div className="scene scene-loading">Loading…</div>}>
            <ConeCatch
              onExit={(result) => {
                closeOverlay();
                overlay.then(result);
              }}
            />
          </Suspense>
        </SceneBoundary>
      )}

      {!started && <TitleScreen onStart={start} />}
    </main>
  );
}
