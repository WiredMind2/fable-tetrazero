/*
	Text scramble: resolves a string from random WORDS, left to right.
	Used for the hero name and section headings.

	Placeholder words always have exactly the same number of letters as
	the word they stand in for, so the glitch reads as fixed-length words
	cycling ("KZQWOXB OMRHAPT" for "WILLIAM MICHAUD") rather than
	per-character letter soup.

	Layout stability: each word is wrapped in an inline-block span locked
	to its final width (fonts are settled by the time this runs), so
	swapping whole words can never re-wrap, change the line count, or
	shift the content below. Plain text is restored when the scramble
	resolves, recovering natural kerning.
*/

// Moderate-width uppercase letters only: dropping the extreme glyphs
// (I, M, W) keeps random words close to the final word's width.
const LETTERS = 'ABCDEFGHJKLNOPQRSTUVXYZ';
const REFRESH_MS = 70;

export function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function randomWord(length: number): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		out += LETTERS[(Math.random() * LETTERS.length) | 0];
	}
	return out;
}

export function scramble(el: HTMLElement, durationMs = 900): void {
	const final = el.dataset.scrambleText ?? el.textContent ?? '';
	if (!final) return;
	const reduced = prefersReducedMotion();
	if (reduced || durationMs <= 0) {
		el.textContent = final;
		return;
	}

	// One inline-block span per word; spaces stay as plain text nodes so
	// wrapping between words keeps working exactly as with plain text.
	const words: { text: string; span: HTMLSpanElement; end: number }[] = [];
	const nodes: Node[] = [];
	let end = 0;
	for (const token of final.split(/(\s+)/)) {
		if (!token) continue;
		if (/^\s+$/.test(token)) {
			nodes.push(document.createTextNode(token));
			end += token.length;
			continue;
		}
		const span = document.createElement('span');
		span.style.display = 'inline-block';
		span.style.textAlign = 'center';
		span.textContent = token;
		nodes.push(span);
		end += token.length;
		words.push({ text: token, span, end });
	}
	el.replaceChildren(...nodes);

	// Lock each word box to its final width, measured with the real text.
	for (const word of words) {
		word.span.style.width = `${word.span.getBoundingClientRect().width.toFixed(2)}px`;
	}

	const start = performance.now();
	let lastRefresh = 0;

	const tick = (now: number) => {
		const t = Math.min(1, (now - start) / durationMs);
		const revealed = Math.floor(t * final.length);

		// Fresh random words at a fixed cadence (not every frame) so the
		// cycling reads as words flipping, not flicker.
		const refresh = now - lastRefresh >= REFRESH_MS;
		if (refresh) lastRefresh = now;

		for (const word of words) {
			if (revealed >= word.end) {
				if (word.span.textContent !== word.text) word.span.textContent = word.text;
			} else if (refresh) {
				word.span.textContent = randomWord(word.text.length);
			}
		}

		if (t < 1) {
			requestAnimationFrame(tick);
		} else {
			// Restore plain text (natural kerning, balanced wrapping).
			el.textContent = final;
		}
	};
	requestAnimationFrame(tick);
}
