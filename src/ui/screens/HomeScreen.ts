import { Menu, setIcon } from "obsidian";
import { buildDeckTree, deckLabel, flattenDeckTree, isInDeck, type DeckNode } from "../../domain/deckTree";
import type { LoadedPackage } from "../../domain/types";
import { buildQueue, deckCounts } from "../../scheduling/queue";
import { cardBreakdown, dueForecast, reviewEntries, reviewSummary } from "../../stats/statistics";
import { pluralize } from "../../utils/strings";
import { studyDayKey } from "../../utils/time";
import { renderCountSentence, renderCounts, renderForecast, renderGuideWords, renderHeatmap } from "../components/charts";
import { guideWords } from "../components/guideWords";
import type { PluginContext } from "../context";
import { confirm } from "../modals/ConfirmModal";
import { DeckOptionsModal } from "../modals/DeckOptionsModal";
import type { Navigator, Screen } from "./Screen";

/** Seconds per card assumed before there's enough review history to measure. */
const DEFAULT_SECONDS_PER_CARD = 8;
const TAB_PIGMENTS = 6;

/**
 * The deck list, laid out like an open dictionary page: a running head with
 * today's guide words, the day's count and Study button, the deck rows, and
 * thumb-cut tabs on the right edge for each branch of the library.
 */
export class HomeScreen implements Screen {
	private container: HTMLElement | null = null;
	/** Branch picked from the thumb tabs; null shows every deck. */
	private branch: string | null = null;

	constructor(
		private readonly ctx: PluginContext,
		private readonly nav: Navigator,
	) {}

	render(container: HTMLElement): void {
		this.container = container;
		container.empty();
		container.addClass("fc-home");

		const page = container.createDiv({ cls: "fc-page" });
		if (this.ctx.repository.collection.allPackages().length === 0) {
			this.renderEmpty(page);
			return;
		}
		const branches = this.branches();
		if (this.branch && !branches.includes(this.branch)) this.branch = null;

		this.renderRunningHead(page);
		this.renderToday(page);
		const decksArea = page.createDiv({ cls: "fc-decks-area" });
		if (branches.length > 1) this.renderThumbTabs(decksArea, branches);
		this.renderDecks(decksArea);
		this.renderFooter(page);
		this.renderPackages(page);
	}

	onDataChanged(): void {
		if (this.container) this.render(this.container);
	}

	// ── Sections ─────────────────────────────────────────────────────────

	private renderEmpty(page: HTMLElement): void {
		const head = page.createDiv({ cls: "fc-running-head" });
		head.createDiv({ cls: "fc-title", text: "Flashcards" });
		const empty = page.createDiv({ cls: "fc-empty" });
		empty.createEl("p", { cls: "fc-empty-lead", text: "No decks yet." });
		empty.createEl("p", { text: "Import an Anki deck (.apkg). Its cards, styling, audio and images come with it, and your progress is saved in this vault." });
		this.button(empty, "Import Anki deck", "download", () => this.ctx.openImport(), "mod-cta");
	}

	private renderRunningHead(page: HTMLElement): void {
		const head = page.createDiv({ cls: "fc-running-head" });
		const queue = buildQueue(this.ctx.repository.collection, this.branch, this.ctx.settings, Date.now());
		const guide = guideWords(queue);
		const left = head.createDiv({ cls: "fc-running-head-main" });
		if (guide) renderGuideWords(left, guide.first, guide.last);
		else left.createDiv({ cls: "fc-title", text: "Flashcards" });
		head.createDiv({ cls: "fc-running-head-scope", text: this.branch ? deckLabel(this.branch) : guide ? "Today's range" : "All caught up" });

		const actions = head.createDiv({ cls: "fc-running-head-actions" });
		this.iconButton(actions, "search", "Browse cards", () => this.nav.browse(this.branch));
		this.iconButton(actions, "download", "Import Anki deck", () => this.ctx.openImport());
	}

	private renderToday(page: HTMLElement): void {
		const { collection } = this.ctx.repository;
		const counts = deckCounts(collection, this.branch, this.ctx.settings, Date.now());
		const total = counts.newCount + counts.learnCount + counts.reviewCount;

		const today = page.createDiv({ cls: "fc-today" });
		const figure = today.createDiv({ cls: "fc-today-figure" });
		figure.createDiv({ cls: "fc-today-number", text: String(total) });
		const text = figure.createDiv({ cls: "fc-today-text" });
		text.createDiv({ cls: "fc-today-label", text: total === 1 ? "card due today" : "cards due today" });
		renderCountSentence(text, counts);
		if (total > 0) text.createDiv({ cls: "fc-today-estimate", text: `About ${this.estimateMinutes(total)} min` });

		if (total > 0) {
			this.button(today, this.branch ? `Study ${deckLabel(this.branch)}` : "Study now", "play", () => this.nav.review(this.branch), "mod-cta fc-study");
		} else {
			today.createDiv({ cls: "fc-today-done", text: "Done for today. New cards arrive tomorrow." });
		}
	}

