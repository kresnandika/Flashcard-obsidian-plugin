import { BRIDGE_MESSAGE_SOURCE } from "../../rendering/bridgeScript";

/** A key press forwarded from inside the card frame. */
export interface ForwardedKey {
	key: string;
	code: string;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
}

export interface CardFrameHandlers {
	onKey?(key: ForwardedKey): void;
	onSound?(index: number): void;
	onTyped?(value: string): void;
}

type BridgeMessage =
	| ({ type: "key" } & ForwardedKey)
	| { type: "sound"; index: number }
	| { type: "typed"; value: string }
	| { type: "storage"; key: string; value: string | null };

/**
 * Shows a card document in a sandboxed iframe. `allow-scripts` without
 * `allow-same-origin` lets deck templates run their JavaScript while keeping
 * them away from Obsidian, the vault and the plugin.
 */
export class CardFrame {
	readonly iframe: HTMLIFrameElement;
	/** Values deck scripts stored in sessionStorage, carried from front to back. */
	readonly storage: Record<string, string> = {};
	private token = "";
	private renderTicket = 0;
	private readonly onMessage = (event: MessageEvent) => this.handleMessage(event);

	constructor(
		parent: HTMLElement,
		private readonly handlers: CardFrameHandlers,
	) {
		this.iframe = parent.createEl("iframe", { cls: "fc-card-frame" });
		this.iframe.setAttribute("sandbox", "allow-scripts");
		this.iframe.setAttribute("title", "Flashcard");
		window.addEventListener("message", this.onMessage);
	}

	/** Starts a render; a later call makes earlier, still-loading renders stale. */
	beginRender(): number {
		return ++this.renderTicket;
	}

	isCurrentRender(ticket: number): boolean {
		return ticket === this.renderTicket;
	}

	/** Creates the per-document token the bridge script must echo back. */
	nextToken(): string {
		this.token = Math.random().toString(36).slice(2) + Date.now().toString(36);
		return this.token;
	}

	show(documentHtml: string, focus: boolean): void {
		this.iframe.srcdoc = documentHtml;
		if (focus) this.iframe.addEventListener("load", () => this.iframe.focus(), { once: true });
	}

	clearStorage(): void {
		for (const key of Object.keys(this.storage)) delete this.storage[key];
	}

	destroy(): void {
		window.removeEventListener("message", this.onMessage);
		this.iframe.remove();
	}

	private handleMessage(event: MessageEvent): void {
		if (event.source !== this.iframe.contentWindow) return;
		const data = event.data as (BridgeMessage & { source?: string; token?: string }) | null;
		if (!data || data.source !== BRIDGE_MESSAGE_SOURCE || data.token !== this.token) return;
		switch (data.type) {
			case "key":
				this.handlers.onKey?.(data);
				break;
			case "sound":
				this.handlers.onSound?.(data.index);
				break;
			case "typed":
				this.handlers.onTyped?.(data.value);
				break;
			case "storage":
				if (data.value === null) delete this.storage[data.key];
				else this.storage[data.key] = data.value;
				break;
		}
	}
}
