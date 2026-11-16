/**
 * `?open=`: a link that opens something on the map, for reviews and the story log's camera.
 * Pure (openLink.test.ts); App acts on it through the same paths a visitor's {A} takes.
 *
 *   ?open=crow                walk up to it and press {A}: a plugin's id (src/game/plugins/index.ts:
 *   ?open=garden              the crow's own snack crow), else any target by its kind (when there's
 *   ?open=sundrop             one of that kind), its key, or its name
 *   ?open=scene:rush-hour     an art spot's scene, as "Let's see it" opens it
 *   ?open=arcade              inside the Duck Arcade (its intro)
 *   ?open=arcade:quack-hero   straight into a cabinet's game
 *   ?open=ride:figure8        Luna Park's rides (figure8 | whirl)
 *   ?open=minigame:cone-catch the chicken's mini game
 *   ?open=idea | spots        the idea box, the spots list
 */
export type OpenLink =
  | { kind: 'target'; name: string }
  | { kind: 'scene'; id: string }
  | { kind: 'arcade'; game: string | null }
  | { kind: 'ride'; ride: 'figure8' | 'whirl' }
  | { kind: 'minigame'; id: 'cone-catch' }
  | { kind: 'panel'; panel: 'idea' | 'spots' };

/** `?open=` from a query string, or null when there's none or it can't be read */
export function openFromSearch(search: string): OpenLink | null {
  const v = new URLSearchParams(search).get('open')?.trim().toLowerCase();
  if (!v) return null;
  const [head, rest = ''] = v.split(/:(.*)/s);
  if (head === 'scene' && rest) return { kind: 'scene', id: rest };
  if (head === 'arcade') return { kind: 'arcade', game: rest || null };
  if (head === 'ride') return rest === 'whirl' || rest === 'figure8' ? { kind: 'ride', ride: rest } : null;
  if (head === 'minigame') return rest === 'cone-catch' ? { kind: 'minigame', id: 'cone-catch' } : null;
  if (!rest && (head === 'idea' || head === 'spots')) return { kind: 'panel', panel: head };
  return { kind: 'target', name: v };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/^(the|a|an)-/, '');

/**
 * The target a name means, from everything on the map you could press {A} on: its exact key,
 * else the only target of that kind, else the first whose name (without "the") matches or
 * contains it as a word. Null if nothing does.
 */
export function findTarget<T extends { key: string; kind: string; label: { name: string } }>(targets: T[], name: string): T | null {
  const n = name.toLowerCase();
  const byKey = targets.find((t) => t.key.toLowerCase() === n);
  if (byKey) return byKey;
  const ofKind = targets.filter((t) => t.kind === n);
  if (ofKind.length === 1) return ofKind[0];
  const s = slug(n);
  return (
    targets.find((t) => slug(t.label.name) === s) ??
    targets.find((t) => `-${slug(t.label.name)}-`.includes(`-${s}-`)) ??
    (ofKind[0] || null)
  );
}
