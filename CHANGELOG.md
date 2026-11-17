# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-17

### Added

- Import Anki packages (`.apkg`, `.colpkg`) in all formats: `collection.anki2`, `collection.anki21` and zstd-compressed `collection.anki21b`, with media.
- Re-importing a deck updates notes matched by guid and keeps review progress.
- Anki template rendering: fields, sections, special fields, `hint`, `type`, `cloze`, `cloze-only`, `furigana`, `kana`, `kanji`, replay buttons and night mode.
- Cards render in a sandboxed iframe; deck scripts run without access to the vault, with a sessionStorage shim for front-to-back state.
- FSRS scheduling via ts-fsrs, with configurable retention, steps, maximum interval, fuzz and weights.
- Study sessions with daily limits (global and per deck), sibling burying, new-card gather and mix order, learn-ahead, undo, bury and suspend.
- Deck list with counts, stats strip, review heatmap, 7-day forecast and package management.
- Card browser with search, filters, preview, note editing, suspend and forget.
- `flashcards` code block, status-bar due count, daily-note habit property and a public API.
