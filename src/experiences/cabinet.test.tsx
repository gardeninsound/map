import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { input } from '../city';
import { BackButton, loadScripts, useCabinet } from './cabinet';

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

const press = (b: 'a' | 'b') => act(() => input.press(b));

describe('useCabinet', () => {
  it('{A} goes to the game, {B} leaves with the latest result', () => {
    const onExit = vi.fn();
    const onA = vi.fn();
    const before = vi.fn();
    let score = 1;
    const { rerender } = renderHook(() => useCabinet({ onExit, onA, beforeLeave: before, result: () => ({ score, best: 9 }) }));
    press('a');
    expect(onA).toHaveBeenCalledTimes(1);
    score = 4;
    rerender();
    press('b');
    expect(before).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith({ score: 4, best: 9 });
  });

  it('BACK leaves too', () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useCabinet({ onExit, result: () => ({ score: 0, best: 0 }) }));
    const { getByRole } = render(<BackButton onClick={result.current} />);
    act(() => getByRole('button').click());
    expect(onExit).toHaveBeenCalledWith({ score: 0, best: 0 });
  });
});

describe('loadScripts', () => {
  it('loads in order once, and tries again after a failure', async () => {
    const first = loadScripts('kit-audio.js', 'kit.js');
    expect(loadScripts('kit-audio.js', 'kit.js')).toBe(first);
    const fire = (n: number, ev: 'load' | 'error') => (document.head.querySelectorAll('script')[n] as HTMLScriptElement)[`on${ev}`]!(new Event(ev));
    await Promise.resolve();
    fire(0, 'load');
    await vi.waitFor(() => expect(document.head.querySelectorAll('script')).toHaveLength(2));
    expect((document.head.querySelectorAll('script')[1] as HTMLScriptElement).src).toMatch(/kit\.js$/);
    fire(1, 'load');
    await expect(first).resolves.toBeUndefined();

    const broken = loadScripts('missing.js');
    await Promise.resolve();
    fire(2, 'error');
    await expect(broken).rejects.toThrow(/could not load missing.js/);
    expect(loadScripts('missing.js')).not.toBe(broken);
  });
});
