/*
	Text scramble: resolves a string from random glyphs, left to right.
	Used for the hero name and section headings.

	Layout stability: before scrambling, each character is wrapped in an
	inline-block span whose width is measured from the FINAL glyph (fonts
	are settled by the time this runs). Random glyphs then swap inside
	fixed-width boxes, so the text can never re-wrap, change line count,
	or shift the content below it. The spans are replaced by plain text
	again once the scramble resolves.
*/

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\*#%&';

export function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scramble(el: HTMLElement, durationMs = 900): void {
	const final = el.dataset.scrambleText ?? el.textContent ?? '';
	if (!final) return;
	const reduced = prefersReducedMotion();
	if (reduced || durationMs <= 0) {
		el.textContent = final;
		return;
	}

	// Build one inline-block per character, laid out with the final glyphs
	// first so each box can be locked to its final width.
	const chars: HTMLSpanElement[] = [];
	const frag = document.createDocumentFragment();
	for (const ch of final) {
		const span = document.createElement('span');
		if (ch !== ' ') span.style.display = 'inline-block';
		span.textContent = ch;
		frag.appendChild(span);
		chars.push(span);
	}
	el.replaceChildren(frag);

	// Lock every non-space character to its final width.
	for (const span of chars) {
		if (span.textContent !== ' ') {
			span.style.width = `${span.getBoundingClientRect().width.toFixed(2)}px`;
		}
	}

	const randomGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
	const start = performance.now();

	const tick = (now: number) => {
		const t = Math.min(1, (now - start) / durationMs);
		const revealed = Math.floor(t * final.length);
		for (let i = 0; i < chars.length; i++) {
			const ch = final[i];
			if (ch === ' ') continue;
			chars[i].textContent = i < revealed ? ch : randomGlyph();
		}
		if (t < 1) {
			requestAnimationFrame(tick);
		} else {
			// Restore plain text (and balanced wrapping) when done.
			el.textContent = final;
		}
	};
	requestAnimationFrame(tick);
}
