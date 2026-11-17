import { Menu, setIcon } from "obsidian";
import { deckLabel } from "../../domain/deckTree";
import { Grade, GRADES, type CardRef } from "../../domain/types";
import { renderBack, renderFront, usesBuiltinLayout, type RenderedSide } from "../../rendering/renderCard";
import { ReviewSession } from "../../scheduling/ReviewSession";
import { pluralize } from "../../utils/strings";
import { formatInterval } from "../../utils/time";
import { CardFrame, type ForwardedKey } from "../components/CardFrame";
import { presentSide, soundUrls } from "../components/cardPresenter";
import { renderCounts } from "../components/charts";
import type { PluginContext } from "../context";
import { EditNoteModal } from "../modals/EditNoteModal";
import { FieldRolesModal } from "../modals/FieldRolesModal";
import type { Navigator, Screen } from "./Screen";

const GRADE_LABELS: Record<Grade, string> = {
	[Grade.Again]: "Again",
	[Grade.Hard]: "Hard",
	[Grade.Good]: "Good",
	[Grade.Easy]: "Easy",
};

/**
 * Runs a study session: shows the front, reveals the back, records the
 * answer. Keyboard: Space/Enter reveal (then Good), 1–4 answer, R replay
 * audio, U or Ctrl/Cmd+Z undo, - bury, @ suspend, E edit, Esc leave.
 */
export class ReviewScreen implements Screen {
	private readonly session: ReviewSession;
	private frame: CardFrame | null = null;
	private countsEl: HTMLElement | null = null;
	private progressEl: HTMLElement | null = null;
	private barEl: HTMLElement | null = null;
	private bodyEl: HTMLElement | null = null;
	private card: CardRef | null = null;
	private side: "front" | "back" = "front";
	private rendered: RenderedSide | null = null;
	private typedAnswer = "";
	private shownAt = 0;
	private waitTimer: number | null = null;
	private finishedReported = false;

	constructor(
		private readonly ctx: PluginContext,
		private readonly nav: Navigator,
		deckName: string | null,
	) {
		this.session = new ReviewSession(ctx.repository.collection, ctx.scheduler(), ctx.settings, deckName, (packageIds) => {
			packageIds.forEach((id) => ctx.repository.scheduleProgressSave(id));
			ctx.notifyDataChanged();
		});
	}

	render(container: HTMLElement): void {
		container.empty();
		container.addClass("fc-review");

		const top = container.createDiv({ cls: "fc-review-top" });
		const back = top.createEl("button", { cls: "clickable-icon fc-icon-button", attr: { "aria-label": "Back to decks (Esc)" } });
		setIcon(back, "arrow-left");
		back.addEventListener("click", () => this.leave());
		top.createDiv({ cls: "fc-review-deck", text: this.session.deckName ? deckLabel(this.session.deckName) : "All decks" });
		this.countsEl = top.createDiv({ cls: "fc-review-counts" });
		const more = top.createEl("button", { cls: "clickable-icon fc-icon-button", attr: { "aria-label": "More actions" } });
		setIcon(more, "more-vertical");
		more.addEventListener("click", (event) => this.openMenu(event));
		const progress = container.createDiv({ cls: "fc-review-progress", attr: { role: "progressbar", "aria-label": "Session progress" } });
		this.progressEl = progress.createDiv({ cls: "fc-review-progress-fill" });

		this.bodyEl = container.createDiv({ cls: "fc-review-body" });
		this.frame = new CardFrame(this.bodyEl, {
			onKey: (key) => this.handleKey(key),
			onSound: (index) => this.playSound(index),
			onTyped: (value) => (this.typedAnswer = value),
		});
		this.barEl = container.createDiv({ cls: "fc-review-bar" });
		this.advance();
	}

	/** Only refresh counts: re-rendering mid-card would lose what the user typed. */
	onDataChanged(): void {
		this.renderCounts();
	}

	destroy(): void {
		this.clearWaitTimer();
		this.ctx.audio.stop();
		this.frame?.destroy();
		this.ctx.repository.flush();
	}

