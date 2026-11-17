# Architecture

The plugin is split into layers by responsibility. Each layer only depends on the ones below it, and everything except `ui/`, `integrations/`, `storage/ObsidianFileSystem.ts` and `main.ts` is free of Obsidian imports, so it runs and is tested in plain Node.

```
src/
├── main.ts              Plugin entry: wires services, views, commands, settings
├── constants.ts         Ids and file names shared across layers
│
├── domain/              The data model, no I/O
│   ├── types.ts           Note types, notes, cards, progress, review log
│   ├── Collection.ts      In-memory index over all loaded packages
│   └── deckTree.ts        Deck hierarchy from "A::B::C" names
│
├── anki/                Reading Anki packages
│   ├── apkgReader.ts      Entry point: zip → ParsedPackage
│   ├── legacySchema.ts    collection.anki2 / .anki21 (JSON in the col table)
│   ├── modernSchema.ts    collection.anki21b (normalised tables + protobuf)
│   ├── collectionRows.ts  notes and cards tables (same in both schemas)
│   ├── media.ts           Media lists (JSON or protobuf) and safe file names
│   ├── protobuf.ts        Minimal protobuf reader
│   ├── zstd.ts            zstd detection and decompression
│   ├── sqlite.ts          sql.js loading and query helpers
│   └── sqliteWasm.ts      The inlined sql.js WebAssembly binary
│
├── storage/             Persistence
│   ├── FileSystem.ts        Interface the repository needs
│   ├── ObsidianFileSystem.ts  Vault adapter implementation
│   ├── PackageRepository.ts   Load, import, save, sync detection
│   └── packageMerge.ts        Re-import: match notes by guid, keep progress
│
├── scheduling/          What to study and when
│   ├── Scheduler.ts       Adapter over ts-fsrs (the only file that imports it)
│   ├── queue.ts           Build a deck's queue: limits, burying, ordering
│   ├── studyDay.ts        Day boundaries and today's activity from the log
│   └── ReviewSession.ts   Session state machine: next, answer, undo, bury
│
├── stats/statistics.ts  Card breakdown, streak, retention, forecast
│
├── rendering/           Card HTML
│   ├── templateEngine.ts  Anki template language
│   ├── cloze.ts · furigana.ts · typeAnswer.ts   Filters
│   ├── media.ts           [sound:] tags and media URL rewriting
│   ├── renderCard.ts      Front/back of a card, autoplay rules
│   ├── cardDocument.ts    Full HTML document for the sandboxed frame
│   ├── bridgeScript.ts    Script injected into the frame (keys, audio, storage)
│   └── baseStyles.ts      Anki's default reviewer styles
│
├── settings/            Settings model, defaults and the settings tab
├── integrations/        Code block, daily note, public API
├── ui/                  Obsidian views
│   ├── FlashcardsView.ts  The tab; hosts one screen and routes keys
│   ├── context.ts         PluginContext: what screens may use
│   ├── screens/           HomeScreen, ReviewScreen, BrowseScreen
│   ├── components/        CardFrame, AudioPlayer, charts, presenter
│   └── modals/            Import, edit note, deck options, confirm, deck picker
└── utils/               Time, strings, debounce, errors
```

## Data flow

### Import

```
.apkg file ─► ImportModal ─► plugin.importAnkiPackage()
                              ├─ readAnkiPackage()      zip → sql.js → ParsedPackage
                              └─ repository.importPackage()
                                   ├─ match an existing package by note guid?
                                   │    yes → mergeIntoPackage()   (keeps progress)
                                   │    no  → new folder
                                   ├─ write media/ files
                                   └─ write collection.json + progress.json
```

### Review

```
ReviewScreen
  └─ ReviewSession(collection, scheduler, settings, deck)
       ├─ buildQueue()            new / review / learning cards for today
       ├─ next()                  learning due now → new/review mix → learn-ahead
       ├─ answer(grade)           Scheduler.answer() → progress + review log entry
       │    └─ onChange(packageIds) → repository.scheduleProgressSave()  (debounced)
       └─ undo() / buryCurrent() / suspendCurrent()

CardFrame (sandboxed iframe) ◄── buildCardDocument(renderFront/renderBack(card))
      │ postMessage: key presses, replay clicks, typed answer, storage writes
      ▼
ReviewScreen.handleKey()
```

### Sync

`main.ts` listens to vault `modify`/`create` events inside the data folder. `PackageRepository.handleExternalChange()` compares the file with the last content it wrote itself; only foreign changes (e.g. a sync from another device) reload the package. Pending local answers win: if a save is queued for that package, the incoming copy is ignored and overwritten shortly after.

## Design decisions

- **Packages, not one big collection.** Each imported deck is its own folder, so a 30,000-card library doesn't rewrite one huge file after every answer, and a deck can be deleted by deleting its folder. Decks with the same name in different packages merge in the deck list, as they would in Anki.
- **JSON in the vault.** Plain files sync with whatever the user already uses and can be inspected or backed up. `progress.json` is separate from `collection.json` because it changes constantly while the notes rarely do.
- **Sandboxed iframe for cards.** Anki decks often ship JavaScript. Running it in `sandbox="allow-scripts"` (without `allow-same-origin`) keeps the deck working while denying it access to Obsidian, the vault and the plugin. See [card-rendering.md](card-rendering.md).
- **FSRS behind an adapter.** Only `Scheduler.ts` imports `ts-fsrs`; the rest of the code uses the JSON-friendly `MemoryState`. Upgrading the library or the algorithm touches one file.
- **Screens depend on `PluginContext`, not the plugin class.** This keeps the UI decoupled from wiring and avoids circular imports.
- **sql.js with an inlined WebAssembly binary.** It works offline and on mobile, at the cost of a ~1.1 MB `main.js`.
