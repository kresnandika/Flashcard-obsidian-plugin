import { Menu, setIcon } from "obsidian";
import { buildDeckTree, flattenDeckTree, type DeckNode } from "../../domain/deckTree";
import type { LoadedPackage } from "../../domain/types";
import { deckCounts } from "../../scheduling/queue";
import { dueForecast, reviewEntries, reviewSummary } from "../../stats/statistics";
import { pluralize } from "../../utils/strings";
import { studyDayKey } from "../../utils/time";
import { renderCounts, renderForecast, renderHeatmap, renderStat } from "../components/charts";
import type { PluginContext } from "../context";
import { confirm } from "../modals/ConfirmModal";
import { DeckOptionsModal } from "../modals/DeckOptionsModal";
import type { Navigator, Screen } from "./Screen";

/** The deck list with today's counts, overall stats and the imported packages. */
export class HomeScreen implements Screen {
	private container: HTMLElement | null = null;

	constructor(
		private readonly ctx: PluginContext,
		private readonly nav: Navigator,
	) {}

	render(container: HTMLElement): void {
		this.container = container;
		container.empty();
		container.addClass("fc-home");

		this.renderHeader(container);
		const collection = this.ctx.repository.collection;
		if (collection.allPackages().length === 0) {
			this.renderEmpty(container);
			return;
		}
		this.renderSummary(container);
		this.renderDecks(container);
		this.renderActivity(container);
		this.renderPackages(container);
	}

	onDataChanged(): void {
		if (this.container) this.render(this.container);
	}

	private renderHeader(parent: HTMLElement): void {
		const header = parent.createDiv({ cls: "fc-header" });
		header.createEl("h2", { text: "Flashcards" });
		const actions = header.createDiv({ cls: "fc-header-actions" });
		this.iconButton(actions, "search", "Browse cards", () => this.nav.browse(null));
		this.iconButton(actions, "download", "Import Anki deck", () => this.ctx.openImport());
	}

	private renderEmpty(parent: HTMLElement): void {
		const empty = parent.createDiv({ cls: "fc-empty" });
		empty.createEl("p", { text: "No decks yet. Import an Anki deck (.apkg) to start; its templates, audio and images come with it." });
		empty.createEl("button", { cls: "mod-cta", text: "Import Anki deck" }).addEventListener("click", () => this.ctx.openImport());
	}

	private renderSummary(parent: HTMLElement): void {
		const { collection } = this.ctx.repository;
		const { settings } = this.ctx;
		const now = Date.now();
		const due = deckCounts(collection, null, settings, now);
		const summary = reviewSummary(reviewEntries(collection, null), now, settings.dayStartHour);

		const strip = parent.createDiv({ cls: "fc-stats" });
		renderStat(strip, "due today", String(due.newCount + due.learnCount + due.reviewCount), `${due.newCount} new · ${due.learnCount} learning · ${due.reviewCount} to review`);
		renderStat(strip, "reviewed today", String(summary.reviewsToday), `${summary.minutesToday} min`);
		renderStat(strip, "day streak", String(summary.streak));
		renderStat(strip, "retention (30d)", summary.retention30d === null ? "–" : `${Math.round(summary.retention30d * 100)}%`, "Review answers that weren't Again");
	}

	private renderDecks(parent: HTMLElement): void {
		const { collection } = this.ctx.repository;
		const { settings } = this.ctx;
		const now = Date.now();
		const collapsed = new Set(settings.collapsedDecks);

		const table = parent.createDiv({ cls: "fc-decks" });
		const head = table.createDiv({ cls: "fc-deck-row fc-deck-head" });
		head.createSpan({ cls: "fc-deck-name", text: "Deck" });
		head.createSpan({ cls: "fc-counts" }).append(createSpan({ text: "New" }), createSpan({ text: "Learn" }), createSpan({ text: "Due" }));
		head.createSpan({ cls: "fc-deck-menu" });

		for (const node of flattenDeckTree(buildDeckTree(collection.deckNames()), collapsed)) {
			this.renderDeckRow(table, node, collapsed, now);
		}
	}

