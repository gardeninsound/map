import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bindKeyboard,
  CityGame,
  Compass,
  createWorld,
  facingFor,
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
import { START, locations, welcome } from './content/locations';
import { CROW_NAME, crowChoices, crowGreeting, crowReply } from './content/crow';
import { CHICKEN_NAME, chickenAfter, chickenInvite, chickenQuestions } from './content/chicken';
import { neighborVoices } from './content/neighbors';
import { recentChanges, type RecentAt } from './content/recent';
import { experiences } from './experiences/registry';
import { ArtSpots, type PlacedLocation } from './game/plugins/artSpots';
import { Busker } from './game/plugins/busker';
import { Crow } from './game/plugins/crow';
import { Chicken } from './game/plugins/chicken';
import { Pegasus } from './game/plugins/pegasus';
import { BigCup } from './game/plugins/bigCup';
import { Seal } from './game/plugins/seal';
import { ArcadeDoor } from './game/plugins/arcadeDoor';
import { LunaPark, lunaSignPortrait } from './game/plugins/lunaPark';
import { lunaRideInvite, type LunaSign } from './content/lunaPark';
import { Visitors } from './game/plugins/visitors';
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
  /** inside the Duck Arcade */
  | { kind: 'arcade' }
  /** riding Luna Park's Great Figure Eight */
  | { kind: 'ride' }
  | { kind: 'spots' }
  /** the idea box: "What would you love to add?" → a GitHub issue */
  | { kind: 'idea' };

const ConeCatch = lazy(() => import('./experiences/minigames/ConeCatch'));
const DuckArcade = lazy(() => import('./experiences/arcade/DuckArcade'));
const FigureEight = lazy(() => import('./experiences/luna/FigureEight'));

/** Overlays that take the whole screen: the map's HUD and touch pad hide under them. */
const FULL_SCREEN: Overlay['kind'][] = ['scene', 'minigame', 'arcade', 'ride'];

/** the sign picture in Luna Park's dialog boxes, drawn on first use */
let signPortrait: string | undefined;

const LANDMARK_COLOR = '#5fa8a0';

