import { setIcon } from "obsidian";
import { buildDeckTree, flattenDeckTree } from "../../domain/deckTree";
import { CardState, type CardRef } from "../../domain/types";
import { renderBack, renderFront } from "../../rendering/renderCard";
import { stripHtml } from "../../utils/strings";
import { formatInterval } from "../../utils/time";
import { CardFrame } from "../components/CardFrame";
import { headword } from "../components/guideWords";
import { presentSide, soundUrls } from "../components/cardPresenter";
import type { PluginContext } from "../context";
import { confirm } from "../modals/ConfirmModal";
import { EditNoteModal } from "../modals/EditNoteModal";
import type { Navigator, Screen } from "./Screen";

type StateFilter = "all" | "new" | "learning" | "review" | "suspended";

const PAGE_SIZE = 200;
const STATE_NAMES: Record<CardState, string> = {
	[CardState.New]: "New",
	[CardState.Learning]: "Learning",
	[CardState.Review]: "Review",
	[CardState.Relearning]: "Relearning",
};

/** Search, preview and manage cards: edit, suspend, forget. */
export class BrowseScreen implements Screen {
	private query = "";
	private stateFilter: StateFilter = "all";
	private limit = PAGE_SIZE;
	private selectedKey: string | null = null;
	private previewSide: "front" | "back" = "front";
	private listEl: HTMLElement | null = null;
	private detailEl: HTMLElement | null = null;
	private frame: CardFrame | null = null;

	constructor(
		private readonly ctx: PluginContext,
		private readonly nav: Navigator,
		private deckName: string | null,
	) {}

	render(container: HTMLElement): void {
		container.empty();
		container.addClass("fc-browse");
		this.renderToolbar(container);
		const body = container.createDiv({ cls: "fc-browse-body" });
		this.listEl = body.createDiv({ cls: "fc-browse-list" });
		this.detailEl = body.createDiv({ cls: "fc-browse-detail" });
		this.renderList();
		this.renderDetail();
	}

	onDataChanged(): void {
		this.renderList();
	}

	destroy(): void {
		this.frame?.destroy();
		this.ctx.audio.stop();
	}

	private renderToolbar(parent: HTMLElement): void {
		const bar = parent.createDiv({ cls: "fc-browse-toolbar" });
		const back = bar.createEl("button", { cls: "clickable-icon fc-icon-button", attr: { "aria-label": "Back to decks" } });
		setIcon(back, "arrow-left");
		back.addEventListener("click", () => this.nav.home());

		const search = bar.createEl("input", { cls: "fc-browse-search", attr: { type: "search", placeholder: "Search fields and tags…" } });
		search.value = this.query;
		search.addEventListener("input", () => {
			this.query = search.value;
			this.limit = PAGE_SIZE;
			this.renderList();
		});

		const deckSelect = bar.createEl("select", { cls: "dropdown" });
		deckSelect.createEl("option", { text: "All decks", value: "" });
		for (const node of flattenDeckTree(buildDeckTree(this.ctx.repository.collection.deckNames()))) {
			deckSelect.createEl("option", { text: `${"  ".repeat(node.depth)}${node.label}`, value: node.name });
		}
		deckSelect.value = this.deckName ?? "";
		deckSelect.addEventListener("change", () => {
			this.deckName = deckSelect.value || null;
			this.limit = PAGE_SIZE;
			this.renderList();
		});

		const stateSelect = bar.createEl("select", { cls: "dropdown" });
		for (const [value, label] of [["all", "Any state"], ["new", "New"], ["learning", "Learning"], ["review", "Review"], ["suspended", "Suspended"]] as const) {
			stateSelect.createEl("option", { text: label, value });
		}
		stateSelect.value = this.stateFilter;
		stateSelect.addEventListener("change", () => {
			this.stateFilter = stateSelect.value as StateFilter;
			this.limit = PAGE_SIZE;
			this.renderList();
		});
	}

	private filteredCards(): CardRef[] {
		const { collection } = this.ctx.repository;
		const terms = this.query.toLowerCase().split(/\s+/).filter(Boolean);
		return collection.cardsInDeck(this.deckName).filter((ref) => {
			const progress = collection.progress(ref);
			const state = progress.memory?.state ?? CardState.New;
			const stateMatches =
				this.stateFilter === "all" ||
				(this.stateFilter === "suspended" && progress.suspended) ||
				(this.stateFilter === "new" && state === CardState.New) ||
				(this.stateFilter === "learning" && (state === CardState.Learning || state === CardState.Relearning)) ||
				(this.stateFilter === "review" && state === CardState.Review);
			if (!stateMatches) return false;
			if (terms.length === 0) return true;
			const haystack = `${stripHtml(ref.note.fields.join(" "))} ${ref.note.tags.join(" ")}`.toLowerCase();
			return terms.every((term) => haystack.includes(term));
		});
	}

