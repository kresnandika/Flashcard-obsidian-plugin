/** Plugin settings, persisted by Obsidian in the plugin's data.json. */

export type NewCardGather = "deck" | "position";
export type NewCardMix = "mixed" | "before-reviews" | "after-reviews";

/** Limits that can be overridden per deck. */
export interface DeckLimits {
	newPerDay: number;
	reviewsPerDay: number;
}

export interface SchedulerSettings {
	/** Probability of recalling a card when it comes due (FSRS desired retention). */
	desiredRetention: number;
	maximumIntervalDays: number;
	enableFuzz: boolean;
	learningSteps: string[];
	relearningSteps: string[];
	/** Optional custom FSRS weights; empty uses the library defaults. */
	weights: number[];
}

export interface FlashcardsSettings {
	/** Vault folder that holds one sub-folder per imported package. */
	dataFolder: string;
	limits: DeckLimits;
	deckLimits: Record<string, Partial<DeckLimits>>;
	newCardGather: NewCardGather;
	newCardMix: NewCardMix;
	buryNewSiblings: boolean;
	buryReviewSiblings: boolean;
	/** Hour (0–23) at which a new study day starts. */
	dayStartHour: number;
	/** Learning cards due within this many minutes are shown early when nothing else is left. */
	learnAheadMinutes: number;
	scheduler: SchedulerSettings;
	autoplayAudio: boolean;
	runDeckScripts: boolean;
	followObsidianTheme: boolean;
	showIntervalsOnButtons: boolean;
	showStatusBar: boolean;
	dailyNote: {
		enabled: boolean;
		/** Path of the note to update. `{{date}}` is replaced with the study day (YYYY-MM-DD). */
		path: string;
		property: string;
	};
	/** Deck names collapsed in the deck list. */
	collapsedDecks: string[];
}

export const DEFAULT_SETTINGS: FlashcardsSettings = {
	dataFolder: "Flashcards",
	limits: { newPerDay: 20, reviewsPerDay: 200 },
	deckLimits: {},
	newCardGather: "deck",
	newCardMix: "mixed",
	buryNewSiblings: true,
	buryReviewSiblings: false,
	dayStartHour: 4,
	learnAheadMinutes: 20,
	scheduler: {
		desiredRetention: 0.9,
		maximumIntervalDays: 36500,
		enableFuzz: true,
		learningSteps: ["1m", "10m"],
		relearningSteps: ["10m"],
		weights: [],
	},
	autoplayAudio: true,
	runDeckScripts: true,
	followObsidianTheme: true,
	showIntervalsOnButtons: true,
	showStatusBar: true,
	dailyNote: { enabled: false, path: "", property: "flashcards" },
	collapsedDecks: [],
};

/** Merges stored settings over the defaults, one level deep for nested groups. */
export function resolveSettings(stored: unknown): FlashcardsSettings {
	const raw = (stored && typeof stored === "object" ? stored : {}) as Partial<FlashcardsSettings>;
	return {
		...DEFAULT_SETTINGS,
		...raw,
		limits: { ...DEFAULT_SETTINGS.limits, ...raw.limits },
		deckLimits: { ...raw.deckLimits },
		scheduler: { ...DEFAULT_SETTINGS.scheduler, ...raw.scheduler },
		dailyNote: { ...DEFAULT_SETTINGS.dailyNote, ...raw.dailyNote },
		collapsedDecks: [...(raw.collapsedDecks ?? [])],
	};
}

/** The limits for a deck: its own override, else the global defaults. */
export function limitsFor(settings: FlashcardsSettings, deckName: string | null): DeckLimits {
	const override = deckName === null ? undefined : settings.deckLimits[deckName];
	return { ...settings.limits, ...override };
}

/** Accepts steps such as `1m`, `10m`, `1h`, `2d`. */
export function parseSteps(text: string): string[] | null {
	const steps = text
		.split(/[\s,]+/)
		.map((step) => step.trim())
		.filter(Boolean);
	return steps.every((step) => /^\d+(\.\d+)?[smhd]$/.test(step)) ? steps : null;
}
