import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { RIBBON_ICON, VIEW_TYPE_FLASHCARDS } from "../constants";
import type { ForwardedKey } from "./components/CardFrame";
import type { PluginContext } from "./context";
import { BrowseScreen } from "./screens/BrowseScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import type { Navigator, Screen } from "./screens/Screen";

interface ViewState {
	screen: "home" | "review" | "browse";
	deck: string | null;
}

/**
 * The plugin's tab. It hosts one screen at a time (deck list, review or
 * browser) and routes keyboard input to it.
 */
export class FlashcardsView extends ItemView implements Navigator {
	private screen: Screen | null = null;
	private state: ViewState = { screen: "home", deck: null };
	private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);

	constructor(
		leaf: WorkspaceLeaf,
		private readonly ctx: PluginContext,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_FLASHCARDS;
	}

	override getDisplayText(): string {
		return "Flashcards";
	}

	override getIcon(): string {
		return RIBBON_ICON;
	}

	override async onOpen(): Promise<void> {
		this.contentEl.addClass("fc-view");
		this.contentEl.tabIndex = -1;
		this.contentEl.addEventListener("keydown", this.onKeyDown);
		this.show(this.state);
	}

	override async onClose(): Promise<void> {
		this.contentEl.removeEventListener("keydown", this.onKeyDown);
		this.screen?.destroy?.();
		this.screen = null;
	}

	override getState(): Record<string, unknown> {
		// Reopen on the deck list after a restart, never mid-review.
		return { screen: this.state.screen === "review" ? "home" : this.state.screen, deck: this.state.deck };
	}

	override async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const next = state as Partial<ViewState> | null;
		if (next?.screen) this.show({ screen: next.screen, deck: next.deck ?? null });
		await super.setState(state, result);
	}

	home(): void {
		this.show({ screen: "home", deck: null });
	}

	review(deckName: string | null): void {
		this.show({ screen: "review", deck: deckName });
	}

	browse(deckName: string | null): void {
		this.show({ screen: "browse", deck: deckName });
	}

	/** Called by the plugin whenever packages or progress change. */
	refresh(): void {
		this.screen?.onDataChanged?.();
	}

	private show(state: ViewState): void {
		this.screen?.destroy?.();
		this.state = state;
		this.contentEl.empty();
		this.contentEl.className = "view-content fc-view";
		const container = this.contentEl.createDiv({ cls: "fc-screen" });
		this.screen = this.createScreen(state);
		this.screen.render(container);
		this.contentEl.focus();
	}

	private createScreen(state: ViewState): Screen {
		switch (state.screen) {
			case "review":
				return new ReviewScreen(this.ctx, this, state.deck);
			case "browse":
				return new BrowseScreen(this.ctx, this, state.deck);
			case "home":
				return new HomeScreen(this.ctx, this);
		}
	}

	private handleKeyDown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
		const key: ForwardedKey = {
			key: event.key,
			code: event.code,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			shiftKey: event.shiftKey,
			altKey: event.altKey,
		};
		if (this.screen?.handleKey?.(key)) {
			event.preventDefault();
			event.stopPropagation();
		}
	}
}
