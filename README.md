# বাংলাtype

A Monkeytype-style typing test for Bengali, using the **Probhat (প্রভাত)** keyboard layout.
No accounts, no saving, just the core typing feel: smooth caret, live word highlighting,
three-line scrolling, and a results screen with a WPM chart.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production build in dist/
pnpm check      # svelte-check + tsc
```

## How input works

- Keys are mapped to Bengali in the browser from `KeyboardEvent.key`, so any OS keyboard
  layout works. You do not need a Bengali keyboard installed.
- If the OS keyboard already emits Bengali characters they are passed through unchanged.
- The map lives in `src/lib/probhat.ts` and follows the m17n-db `bn-probhat.mim` file
  (the layout Linux ships). Notable keys: hasanta `/`, danda `.`, chandrabindu `>`, ৃ `<`,
  য় `z`, য `Z`, ড় `R`, ঢ় `X`, ঞ `&`, ৎ `*`.
- Toggle the on-screen layout reference with the **⌨ প্রভাত** button. It highlights the
  key for the next expected character.

## Shortcuts

| Key | Action |
| --- | --- |
| `Tab` | restart |
| `Enter` | restart from the result screen |
| `Esc` | restart |
| `Backspace` | delete one keystroke (code point); steps back into a previous incorrect word |
| `Ctrl/Alt + Backspace` | delete the current word |

## Scoring

Bengali has no monospace tradition and one Probhat keystroke is one Unicode code point, so
"characters" means code points. WPM uses Monkeytype's formula: correct code points in
correct words (plus their spaces) divided by 5, per minute. Raw counts all keystrokes.
Accuracy is correct keystrokes over all keystrokes. Consistency is Monkeytype's
coefficient-of-variation curve over per-second raw WPM.

## Word list

`src/lib/words.ts` holds a hand-curated list of ~850 common words. Edit it freely; words
are de-duplicated and normalized on load so spelling variants of ড়/ঢ়/য় all match.

## Stack

Svelte 5 + Vite + TypeScript. No runtime dependencies. Fonts (Noto Sans Bengali, Roboto Mono)
are self-hosted woff2 subsets in `public/fonts/`, preloaded from `index.html`, so first paint
does not wait on a third-party request. The caret is animated with requestAnimationFrame
(exponential smoothing) and written directly to the DOM. Wrong keystrokes show the character
you actually typed in red, shake briefly, and flash the caret.
