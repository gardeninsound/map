import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bindKeyboard,
  buildBikeRabbit,
  buildRabbit,
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
  type MapPlace,
  type PlacedLandmark,
  type Target,
} from './city';
import { START, welcome } from './content/locations';
import { neighborVoices } from './content/neighbors';
import { experiences } from './experiences/registry';
import type { ArtSpots, PlacedLocation } from './game/plugins/artSpots';
import { raceResult } from './content/bikeRace';
import { LookPicker } from './ui/LookPicker';
import { dress, loadLook, lookCode, LOOK_SCARVES, saveLook } from './game/look';
import { EMOTES } from './content/emotes';
import type { MiniGameResult } from './experiences/minigames/ConeCatch';
import { DialogBox } from './ui/MikeDialog';
import { SceneBoundary } from './ui/SceneBoundary';
import { SpotsMenu } from './ui/SpotsMenu';
import { IdeaBox } from './ui/IdeaBox';
import { Pelican } from './ui/Pelican';
import { PELICAN_AFTER } from './game/pelican';
import { TitleScreen } from './ui/TitleScreen';
import { sounds } from './ui/sounds';
import { findTarget, openFromSearch } from './ui/openLink';
import { isActor, talk, type Action } from './game/actions';
import { createIsland, devHooks, pluginById, pluginList, targetsOf, type Island } from './game/plugins';
import type { Visitors } from './game/plugins/visitors';
import { store, storedFlag } from './city/stored';

type Overlay =
  | { kind: 'none' }
  | {
      kind: 'talk';
      lines: string[];
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
  /** inside the Duck Arcade (`game`: straight into that cabinet, from ?open=arcade:<id>) */
  | { kind: 'arcade'; game?: string }
  /** riding Luna Park's Great Figure Eight */
  | { kind: 'ride'; ride?: 'whirl' }
  | { kind: 'spots' }
  /** the idea box: "What would you love to add?" → a GitHub issue */
  | { kind: 'idea' };

const ConeCatch = lazy(() => import('./experiences/minigames/ConeCatch'));
const DuckArcade = lazy(() => import('./experiences/arcade/DuckArcade'));
const FigureEight = lazy(() => import('./experiences/luna/FigureEight'));
const GiantWhirl = lazy(() => import('./experiences/luna/GiantWhirl'));

/** Overlays that take the whole screen: the map's HUD and touch pad hide under them. */
const FULL_SCREEN: Overlay['kind'][] = ['scene', 'minigame', 'arcade', 'ride'];


const LANDMARK_COLOR = '#5fa8a0';

/**
 * The landmarks, as named places for the map: the Junction's four block faces become one
 * "The Junction shops", other names lose their parenthetical. Most-visited first, so those
 * keep their name tags when the map gets crowded. A landmark with no name is a secret: drawn,
 * never listed.
 */
function mapLandmarks(landmarks: PlacedLandmark[]): MapPlace[] {
  const centre = (l: PlacedLandmark) => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });
  const shops = landmarks.filter((l) => l.sprite === 'storefronts');
  const out: MapPlace[] = [];
  if (shops.length) {
    const cs = shops.map(centre);
    out.push({ name: 'The Junction shops', x: cs.reduce((a, c) => a + c.x, 0) / cs.length, y: cs.reduce((a, c) => a + c.y, 0) / cs.length, color: LANDMARK_COLOR });
  }
  for (const l of landmarks) {
    if (l.sprite === 'storefronts' || !l.name) continue; // a nameless landmark is a hidden one
    out.push({ name: l.name.replace(/\s*\(.*\)\s*$/, ''), ...centre(l), color: LANDMARK_COLOR });
  }
  return out;
}

/** Remember (per browser) that the first-visit direction arrow has been shown. */
const HINT_KEY = 'bearisland-direction-hint';
const hintSeen = () => storedFlag(HINT_KEY);
const markHintSeen = () => store(HINT_KEY, true); // private mode: they'll just see it again next time

