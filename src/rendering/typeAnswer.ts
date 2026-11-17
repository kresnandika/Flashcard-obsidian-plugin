import { escapeHtml } from "../utils/strings";

/** The input placed where `{{type:Field}}` appears on the front. */
export const TYPE_ANSWER_INPUT =
	'<input type="text" id="typeans" class="fc-typeans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">';

/**
 * Anki-style comparison of what was typed against the expected answer:
 * matching characters in `typeGood`, wrong ones in `typeBad`, missing ones in
 * `typeMissed`, followed by the correct answer when they differ.
 */
export function renderTypeComparison(typed: string, expected: string): string {
	const given = typed.trim();
	const correct = expected.trim();
	if (given === correct) return `<code id="typeans"><span class="typeGood">${escapeHtml(correct)}</span></code>`;
	if (given === "") return `<code id="typeans">${escapeHtml(correct)}</code>`;

	const diff = diffChars([...given], [...correct]);
	const typedHtml = diff.map(([kind, text]) => (kind === "missing" ? `<span class="typeMissed">${escapeHtml(text.replace(/./gu, "-"))}</span>` : `<span class="${kind === "same" ? "typeGood" : "typeBad"}">${escapeHtml(text)}</span>`)).join("");
	return `<code id="typeans">${typedHtml}<br><span id="typearrow">&darr;</span><br>${escapeHtml(correct)}</code>`;
}

type DiffKind = "same" | "extra" | "missing";

/** Character diff via longest common subsequence; answers are short, so O(n·m) is fine. */
function diffChars(a: string[], b: string[]): [DiffKind, string][] {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const lcs = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	const out: [DiffKind, string][] = [];
	const push = (kind: DiffKind, char: string) => {
		const last = out[out.length - 1];
		if (last && last[0] === kind) last[1] += char;
		else out.push([kind, char]);
	};
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			push("same", a[i]);
			i++;
			j++;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("extra", a[i++]);
		else push("missing", b[j++]);
	}
	while (i < a.length) push("extra", a[i++]);
	while (j < b.length) push("missing", b[j++]);
	return out;
}
