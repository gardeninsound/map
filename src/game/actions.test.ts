import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorld, setClock, type CityGame, type Target } from '../city';
import { lunaRideInvite, lunaRides } from '../content/lunaPark';
import { ponies as ponyWords } from '../content/ponies';
import { isActor, pick, talk } from './actions';
import { Garden } from './plugins/garden';
import { LunaPark } from './plugins/lunaPark';
import { Ponies } from './plugins/ponies';
import { Crow } from './plugins/crow';
import { Chicken } from './plugins/chicken';
import { Ham } from './plugins/ham';
import { ArtSpots } from './plugins/artSpots';
import { crowChoices } from '../content/crow';
import { chickenInvite, chickenQuestions } from '../content/chicken';
import { hamPets } from '../content/ham';
import { locations, spotInvite } from '../content/locations';
import type { Action } from './actions';

// jsdom has no canvas: portraits draw into a context that does nothing
beforeAll(() => {
  const noop = new Proxy({}, { get: () => () => undefined });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(noop as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
});

const world = createWorld();
const game = { world, npcs: [], portraitOf: () => 'portrait', besideRoad: (p: { x: number; y: number }) => p } as unknown as CityGame;
/** follow `then` past a line, as dismissing the last line does */
const then = (a: Action | null) => (a?.kind === 'talk' ? a.then : undefined);
const target = (kind: string, data?: unknown): Target => ({ key: kind, kind, x: 0, y: 0, label: { name: kind, verb: 'a' }, data });

describe('what {A} does, as data', () => {
  it('leaves other plugins’ targets alone', () => {
    const garden = new Garden();
    expect(isActor(garden)).toBe(true);
    expect(garden.act(target('pony'))).toBeNull();
  });

  it('the garden sign says what is out in the month on the clock', () => {
    const garden = new Garden();
    garden.attach(game);
    setClock({ at: new Date(2026, 3, 15, 12).getTime() });
    const a = garden.act(target('garden'));
    setClock({ at: null });
    expect(a).toMatchObject({ kind: 'talk', speaker: 'Dragonfly Garden' });
    expect(a?.kind === 'talk' && a.lines[0]).toMatch(/April, spring/);
    expect(a?.kind === 'talk' && a.lines[1]).toMatch(/tulips/);
  });

  it('a pony stands still and says its lines', () => {
    const herd = new Ponies();
    herd.attach(game);
    const h = herd.herd[0];
    const a = herd.act(target('pony', h));
    expect(a).toMatchObject({ kind: 'talk', speaker: ponyWords[0].name, lines: ponyWords[0].lines });
    expect(herd.talking).toBe(h);
  });

  it("Luna Park: the Figure Eight's sign offers the ride, no closes; a plain sign just talks", () => {
    const luna = new LunaPark();
    luna.attach(game);
    const signOf = (id: string) => luna.targets().find((t) => (t.data as { id?: string })?.id === id)!;
    const fig = luna.act(signOf('figure8'));
    expect(pick(fig, lunaRideInvite.yes)).toEqual({ kind: 'ride', ride: 'figure8' });
    expect(pick(fig, lunaRideInvite.no)).toEqual({ kind: 'close' });
    expect(pick(luna.act(signOf('whirl')), lunaRideInvite.yes)).toEqual({ kind: 'ride', ride: 'whirl' });
    // Pat answers a sum: the question leads to another dialog
    const pat = lunaRides.find((r) => r.ask)!;
    expect(pat).toBeDefined();
    const a = luna.act(signOf(pat.id));
    expect(pick(a, pat.ask!.label)).toMatchObject({ kind: 'talk', lines: pat.ask!.reply });
    expect(pick(a, pat.ask!.done)).toEqual({ kind: 'close' });
  });

  it('a mini game hands its score to what comes next', () => {
    const a = talk('A chicken', ['Want to play?'], {
      choices: [{ label: 'Yes!', next: { kind: 'minigame', game: 'cone-catch', then: (r) => talk('A chicken', [`${r.score} cones!`]) } }],
    });
    const game = pick(a, 'Yes!');
    expect(game.kind === 'minigame' && game.then?.({ score: 12, best: 20 })).toMatchObject({ lines: ['12 cones!'] });
  });

  it('the crow: a snack or not, its reply, then it flies off', () => {
    const crow = new Crow();
    crow.attach(game);
    const npcTarget = { ...target('npc'), npc: crow.npc };
    const a = crow.act(npcTarget);
    expect(a).toMatchObject({ kind: 'talk', speaker: 'A crow', portrait: 'portrait' });
    const reply = pick(a, crowChoices[0].label);
    const fly = then(reply);
    expect(fly?.kind).toBe('do');
    const flew: boolean[] = [];
    crow.flyAway = (shared: boolean) => void flew.push(shared);
    if (fly?.kind === 'do') fly.run();
    expect(flew).toEqual([true]);
    expect(crow.act(target('npc'))).toBeNull(); // someone else's neighbor
  });

  it('the chicken: two questions, then her game, and a line about your score', () => {
    const chicken = new Chicken();
    chicken.attach(game);
    let a: Action | null | undefined = chicken.act({ ...target('npc'), npc: chicken.npc });
    for (const q of chickenQuestions) {
      expect(a).toMatchObject({ kind: 'talk', lines: q.lines });
      a = then(pick(a!, q.answers[0].label));
    }
    expect(a).toMatchObject({ lines: chickenInvite.lines });
    const game2 = pick(a!, chickenInvite.yes);
    expect(game2).toMatchObject({ kind: 'minigame', game: 'cone-catch' });
    expect(game2.kind === 'minigame' && game2.then?.({ score: 1, best: 3 })).toMatchObject({ lines: [expect.stringMatching(/^1 cone!/), expect.any(String)] });
    expect(pick(a!, chickenInvite.no)).toMatchObject({ lines: chickenInvite.bye });
  });

  it('Ham: his lines and a request; petting does it, then he answers', () => {
    const ham = new Ham();
    ham.attach(game);
    const a = ham.act({ ...target('npc'), npc: ham.npc });
    expect(a?.kind === 'talk' && a.lines.at(-1)).toBe(hamPets.ask);
    const pet = pick(a, hamPets.yes);
    let petted = 0;
    ham.pet = () => void petted++;
    if (pet.kind === 'do') pet.run();
    expect(petted).toBe(1);
    expect(pet.kind === 'do' && pet.then).toMatchObject({ lines: hamPets.after });
  });

  it("an art spot: Mike's greeting, then its scene if it has one", () => {
    const spots = new ArtSpots(locations);
    spots.attach(game);
    const withScene = spots.places.find((l) => l.experience)!;
    const a = spots.act(target('place', withScene));
    expect(a).toMatchObject({ kind: 'talk', lines: withScene.greeting });
    expect(pick(a, spotInvite.yes)).toEqual({ kind: 'scene', spot: withScene.id });
    expect(spots.visited.has(withScene.id)).toBe(true);
    const soon = spots.places.find((l) => !l.experience);
    if (soon) expect(spots.act(target('place', soon))).not.toHaveProperty('choices');
  });

  it('pick() refuses a choice that is not there', () => {
    expect(() => pick(talk('x', ['hi']), 'nope')).toThrow(/no choice "nope"/);
  });
});