export default function App() {
  const world = useMemo(() => createWorld(), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<CityGame | null>(null);
  const [spots, setSpots] = useState<ArtSpots | null>(null);
  const [visitors, setVisitors] = useState<Visitors | null>(null);
  /** bumped whenever other rabbits come, go, or are hidden: re-reads `visitors` */
  const [, setRabbitTick] = useState(0);
  const [rabbitsOpen, setRabbitsOpen] = useState(false);
  const [sayOpen, setSayOpen] = useState(false);
  // your rabbit's fur, scarf and hat (idea box #38, #34), remembered here and sent to everyone
  const [look, setLook] = useState(loadLook);
  const [lookOpen, setLookOpen] = useState(false);
  const [started, setStarted] = useState(false);
  /** the pelican's visit, once a session, PELICAN_AFTER s after you join (ui/Pelican.tsx) */
  const [pelican, setPelican] = useState(false);
  const [pelicanDue, setPelicanDue] = useState(false);
  const pelicanCame = useRef(false);
  const [street, setStreet] = useState<string | null>(null);
  const [storefront, setStorefront] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Target | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const overlayKind = useRef<Overlay['kind']>('none');
  overlayKind.current = overlay.kind;
  const [mapOpen, setMapOpen] = useState(false);
  const [muted, setMuted] = useState(sounds.isMuted());
  const touch = isTouch();
  const [island, setIsland] = useState<Island | null>(null);

  useEffect(() => bindKeyboard(), []);

  useEffect(() => {
    // Everyone else on the island, live. `?solo` walks alone; `?relay=` points at another
    // relay; in dev, `?island=<name>` uses a private room so tests don't walk onto the real one.
    const params = new URLSearchParams(location.search);
    const room = (import.meta.env.DEV && params.get('island')) || undefined;
    // dev: `?presence=N` → a hidden tab leaves after N s, idle fades after 2N and leaves after 4N
    const fast = import.meta.env.DEV ? Number(params.get('presence')) : 0;
    const timings = fast > 0 ? { hiddenGone: fast, idleAway: 2 * fast, idleGone: 4 * fast } : undefined;
    // everyone and everything on the island, by id (src/game/plugins/index.ts): App names none of them
    const isle = createIsland({ visitors: params.has('solo') ? null : [params.get('relay') ?? undefined, room, timings] });
    const { art, race, visitors: live } = isle;
    if (live) live.onChange = () => setRabbitTick((n) => n + 1);
    const plugins = pluginList(isle);
    /** plugins that say what {A} does on their targets */
    const actors = plugins.filter(isActor);
    /** an Action (src/game/actions.ts) → the overlay that shows it */
    const runAction = (a: Action): void => {
      if (a.kind === 'talk') {
        setOverlay({
          kind: 'talk',
          lines: a.lines,
          ...(a.speaker ? { speaker: a.speaker } : {}),
          ...(a.portrait ? { portrait: a.portrait } : {}),
          ...(a.choices ? { choices: a.choices.map((c) => ({ label: c.label, onPick: () => runAction(c.next) })) } : {}),
          ...(a.then ? { then: () => runAction(a.then!) } : {}),
        });
      } else if (a.kind === 'ride') setOverlay(a.ride === 'whirl' ? { kind: 'ride', ride: 'whirl' } : { kind: 'ride' });
      else if (a.kind === 'minigame') setOverlay({ kind: 'minigame', then: (r) => (a.then ? runAction(a.then(r)) : setOverlay({ kind: 'none' })) });
      else if (a.kind === 'arcade') setOverlay({ kind: 'arcade' });
      else if (a.kind === 'scene') {
        const loc = art.places.find((l) => l.id === a.spot);
        setOverlay(loc ? { kind: 'scene', loc } : { kind: 'none' });
      } else if (a.kind === 'emotes') setSayOpen((o) => !o);
      else if (a.kind === 'close') setOverlay({ kind: 'none' });
      else {
        a.run();
        if (a.then) runAction(a.then);
      }
    };
    const g = new CityGame(canvas.current!, world, {
      start: world.project(START.lat, START.lon),
      voices: neighborVoices,
      plugins,
      events: {
        onStreet: setStreet,
        onStorefront: setStorefront,
        onNearby: setNearby,
        onInteract: (t) => {
          sounds.confirm();
          // what {A} does is the plugin's own act() (src/game/actions.ts); the city's plain
          // neighbors, which belong to no plugin, just say their lines
          for (const p of actors) {
            const a = p.act(t);
            if (a) return runAction(a);
          }
          if (t.npc) {
            setOverlay({ kind: 'talk', lines: t.npc.voice.lines, speaker: t.npc.voice.name, portrait: g.portraitOf(t.npc) });
          }
        },
      },
    });
    // when you cross the line, the winner says how you did
    race.onFinish = (r) =>
      runAction(talk(r.winnerKind === 'rabbit' ? 'The race marshal' : r.winner, raceResult(r.place, r.total, r.winner, r.seconds), { portrait: race.portraitOf(r.winnerKind) }));
    g.paused = true;
    if (import.meta.env.DEV) Object.assign(window, { __game: g, ...devHooks(isle) }); // test hooks: window.__<plugin id>
    // Review hooks: ?at=lat,lon (or ?atTile=x,y, or ?at=arcade) skips the title and drops you there;
    // ?audit scans the whole map for road-drawing glitches (scripts/city/road-audit.mjs).
    const q = new URLSearchParams(location.search);
    // (These two also work on the live site: a link that starts you somewhere, and how the
    // smoke test walks straight into the Duck Arcade with ?at=arcade.)
    const at = q.get('at');
    const atTile = q.get('atTile');
    if (at === 'arcade') {
      const door = isle.arcadeDoor.door;
      if (door) g.teleport(door);
      setStarted(true);
    } else if (at || atTile) {
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
    setIsland(isle);
    setVisitors(live);
    return () => {
      g.stop();
      window.removeEventListener('resize', onResize);
    };
  }, [world]);

  // Dress your rabbit (walking and on the bike), remember the look, and send it with your rabbit.
  useEffect(() => {
    saveLook(look);
    if (!game) return;
    const scarf = LOOK_SCARVES[look.scarf];
    game.setPlayerSprites(dress(buildRabbit(scarf), look), dress(buildBikeRabbit(scarf), look));
    if (visitors) visitors.look = lookCode(look);
  }, [game, visitors, look]);

  // Show up on everyone else's map once past the title screen.
  useEffect(() => {
    if (started) visitors?.join();
  }, [started, visitors]);

  // The pelican comes PELICAN_AFTER s after you join, as soon as nothing's open (Mike's
  // welcome, a scene…); opening anything while it's here (the idea box it points at) ends its visit.
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setPelicanDue(true), PELICAN_AFTER * 1000);
    return () => clearTimeout(t);
  }, [started]);
  useEffect(() => {
    if (overlay.kind !== 'none') setPelican(false);
    else if (pelicanDue && !pelicanCame.current) {
      pelicanCame.current = true;
      setPelican(true);
    }
  }, [overlay.kind, pelicanDue]);

  // The world only moves when nothing is on top of it.
  useEffect(() => {
    if (game) {
      game.paused = !started || overlay.kind !== 'none';
      // street sounds stay on while you chat on the street, hush inside an art scene
      game.quiet = !started || FULL_SCREEN.includes(overlay.kind);
    }
  }, [game, started, overlay]);

  // mini games (Cone Catch) start with their sound on, even if the map is muted
  useEffect(() => {
    sounds.gameSound(overlay.kind === 'minigame');
    return () => sounds.gameSound(false);
  }, [overlay.kind]);

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
        } else if (b === 'b' && overlayKind.current === 'none') {
          setSayOpen(false); // {B} puts the SAY picker away
        }
      }),
    [],
  );

  // Number keys say the matching emote (only while walking around).
  useEffect(() => {
    if (!visitors) return;
    const onKey = (e: KeyboardEvent) => {
      const n = /^Digit([1-9])$/.exec(e.code);
      if (!n || e.repeat || !started || overlayKind.current !== 'none') return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (visitors.emote(Number(n[1]) - 1)) sounds.pop();
      setSayOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visitors, started]);
  // The rabbit list shows streets, which change as they walk: refresh it while open.
  useEffect(() => {
    if (!rabbitsOpen) return;
    const t = setInterval(() => setRabbitTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rabbitsOpen]);
  const others = visitors?.visitors.size ?? 0;

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
  // ?open= (src/ui/openLink.ts): opens something through the same paths a visitor's {A} takes,
  // for review links and the story log's camera. A moment after the map starts, once everyone's placed.
  useEffect(() => {
    if (!game || !spots) return;
    const link = openFromSearch(location.search);
    if (!link) return;
    setStarted(true);
    const t = setTimeout(() => {
      input.clear();
      if (link.kind === 'target') {
        // a plugin's id first (?open=crow: the crow's own target), else any target by kind, key or name
        const owner = island && pluginById(island, link.name);
        const target = (owner && targetsOf(owner, game)[0]) || findTarget(game.allTargets(), link.name);
        if (target) game.interactWith(target);
        else console.warn(`?open=${link.name}: nothing by that name on the map`);
      } else if (link.kind === 'scene') {
        const loc = spots.places.find((l) => l.id === link.id);
        if (loc) travel(loc, true);
        else console.warn(`?open=scene:${link.id}: no such spot`);
      } else if (link.kind === 'arcade') {
        const door = island?.arcadeDoor.door;
        if (door) game.teleport(door);
        setOverlay(link.game ? { kind: 'arcade', game: link.game } : { kind: 'arcade' });
      } else if (link.kind === 'ride') {
        setOverlay(link.ride === 'whirl' ? { kind: 'ride', ride: 'whirl' } : { kind: 'ride' });
      } else if (link.kind === 'minigame') {
        setOverlay({ kind: 'minigame', then: () => setOverlay({ kind: 'none' }) });
      } else {
        setOverlay({ kind: link.panel });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [game, spots, island, travel]);

  const openSpots = spots?.open ?? [];
  const landmarkPlaces = useMemo(() => (game ? mapLandmarks(game.world.landmarks) : []), [game]);

  const Scene = overlay.kind === 'scene' && overlay.loc.experience ? experiences[overlay.loc.experience] : null;

  return (
    <main className="app">
      <canvas ref={canvas} className="world" aria-label="A pixel map of West Seattle. Walk with the arrow keys." />

      {started && !FULL_SCREEN.includes(overlay.kind) && (
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
              {visitors && (
                <button onClick={() => setSayOpen((o) => !o)} aria-pressed={sayOpen} aria-label="Say something to other rabbits">
                  {touch ? '♥' : '♥ SAY'}
                </button>
              )}
              <button onClick={() => setLookOpen((o) => !o)} aria-pressed={lookOpen} aria-label="Change how your rabbit looks">
                {touch ? '◆' : '◆ LOOK'}
              </button>
              <button
                className="hud-idea"
                onClick={() => { sounds.confirm(); setOverlay({ kind: 'idea' }); }}
                aria-pressed={overlay.kind === 'idea'}
                aria-label="Suggest something to add to the Garden in Sound"
              >
                {touch ? '✿' : '✿ IDEA'}
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
            {lookOpen && overlay.kind === 'none' && <LookPicker look={look} onChange={setLook} onClose={() => setLookOpen(false)} />}
            {visitors && sayOpen && overlay.kind === 'none' && (
              <div className="say-picker" role="group" aria-label="Say something">
                {EMOTES.map((e, i) => (
                  <button
                    key={e.label}
                    aria-label={e.label}
                    onClick={() => {
                      if (visitors.emote(i)) sounds.pop();
                      setSayOpen(false);
                    }}
                  >
                    {!touch && <kbd>{i + 1}</kbd>}
                    {e.text}
                  </button>
                ))}
              </div>
            )}
            {visitors && others > 0 && (
              <button className="hud-visitors" aria-live="polite" aria-expanded={rabbitsOpen} onClick={() => setRabbitsOpen((o) => !o)}>
                {others === 1 ? '1 OTHER RABBIT HERE' : `${others} OTHER RABBITS HERE`}
                {visitors.hidden && ' (HIDDEN)'}
              </button>
            )}
            {visitors && rabbitsOpen && others > 0 && (
              <div className="rabbit-list">
                {visitors.myName && <p className="rabbit-me">YOU ARE <b>{visitors.myName.toUpperCase()}</b></p>}
                <ul>
                  {visitors.list().map((r) => (
                    <li key={r.id}>
                      <button
                        className="rabbit-go"
                        aria-label={`Go to ${r.name}`}
                        onClick={() => {
                          const p = visitors.where(r.id);
                          if (!game || !p) return;
                          sounds.confirm();
                          game.teleport(p);
                          input.clear();
                          setMapOpen(false);
                          setRabbitsOpen(false);
                        }}
                      >
                        <i style={{ background: r.color }} aria-hidden="true" />
                        <span>
                          {r.name.toUpperCase()}
                          <small>{r.away ? 'looking at something' : (r.street ?? 'off the street')}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button onClick={() => (visitors.hidden = !visitors.hidden)} aria-pressed={visitors.hidden}>
                  {visitors.hidden ? 'SHOW OTHER RABBITS' : 'HIDE OTHER RABBITS'}
                </button>
              </div>
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
                places={landmarkPlaces}
                onPick={(p) => {
                  // jump to the nearest street there, and get back to walking
                  sounds.confirm();
                  game.teleport(p);
                  input.clear();
                  setMapOpen(false);
                }}
                legend={[
                  { color: '#ffe066', label: 'open' },
                  { color: '#ff7eb6', label: 'soon' },
                  { color: LANDMARK_COLOR, label: 'landmark' },
                  ...(visitors && others > 0 && !visitors.hidden ? [{ color: '#9b5de5', label: 'other rabbits' }] : []),
                ]}
              />
            )}
          </div>
          <p className="attribution">{world.attribution}</p>
        </>
      )}

      {started && touch && !FULL_SCREEN.includes(overlay.kind) && <TouchPad />}

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
            choices={overlay.choices}
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

      {overlay.kind === 'idea' && <IdeaBox street={street} onClose={closeOverlay} />}

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

      {overlay.kind === 'arcade' && (
        <SceneBoundary onError={closeOverlay}>
          <Suspense fallback={<div className="scene scene-loading">Loading…</div>}>
            <DuckArcade onExit={closeOverlay} start={overlay.game} />
          </Suspense>
        </SceneBoundary>
      )}

      {overlay.kind === 'ride' && (
        <SceneBoundary onError={closeOverlay}>
          <Suspense fallback={<div className="scene scene-loading">Loading…</div>}>
            {overlay.ride === 'whirl' ? <GiantWhirl onExit={closeOverlay} /> : <FigureEight onExit={closeOverlay} />}
          </Suspense>
        </SceneBoundary>
      )}

      {pelican && game && overlay.kind === 'none' && <Pelican game={game} onDone={() => setPelican(false)} />}

      {!started && <TitleScreen onStart={start} />}
    </main>
  );
}
