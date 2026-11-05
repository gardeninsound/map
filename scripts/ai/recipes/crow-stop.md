---
name: crow-stop
use: a new place for the snack crow to land and say something, at a real shop or business
edit: src/content/crow.ts
read: src/game/crow.test.ts, .ai/shops.txt
test: src/game/crow.test.ts
---
# Recipe: a new stop for the snack crow

The crow starts at Les Schwab, asks the rabbit for snacks, then flies to the next stop in
`crowStops`, and after the last one heads home. A new stop goes **just before the last
entry** (the Luna Park one), because the last stop's lines say it's heading home.

## Do

In `src/content/crow.ts`, add one object to `crowStops`, right before the entry whose
`shop` is `/luna park/i`. Change nothing else.

```ts
  {
    shop: /easy street records/i,
    lat: 47.5613,
    lon: -122.387,
    lines: ['Records. Rows and rows of records.', 'None of them are about crows. Got any snacks?'],
    thanks: ['A carrot. Not a record, but I respect it.', 'CAW!'],
    huff: ['Fine. I\'ll go listen to the gulls.'],
  },
```

## Rules

- `shop` is a case-insensitive regex that must match a shop **name in `.ai/shops.txt`**
  (one name per line, then its kind). Pick a shop from that list; never invent one. Keep the
  regex short, but long enough not to match a second shop: `/easy street/i` would match
  both Easy Street Records and Easy Street Cafe, so use `/easy street records/i`.
- `lat`/`lon`: copy them from the line in `.ai/shops.txt` (they're there for this).
- The **last line of `lines` must end with "snacks?"** (the test checks it). The rabbit then
  chooses "Share a carrot" or "Sorry, no snacks".
- `thanks` is the reply to a carrot, `huff` to no snacks. The crow is dry and a bit proud.
  It only ever gets carrots.
- 1 to 3 lines in each list, each under 100 characters. No emoji, never "press A".

## Done when

- `crowStops` has one more entry, second to last.
- `npx vitest run src/game/crow.test.ts` passes (the shop is real, the greeting asks for snacks).
