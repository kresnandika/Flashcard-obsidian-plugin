---
name: Flashcards
description: Spaced-repetition review inside Obsidian, set like an open pocket dictionary.
colors:
  dictionary-red: "#b8392c"
  dictionary-red-fill: "#b13527"
  ochre: "#a26a17"
  green: "#3c7a58"
  olive: "#6f6a22"
  blue: "#3f6697"
  violet: "#6a559a"
  paper: "var(--background-primary)"
  paper-raised: "color-mix(in srgb, var(--background-secondary) 70%, var(--background-primary))"
  ink: "var(--text-normal)"
  ink-muted: "var(--text-muted)"
  ink-faint: "var(--text-faint)"
  ink-tint: "color-mix(in srgb, var(--text-normal) 45%, transparent)"
  rule: "color-mix(in srgb, var(--text-normal) 12%, transparent)"
  rule-strong: "color-mix(in srgb, var(--text-normal) 22%, transparent)"
typography:
  display:
    fontFamily: "var(--font-interface)"
    fontSize: "clamp(3.2rem, 9vw, 4.6rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "var(--font-interface)"
    fontSize: "1.6em"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "var(--font-interface)"
    fontSize: "1.1em"
    fontWeight: 600
  body:
    fontFamily: "var(--font-interface)"
    fontSize: "var(--font-ui-medium)"
    fontWeight: 400
  label:
    fontFamily: "var(--font-interface)"
    fontSize: "var(--font-ui-smaller)"
    fontWeight: 400
  entry-headword:
    fontFamily: "var(--font-text)"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: 1.15
  entry-prompt:
    fontFamily: "var(--font-text)"
    fontSize: "clamp(24px, 4.5vw, 32px)"
    fontWeight: 500
  entry-meaning:
    fontFamily: "var(--font-text)"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  hairline: "2px"
  sm: "4px"
  md: "8px"
  frame: "10px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  3xl: "32px"
  gutter: "clamp(16px, 4vw, 40px)"
components:
  button-study:
    backgroundColor: "{colors.dictionary-red-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-study-hover:
    backgroundColor: "color-mix(in srgb, #b13527 88%, #000)"
  button-grade:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    height: "56px"
  thumb-tab:
    backgroundColor: "color-mix(in srgb, var(--fc-tab) 16%, var(--background-primary))"
    rounded: "0 8px 8px 0"
    width: "34px"
    height: "52px"
  thumb-tab-active:
    backgroundColor: "color-mix(in srgb, var(--fc-tab) 82%, #000)"
    textColor: "#ffffff"
    width: "44px"
  deck-row:
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "6px"
    height: "44px"
  key-hint:
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.sm}"
    padding: "0 5px"
---

# Design System: Flashcards

## Overview

**Creative North Star: "The Pocket Dictionary"**

