/** Deck hierarchy built from `::`-separated names, merged across packages. */

export const DECK_SEPARATOR = "::";

export interface DeckNode {
	name: string;
	/** Last level of the name, shown in the tree. */
	label: string;
	depth: number;
	children: DeckNode[];
}

export function deckLabel(name: string): string {
	const parts = name.split(DECK_SEPARATOR);
	return parts[parts.length - 1];
}

export function parentDeck(name: string): string | null {
	const index = name.lastIndexOf(DECK_SEPARATOR);
	return index < 0 ? null : name.slice(0, index);
}

/** True when `name` is `root` or one of its sub-decks. */
export function isInDeck(name: string, root: string): boolean {
	return name === root || name.startsWith(root + DECK_SEPARATOR);
}

/** Builds a sorted tree. Missing parents (e.g. `A` for `A::B`) are created. */
export function buildDeckTree(names: Iterable<string>): DeckNode[] {
	const nodes = new Map<string, DeckNode>();
	const roots: DeckNode[] = [];

	const ensure = (name: string): DeckNode => {
		const existing = nodes.get(name);
		if (existing) return existing;
		const parts = name.split(DECK_SEPARATOR);
		const node: DeckNode = { name, label: parts[parts.length - 1], depth: parts.length - 1, children: [] };
		nodes.set(name, node);
		const parent = parentDeck(name);
		if (parent === null) roots.push(node);
		else ensure(parent).children.push(node);
		return node;
	};

	for (const name of names) ensure(name);

	const sort = (list: DeckNode[]) => {
		list.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
		list.forEach((node) => sort(node.children));
	};
	sort(roots);
	return roots;
}

/** Depth-first list of a tree, honouring a set of collapsed deck names. */
export function flattenDeckTree(roots: DeckNode[], collapsed: ReadonlySet<string> = new Set()): DeckNode[] {
	const out: DeckNode[] = [];
	const walk = (list: DeckNode[]) => {
		for (const node of list) {
			out.push(node);
			if (!collapsed.has(node.name)) walk(node.children);
		}
	};
	walk(roots);
	return out;
}

/**
 * Finds a deck from a full name or from one level of it, so notes can say
 * `HSK 1` instead of `HSK 3.0 2026::HSK 1 (300 Words)`. Exact level matches
 * win over prefix matches. Unknown names are returned unchanged.
 */
export function resolveDeckName(names: string[], query: string): string {
	if (names.includes(query)) return query;
	const sorted = [...names].sort();
	for (const matches of [(level: string) => level === query, (level: string) => level.startsWith(query)]) {
		for (const name of sorted) {
			const parts = name.split(DECK_SEPARATOR);
			const index = parts.findIndex(matches);
			if (index >= 0) return parts.slice(0, index + 1).join(DECK_SEPARATOR);
		}
	}
	return query;
}
