# Development

## Requirements

- Node.js 22.15 or newer (the test fixtures use Node's built-in zstd)
- npm

## Setup

```bash
git clone https://github.com/kresnandika/Flashcard-obsidian-plugin.git
cd Flashcard-obsidian-plugin
npm install
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Watch mode: rebuilds `main.js` on every change, with inline source maps |
| `npm run build` | Type-checks, then writes a minified `main.js` |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run lint` | ESLint over `src/` and `tests/` |
| `npm run typecheck` | TypeScript without emitting |
| `npm run check` | Type-check, lint and test, the same gate CI runs |

## Trying it in a vault

Build straight into a vault's plugin folder:

```bash
OUT_FILE="/path/to/vault/.obsidian/plugins/flashcard-srs/main.js" npm run dev
cp manifest.json styles.css /path/to/vault/.obsidian/plugins/flashcard-srs/
```

Enable the plugin under **Settings → Community plugins**. After a rebuild, reload it (toggle it off and on, or use the *Hot Reload* community plugin).

## Tests

Tests live in `tests/`:

- `tests/unit/` covers the template engine, rendering, the Anki reader, queue building, review sessions, statistics, the repository and the domain helpers.
- `tests/helpers/` builds synthetic Anki packages on the fly (legacy and modern formats) with sql.js, JSZip and a tiny protobuf writer, and provides an in-memory file system. No real decks are committed.
- `tests/integration/samplePackage.test.ts` imports and renders every card of a real deck that you point it at:

  ```bash
  FLASHCARDS_SAMPLE_APKG=~/Downloads/some-deck.apkg npm test
  ```

  It's skipped when the variable isn't set.

The Obsidian-specific layers (`ui/`, `integrations/`, `main.ts`) aren't unit-tested; the logic they call is.

## Code conventions

- TypeScript strict mode; no `any`.
- Layers by responsibility (see [architecture.md](architecture.md)). Keep Obsidian imports out of `domain/`, `anki/`, `scheduling/`, `stats/`, `rendering/` and `storage/` (except `ObsidianFileSystem.ts`), so they stay testable in Node.
- `ts-fsrs` is only imported in `scheduling/Scheduler.ts`.
- Persisted shapes live in `domain/types.ts`. Changing them means bumping `STORAGE_SCHEMA_VERSION` and adding a migration, and updating [storage-format.md](storage-format.md).
- User-facing errors throw `UserFacingError` with a message that can be shown as is.
- Tabs for indentation (see `.editorconfig`).

## Releasing

1. Update `CHANGELOG.md`.
2. Run `npm version patch` (or `minor` / `major`). This bumps `package.json`, syncs `manifest.json` and `versions.json`, and creates a commit and tag.
3. Push with tags: `git push --follow-tags`.
4. The **Release** workflow builds the plugin and drafts a GitHub release with `main.js`, `manifest.json` and `styles.css` attached. Review and publish it.

Obsidian's community directory expects the release tag to equal the version in `manifest.json`, without a `v` prefix; the repository's `.npmrc` is set up for that.
