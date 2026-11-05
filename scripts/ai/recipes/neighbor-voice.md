---
name: neighbor-voice
use: a new person wandering the streets who says a line or two when you walk up (a neighbor, a shopkeeper, a dog walker…)
edit: src/content/neighbors.ts
read: src/content/neighbors.test.ts
test: src/content/neighbors.test.ts
---
# Recipe: a neighbor's voice

People wandering the map say one of these when the rabbit walks up to them. Each one is a
name and one to three short lines.

## Do

Add **one** entry to the end of the `neighborVoices` array in `src/content/neighbors.ts`,
just before the closing `];`. Change nothing else in the file. Don't touch `buskerVoice`.

```ts
  { name: 'A gardener', lines: ['The tulips came up early this year.', 'Nobody told them it was still February.'] },
```

## Rules

- `name` is how they're introduced: "A gardener", "A bus driver", or a first name. Never a
  real, identifiable person.
- 1 to 3 lines, each under 100 characters. Plain words, warm and a little funny, like the
  other entries. They're West Seattle neighbors talking about the neighborhood or the art.
- Use straight quotes in the code: single quotes around strings, and `\'` or double
  quotes for an apostrophe inside, as the file already does.
- Never write "press A". No emoji. No links.
- Keep the trailing comma after the entry.

## Done when

- `neighborVoices` has exactly one more entry than before, at the end.
- `npx vitest run src/content/neighbors.test.ts` passes (a name, 1–3 lines under 100
  characters, no emoji, no links, never "press A").
