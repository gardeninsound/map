/**
 * What people open on the island, counted (relay/src/stats.ts keeps the numbers; the admin page
 * shows them). One beacon per thing per page load: `count('scene:gas-station-wall')` POSTs the key
 * to the relay's `/count`. No ids, no names, nothing about who: a key and the day it was opened.
 *
 * Only from the live site, and never from a browser a script drives (the smoke test, the story
 * log's photos), so previews, dev and tests don't count. `?count` turns it on anywhere, to try it.
 */
import type { Target } from '../city';
import { RELAY_URL } from './relay';

export const APP_ID = 'bearisland';
const LIVE = ['gardeninsound.website', 'www.gardeninsound.website'];

/** count from this page? the live site with a person at it, or `?count` */
export const countsHere = (hostname: string, search: string, scripted: boolean) =>
  new URLSearchParams(search).has('count') || (LIVE.includes(hostname) && !scripted);

/**
 * The key for {A} on a target: a plugin's own thing by its target key (`place:gas-station-wall`,
 * `luna:whirl`, `pony:2`), a plugin's character by the plugin's id (`crow`, `ham`), another rabbit
 * as `rabbit`, and the city's plain neighbors as `neighbor`.
 */
export function countKey(t: Pick<Target, 'key' | 'npc'>, pluginId: string | null): string {
  if (t.key.startsWith('rabbit:')) return 'rabbit';
  if (t.npc) return pluginId ?? 'neighbor';
  return t.key.toLowerCase().replace(/[^a-z0-9:_-]/g, '-').slice(0, 64);
}

/**
 * The key for something opened over the map (App's overlay), however it was reached: a scene
 * (`scene:<spot>`), a ride, the mini game, the arcade, the SPOTS list, the idea box. Dialogs and
 * nothing-open are null (a dialog is counted by what you pressed {A} on, `countKey`).
 */
export function overlayKey(o: { kind: string; loc?: { id: string }; ride?: string }): string | null {
  if (o.kind === 'scene') return o.loc ? `scene:${o.loc.id}` : null;
  if (o.kind === 'ride') return `ride:${o.ride ?? 'figure8'}`;
  if (o.kind === 'minigame') return 'minigame:cone-catch';
  if (o.kind === 'arcade' || o.kind === 'spots' || o.kind === 'idea') return o.kind;
  return null;
}

/** once per key per page load; `send` gets the keys that are new */
export function counter(send: (key: string) => void, on: boolean) {
  const sent = new Set<string>();
  return (key: string) => {
    if (!on || sent.has(key)) return;
    sent.add(key);
    send(key);
  };
}

/** the relay's /count (`?relay=ws://127.0.0.1:8790` points it at a local relay, as it does the rabbits) */
export const countUrl = (search: string) => `${(new URLSearchParams(search).get('relay') ?? RELAY_URL).replace(/^ws/, 'http').replace(/\/$/, '')}/count/${APP_ID}`;
const endpoint = typeof location !== 'undefined' ? countUrl(location.search) : '';
const beacon = (key: string) => {
  try {
    // a text/plain beacon: no preflight, and it still goes if the page is closing
    if (!navigator.sendBeacon?.(endpoint, key)) void fetch(endpoint, { method: 'POST', body: key, keepalive: true }).catch(() => {});
  } catch {
    // counting never gets in the way
  }
};

/** count something opened (see the top of this file) */
export const count = counter(
  beacon,
  typeof location !== 'undefined' && countsHere(location.hostname, location.search, typeof navigator !== 'undefined' && navigator.webdriver),
);
