/**
 * Styles every card document starts with, before the note type's own CSS.
 * They mirror Anki's reviewer defaults so imported decks look as intended.
 */
export const BASE_CARD_CSS = `
html { color-scheme: var(--fc-scheme, light); }
html, body { margin: 0; padding: 0; }
body { padding: 20px; box-sizing: border-box; overflow-wrap: break-word; color: var(--fc-text, #000); }
.card { font-family: arial, sans-serif; font-size: 20px; text-align: center; }
img { max-width: 100%; height: auto; }
.replay-button { text-decoration: none; display: inline-flex; vertical-align: middle; margin: 3px; }
.replay-button svg { width: 40px; height: 40px; }
.replay-button svg circle { fill: #fff; stroke: #414141; }
.replay-button svg path { fill: #414141; }
.nightMode .replay-button svg circle { fill: #363636; stroke: #d7d7d7; }
.nightMode .replay-button svg path { fill: #d7d7d7; }
.cloze { font-weight: bold; color: blue; }
.nightMode .cloze { color: #4a9eff; }
#typeans { width: 100%; box-sizing: border-box; font-family: inherit; font-size: inherit; }
code#typeans { font-family: monospace; }
.typeGood { background: #afa; color: #000; }
.typeBad { background: #faa; color: #000; }
.typeMissed { background: #ccc; color: #000; }
.fc-template-error { color: #c00; font-family: monospace; font-size: 14px; }
`;
