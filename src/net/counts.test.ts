import { counter, countKey, countsHere, countUrl, overlayKey } from './counts';

describe('counting what people open', () => {
  it('counts on the live site only, never from a scripted browser, unless ?count', () => {
    expect(countsHere('gardeninsound.website', '', false)).toBe(true);
    expect(countsHere('www.gardeninsound.website', '?at=arcade', false)).toBe(true);
    expect(countsHere('gardeninsound.website', '', true)).toBe(false);
    expect(countsHere('pr-9-garden-preview.gardeninsound.workers.dev', '', false)).toBe(false);
    expect(countsHere('localhost', '', false)).toBe(false);
    expect(countsHere('localhost', '?count', true)).toBe(true);
  });

  it('sends to the relay, or the one ?relay= names', () => {
    expect(countUrl('')).toBe('https://relay.gardeninsound.website/count/bearisland');
    expect(countUrl('?relay=ws://127.0.0.1:8790')).toBe('http://127.0.0.1:8790/count/bearisland');
  });

  it('keys a target by what it is, never by who', () => {
    expect(countKey({ key: 'place:gas-station-wall' }, 'art')).toBe('place:gas-station-wall');
    expect(countKey({ key: 'luna:whirl' }, 'luna')).toBe('luna:whirl');
    expect(countKey({ key: 'rabbit:k3j2h1x9' }, 'visitors')).toBe('rabbit');
    const npc = {} as NonNullable<Parameters<typeof countKey>[0]['npc']>;
    expect(countKey({ key: 'npc:12', npc }, 'crow')).toBe('crow');
    expect(countKey({ key: 'npc:40', npc }, null)).toBe('neighbor');
    expect(countKey({ key: 'Odd Key!' }, 'x')).toBe('odd-key-');
  });

  it('keys what opens over the map, not the dialogs', () => {
    expect(overlayKey({ kind: 'scene', loc: { id: 'gas-station-wall' } })).toBe('scene:gas-station-wall');
    expect(overlayKey({ kind: 'ride' })).toBe('ride:figure8');
    expect(overlayKey({ kind: 'ride', ride: 'whirl' })).toBe('ride:whirl');
    expect(overlayKey({ kind: 'minigame' })).toBe('minigame:cone-catch');
    expect(overlayKey({ kind: 'arcade' })).toBe('arcade');
    expect(overlayKey({ kind: 'idea' })).toBe('idea');
    expect(overlayKey({ kind: 'talk' })).toBeNull();
    expect(overlayKey({ kind: 'none' })).toBeNull();
  });

  it('sends each key once per page load, and nothing when off', () => {
    const sent: string[] = [];
    const count = counter((k) => sent.push(k), true);
    count('crow');
    count('crow');
    count('scene:cup');
    expect(sent).toEqual(['crow', 'scene:cup']);
    const off = counter((k) => sent.push(k), false);
    off('ham');
    expect(sent).toEqual(['crow', 'scene:cup']);
  });
});
