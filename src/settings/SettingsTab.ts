import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import { DEFAULT_SETTINGS, parseSteps, type FlashcardsSettings, type NewCardGather, type NewCardMix } from "./settings";

export interface SettingsHost {
	readonly settings: FlashcardsSettings;
	saveSettings(): Promise<void>;
	/** Re-reads packages after the data folder changed. */
	reloadData(): Promise<void>;
}

export class FlashcardsSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly host: SettingsHost,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.storageSection(containerEl);
		this.dailyLimitsSection(containerEl);
		this.schedulingSection(containerEl);
		this.displaySection(containerEl);
		this.dailyNoteSection(containerEl);
	}

	private storageSection(el: HTMLElement): void {
		new Setting(el).setName("Storage").setHeading();
		new Setting(el)
			.setName("Data folder")
			.setDesc("Vault folder for imported decks: one sub-folder per package with its cards, progress and media. Syncs with the vault.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dataFolder)
					.setValue(this.host.settings.dataFolder)
					.onChange(async (value) => {
						this.host.settings.dataFolder = value.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_SETTINGS.dataFolder;
						await this.host.saveSettings();
					}),
			)
			.addButton((button) =>
				button.setButtonText("Reload").onClick(async () => {
					await this.host.reloadData();
				}),
			);
	}

	private dailyLimitsSection(el: HTMLElement): void {
		const { settings } = this.host;
		new Setting(el).setName("Daily limits").setDesc("Defaults for every deck. Override them per deck from the deck's ⋯ menu.").setHeading();
		this.numberSetting(el, "New cards per day", "", () => settings.limits.newPerDay, (v) => (settings.limits.newPerDay = v), 0, 9999);
		this.numberSetting(el, "Reviews per day", "", () => settings.limits.reviewsPerDay, (v) => (settings.limits.reviewsPerDay = v), 0, 99999);

		new Setting(el)
			.setName("New card order")
			.setDesc("Deck: finish one sub-deck's new cards before the next, as in Anki. Position: follow the order of the notes across sub-decks.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("deck", "Deck, then position")
					.addOption("position", "Position, then deck")
					.setValue(settings.newCardGather)
					.onChange(async (value) => {
						settings.newCardGather = value as NewCardGather;
						await this.host.saveSettings();
					}),
			);
		new Setting(el)
			.setName("New cards vs. reviews")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("mixed", "Mix with reviews")
					.addOption("before-reviews", "Show before reviews")
					.addOption("after-reviews", "Show after reviews")
					.setValue(settings.newCardMix)
					.onChange(async (value) => {
						settings.newCardMix = value as NewCardMix;
						await this.host.saveSettings();
					}),
			);
		this.toggle(el, "Bury new siblings", "Show only one new card per note per day (e.g. not the typing card right after the recognition card).", () => settings.buryNewSiblings, (v) => (settings.buryNewSiblings = v));
		this.toggle(el, "Bury review siblings", "Show only one review card per note per day.", () => settings.buryReviewSiblings, (v) => (settings.buryReviewSiblings = v));
		this.numberSetting(el, "Next day starts at", "Hour (0–23). Reviews after midnight but before this hour count for the previous day.", () => settings.dayStartHour, (v) => (settings.dayStartHour = v), 0, 23);
		this.numberSetting(el, "Learn-ahead limit", "Minutes. When nothing else is left, learning cards due within this time are shown early.", () => settings.learnAheadMinutes, (v) => (settings.learnAheadMinutes = v), 0, 1440);
	}

	private schedulingSection(el: HTMLElement): void {
		const scheduler = this.host.settings.scheduler;
		new Setting(el).setName("Scheduling (FSRS)").setHeading();
		new Setting(el)
			.setName("Desired retention")
			.setDesc("Chance of remembering a card when it comes due. Higher means more reviews. 0.85–0.95 works for most people.")
			.addSlider((slider) =>
				slider
					.setLimits(0.7, 0.99, 0.01)
					.setValue(scheduler.desiredRetention)
					.setDynamicTooltip()
					.onChange(async (value) => {
						scheduler.desiredRetention = value;
						await this.host.saveSettings();
					}),
			);
		this.numberSetting(el, "Maximum interval", "Days.", () => scheduler.maximumIntervalDays, (v) => (scheduler.maximumIntervalDays = v), 1, 36500);
		this.stepsSetting(el, "Learning steps", "For new cards, e.g. `1m 10m`.", () => scheduler.learningSteps, (v) => (scheduler.learningSteps = v));
		this.stepsSetting(el, "Relearning steps", "For forgotten cards, e.g. `10m`.", () => scheduler.relearningSteps, (v) => (scheduler.relearningSteps = v));
		this.toggle(el, "Fuzz intervals", "Spread reviews a little so cards learned together don't stay due together.", () => scheduler.enableFuzz, (v) => (scheduler.enableFuzz = v));
		new Setting(el)
			.setName("FSRS weights")
			.setDesc("Optional: paste weights optimised in Anki (comma separated). Empty uses the defaults.")
			.addTextArea((area) =>
				area.setValue(scheduler.weights.join(", ")).onChange(async (value) => {
					const weights = value
						.split(/[\s,]+/)
						.filter(Boolean)
						.map(Number);
					if (weights.some(Number.isNaN)) return;
					scheduler.weights = weights;
					await this.host.saveSettings();
				}),
			);
	}

	private displaySection(el: HTMLElement): void {
		const { settings } = this.host;
		new Setting(el).setName("Reviewing").setHeading();
		this.toggle(el, "Play audio automatically", "Play a side's audio when it's shown. R replays it.", () => settings.autoplayAudio, (v) => (settings.autoplayAudio = v));
		this.toggle(el, "Run deck scripts", "Let card templates run their JavaScript (typing boxes, drawing pads…). Cards run in a sandbox without access to your vault.", () => settings.runDeckScripts, (v) => (settings.runDeckScripts = v));
		this.toggle(el, "Follow Obsidian's theme", "Render cards in night mode when Obsidian uses a dark theme.", () => settings.followObsidianTheme, (v) => (settings.followObsidianTheme = v));
		this.toggle(el, "Show next intervals on answer buttons", "", () => settings.showIntervalsOnButtons, (v) => (settings.showIntervalsOnButtons = v));
		this.toggle(el, "Show due count in the status bar", "", () => settings.showStatusBar, (v) => (settings.showStatusBar = v));
	}

	private dailyNoteSection(el: HTMLElement): void {
		const daily = this.host.settings.dailyNote;
		new Setting(el).setName("Daily note").setDesc("Tick a habit property in a note when you finish studying for the day.").setHeading();
		this.toggle(el, "Mark the daily note", "", () => daily.enabled, (v) => (daily.enabled = v));
		new Setting(el)
			.setName("Note path")
			.setDesc("e.g. `Journal/{{date}}.md`. {{date}} becomes YYYY-MM-DD.")
			.addText((text) =>
				text.setValue(daily.path).onChange(async (value) => {
					daily.path = value.trim();
					await this.host.saveSettings();
				}),
			);
		new Setting(el)
			.setName("Property")
			.setDesc("Frontmatter property set to true.")
			.addText((text) =>
				text.setValue(daily.property).onChange(async (value) => {
					daily.property = value.trim();
					await this.host.saveSettings();
				}),
			);
	}

	private toggle(el: HTMLElement, name: string, desc: string, get: () => boolean, set: (value: boolean) => void): void {
		new Setting(el)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(get()).onChange(async (value) => {
					set(value);
					await this.host.saveSettings();
				}),
			);
	}

	private numberSetting(el: HTMLElement, name: string, desc: string, get: () => number, set: (value: number) => void, min: number, max: number): void {
		new Setting(el)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = String(min);
				text.inputEl.max = String(max);
				text.setValue(String(get())).onChange(async (value) => {
					const parsed = Number(value);
					if (value.trim() === "" || !Number.isFinite(parsed)) return;
					set(Math.min(max, Math.max(min, Math.round(parsed))));
					await this.host.saveSettings();
				});
			});
	}

	private stepsSetting(el: HTMLElement, name: string, desc: string, get: () => string[], set: (value: string[]) => void): void {
		new Setting(el)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text.setValue(get().join(" ")).onChange(async (value) => {
					const steps = parseSteps(value);
					text.inputEl.toggleClass("fc-invalid", steps === null);
					if (!steps) return;
					set(steps);
					await this.host.saveSettings();
				}),
			);
	}
}
