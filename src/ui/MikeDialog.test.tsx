import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogBox, MIKE_PORTRAIT } from './MikeDialog';

describe('MikeDialog', () => {
  it('is Mike when no speaker is given, even if passed undefined', () => {
    const { container } = render(<DialogBox lines={['hi']} speaker={undefined} portrait={undefined} onDone={() => {}} />);
    expect(screen.getByText('Mike')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(MIKE_PORTRAIT);
  });

  it('lets someone else speak', () => {
    render(<DialogBox lines={['caw']} speaker="A crow" portrait="data:x" onDone={() => {}} />);
    expect(screen.getByText('A crow')).toBeTruthy();
  });
});
