# Storage format

All data lives in the vault under the configured data folder (default `Flashcards/`). Each imported package gets its own folder:

```
<data folder>/<package name>/
├── collection.json
├── progress.json
└── media/
```

Both JSON files carry a `schema` number (currently `1`). The plugin refuses to load a package with a newer schema than it understands, rather than risk damaging it. Files are written compactly (no indentation) to keep them small.

Ids are strings. Ids that come from Anki keep their Anki value (a millisecond timestamp).

## collection.json

```jsonc
{
  "schema": 1,
  "id": "pm3x1q2a",               // package id, generated on first import
  "name": "HSK 1 (300 Words)",
  "source": "HSK_1.apkg",         // file name of the last import
  "importedAt": 1763380000000,
  "updatedAt": 1763380000000,
  "noteTypes": {
    "1778737156243": {
      "id": "1778737156243",
      "name": "HSK Deck",
      "kind": "standard",         // or "cloze"
      "fields": ["Hanzi", "Pinyin", "Meaning"],
      "templates": [{ "name": "Recognition", "ord": 0, "front": "{{Hanzi}}", "back": "…" }],
      "css": ".card { … }",
      "sortField": 0              // field shown as the card title in lists
    }
  },
  "decks": {
    "1800000000003": { "id": "1800000000003", "name": "HSK 3.0::HSK 1 (300 Words)::Recognition" }
  },
  "notes": {
    "1779527158804": {
      "id": "1779527158804",
      "guid": "official-2026-J/^Ye~[EU`-1779527158804",  // matches notes on re-import
      "noteTypeId": "1778737156243",
      "fields": ["爱", "ài", "to love"],                   // HTML, one entry per field
      "tags": ["HSK1"],
      "modified": 1779527158
    }
  },
  "cards": {
    "1779527158900": {
      "id": "1779527158900",
      "noteId": "1779527158804",
      "deckId": "1800000000003",
      "ord": 0,                   // template index; cloze number − 1 for cloze notes
      "position": 1               // order in which new cards are introduced
    }
  },
  "renamedMedia": {               // only names that weren't safe as file names
    "a:b.mp3": "a_b.mp3"
  }
}
```

## progress.json

```jsonc
{
  "schema": 1,
  "cards": {
    "1779527158900": {
      "memory": {                 // absent while the card is new
        "due": 1763466400000,     // epoch ms
        "stability": 3.17,        // days
        "difficulty": 5.28,       // 1–10
        "elapsedDays": 0,
        "scheduledDays": 3,
        "learningSteps": 0,
        "reps": 1,
        "lapses": 0,
        "state": 2,               // 0 new · 1 learning · 2 review · 3 relearning
        "lastReview": 1763380000000
      },
      "suspended": true,          // optional
      "buriedOn": "2026-11-17"    // optional; the card returns the next study day
    }
  },
  "log": [
    // [time (epoch ms), cardId, grade 1–4, state before, duration ms]
    [1763380000000, "1779527158900", 3, 0, 5400]
  ]
}
```

Cards with no entry in `cards` are new, not suspended and not buried. The log is append-only and chronological; statistics, streaks and daily limits are computed from it.

## media/

The package's media files under their original Anki names. Names containing characters that aren't allowed in file names on some platform (`\ / : * ? " < > |` and control characters) are stored under a sanitised name and listed in `renamedMedia`.

## Editing by hand

The files are safe to inspect and back up. When editing them by hand, keep the JSON valid and run **Flashcards: Reload decks from disk** afterwards (or let the change be picked up automatically). Removing `progress.json` resets a package's progress.
