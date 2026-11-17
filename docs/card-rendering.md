# Card rendering

## Two card styles

**Flashcards layout** (default) ignores the deck's templates and draws the card itself (`rendering/layout/`):

1. `fieldRoles.ts` works out what each note field is (word, reading, meaning, part of speech, example, example reading/translation, image, word/example audio) from field names, then contents (`[sound:]` → audio, `<img>` → image). Users correct it per note type with **Card fields…** (stored in `settings.noteTypeLayouts[noteTypeId].roles`).
2. `cardKind.ts` reads the deck's front template to keep its intent: does it show the word (recognition) or the meaning (production), and did it expect typing (`{{type:}}`, a text box) or drawing (a canvas)? Scripts and comments are ignored, since they often mention fields without showing them.
3. `builtinLayout.ts` renders a dictionary entry: headword with reading in red and audio, part of speech and meaning, then a ruled-off example, picture and audio. Production cards with typing get a character diff against the word; recognition answers are shown for self-grading; drawing cards get a practice-grid writing pad whose drawing is shown again on the back. Colours and font come from the active Obsidian theme as CSS variables.

A note type falls back to its deck design when no word or meaning field can be found, or when the user picks **Use the deck's own design** for it.

**Deck design** renders the deck's Anki templates as described below.

## Deck design

A card is shown in four steps:

1. **Template** (`rendering/templateEngine.ts`). The note type's front or back template is rendered with the note's fields.
2. **Sounds** (`rendering/media.ts`). `[sound:file.mp3]` tags become Anki-style replay buttons; the file names are collected for autoplay.
3. **Document** (`rendering/cardDocument.ts`). The HTML is wrapped in a full document with Anki's default styles, the note type's CSS, and a small bridge script. Relative `src` attributes and CSS `url()`s are rewritten to the package's `media/` folder.
4. **Frame** (`ui/components/CardFrame.ts`). The document is loaded into a sandboxed iframe.

## Template language

| Syntax | Meaning |
|---|---|
| `{{Field}}` | Field content (HTML) |
| `{{#Field}}…{{/Field}}` | Shown when the field isn't empty (an image or sound counts as content) |
| `{{^Field}}…{{/Field}}` | Shown when the field is empty |
| `{{FrontSide}}` | The rendered front, on the back template |
| `{{Tags}}` `{{Deck}}` `{{Subdeck}}` `{{Card}}` `{{Type}}` | Special fields |
| `{{text:Field}}` | Field without HTML |
| `{{hint:Field}}` | A "Show Field" link that reveals the field |
| `{{type:Field}}` | A text box on the front; a character diff against the field on the back |
| `{{cloze:Text}}` | Cloze deletions for the current card number |
| `{{cloze-only:Text}}` | Only the answers of the current cloze |
| `{{#c1}}…{{/c1}}` | Shown on cloze card 1 |
| `{{furigana:F}}` `{{kana:F}}` `{{kanji:F}}` | Japanese readings written as `漢字[かんじ]` |
| `{{tts …:F}}` and unknown filters | The field, unchanged |

Filters apply right to left, as in Anki: `{{text:hint:Field}}` applies `hint` first. Unknown fields render a visible "Unknown field" marker instead of failing the whole card. A mismatched closing tag closes the nearest section rather than blanking the card.

## The sandbox

Anki decks often include JavaScript: a typing box that carries what you typed from the front to the back, a drawing canvas for writing characters, and so on. The card frame uses `sandbox="allow-scripts"` **without** `allow-same-origin`:

- deck scripts run, so these decks keep working;
- the frame has an opaque origin, so it can't touch Obsidian's DOM, the vault, the plugin, or other frames.

Turning off **Run deck scripts** in settings removes `<script>` elements and inline event handlers from the deck HTML. The bridge script still runs.

### The bridge

`rendering/bridgeScript.ts` is injected at the top of every card document. It is the only channel between the card and the plugin, and every message carries a per-document token that the plugin checks along with the sender frame.

| Direction | Message | Purpose |
|---|---|---|
| frame → plugin | `key` | Key presses, unless the user is typing in a text box. Enter in a box (outside IME composition) reveals the answer; Esc leaves the box. |
| frame → plugin | `sound` | A replay button was clicked. Audio plays in the plugin, so R and the autoplay queue control it. |
| frame → plugin | `typed` | The content of the `{{type:}}` box, for the comparison on the back. |
| frame → plugin | `storage` | A deck script wrote to `sessionStorage`/`localStorage`. |
| plugin → frame | (initial config) | Token, the current storage values, whether to focus the first text box. |

Sandboxed frames can't use web storage, and many decks rely on `sessionStorage` to pass state from front to back. The bridge replaces `sessionStorage` and `localStorage` with an in-memory shim and reports every write. The plugin hands the values back when it renders the back. The values are cleared when the next card starts.

The bridge also defines `pycmd`, `onUpdateHook` and `onShownHook` (and runs the latter on load) so decks written for Anki desktop don't throw.

## Media

Media URLs come from the vault adapter's resource path (`app://…` on desktop, `capacitor://…` on mobile). A media reference is resolved by trying the name as written, then HTML-entity-decoded, then percent-decoded, and finally the sanitised stored name from `renamedMedia`. Absolute URLs (`https:`, `data:`, `//…`) are left alone.

## Autoplay

The front's sounds play when the front is shown. On the back, sounds play too, except those that came from `{{FrontSide}}`, matching Anki. R replays every sound on the current side.

## Night mode

When **Follow Obsidian's theme** is on and Obsidian uses a dark theme, the body gets Anki's `nightMode night_mode` classes and the html element `night-mode`, so deck CSS written for Anki's night mode applies. The default text colour follows Obsidian's `--text-normal`.