Every surface is set like a page of an open pocket dictionary. A running head carries guide words (the first and last headword of today's queue) over a single red rule; the deck list below is ranked the way a dictionary ranks entries, by weight and indent, separated by hairlines; thumb-cut tabs hang off the page's fore-edge, one per top-level deck branch. The card itself, when the plugin draws it, is a dictionary entry: headword with its reading over a red rule, italic part of speech, meaning, then a ruled-off example.

The system owns almost no colour of its own. Ground, ink, font and every neutral come from the active Obsidian theme, so the page follows any theme in light and dark. On top of that sits one dictionary red and a small set of muted pigments, each with a fixed meaning. Density is calm: one body size, generous vertical air around the due figure, a single large number as the only display type in the chrome.

The build rejects the dashboard of equal stat cards and coloured count tables; numbers are set as text in columns, and history is a quiet footnote in ink density.

**Key Characteristics:**
- Theme ground and ink; one dictionary red; muted pigments with fixed meanings.
- A 2px red rule under every head (running head, browser toolbar, code block head, finished title, entry head).
- Hairline rules instead of boxes; rows ranked by weight and indent.
- Thumb-cut tabs on the page's fore-edge, in a six-pigment sequence.
- Tabular numerals everywhere a count appears; zeros fade.

## Colors

Theme ground and ink carry the page; colour is reserved for meaning.

### Primary
- **Dictionary Red** (`dictionary-red`; lifts to #d4604f in dark): the rule under every head, due counts, the review progress fill, the Again grade, the active browser tab underline, selection tint, focus outline, and in the card entry only the rule under the headword. Readings, replay buttons, focus states and the writing pad stay in ink.
- **Deep Dictionary Red** (`dictionary-red-fill`): filled surfaces only (the Study button and other call-to-action buttons), deep enough that white text holds 4.5:1 in both themes.

### Secondary
- **Ochre** (`ochre`; #cf9a4a in dark): cards in learning, and the Hard grade.
- **Green** (`green`; #74ad8b in dark): new, unspent cards, and the Good grade.

### Tertiary
- **Olive, Blue, Violet** (`olive`, `blue`, `violet`; #b0a85c, #86a7d2, #a693d0 in dark): pigments that exist to complete the thumb-tab sequence. Blue also marks the Easy grade.

### Neutral
- **Paper** (`paper`): the view ground, straight from the theme.
- **Raised Paper** (`paper-raised`): grade buttons, a step off the ground.
- **Ink / Muted Ink / Faint Ink** (`ink`, `ink-muted`, `ink-faint`): text hierarchy from the theme; faint ink carries zeros, column heads, notes and labels.
- **Ink Tint** (`ink-tint`): neutral progress fill in the code block.
- **Rule / Strong Rule** (`rule`, `rule-strong`): hairline row dividers, and the stronger rule that opens a list or edges the page.

### Named Rules
**The One Red Rule.** Red means "due today" or "this is the head". It never decorates; it marks the head rule, due counts and the one primary action.

**The Fixed Pigment Rule.** New is green, learning is ochre, due is red, and the grades read red, ochre, green, blue from Again to Easy. A pigment never changes meaning between screens.

**The Thumb Sequence Rule.** Thumb tabs take pigments in order: red, ochre, olive, green, blue, violet, then repeat. Tabs are tinted at 16% over paper at rest and filled when active.

**The Ink Density Rule.** History is shown in ink, not hue: the review heatmap steps the theme's text colour through 18%, 32%, 50% and 70%. The forecast bars are the one exception, red at 55% because they are future due counts.

**The Theme Owns the Ground Rule.** Every neutral is an Obsidian variable or a mix of one. No hard-coded greys or backgrounds in the chrome.

## Typography

**Display Font:** the theme's interface font (`--font-interface`)
**Body Font:** the theme's interface font
**Card Font:** the theme's text font (`--font-text`), passed into the card frame

**Character:** No bundled fonts. Hierarchy comes from size and weight inside whatever face the user's theme sets, which keeps the plugin native to the vault.

### Hierarchy
- **Display** (bold, clamp 3.2 to 4.6rem, line-height 0.9, tight tracking, tabular): the day's due count, once per page. Drops to 2.6rem in the code block.
- **Headline** (semibold, 1.6em, 1.2): the guide words in the running head, with readings in muted ink at 0.6em. Falls back to the "Flashcards" title (bold, 1.5em) when the queue is empty.
- **Title** (semibold, 1.1em): the code block title, the due label, the browser headword, top-level deck names.
- **Body** (regular, the theme's UI size): deck rows, buttons, descriptions.
- **Label** (regular, the theme's smaller UI size): column heads, deck notes, footer titles, intervals, key hints. Sentence case, no tracking.
- **Card entry** (text font, 18px base): headword 56px semibold on both sides (it never moves when the card flips); production prompt (the meaning) 24 to 32px, balanced; meaning 22px at 1.4; reading 24px in ink; part of speech 14px italic faint; example 20px.

### Named Rules
**The One Body Size Rule.** Rank comes from weight, indent and ink level, not a stack of type sizes. Deck depth 0 is semibold, depth 1 normal, depths 2 and 3 muted.

**The Tabular Count Rule.** Every count is set in tabular numerals in a fixed right-aligned column, so figures line up down the page.

## Layout

The home page is a single column capped at 860px, padded by a fluid gutter (`gutter`), with 44px of extra right padding to hold the thumb tabs. The page's right edge is a strong rule, the fore-edge the tabs hang from. Order down the page: running head, the due figure with its breakdown and the Study button, the deck list, then a footer grid (history at flexible width, forecast at 180 to 240px).

Counts sit in a three-column grid (3.4rem per column; 2.6rem in review; 2.8rem on phones). Deck rows are 44px minimum, indenting 20px per depth level (12px on phones). Spacing uses Obsidian's size scale (`--size-2-*`, `--size-4-*`), with the larger steps (24 and 32px) between page sections.

Review is a column: a top bar with the deck name and counts, a 1.5px progress line, the card frame inset 12px, and an answer bar under a hairline. The bar holds one centred button up to 420px before the answer, and four grade buttons up to 132px each after it. The browser is a two-pane grid (list and detail, 1 : 1.4).

At 640px and below: the thumb tabs move into a horizontal row above the deck list, the fore-edge rule disappears, the Study button goes full width, the footer and browser collapse to one column, the grade buttons share the width equally, and the scope label in the running head is hidden.

## Elevation & Depth

Flat by default. Depth comes from rules and tonal steps (paper and raised paper), not shadows. Two soft shadows exist, both small and functional.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18)`): filled red call-to-action buttons only.
- **Deck frame** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18)`): the review card frame when it shows the deck's own design, to set that foreign page off the chrome.

### Named Rules
**The Rule-Not-Box Rule.** Structure is drawn with hairlines (row dividers, the list's top rule, the fore-edge) and the 2px red head rule. Containers do not get borders and shadows to separate them.

## Shapes

Gentle, small radii. Buttons, the Study button, grade buttons, the card input and thumb tabs use 8px; the review frame and browser preview use 10px; key hints, deck toggles and the writing pad use 4px; heatmap cells and forecast bars use 2px. Deck and browser rows are square. Thumb tabs are rounded only on the outer edge (right side on desktop, bottom on phones), like a cut into the page block.

## Components

### Running Head
The page's identity. Guide words (first and last headword of today's queue, joined by a faint dash) in headline type, a muted scope label, icon actions on the right, all over a 2px red rule. The same red rule closes the browser toolbar, the code block head, the "finished" title and the card entry head.

### Thumb-Cut Tabs
One tab per top-level deck branch, 34 by 52px, hung outside the page's right edge. At rest: pigment tinted 16% over paper with text mixed 55% toward ink. Hover widens to 40px; active widens to 44px and fills (pigment darkened 18% with white text in light; pure pigment with paper-coloured text in dark). Idle branches with nothing due go neutral. Width eases over 200ms (`cubic-bezier(0.22, 1, 0.36, 1)`).

### Deck Rows
Rows separated by hairlines below a strong top rule, with a faint column-head row. Indent 20px per depth; weight and ink fall with depth. A collapse chevron in faint ink, an optional one-line note in faint label type, counts in the three-pigment columns, a menu at the end. Hover uses the theme's hover modifier; no other row decoration.

### Buttons
- **Primary (Study):** deep red fill, white semibold text, 8px radius, 12 by 24px padding, button-lift shadow; hover mixes 12% black into the fill.
- **Grade buttons:** raised paper with a hairline border, 8px radius, 56px minimum height, stacked interval (muted, tabular), label (semibold, in the grade's pigment) and key hint. Hover uses the theme hover modifier.
- **Icon buttons:** no background, border or shadow; muted ink going to normal on hover. Icons come from Obsidian's icon set.
- **Focus:** 2px red outline, 2px offset, on every button.

### Key Hints
Keyboard hints set as small faint text in a 1px strong-rule outline, 4px radius, no fill or shadow.

### Review Chrome
Top bar (semibold deck name, counts), a 1.5px red progress line that eases over 240ms, the card frame, the answer bar. The "finished" state centres a title over a short red rule.

### Dictionary-Entry Card
The plugin's own card layout, drawn inside the card frame from theme variables the plugin passes in (ink, ground, muted, faint, red, text font). The answer side is an entry: headword and reading with muted outlined replay buttons over a 2px red rule; italic faint part of speech; the meaning; a hairline; the example, its reading in muted ink and its translation. Both sides share one top-aligned 640px column, so the headword stays in place and the answer opens beneath it. The question side shows only what is asked. The typing field is a transparent box with a strong hairline that turns to ink on focus; the writing pad is a square with a strong hairline border and faint centre cross-hairs, like practice paper. Latin part-of-speech lists are set as one comma list.

### Review History
A 26-week heatmap of 9px cells (2px radius, 3px gaps) in ink density, today ringed in muted ink; beside it a 7-day forecast of red bars over a strong baseline, with tabular counts above and faint day labels below.

## Do's and Don'ts

### Do:
- **Do** take every neutral from Obsidian variables (`--background-primary`, `--text-normal`, `--text-muted`, `--text-faint`) or a `color-mix` of them, and check both light and dark themes.
- **Do** put a 2px red rule under each head, and keep hairlines (12% and 22% ink) for every other division.
- **Do** keep the pigment meanings fixed: green new, ochre learning, red due; Again red, Hard ochre, Good green, Easy blue.
- **Do** fade zero counts to faint ink at normal weight.
- **Do** set counts in tabular numerals in fixed right-aligned columns.
- **Do** use the deep red fill for filled buttons with white text, and the lighter red for text and rules.

### Don't:
- **Don't** build equal stat cards or coloured count tables; counts are text in columns.
- **Don't** use red for decoration or for anything that is not a head rule, a due count, the primary action, focus or selection.
- **Don't** add hue to history; review activity is ink density.
- **Don't** bundle web fonts or hard-code greys and backgrounds in the chrome.
- **Don't** box containers with borders and shadows; separate with rules and tonal steps.
