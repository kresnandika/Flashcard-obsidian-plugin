/** Plays card audio one file after another, like Anki. Lives outside the card frame so it can be controlled by keys. */
export class AudioPlayer {
	private current: HTMLAudioElement | null = null;
	private queue: string[] = [];
	private generation = 0;

	play(urls: string[]): void {
		this.stop();
		this.queue = [...urls];
		this.playNext(this.generation);
	}

	stop(): void {
		this.generation++;
		this.queue = [];
		if (this.current) {
			this.current.pause();
			this.current.src = "";
			this.current = null;
		}
	}

	private playNext(generation: number): void {
		if (generation !== this.generation) return;
		const url = this.queue.shift();
		if (!url) {
			this.current = null;
			return;
		}
		const audio = new Audio(url);
		this.current = audio;
		const advance = () => this.playNext(generation);
		audio.addEventListener("ended", advance, { once: true });
		audio.addEventListener("error", advance, { once: true });
		audio.play().catch(advance);
	}
}
