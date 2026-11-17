import type { App } from "obsidian";
import type { Scheduler } from "../scheduling/Scheduler";
import type { FlashcardsSettings } from "../settings/settings";
import type { PackageRepository } from "../storage/PackageRepository";
import type { AudioPlayer } from "./components/AudioPlayer";
import type { MediaInliner } from "./components/MediaInliner";

/**
 * Everything the views need from the plugin. Views depend on this interface
 * rather than on the plugin class, which keeps them decoupled and testable.
 */
export interface PluginContext {
	readonly app: App;
	readonly settings: FlashcardsSettings;
	readonly repository: PackageRepository;
	readonly audio: AudioPlayer;
	readonly media: MediaInliner;
	scheduler(): Scheduler;
	saveSettings(): Promise<void>;
	/** Re-renders every open view and the status bar after data changed. */
	notifyDataChanged(): void;
	/** Called when a study session runs out of cards. */
	onSessionFinished(deckName: string | null, answered: number): Promise<void>;
	openImport(): void;
}