	private renderDecks(page: HTMLElement): void {
		const { collection } = this.ctx.repository;
		const { settings } = this.ctx;
		const now = Date.now();
		const collapsed = new Set(settings.collapsedDecks);
		const names = collection.deckNames().filter((name) => this.branch === null || isInDeck(name, this.branch));
		const roots = buildDeckTree(names);

		const list = page.createDiv({ cls: "fc-decks", attr: { role: "list" } });
		const head = list.createDiv({ cls: "fc-deck-row fc-deck-head", attr: { "aria-hidden": "true" } });
		head.createSpan({ cls: "fc-deck-name", text: "Deck" });
		const columns = head.createSpan({ cls: "fc-counts" });
		for (const label of ["New", "Learn", "Due"]) columns.createSpan({ cls: "fc-count", text: label });
		head.createSpan({ cls: "fc-deck-menu" });

		// buildDeckTree recreates the branch's parents; a filtered list shows the branch and below only.
		const nodes = flattenDeckTree(roots, collapsed).filter((node) => this.branch === null || isInDeck(node.name, this.branch));
		for (const node of nodes) this.renderDeckRow(list, node, collapsed, now);
	}

	private renderDeckRow(list: HTMLElement, node: DeckNode, collapsed: Set<string>, now: number): void {
		const { collection } = this.ctx.repository;
		const depth = this.branch ? node.depth - this.branch.split("::").length + 1 : node.depth;
		const row = list.createDiv({ cls: `fc-deck-row depth-${Math.min(depth, 3)}`, attr: { role: "listitem" } });
		const name = row.createDiv({ cls: "fc-deck-name" });
		name.style.setProperty("--fc-depth", String(Math.max(0, depth)));

		const toggle = name.createSpan({ cls: "fc-deck-toggle" });
		if (node.children.length > 0) {
			const isCollapsed = collapsed.has(node.name);
			setIcon(toggle, isCollapsed ? "chevron-right" : "chevron-down");
			toggle.setAttribute("role", "button");
			toggle.setAttribute("aria-label", isCollapsed ? `Expand ${node.label}` : `Collapse ${node.label}`);
			toggle.addEventListener("click", (event) => {
				event.stopPropagation();
				void this.toggleCollapsed(node.name);
			});
		}

		const label = name.createDiv({ cls: "fc-deck-label" });
		label.createDiv({ cls: "fc-deck-title", text: node.label });
		if (depth === 0) {
			const breakdown = cardBreakdown(collection, node.name);
			const learned = breakdown.young + breakdown.mature;
			label.createDiv({ cls: "fc-deck-note", text: `${learned} of ${breakdown.total} learned` });
		}

		renderCounts(row, deckCounts(collection, node.name, this.ctx.settings, now));

		const menuButton = row.createDiv({ cls: "fc-deck-menu clickable-icon", attr: { "aria-label": `Actions for ${node.label}` } });
		setIcon(menuButton, "more-horizontal");
		menuButton.addEventListener("click", (event) => {
			event.stopPropagation();
			this.openDeckMenu(event, node.name);
		});

		row.addEventListener("click", () => this.nav.review(node.name));
	}

	private renderFooter(page: HTMLElement): void {
		const { collection } = this.ctx.repository;
		const { settings } = this.ctx;
		const now = Date.now();
		const summary = reviewSummary(reviewEntries(collection, this.branch), now, settings.dayStartHour);

		const footer = page.createDiv({ cls: "fc-footer" });
		const history = footer.createDiv({ cls: "fc-footer-block fc-footer-history" });
		history.createDiv({ cls: "fc-footer-title", text: "Reviews, last 26 weeks" });
		renderHeatmap(history, summary.perDay, studyDayKey(now, settings.dayStartHour));

		const forecast = footer.createDiv({ cls: "fc-footer-block" });
		forecast.createDiv({ cls: "fc-footer-title", text: "Due next 7 days" });
		renderForecast(forecast, dueForecast(collection, this.branch, now, settings.dayStartHour, 7));

		const facts: string[] = [pluralize(summary.reviewsToday, "review") + " today"];
		if (summary.streak > 0) facts.push(`${summary.streak}-day streak`);
		if (summary.retention30d !== null) facts.push(`${Math.round(summary.retention30d * 100)}% recalled (30 days)`);
		page.createDiv({ cls: "fc-facts", text: facts.join(" · ") });
	}

	private renderPackages(page: HTMLElement): void {
		const details = page.createEl("details", { cls: "fc-packages" });
		const summary = details.createEl("summary");
		setIcon(summary.createSpan(), "chevron-right");
		summary.createSpan({ text: "Imported packages" });
		for (const pkg of this.ctx.repository.collection.allPackages()) this.renderPackageRow(details, pkg);
	}