/**
 * The landmarks, as named places for the map: the Junction's four block faces become one
 * "The Junction shops", other names lose their parenthetical. Most-visited first, so those
 * keep their name tags when the map gets crowded.
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
    if (l.sprite === 'storefronts') continue;
    out.push({ name: l.name.replace(/\s*\(.*\)\s*$/, ''), ...centre(l), color: LANDMARK_COLOR });
  }
  return out;
}

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
  /** bumped whenever other rabbits come, go, or are hidden: re-reads `visitors` */
  const [, setRabbitTick] = useState(0);
  const [rabbitsOpen, setRabbitsOpen] = useState(false);
  const [sayOpen, setSayOpen] = useState(false);
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
  const arcadeDoor = useRef(new ArcadeDoor());
  // RECENT: which change the next press jumps to, and the caption shown on landing
  const recentNext = useRef(0);
  const [recentNote, setRecentNote] = useState<string | null>(null);

  useEffect(() => bindKeyboard(), []);

  useEffect(() => {
    const art = new ArtSpots(locations);
    const busker = new Busker();
    const crow = new Crow();
    const chicken = new Chicken();
    const pegasus = new Pegasus();
    const luna = new LunaPark();
    // Everyone else on the island, live. `?solo` walks alone; `?relay=` points at another
    // relay; in dev, `?island=<name>` uses a private room so tests don't walk onto the real one.
    const params = new URLSearchParams(location.search);
    const island = (import.meta.env.DEV && params.get('island')) || undefined;
    // dev: `?presence=N` → a hidden tab leaves after N s, idle fades after 2N and leaves after 4N
    const fast = import.meta.env.DEV ? Number(params.get('presence')) : 0;
    const timings = fast > 0 ? { hiddenGone: fast, idleAway: 2 * fast, idleGone: 4 * fast } : undefined;
    const live = params.has('solo') ? null : new Visitors(params.get('relay') ?? undefined, island, timings);
    if (live) live.onChange = () => setRabbitTick((n) => n + 1);
    const g = new CityGame(canvas.current!, world, {
      start: world.project(START.lat, START.lon),
      voices: neighborVoices,
      plugins: [art, new BigCup(art), new Seal(), arcadeDoor.current, luna, busker, crow, chicken, pegasus, ...(live ? [live] : [])],
      events: {
        onStreet: setStreet,
        onStorefront: setStorefront,
        onNearby: setNearby,
        onInteract: (t) => {
          sounds.confirm();
          if (t.kind === 'arcade') {
            setOverlay({ kind: 'arcade' });
          } else if (t.kind === 'luna') {
            // a sign at Luna Park; the Figure Eight's offers a ride, Pat answers a sum
            const sign = t.data as LunaSign;
            const talk = { kind: 'talk', speaker: sign.name, portrait: (signPortrait ??= lunaSignPortrait()) } as const;
            const { ask } = sign;
            setOverlay({
              ...talk,
              lines: sign.lines,
              choices:
                sign.id === 'figure8'
                  ? [
                      { label: lunaRideInvite.yes, onPick: () => setOverlay({ kind: 'ride' }) },
                      { label: lunaRideInvite.no, onPick: () => setOverlay({ kind: 'none' }) },
                    ]
                  : ask
                    ? [
                        { label: ask.label, onPick: () => setOverlay({ ...talk, lines: ask.reply }) },
                        { label: ask.done, onPick: () => setOverlay({ kind: 'none' }) },
                      ]
                    : undefined,
            });
          } else if (t.kind === 'rabbit' && live) {
            // Another player close by: face them and open (or close) the SAY picker.
            g.player.facing = facingFor({ x: t.x - g.player.pos.x, y: t.y - g.player.pos.y }, g.player.facing);
            setSayOpen((o) => !o);
          } else if (t.kind === 'place') {
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
    if (import.meta.env.DEV) Object.assign(window, { __game: g, __busker: busker, __crow: crow, __chicken: chicken, __pegasus: pegasus, __art: art, __luna: luna, __visitors: live }); // test hooks
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
  /** RECENT: jump to the newest change, then each one before it on the next presses, wrapping round. */
  const goRecent = useCallback(() => {
    if (!game || !spots) return;
    const where = (at: RecentAt): { x: number; y: number } | null => {
      if ('landmark' in at) {
        const l = game.world.landmarks.find((m) => m.id === at.landmark);
        return l ? { x: l.x + l.w / 2, y: l.y + l.h + 0.5 } : null; // just in front of it
      }
      if ('spot' in at) return spots.places.find((p) => p.id === at.spot) ?? null;
      if ('arcade' in at) return arcadeDoor.current.door;
      return game.world.project(at.lat, at.lon);
    };
    const n = recentChanges.length;
    for (let tries = 0; tries < n; tries++) {
      const i = recentNext.current % n;
      recentNext.current = i + 1;
      const p = where(recentChanges[i].at);
      if (!p) continue; // gone from the map: skip it
      sounds.confirm();
      game.teleport(p);
      input.clear();
      setMapOpen(false);
      setRecentNote(`NEW ${i + 1}/${n} · ${recentChanges[i].title}`);
      return;
    }
  }, [game, spots]);
  useEffect(() => {
    if (!recentNote) return;
    const t = setTimeout(() => setRecentNote(null), 3500);
    return () => clearTimeout(t);
  }, [recentNote]);
  const openSpots = spots?.open ?? [];
  const landmarkPlaces = useMemo(() => (game ? mapLandmarks(game.world.landmarks) : []), [game]);

  const Scene = overlay.kind === 'scene' && overlay.loc.experience ? experiences[overlay.loc.experience] : null;
  const talkLoc = overlay.kind === 'talk' ? overlay.loc : undefined;

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
              <button className="hud-recent" onClick={goRecent} aria-label="Go to the next most recent change on the map">
                RECENT
              </button>
              <button onClick={() => setMapOpen((o) => !o)} aria-pressed={mapOpen}>
                MAP {!touch && <kbd>M</kbd>}
              </button>
              {visitors && (
                <button onClick={() => setSayOpen((o) => !o)} aria-pressed={sayOpen} aria-label="Say something to other rabbits">
                  {touch ? '♥' : '♥ SAY'}
                </button>
              )}
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
          {recentNote && overlay.kind === 'none' && (
            <p className="recent-note" role="status">{recentNote}</p>
          )}
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
            <DuckArcade onExit={closeOverlay} />
          </Suspense>
        </SceneBoundary>
      )}

      {overlay.kind === 'ride' && (
        <SceneBoundary onError={closeOverlay}>
          <Suspense fallback={<div className="scene scene-loading">Loading…</div>}>
            <FigureEight onExit={closeOverlay} />
          </Suspense>
        </SceneBoundary>
      )}

      {pelican && game && overlay.kind === 'none' && <Pelican game={game} onDone={() => setPelican(false)} />}

      {!started && <TitleScreen onStart={start} />}
    </main>
  );
}