	handleKey(key: ForwardedKey): boolean {
		const mod = key.ctrlKey || key.metaKey;
		if (key.key === "Escape") return this.leave(), true;
		if (mod && key.key.toLowerCase() === "z") return this.undo(), true;
		if (mod || key.altKey) return false;

		switch (key.key) {
			case " ":
			case "Enter":
				if (this.side === "front") this.reveal();
				else this.answer(Grade.Good);
				return true;
			case "1":
			case "2":
			case "3":
			case "4":
				if (this.side === "back") this.answer(Number(key.key) as Grade);
				return true;
			case "r":
			case "R":
				this.replay();
				return true;
			case "u":
			case "U":
				this.undo();
				return true;
			case "-":
				this.session.buryCurrent();
				this.advance();
				return true;
			case "@":
				this.session.suspendCurrent();
				this.advance();
				return true;
			case "e":
			case "E":
				this.editCurrent();
				return true;
			default:
				return false;
		}
	}

	private advance(): void {
		this.clearWaitTimer();
		this.ctx.audio.stop();
		this.card = this.session.next();
		this.renderCounts();
		if (!this.card) {
			this.renderFinished();
			return;
		}
		this.frame?.clearStorage();
		this.typedAnswer = "";
		this.showSide("front");
	}

	private showSide(side: "front" | "back"): void {
		const card = this.card;
		if (!card || !this.frame) return;
		this.side = side;
		this.frame.iframe.show();
		this.rendered = side === "front" ? renderFront(card, this.ctx.settings) : renderBack(card, this.typedAnswer, this.ctx.settings);
		this.bodyEl?.toggleClass("is-deck-design", !this.rendered.builtin);
		void presentSide(this.frame, this.ctx.media, card, this.rendered, {
			followTheme: this.ctx.settings.followObsidianTheme,
			runDeckScripts: this.ctx.settings.runDeckScripts,
		});
		if (side === "front") {
			this.shownAt = Date.now();
			this.ctx.media.prefetch(card.pkg, renderBack(card, "", this.ctx.settings).html);
		}
		if (this.ctx.settings.autoplayAudio) this.ctx.audio.play(soundUrls(this.ctx.repository, card, this.rendered.autoplay));
		this.renderBar();
	}

	private reveal(): void {
		if (this.card && this.side === "front") this.showSide("back");
	}

	private answer(grade: Grade): void {
		if (!this.card || this.side !== "back") return;
		this.session.answer(grade, Date.now() - this.shownAt);
		this.advance();
	}

	private undo(): void {
		if (!this.session.canUndo) return;
		this.clearWaitTimer();
		this.ctx.audio.stop();
		this.finishedReported = false;
		this.card = this.session.undo();
		this.renderCounts();
		if (this.card) {
			this.frame?.clearStorage();
			this.typedAnswer = "";
			this.showSide("front");
		}
	}

	private replay(): void {
		if (this.card && this.rendered) this.ctx.audio.play(soundUrls(this.ctx.repository, this.card, this.rendered.sounds));
	}

	private playSound(index: number): void {
		const name = this.rendered?.sounds[index];
		if (this.card && name) this.ctx.audio.play(soundUrls(this.ctx.repository, this.card, [name]));
	}

	private editCurrent(): void {
		const card = this.card;
		if (!card) return;
		new EditNoteModal(this.ctx.app, card, async () => {
			await this.ctx.repository.savePackage(card.pkg);
			this.showSide(this.side);
		}).open();
	}

	private renderCounts(): void {
		if (!this.countsEl) return;
		this.countsEl.empty();
		const counts = this.session.counts();
		renderCounts(this.countsEl, counts);
		if (this.progressEl) {
			const remaining = counts.newCount + counts.learnCount + counts.reviewCount;
			const done = this.session.answered;
			const share = done + remaining === 0 ? 1 : done / (done + remaining);
			this.progressEl.style.width = `${Math.round(share * 100)}%`;
			this.progressEl.parentElement?.setAttribute("aria-valuenow", String(Math.round(share * 100)));
		}
	}

	private renderBar(): void {
		const bar = this.barEl;
		if (!bar) return;
		bar.empty();
		bar.toggleClass("is-answering", this.side === "back");
		if (this.side === "front") {
			const show = bar.createEl("button", { cls: "fc-show-answer" });
			show.createSpan({ cls: "fc-show-answer-label", text: "Show answer" });
			show.createEl("kbd", { cls: "fc-key-hint", text: "Space" });
			show.addEventListener("click", () => this.reveal());
			return;
		}
		const preview = this.session.preview();
		for (const grade of GRADES) {
			const name = GRADE_LABELS[grade];
			const button = bar.createEl("button", { cls: `fc-grade fc-grade-${name.toLowerCase()}`, attr: { "aria-label": `${name} (${grade})` } });
			const interval = this.ctx.settings.showIntervalsOnButtons && preview ? formatInterval(preview[grade].intervalMs) : "";
			button.createSpan({ cls: "fc-grade-interval", text: interval });
			button.createSpan({ cls: "fc-grade-label", text: name });
			button.createEl("kbd", { cls: "fc-key-hint", text: String(grade) });
			button.addEventListener("click", () => this.answer(grade));
		}
	}

