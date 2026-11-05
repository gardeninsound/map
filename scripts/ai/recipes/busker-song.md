---
name: busker-song
use: a new short tune for the keyboard busker outside Easy Street to play
edit: src/game/busker.ts
read: src/game/busker.test.ts
test: src/game/busker.test.ts
---
# Recipe: a new song for the busker

The busker plays the songs in `SONGS` (in `src/game/busker.ts`) one after another, the same
for everyone. A song is a few numbers and two strings of notes.

## Do

Add one song object to the end of the `SONGS` array, just before its closing `];`. Change
nothing else in the file (not the other songs, not the code below).

```ts
  {
    // gentle, G major
    name: 'Rain on the Junction',
    bpm: 96,
    lead:
      'B4:1 D5:1 G5:2 ' +
      'A5:1 G5:1 E5:2 ' +
      'D5:1 E5:1 G5:1 A5:1 ' +
      'B5:3 R:1',
    bass: ['G2', 'E2', 'C3', 'D3'],
    wave: 'triangle',
    gain: 0.8,
    sparkle: 0,
  },
```

## How the notes work

- `lead` is space-separated `NOTE:beats` tokens. A note is a letter, an optional `#` or
  `b`, then an octave: `C5`, `F#5`, `Bb4`. `R` is a rest. Beats can be `1`, `2`, `.5`, `.25`,
  `1.5`, `3`.
- Write one bar (4 beats) per line of the string, as above, and **add up every bar to
  exactly 4 beats**. Check each bar before you move on: `B4:1 D5:1 G5:2` is 1 + 1 + 2 = 4.
- `bass` has **one note per bar**: if the lead has 8 bars, `bass` has 8 notes. Bass notes
  are in octave 2 or 3.
- Lead notes stay between octave 4 and octave 6.
- Keep it short: 4 or 8 bars. Use notes from one key.
- It should be gentle, not loud: `gain` between 0.5 and 0.9; `bpm` between 70 and 140.
- Leave out `groove`, `hats` and `times` unless the idea asks for something funky.
- Give it an original title. Never copy a real song's melody or name.

## Done when

- `SONGS` has one more song, at the end.
- `npx vitest run src/game/busker.test.ts` passes (whole bars, the bass matches, notes in range).