	private renderList(): void {
		const list = this.listEl;
		if (!list) return;
		list.empty();
		const cards = this.filteredCards();
		const count = list.createDiv({ cls: "fc-browse-count", text: `${cards.length} cards` });
		if (cards.length > 1) {
			const first = headword(cards[0]);
			const last = headword(cards[cards.length - 1]);
			count.createSpan({ cls: "fc-browse-guide", text: ` · ${first.text} — ${last.text}` });
		}

		const { collection } = this.ctx.repository;
		for (const ref of cards.slice(0, this.limit)) {
			const row = list.createDiv({ cls: "fc-browse-row" });
			if (ref.key === this.selectedKey) row.addClass("is-selected");
			const progress = collection.progress(ref);
			if (progress.suspended) row.addClass("is-suspended");
			const word = headword(ref);
			const title = row.createDiv({ cls: "fc-browse-title" });
			title.createSpan({ cls: "fc-headword-text", text: word.text });
			if (word.reading) title.createSpan({ cls: "fc-headword-reading", text: word.reading });
			const deck = ref.deckName.split("::").pop() ?? "";
			const where = deck.toLowerCase().startsWith(ref.template.name.toLowerCase()) ? deck : `${ref.template.name} · ${deck}`;
			row.createDiv({ cls: "fc-browse-sub", text: `${where} · ${this.dueText(ref)}` });
			row.addEventListener("click", () => {
				this.selectedKey = ref.key;
				this.previewSide = "front";
				list.querySelectorAll(".is-selected").forEach((el) => el.removeClass("is-selected"));
				row.addClass("is-selected");
				this.renderDetail();
			});
		}
		if (cards.length > this.limit) {
			list.createEl("button", { cls: "fc-browse-more", text: `Show ${Math.min(PAGE_SIZE, cards.length - this.limit)} more` }).addEventListener("click", () => {
				this.limit += PAGE_SIZE;
				this.renderList();
			});
		}
	}

	private renderDetail(): void {
		const detail = this.detailEl;
		if (!detail) return;
		this.frame?.destroy();
		this.frame = null;
		detail.empty();

		const ref = this.selectedKey ? this.ctx.repository.collection.card(this.selectedKey) : undefined;
		if (!ref) {
			detail.createDiv({ cls: "fc-browse-placeholder", text: "Select a card to preview it." });
			return;
		}

		const tabs = detail.createDiv({ cls: "fc-browse-tabs" });
		for (const side of ["front", "back"] as const) {
			const active = side === this.previewSide;
			const tab = tabs.createEl("button", { text: side === "front" ? "Front" : "Back", attr: { "aria-pressed": String(active) } });
			if (active) tab.addClass("is-active");
			tab.addEventListener("click", () => {
				this.previewSide = side;
				this.renderDetail();
			});
		}

		const preview = detail.createDiv({ cls: "fc-browse-preview" });
		const rendered = this.previewSide === "front" ? renderFront(ref, this.ctx.settings) : renderBack(ref, "", this.ctx.settings);
		this.frame = new CardFrame(preview, {
			onSound: (index) => {
				const name = rendered.sounds[index];
				if (name) this.ctx.audio.play(soundUrls(this.ctx.repository, ref, [name]));
			},
		});
		void presentSide(this.frame, this.ctx.media, ref, rendered, {
			followTheme: this.ctx.settings.followObsidianTheme,
			runDeckScripts: this.ctx.settings.runDeckScripts,
		});

		this.renderInfo(detail, ref);
		this.renderActions(detail, ref);
	}

	private renderInfo(parent: HTMLElement, ref: CardRef): void {
		const { collection } = this.ctx.repository;
		const { memory, suspended } = collection.progress(ref);
		const info = parent.createDiv({ cls: "fc-browse-info" });
		const add = (label: string, value: string) => {
			info.createSpan({ cls: "fc-browse-info-label", text: label });
			info.createSpan({ text: value });
		};
		add("Deck", ref.deckName.split("::").join(" › "));
		add("Card", `${ref.noteType.name} · ${ref.template.name}`);
		add("State", suspended ? "Suspended" : STATE_NAMES[memory?.state ?? CardState.New]);
		if (memory) {
			add("Due", `${new Date(memory.due).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} (${this.dueText(ref)})`);
			add("Interval", memory.scheduledDays > 0 ? `${memory.scheduledDays} days` : "–");
			add("Reviews", `${memory.reps} (${memory.lapses} lapses)`);
			add("Stability", `${memory.stability.toFixed(1)} days`);
			add("Difficulty", `${memory.difficulty.toFixed(1)} / 10`);
			add("Recall now", `${Math.round(this.ctx.scheduler().retrievability(memory, Date.now()) * 100)}%`);
		}
		if (ref.note.tags.length > 0) add("Tags", ref.note.tags.join(" "));
	}

	private renderActions(parent: HTMLElement, ref: CardRef): void {
		const { repository } = this.ctx;
		const { collection } = repository;
		const actions = parent.createDiv({ cls: "fc-browse-actions" });
		const progress = collection.progress(ref);

		actions.createEl("button", { text: "Edit note" }).addEventListener("click", () =>
			new EditNoteModal(this.ctx.app, ref, async () => {
				await repository.savePackage(ref.pkg);
				this.ctx.notifyDataChanged();
				this.renderDetail();
			}).open(),
		);
		actions.createEl("button", { text: progress.suspended ? "Unsuspend" : "Suspend" }).addEventListener("click", () => {
			collection.setProgress(ref, { ...progress, suspended: !progress.suspended });
			this.saveProgress(ref);
		});
		if (progress.memory || progress.buriedOn) {
			actions.createEl("button", { cls: "mod-warning", text: "Forget" }).addEventListener("click", async () => {
				const ok = await confirm(this.ctx.app, "Forget this card?", "It becomes a new card again. Its review history stays in the log.", "Forget");
				if (!ok) return;
				collection.setProgress(ref, { suspended: progress.suspended });
				this.saveProgress(ref);
			});
		}
	}

	private saveProgress(ref: CardRef): void {
		this.ctx.repository.scheduleProgressSave(ref.pkg.data.id);
		this.ctx.notifyDataChanged();
		this.renderDetail();
	}

	private dueText(ref: CardRef): string {
		const { memory, suspended } = this.ctx.repository.collection.progress(ref);
		if (suspended) return "suspended";
		if (!memory) return "new";
		const ms = memory.due - Date.now();
		return ms <= 0 ? "due" : `due in ${formatInterval(ms)}`;
	}
}