	private renderDeckRow(table: HTMLElement, node: DeckNode, collapsed: Set<string>, now: number): void {
		const { collection } = this.ctx.repository;
		const row = table.createDiv({ cls: "fc-deck-row" });
		const name = row.createDiv({ cls: "fc-deck-name" });
		name.style.paddingLeft = `${node.depth * 18}px`;

		const toggle = name.createSpan({ cls: "fc-deck-toggle" });
		if (node.children.length > 0) {
			setIcon(toggle, collapsed.has(node.name) ? "chevron-right" : "chevron-down");
			toggle.addEventListener("click", async (event) => {
				event.stopPropagation();
				if (collapsed.has(node.name)) collapsed.delete(node.name);
				else collapsed.add(node.name);
				this.ctx.settings.collapsedDecks = [...collapsed];
				await this.ctx.saveSettings();
				this.onDataChanged();
			});
		}
		const link = name.createEl("a", { cls: "fc-deck-link", text: node.label, attr: { "aria-label": `Study ${node.name}` } });
		link.addEventListener("click", () => this.nav.review(node.name));

		renderCounts(row, deckCounts(collection, node.name, this.ctx.settings, now));

		const menuButton = row.createDiv({ cls: "fc-deck-menu clickable-icon", attr: { "aria-label": "Deck actions" } });
		setIcon(menuButton, "more-horizontal");
		menuButton.addEventListener("click", (event) => this.openDeckMenu(event, node.name));
	}

	private openDeckMenu(event: MouseEvent, deckName: string): void {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("Study").setIcon("play").onClick(() => this.nav.review(deckName)));
		menu.addItem((item) => item.setTitle("Browse cards").setIcon("search").onClick(() => this.nav.browse(deckName)));
		menu.addItem((item) =>
			item
				.setTitle("Options")
				.setIcon("settings")
				.onClick(() => new DeckOptionsModal(this.ctx.app, this.ctx.settings, deckName, () => this.saveAndRefresh()).open()),
		);
		menu.showAtMouseEvent(event);
	}

	private renderActivity(parent: HTMLElement): void {
		const { collection } = this.ctx.repository;
		const { settings } = this.ctx;
		const now = Date.now();
		const summary = reviewSummary(reviewEntries(collection, null), now, settings.dayStartHour);

		const section = parent.createDiv({ cls: "fc-activity" });
		const heat = section.createDiv({ cls: "fc-panel" });
		heat.createDiv({ cls: "fc-panel-title", text: "Reviews" });
		renderHeatmap(heat, summary.perDay, studyDayKey(now, settings.dayStartHour));

		const forecast = section.createDiv({ cls: "fc-panel" });
		forecast.createDiv({ cls: "fc-panel-title", text: "Due in the next 7 days" });
		renderForecast(forecast, dueForecast(collection, null, now, settings.dayStartHour, 7));
	}

	private renderPackages(parent: HTMLElement): void {
		const details = parent.createEl("details", { cls: "fc-packages" });
		details.createEl("summary", { text: "Imported packages" });
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
			text: `${pluralize(cards.length, "card")} · ${studied} studied · from ${pkg.data.source} · ${new Date(pkg.data.importedAt).toLocaleDateString()}`,
		});

		const remove = row.createDiv({ cls: "clickable-icon", attr: { "aria-label": "Delete package" } });
		setIcon(remove, "trash-2");
		remove.addEventListener("click", async () => {
			const ok = await confirm(
				this.ctx.app,
				"Delete package?",
				`This deletes "${pkg.data.name}" with its media and review history from ${pkg.folder}. It can't be undone.`,
			);
			if (!ok) return;
			await this.ctx.repository.deletePackage(pkg.data.id);
			this.ctx.notifyDataChanged();
		});
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const button = parent.createDiv({ cls: "clickable-icon", attr: { "aria-label": label } });
		setIcon(button, icon);
		button.addEventListener("click", onClick);
	}

	private async saveAndRefresh(): Promise<void> {
		await this.ctx.saveSettings();
		this.ctx.notifyDataChanged();
	}
}
