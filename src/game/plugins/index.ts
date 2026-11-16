/**
 * Everyone and everything on the island, by a stable id: the one list of the art layer's plugins.
 * App hands `pluginList(island)` to `CityGame` (in this order: it's the draw and {A} order) and
 * never names a plugin itself, so **a new character is a line here, not a change to App.tsx**.
 *
 * The ids are the names a link or a test uses: `?open=crow` presses {A} on the crow's own target
 * (the snack crow, not some street crow), and in dev each plugin is `window.__<id>`.
 */
import type { CityGame, CityPlugin, Npc, Target } from '../../city';
import { locations } from '../../content/locations';
import { ArcadeDoor } from './arcadeDoor';
import { ArtSpots } from './artSpots';
import { BigCup } from './bigCup';
import { BikeRace } from './bikeRace';
import { Busker } from './busker';
import { Chicken } from './chicken';
import { ChickenBoxing } from './chickenBoxing';
import { Crow } from './crow';
import { Dinos } from './dinos';
import { Flock } from './flock';
import { ForestMaze } from './forestMaze';
import { Garden } from './garden';
import { Ham } from './ham';
import { LunaPark } from './lunaPark';
import { Mermaids } from './mermaids';
import { Pegasus } from './pegasus';
import { Ponies } from './ponies';
import { Rowboat } from './rowboat';
import { Seal } from './seal';
import { Squirrels } from './squirrels';
import { Visitors } from './visitors';

export type IslandOptions = {
  /** null: walk alone (`?solo`), no other rabbits */
  visitors: ConstructorParameters<typeof Visitors> | null;
};

/** Every plugin, by id. Add a new one here (in the order it should draw and answer {A}). */
export function createIsland({ visitors }: IslandOptions) {
  const art = new ArtSpots(locations);
  const rowboat = new Rowboat();
  return {
    garden: new Garden(),
    art,
    cup: new BigCup(art),
    dinos: new Dinos(),
    seal: new Seal(),
    arcadeDoor: new ArcadeDoor(),
    luna: new LunaPark(),
    busker: new Busker(),
    crow: new Crow(),
    flock: new Flock(),
    squirrels: new Squirrels(),
    chicken: new Chicken(),
    pegasus: new Pegasus(),
    ham: new Ham(),
    race: new BikeRace(),
    rowboat,
    mermaids: new Mermaids(rowboat),
    ponies: new Ponies(),
    maze: new ForestMaze(),
    boxing: new ChickenBoxing(),
    visitors: visitors ? new Visitors(...visitors) : null,
  };
}

export type Island = ReturnType<typeof createIsland>;
export type PluginId = keyof Island;

/** the plugins, in order, for `CityGame` */
export const pluginList = (island: Island): CityPlugin[] => Object.values(island).filter((p): p is NonNullable<typeof p> => p !== null);

/** dev test hooks: `window.__<id>` for each plugin */
export const devHooks = (island: Island): Record<string, unknown> => Object.fromEntries(Object.entries(island).map(([id, p]) => [`__${id}`, p]));

/** the plugin with this id (any case: links come lowercased), or undefined when no plugin has it */
export function pluginById(island: Island, id: string): CityPlugin | undefined {
  const key = Object.keys(island).find((k) => k.toLowerCase() === id.toLowerCase()) as PluginId | undefined;
  return (key && island[key]) || undefined;
}

/**
 * A plugin's own targets, out of everything you could press {A} on: the ones it lists itself, and
 * its character (a plugin with an `npc`, like the crow, chicken and Ham) when it's around to talk.
 */
export function targetsOf(plugin: CityPlugin, game: Pick<CityGame, 'allTargets'>): Target[] {
  const all = game.allTargets();
  const own = new Set((plugin.targets?.(game as CityGame) ?? []).map((t) => t.key));
  const npc = (plugin as { npc?: Npc }).npc;
  return all.filter((t) => own.has(t.key) || (npc !== undefined && t.npc === npc));
}
