---
version: 1
slug: "styles-css"
primary_target: "styles.css"
related_targets: ["src/ui"]
---

# Flashcards view (deck list, review, browser)

Scope: the plugin's tab (home/deck list, review session, browser), its modals and the `flashcards` code block. Mode: Operate. Audience: the author studying HSK on Mac (dark) and phone; later any Obsidian user with Anki decks. Constraints: Obsidian theme variables only, light and dark, phone widths; card content is the deck's own design inside the iframe.

## Direction contract

THESIS: The deck page reads like an open pocket dictionary. It refuses the dashboard of equal stat cards and coloured count tables.

OWN-WORLD: Theme ground and ink with one dictionary red (a red rule under the running head, the Study button, due counts). New / learning / due are three muted pigments (red, ochre, green) that also differ in weight, and zeros fade. Thumb-cut tabs on the panel's right edge, one per top-level deck branch, in muted pigments. Hairline rules, one body size, rank by weight and indent.

STORY: Opening the tab tells the learner today's range of words and how many are due; one click starts; history is a quiet footnote.

FIRST VIEWPORT: A running head with guide words (first and last word in today's queue) and the icon actions; a large due count, its breakdown, a red Study button; deck rows with counts and a one-line note; below, the review history and 7-day forecast; level tabs on the right edge.

FORM: Dictionary Thumb Index, assigned candidate 6 of 7 (re-roll 1). seed:560e80ceb9e2a08e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
