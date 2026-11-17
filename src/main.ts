import type { TAbstractFile} from "obsidian";
import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { readAnkiPackage } from "./anki/apkgReader";
import { loadSqlite } from "./anki/sqlite";
import { SQLITE_WASM } from "./anki/sqliteWasm";
import { CODE_BLOCK_LANGUAGE, RIBBON_ICON, VIEW_TYPE_FLASHCARDS } from "./constants";
import { createApi, type FlashcardsApi } from "./integrations/api";
import { renderCodeBlock } from "./integrations/codeBlock";
import { markDailyNote } from "./integrations/dailyNote";
import { deckCounts } from "./scheduling/queue";
import { Scheduler } from "./scheduling/Scheduler";
import { resolveSettings, type FlashcardsSettings } from "./settings/settings";
import { FlashcardsSettingTab } from "./settings/SettingsTab";
import { ObsidianFileSystem } from "./storage/ObsidianFileSystem";
import { PackageRepository, type ImportProgress, type ImportReport } from "./storage/PackageRepository";
import { AudioPlayer } from "./ui/components/AudioPlayer";
import type { PluginContext } from "./ui/context";
import { FlashcardsView } from "./ui/FlashcardsView";
import { DeckSuggestModal } from "./ui/modals/DeckSuggestModal";
import { ImportModal } from "./ui/modals/ImportModal";
import { debounce } from "./utils/debounce";
import { pluralize } from "./utils/strings";

const STATUS_BAR_REFRESH_MS = 60_000;

/** Wires the plugin together: storage, views, commands, settings and integrations. */
export default class FlashcardsPlugin extends Plugin implements PluginContext {
	declare settings: FlashcardsSettings;
	repository!: PackageRepository;
	readonly audio = new AudioPlayer();
	api!: FlashcardsApi;
	private cachedScheduler: Scheduler | null = null;
	private statusBarEl: HTMLElement | null = null;

	override async onload(): Promise<void> {
		this.settings = resolveSettings(await this.loadData());
		this.repository = new PackageRepository(new ObsidianFileSystem(this.app.vault.adapter), () => this.settings.dataFolder);
		this.api = createApi(
			() => this.repository.collection,
			() => this.settings,
			(deck) => void this.openView({ screen: "review", deck }),
		);

		this.registerView(VIEW_TYPE_FLASHCARDS, (leaf) => new FlashcardsView(leaf, this));
		this.addRibbonIcon(RIBBON_ICON, "Open flashcards", () => void this.openView({ screen: "home", deck: null }));
		this.addSettingTab(new FlashcardsSettingTab(this.app, this, this));
		this.registerCommands();
		this.registerMarkdownCodeBlockProcessor(CODE_BLOCK_LANGUAGE, (source, el) => renderCodeBlock(source, el, this.api));
		this.setupStatusBar();

		this.app.workspace.onLayoutReady(async () => {
			await this.reloadData();
			this.watchDataFolder();
		});
	}

	override onunload(): void {
		this.repository.flush();
		this.audio.stop();
	}

	// ── PluginContext ────────────────────────────────────────────────────

	scheduler(): Scheduler {
		this.cachedScheduler ??= new Scheduler(this.settings.scheduler);
		return this.cachedScheduler;
	}

	async saveSettings(): Promise<void> {
		this.cachedScheduler = null;
		await this.saveData(this.settings);
		this.notifyDataChanged();
	}