	private renderPackageRow(parent: HTMLElement, pkg: LoadedPackage): void {
		const { collection } = this.ctx.repository;
		const row = parent.createDiv({ cls: "fc-package-row" });
		const info = row.createDiv({ cls: "fc-package-info" });
		info.createDiv({ cls: "fc-package-name", text: pkg.data.name });
		const cards = collection.cards().filter((ref) => ref.pkg === pkg);
		const studied = cards.filter((ref) => collection.progress(ref).memory).length;
		info.createDiv({
			cls: "fc-package-meta",
			text: `${pluralize(cards.length, "card")} · ${studied} studied · ${pkg.data.source} · imported ${new Date(pkg.data.importedAt).toLocaleDateString()}`,
		});
		this.iconButton(row, "trash-2", `Delete ${pkg.data.name}`, async () => {
			const ok = await confirm(this.ctx.app, "Delete package?", `This deletes "${pkg.data.name}" with its media and review history from ${pkg.folder}. It can't be undone.`);
			if (!ok) return;
			await this.ctx.repository.deletePackage(pkg.data.id);
			this.ctx.notifyDataChanged();
		});
	}

	/** Thumb-cut tabs on the page's right edge, one per branch, like a dictionary's letter tabs. */
	private renderThumbTabs(page: HTMLElement, branches: string[]): void {
		const tabs = page.createDiv({ cls: "fc-thumb-tabs", attr: { role: "tablist", "aria-label": "Deck branches" } });
		branches.forEach((branch, index) => {
			const active = this.branch === branch;
			const tab = tabs.createEl("button", {
				cls: `fc-thumb-tab pigment-${index % TAB_PIGMENTS}${active ? " is-active" : ""}`,
				text: tabLabel(deckLabel(branch)),
				attr: { role: "tab", "aria-selected": String(active), "aria-label": deckLabel(branch), title: deckLabel(branch) },
			});
			const due = deckCounts(this.ctx.repository.collection, branch, this.ctx.settings, Date.now());
			if (due.newCount + due.learnCount + due.reviewCount === 0) tab.addClass("is-idle");
			tab.addEventListener("click", () => {
				this.branch = active ? null : branch;
				this.onDataChanged();
			});
		});
	}

	// ── Helpers ──────────────────────────────────────────────────────────

	/** Branches for the thumb tabs: the top-level decks, or the levels under a single top-level deck. */
	private branches(): string[] {
		const roots = buildDeckTree(this.ctx.repository.collection.deckNames());
		const level = roots.length === 1 ? roots[0].children : roots;
		return level.map((node) => node.name);
	}

	private estimateMinutes(cards: number): number {
		const log = this.ctx.repository.collection.allPackages().flatMap((pkg) => pkg.progress.log.slice(-200));
		const durations = log.map((entry) => entry[4]).filter((ms) => ms > 0 && ms < 120_000);
		const seconds = durations.length >= 20 ? durations.reduce((a, b) => a + b, 0) / durations.length / 1000 : DEFAULT_SECONDS_PER_CARD;
		return Math.max(1, Math.round((cards * seconds) / 60));
	}

	private openDeckMenu(event: MouseEvent, deckName: string): void {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("Study").setIcon("play").onClick(() => this.nav.review(deckName)));
		menu.addItem((item) => item.setTitle("Browse cards").setIcon("search").onClick(() => this.nav.browse(deckName)));
		menu.addItem((item) =>
			item
				.setTitle("Daily limits…")
				.setIcon("sliders-horizontal")
				.onClick(() => new DeckOptionsModal(this.ctx.app, this.ctx.settings, deckName, () => this.saveAndRefresh()).open()),
		);
		menu.showAtMouseEvent(event);
	}

	private async toggleCollapsed(deckName: string): Promise<void> {
		const collapsed = new Set(this.ctx.settings.collapsedDecks);
		if (collapsed.has(deckName)) collapsed.delete(deckName);
		else collapsed.add(deckName);
		this.ctx.settings.collapsedDecks = [...collapsed];
		await this.ctx.saveSettings();
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const button = parent.createEl("button", { cls: "clickable-icon fc-icon-button", attr: { "aria-label": label } });
		setIcon(button, icon);
		button.addEventListener("click", onClick);
	}

	private button(parent: HTMLElement, text: string, icon: string, onClick: () => void, cls = ""): void {
		const button = parent.createEl("button", { cls });
		const iconEl = button.createSpan({ cls: "fc-button-icon" });
		setIcon(iconEl, icon);
		button.createSpan({ text });
		button.addEventListener("click", onClick);
	}

	private async saveAndRefresh(): Promise<void> {
		await this.ctx.saveSettings();
		this.ctx.notifyDataChanged();
	}
}

/** "HSK 1 (300 Words)" → "1"; otherwise the first two letters. */
export function tabLabel(label: string): string {
	const number = /\d+/.exec(label);
	if (number) return number[0];
	return [...label.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("") || "·";
}
