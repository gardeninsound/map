import { describe, expect, it } from 'vitest';
import { check, clean, issueFor, MAX_LENGTH, NAME_MAX } from './issue';

describe('idea box → GitHub issue', () => {
  it('keeps newlines, drops control characters and piles of blank lines', () => {
    expect(clean('  a\r\nb\u0007\n\n\n\nc‮  ')).toBe('a\nb\n\nc');
  });

  it('refuses missing, short and long ideas', () => {
    expect(check({}).ok).toBe(false);
    expect(check({ text: 42 }).ok).toBe(false);
    expect(check({ text: ' hi  ' }).ok).toBe(false);
    expect(check({ text: 'x'.repeat(MAX_LENGTH + 1) }).ok).toBe(false);
    expect(check({ text: 'A bench by the seal' })).toEqual({ ok: true, text: 'A bench by the seal', street: null, name: null });
  });

  it('keeps the street short and on one line', () => {
    const c = check({ text: 'A bench by the seal', street: 'California\nAve SW' + 'x'.repeat(200) });
    expect(c.ok && c.street?.length).toBe(80);
    expect(c.ok && c.street?.includes('\n')).toBe(false);
  });

  it('takes an optional name: one line, trimmed, blank means none, too long is refused', () => {
    const c = check({ text: 'A bench by the seal', name: '  Sam \n from Delridge ' });
    expect(c.ok && c.name).toBe('Sam from Delridge');
    expect(check({ text: 'A bench by the seal', name: '   ' })).toMatchObject({ ok: true, name: null });
    expect(check({ text: 'A bench by the seal', name: 7 })).toMatchObject({ ok: true, name: null });
    expect(check({ text: 'A bench by the seal', name: 'x'.repeat(NAME_MAX + 1) }).ok).toBe(false);
  });

  it('credits the name in bold, with mentions and Markdown defused', () => {
    const i = issueFor('A koi pond', 'Alki Ave SW', '@sam *the* [great]');
    expect(i.body).toContain("Sent from the map's idea box by **@\u200bsam the great** · the rabbit was on Alki Ave SW.");
    expect(i.body).not.toMatch(/@sam/);
    expect(issueFor('A koi pond', null).body).not.toContain(' by ');
  });

  it('quotes the idea, labels it, and never @mentions anyone', () => {
    const i = issueFor('Ping @vlandham about\n\na koi pond', 'California Ave SW');
    expect(i.labels).toEqual(['suggestion']);
    expect(i.title).toBe('Idea: Ping @​vlandham about');
    expect(i.body).toContain('> Ping @​vlandham about\n>\n> a koi pond');
    expect(i.body).not.toMatch(/@vlandham/);
    expect(i.body).toContain('the rabbit was on California Ave SW');
  });

  it('shortens long first lines for the title', () => {
    const i = issueFor('y'.repeat(100), null);
    expect(i.title.length).toBeLessThanOrEqual('Idea: '.length + 58);
    expect(i.title.endsWith('…')).toBe(true);
    expect(i.body).not.toContain('rabbit was on');
  });
});
