# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The author first: a learner studying Mandarin (HSK 3.0 levels) inside their own Obsidian vault, reviewing on a Mac (dark theme, keyboard-driven) and in quick sessions on a phone. Later, any Obsidian user who studies with Anki decks, once the plugin is submitted to the community directory.

## Product Purpose

Spaced-repetition review inside Obsidian. Import an Anki deck (.apkg) and study it with its own templates, audio and images, scheduled by FSRS, without leaving the vault. Success: the daily review is the easiest thing to start and finish, and progress lives next to the rest of the user's notes.

## Positioning

Anki decks render faithfully (deck scripts, typing boxes, writing pads, audio) inside a sandboxed frame, while scheduling, progress and stats are plain files in the vault that sync with it. Other Obsidian flashcard plugins make you write cards as markdown; this one brings existing Anki decks over intact.

## Operating Context

A tab inside Obsidian (desktop and mobile) next to the user's notes; a ribbon icon, commands, a status-bar due count, and a `flashcards` code block on dashboard notes (e.g. the vault's Mandarin page). Sessions are daily, short, keyboard-first on desktop (Space, 1–4) and thumb-driven on phone. The card itself is the deck author's design (often dark, coloured hanzi); the plugin's chrome surrounds it.

## Capabilities and Constraints

- Screens: deck list (today's counts, stats, review history, forecast, packages), review session (card frame + answer bar), card browser (search, preview, edit, suspend, forget), modals (import, edit note, deck options), code block, settings tab.
- Must follow whatever Obsidian theme is active (light and dark) through Obsidian CSS variables; no bundled web fonts in the chrome.
- Works at desktop and phone widths.
- Card content is rendered by the deck's own HTML/CSS in an iframe; plugin styling must not depend on it.

## Brand Commitments

Name: "Flashcards" (plugin id `flashcard-srs`). User-stated: minimalist, colour balanced and conceptual; must not feel gamey or overly colourful, not grey and generic, not dense, and must not fight the user's Obsidian theme.

## Evidence on Hand

Real deck: HSK 1 (300 words, 900 cards, 898 media files) from an Anki package the user owns; not committed to the repo. No users, reviews or metrics exist yet; do not invent any.

## Product Principles

1. Starting today's review takes one click; everything else is secondary.
2. The deck's card is the hero; plugin chrome recedes around it.
3. Belongs in Obsidian: native controls, theme variables, familiar patterns.
4. Calm progress: numbers that motivate without points, streak fireworks or noise.
5. Same experience on Mac and phone.
