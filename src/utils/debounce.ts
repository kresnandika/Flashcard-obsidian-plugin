/** A trailing-edge debounce whose pending call can be flushed or cancelled. */
export interface Debounced<A extends unknown[]> {
	(...args: A): void;
	flush(): void;
	cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): Debounced<A> {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending: A | null = null;

	const run = () => {
		timer = null;
		if (!pending) return;
		const args = pending;
		pending = null;
		fn(...args);
	};

	const debounced = ((...args: A) => {
		pending = args;
		if (timer) clearTimeout(timer);
		timer = setTimeout(run, waitMs);
	}) as Debounced<A>;

	debounced.flush = () => {
		if (timer) clearTimeout(timer);
		run();
	};
	debounced.cancel = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		pending = null;
	};
	return debounced;
}
