import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorld, setClock, type CityGame, type Target } from '../city';
import { lunaRideInvite, lunaRides } from '../content/lunaPark';
import { ponies as ponyWords } from '../content/ponies';
import { isActor, pick, talk } from './actions';
import { Garden } from './plugins/garden';
import { LunaPark } from './plugins/lunaPark';
import { Ponies } from './plugins/ponies';

// jsdom has no canvas: portraits draw into a context that does nothing
beforeAll(() => {
  const noop = new Proxy({}, { get: () => () => undefined });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(noop as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
});

const world = createWorld();
const game = { world } as CityGame;
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

  it('pick() refuses a choice that is not there', () => {
    expect(() => pick(talk('x', ['hi']), 'nope')).toThrow(/no choice "nope"/);
  });
});