	notifyDataChanged(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_FLASHCARDS)) {
			if (leaf.view instanceof FlashcardsView) leaf.view.refresh();
		}
		this.refreshStatusBar();
	}

	async onSessionFinished(_deckName: string | null, answered: number): Promise<void> {
		if (answered === 0) return;
		try {
			if (await markDailyNote(this.app, this.settings)) new Notice(`Marked "${this.settings.dailyNote.property}" in today's note.`);
		} catch (error) {
			console.error("Flashcards: updating the daily note failed", error);
		}
	}

	openImport(): void {
		new ImportModal(this.app, (data, fileName, onProgress) => this.importAnkiPackage(data, fileName, onProgress)).open();
	}

	/** Imports an Anki package from its bytes. Also usable from scripts via the plugin instance. */
	async importAnkiPackage(data: ArrayBuffer | Uint8Array, fileName: string, onProgress: (progress: ImportProgress) => void = () => {}): Promise<ImportReport> {
		onProgress({ stage: "reading", done: 0, total: 1 });
		const parsed = await readAnkiPackage(data, fileName, await loadSqlite(SQLITE_WASM));
		const report = await this.repository.importPackage(parsed, fileName, onProgress);
		this.notifyDataChanged();
		return report;
	}

	async reloadData(): Promise<void> {
		const report = await this.repository.loadAll();
		for (const failure of report.failed) {
			console.error(`Flashcards: couldn't load ${failure.folder}`, failure.error);
			new Notice(`Flashcards couldn't load ${failure.folder}: ${failure.error}`);
		}
		this.notifyDataChanged();
	}

	// ── Setup ────────────────────────────────────────────────────────────

	private registerCommands(): void {
		this.addCommand({ id: "open", name: "Open deck list", callback: () => void this.openView({ screen: "home", deck: null }) });
		this.addCommand({ id: "study-all", name: "Study all decks", callback: () => void this.openView({ screen: "review", deck: null }) });
		this.addCommand({
			id: "study-deck",
			name: "Study deck…",
			callback: () => {
				const decks = this.repository.collection.deckNames().sort();
				if (decks.length === 0) return void new Notice("No decks yet. Import an Anki deck first.");
				new DeckSuggestModal(this.app, decks, (deck) => void this.openView({ screen: "review", deck })).open();
			},
		});
		this.addCommand({ id: "browse", name: "Browse cards", callback: () => void this.openView({ screen: "browse", deck: null }) });
		this.addCommand({ id: "import-apkg", name: "Import Anki deck (.apkg)", callback: () => this.openImport() });
		this.addCommand({ id: "reload", name: "Reload decks from disk", callback: () => void this.reloadData() });
	}

	/** Picks up changes synced from other devices without a restart. */
	private watchDataFolder(): void {
		const pending = new Set<string>();
		const process = debounce(async () => {
			const paths = [...pending];
			pending.clear();
			let changed = false;
			for (const path of paths) changed = (await this.repository.handleExternalChange(path)) || changed;
			if (changed) this.notifyDataChanged();
		}, 1000);
		const onChange = (file: TAbstractFile) => {
			if (!file.path.startsWith(this.settings.dataFolder + "/")) return;
			pending.add(file.path);
			process();
		};
		this.registerEvent(this.app.vault.on("modify", onChange));
		this.registerEvent(this.app.vault.on("create", onChange));
	}

	private setupStatusBar(): void {
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass("fc-status-bar", "mod-clickable");
		this.statusBarEl.addEventListener("click", () => void this.openView({ screen: "home", deck: null }));
		this.registerInterval(window.setInterval(() => this.refreshStatusBar(), STATUS_BAR_REFRESH_MS));
	}

	private refreshStatusBar(): void {
		const el = this.statusBarEl;
		if (!el) return;
		const hasDecks = this.repository.collection.allPackages().length > 0;
		el.toggle(this.settings.showStatusBar && hasDecks);
		if (!this.settings.showStatusBar || !hasDecks) return;
		const counts = deckCounts(this.repository.collection, null, this.settings, Date.now());
		const total = counts.newCount + counts.learnCount + counts.reviewCount;
		el.setText(total > 0 ? `🗂 ${total} due` : "🗂 done");
		el.setAttribute("aria-label", `Flashcards: ${pluralize(counts.newCount, "new card")}, ${counts.learnCount} learning, ${pluralize(counts.reviewCount, "review")}`);
	}

	private async openView(state: { screen: "home" | "review" | "browse"; deck: string | null }): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARDS)[0] ?? null;
		if (!leaf) leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_FLASHCARDS, active: true, state });
		await workspace.revealLeaf(leaf);
	}
}