	private renderFinished(): void {
		this.frame?.iframe.hide();
		this.barEl?.empty();
		const body = this.bodyEl;
		if (!body) return;
		body.querySelector(".fc-finished")?.remove();
		const done = body.createDiv({ cls: "fc-finished" });

		const nextDue = this.session.nextLearningDue();
		if (nextDue !== null) {
			done.createEl("h3", { cls: "fc-finished-title", text: "Nothing due right now" });
			done.createEl("p", { text: `The next learning card is ready at ${new Date(nextDue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Stay here and it'll appear.` });
			this.waitTimer = window.setTimeout(() => {
				done.remove();
				this.advance();
			}, Math.max(1000, nextDue - Date.now() - this.ctx.settings.learnAheadMinutes * 60_000 + 500));
		} else {
			done.createEl("h3", { cls: "fc-finished-title", text: "That's today's range" });
			done.createEl("p", { text: this.session.answered > 0 ? `${pluralize(this.session.answered, "card")} reviewed. This deck is done until tomorrow.` : "Nothing left in this deck today. New cards arrive tomorrow." });
			if (!this.finishedReported) {
				this.finishedReported = true;
				void this.ctx.onSessionFinished(this.session.deckName, this.session.answered);
			}
		}
		const actions = done.createDiv({ cls: "fc-finished-actions" });
		actions.createEl("button", { cls: "mod-cta", text: "Back to decks" }).addEventListener("click", () => this.leave());
		if (this.session.canUndo) actions.createEl("button", { text: "Undo last answer" }).addEventListener("click", () => {
			done.remove();
			this.undo();
		});
	}

	private openMenu(event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("Undo (U)").setIcon("undo-2").setDisabled(!this.session.canUndo).onClick(() => this.undo()));
		menu.addItem((item) => item.setTitle("Replay audio (R)").setIcon("volume-2").setDisabled(!this.card).onClick(() => this.replay()));
		menu.addItem((item) => item.setTitle("Edit note (E)").setIcon("pencil").setDisabled(!this.card).onClick(() => this.editCurrent()));
		const card = this.card;
		if (card) {
			menu.addSeparator();
			const builtin = usesBuiltinLayout(card, this.ctx.settings);
			menu.addItem((item) =>
				item
					.setTitle(builtin ? "Use the deck's own design" : "Use the Flashcards layout")
					.setIcon("layout-template")
					.onClick(() => void this.setNoteTypeStyle(card, builtin ? "deck" : "flashcards")),
			);
			menu.addItem((item) =>
				item
					.setTitle("Card fields…")
					.setIcon("list")
					.onClick(() => new FieldRolesModal(this.ctx.app, this.ctx.settings, card, async () => {
						await this.ctx.saveSettings();
						this.showSide(this.side);
					}).open()),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item.setTitle("Bury card until tomorrow (-)").setIcon("eye-off").setDisabled(!this.card).onClick(() => {
				this.session.buryCurrent();
				this.advance();
			}),
		);
		menu.addItem((item) =>
			item.setTitle("Suspend card (@)").setIcon("pause").setDisabled(!this.card).onClick(() => {
				this.session.suspendCurrent();
				this.advance();
			}),
		);
		menu.showAtMouseEvent(event);
	}

	private async setNoteTypeStyle(card: CardRef, style: "deck" | "flashcards"): Promise<void> {
		const layouts = this.ctx.settings.noteTypeLayouts;
		layouts[card.noteType.id] = { ...layouts[card.noteType.id], style };
		await this.ctx.saveSettings();
		this.showSide(this.side);
	}

	private leave(): void {
		this.ctx.repository.flush();
		this.nav.home();
	}

	private clearWaitTimer(): void {
		if (this.waitTimer !== null) window.clearTimeout(this.waitTimer);
		this.waitTimer = null;
	}
}
