/**
 * Turns a visitor's idea into a GitHub issue. Pure, so it's unit-tested (issue.test.ts,
 * run by the site's `npm test`).
 *
 * The text is untrusted and the repo is public, so it's made harmless as Markdown: no
 * @mentions (they'd notify real people), no control characters, bounded length. It only
 * ever travels as data: an issue body, never a command.
 */

export const MIN_LENGTH = 5;
export const MAX_LENGTH = 1000;
/** the optional name ("Sam from Delridge") */
export const NAME_MAX = 60;
export const LABEL = 'suggestion';

/** Strips control characters (keeping newlines), tidies blank lines, trims. */
export function clean(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A zero-width space after every @ so GitHub doesn't turn it into a mention. */
export const noMentions = (s: string) => s.replace(/@/g, '@​');

export type Checked = { ok: true; text: string; street: string | null; name: string | null } | { ok: false; error: string };

/** An optional one-line field: cleaned, newlines folded to spaces, cut to `max`; empty → null. */
const line = (v: unknown, max: number) => (typeof v === 'string' ? clean(v).replace(/\s*\n\s*/g, ' ').slice(0, max).trim() || null : null);

export function check(body: unknown): Checked {
  const b = (body ?? {}) as { text?: unknown; street?: unknown; name?: unknown };
  if (typeof b.text !== 'string') return { ok: false, error: 'Write your idea first.' };
  const text = clean(b.text);
  if (text.length < MIN_LENGTH) return { ok: false, error: 'Tell us a little more.' };
  if (text.length > MAX_LENGTH) return { ok: false, error: `Keep it under ${MAX_LENGTH} characters.` };
  if (typeof b.name === 'string' && clean(b.name).length > NAME_MAX) return { ok: false, error: `Keep your name under ${NAME_MAX} characters.` };
  return { ok: true, text, street: line(b.street, 80), name: line(b.name, NAME_MAX) };
}

export function issueFor(text: string, street: string | null, name: string | null = null) {
  const firstLine = text.split('\n')[0];
  const short = firstLine.length > 60 ? firstLine.slice(0, 57).trimEnd() + '…' : firstLine;
  const quoted = noMentions(text)
    .split('\n')
    .map((l) => (l ? `> ${l}` : '>'))
    .join('\n');
  const who = name ? ` by **${noMentions(name).replace(/[*_`~\\[\]<>]/g, '')}**` : '';
  const where = street ? ` · the rabbit was on ${noMentions(street)}` : '';
  return {
    title: `Idea: ${noMentions(short)}`,
    body: `${quoted}\n\n---\n<sub>Sent from the map's idea box${who}${where}.</sub>`,
    labels: [LABEL],
  };
}
