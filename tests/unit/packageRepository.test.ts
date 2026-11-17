import { describe, expect, it } from "vitest";
import { readAnkiPackage } from "../../src/anki/apkgReader";
import { CardState } from "../../src/domain/types";
import { PackageRepository } from "../../src/storage/PackageRepository";
import { legacyApkg } from "../helpers/ankiFixtures";
import { MemoryFileSystem } from "../helpers/MemoryFileSystem";
import { testSqlite } from "../helpers/sqlite";

async function importFixture(repository: PackageRepository, notes?: Parameters<typeof legacyApkg>[0]) {
	const parsed = await readAnkiPackage(await legacyApkg(notes), "hsk.apkg", await testSqlite());
	return repository.importPackage(parsed, "hsk.apkg", () => {});
}

describe("PackageRepository", () => {
	it("imports a package into its own folder with media", async () => {
		const fs = new MemoryFileSystem();
		const repository = new PackageRepository(fs, () => "Flashcards");
		const report = await importFixture(repository);

		expect(report).toMatchObject({ packageName: "HSK 1", updatedExisting: false, cardsAdded: 6, notesAdded: 3, mediaWritten: 3 });
		expect(fs.files.has("Flashcards/HSK 1/collection.json")).toBe(true);
		expect(fs.files.has("Flashcards/HSK 1/progress.json")).toBe(true);
		expect(fs.files.get("Flashcards/HSK 1/media/ai.mp3")).toEqual(new Uint8Array([1, 2, 3]));
		expect(repository.collection.cards()).toHaveLength(6);
		expect(repository.collection.deckNames().sort()).toEqual(["Chinese::HSK 1::Recognition", "Chinese::HSK 1::Typing"]);
	});

	it("reloads everything from disk", async () => {
		const fs = new MemoryFileSystem();
		await importFixture(new PackageRepository(fs, () => "Flashcards"));
		const fresh = new PackageRepository(fs, () => "Flashcards");
		expect(await fresh.loadAll()).toEqual({ loaded: 1, failed: [] });
		expect(fresh.collection.cards()).toHaveLength(6);
	});

	it("re-importing updates notes in place and keeps progress", async () => {
		const fs = new MemoryFileSystem();
		const repository = new PackageRepository(fs, () => "Flashcards");
		await importFixture(repository);
		const pkg = repository.collection.allPackages()[0];
		pkg.progress.cards["10"] = { memory: { due: 1, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: CardState.Review } };
		await repository.saveProgress(pkg);

		const report = await importFixture(repository, {
			notes: [
				{ id: 1, guid: "g-love", fields: ["爱", "ài", "to love; to like", "", ""] },
				{ id: 4, guid: "g-mom", fields: ["妈妈", "māma", "mother", "", ""] },
			],
			media: {},
		});

		expect(report).toMatchObject({ updatedExisting: true, notesAdded: 1, notesUpdated: 1, cardsAdded: 2 });
		expect(repository.collection.allPackages()).toHaveLength(1);
		expect(pkg.data.notes["1"].fields[2]).toBe("to love; to like");
		expect(pkg.progress.cards["10"].memory?.reps).toBe(1);
		expect(repository.collection.cards()).toHaveLength(8);
	});

	it("ignores its own writes but reloads changes from sync", async () => {
		const fs = new MemoryFileSystem();
		const repository = new PackageRepository(fs, () => "Flashcards");
		await importFixture(repository);
		const path = "Flashcards/HSK 1/progress.json";
		expect(await repository.handleExternalChange(path)).toBe(false);

		await fs.writeText(path, JSON.stringify({ schema: 1, cards: { "10": { suspended: true } }, log: [] }));
		expect(await repository.handleExternalChange(path)).toBe(true);
		expect(repository.collection.allPackages()[0].progress.cards["10"].suspended).toBe(true);
	});

	it("renames media with unsafe names and resolves them", async () => {
		const fs = new MemoryFileSystem();
		const repository = new PackageRepository(fs, () => "Flashcards");
		await importFixture(repository, { media: { "a:b.mp3": new Uint8Array([9]) } });
		const pkg = repository.collection.allPackages()[0];
		expect(fs.files.has("Flashcards/HSK 1/media/a_b.mp3")).toBe(true);
		expect(repository.mediaUrl(pkg, "a:b.mp3")).toBe("app://vault/Flashcards/HSK%201/media/a_b.mp3");
	});

	it("deletes a package and its folder", async () => {
		const fs = new MemoryFileSystem();
		const repository = new PackageRepository(fs, () => "Flashcards");
		await importFixture(repository);
		await repository.deletePackage(repository.collection.allPackages()[0].data.id);
		expect(repository.collection.cards()).toHaveLength(0);
		expect([...fs.files.keys()].some((key) => key.startsWith("Flashcards/HSK 1/"))).toBe(false);
	});
});
