import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { input } from '../engine/input';
import { DialogBox } from './DialogBox';

const setup = () => {
  const egg = vi.fn();
  const chicken = vi.fn();
  const { container } = render(
    <DialogBox
      lines={['Which came first?']}
      speaker="A chicken"
      onDone={() => {}}
      choices={[
        { label: 'The chicken', onPick: chicken },
        { label: 'The egg', onPick: egg },
      ]}
    />,
  );
  // finish typing the line so the choices show
  fireEvent.click(container.querySelector('.dialog')!);
  return { chicken, egg };
};
const selected = () => document.querySelector('.dialog-choices .is-selected')?.textContent;

describe('DialogBox choices', () => {
  it('start on the first choice; the arrow keys move the highlight, wrapping around', () => {
    setup();
    expect(selected()).toBe('The chicken');
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(selected()).toBe('The egg');
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(selected()).toBe('The chicken');
    fireEvent.keyDown(window, { code: 'ArrowLeft' });
    expect(selected()).toBe('The egg');
    expect(screen.getByText('The egg')).toBe(document.activeElement); // Space / Enter press it
  });

  it('A picks the highlighted choice', () => {
    const { chicken, egg } = setup();
    fireEvent.keyDown(window, { code: 'KeyD' });
    act(() => input.press('a'));
    expect(egg).toHaveBeenCalledTimes(1);
    expect(chicken).not.toHaveBeenCalled();
  });
});
