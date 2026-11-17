# Flashcards for Obsidian

Spaced-repetition flashcards inside Obsidian. Import an Anki deck (`.apkg`) and review it with the same templates, styling, audio and images it has in Anki, scheduled by [FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm), the algorithm modern Anki uses.

Your cards, progress and media live as plain files in your vault, so they sync with the rest of it (Obsidian Sync, Dropbox, iCloud, Git…) and work on desktop and mobile.

## Features

- **Anki import.** Reads every package format Anki has written (`collection.anki2`, `collection.anki21`, and the zstd-compressed `collection.anki21b`), plus `.colpkg` collection backups. Deck hierarchy, note types, templates, CSS, audio and images come along. Importing a deck again updates its notes and keeps your progress.
- **Faithful cards.** Templates are rendered like Anki: fields, sections, `{{FrontSide}}`, `hint`, `type`, `cloze`, `furigana`, `[sound:…]` replay buttons, and night mode. Deck JavaScript (typing boxes, drawing pads) runs inside a sandboxed frame that can't reach your vault.
- **FSRS scheduling.** Learning steps, desired retention, maximum interval, fuzz and custom weights, with the next interval shown on every answer button.
- **Anki-style study.** Daily new and review limits (global or per deck), sibling burying, new-card gather order, learn-ahead, undo, bury and suspend.
- **Keyboard first.** Space reveals, 1–4 answer, R replays audio, U undoes.
- **Browser.** Search cards, preview both sides, edit notes, suspend, or forget.
- **Stats.** Due counts, reviews today, streak, 30-day retention, a review heatmap and a 7-day forecast.
- **Vault integration.** A `flashcards` code block for dashboards, a status-bar due count, an optional daily-note habit tick, and a small API for Dataview and other plugins.

## Installation

The plugin isn't in the community directory yet. Install it manually:

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/kresnandika/Flashcard-obsidian-plugin/releases), or build them yourself (see [Development](docs/development.md)).
2. Copy them into `<your vault>/.obsidian/plugins/flashcard-srs/`.
3. In Obsidian, open **Settings → Community plugins**, reload the list and enable **Flashcards**.

## Getting started

1. Click the **layers** icon in the ribbon, or run **Flashcards: Open deck list**.
2. Click **Import Anki deck** and choose an `.apkg` file. For decks exported from a recent Anki, any export works; if a deck shows no cards, export it again with *Support older Anki versions* ticked.
3. Click a deck name to study it.

### Reviewing

| Key | Action |
|---|---|
| Space / Enter | Show answer, then **Good** |
| 1 · 2 · 3 · 4 | Again · Hard · Good · Easy |
| R | Replay audio |
| U or Ctrl/Cmd + Z | Undo the last answer |
| - | Bury the card until tomorrow |
| @ | Suspend the card |
| E | Edit the note |
| Esc | Back to the deck list |

When a card has a text box (for example a typing card), click into it and type. Press Enter to reveal the answer, or Esc to leave the box and use the shortcuts again.

### Deck list

Each deck shows its **new** (blue), **learning** (red) and **due** (green) counts for today. Studying a parent deck includes its sub-decks. The ⋯ menu opens per-deck options (daily limits) and the browser.

### In your notes

Add a live summary with a Study button to any note:

````markdown
```flashcards
deck: HSK 1
```
````

`deck` accepts a full name (`Chinese::HSK 1`) or any level of it (`HSK 1`); leave it out to cover every deck. `title:` overrides the heading.

For Dataview or other plugins:

```js
const fc = app.plugins.plugins["flashcard-srs"].api;
fc.stats("HSK 1");  // { newCount, learnCount, reviewCount, cards: {...}, streak, ... }
fc.study("HSK 1");  // opens a review session
```

### Daily note habit

Under **Settings → Flashcards → Daily note**, point the plugin at a note (`Journal/{{date}}.md`) and a frontmatter property (`mandarin`). When you finish a deck for the day, that property is set to `true`.

## Settings

| Group | Setting | Default |
|---|---|---|
| Storage | Data folder | `Flashcards` |
| Daily limits | New cards / reviews per day | 20 / 200 |
| | New card order | Deck, then position |
| | New cards vs. reviews | Mixed |
| | Bury new / review siblings | On / Off |
| | Next day starts at | 4 am |
| | Learn-ahead limit | 20 min |
| Scheduling | Desired retention | 0.90 |
| | Maximum interval | 36,500 days |
| | Learning / relearning steps | `1m 10m` / `10m` |
| | Fuzz intervals | On |
| | FSRS weights | Library defaults |
| Reviewing | Autoplay audio, run deck scripts, follow theme, show intervals, status bar | On |
| Daily note | Mark the daily note, note path, property | Off |

## Your data

Everything is stored under the data folder, one sub-folder per imported deck:

```
Flashcards/
└── HSK 1 (300 Words)/
    ├── collection.json   notes, cards, decks, note types
    ├── progress.json     scheduling state and the review log
    └── media/            audio and images from the deck
```

The format is documented in [docs/storage-format.md](docs/storage-format.md). Deleting a package from the deck list removes its folder.

**Sync:** progress is written about 1.5 seconds after you answer. Changes synced in from another device are picked up automatically. If two devices review the same deck while offline, the last one to sync wins for that deck.

## Limitations

- Review history and scheduling from Anki aren't imported; cards start as new.
- Nested clozes, image occlusion and LaTeX rendering aren't supported.
- Changes made here aren't written back to Anki.

## Documentation

- [Architecture](docs/architecture.md): how the code is organised and how data flows.
- [Storage format](docs/storage-format.md): the JSON files in the data folder.
- [Card rendering](docs/card-rendering.md): templates, media and the sandbox.
- [Development](docs/development.md): building, testing and releasing.

## License

[MIT](LICENSE)
