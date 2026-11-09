/*
	Text scramble: resolves a string from random glyphs, left to right.
	Used for the hero name and section headings. Falls back to the final
	text immediately when the element should not animate (caller checks
	prefers-reduced-motion).
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
	const start = performance.now();
	let raf = 0;
	const tick = (now: number) => {
		const t = Math.min(1, (now - start) / durationMs);
		const revealed = Math.floor(t * final.length);
		let out = '';
		for (let i = 0; i < final.length; i++) {
			const ch = final[i];
			if (ch === ' ' || i < revealed) out += ch;
			else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
		}
		el.textContent = out;
		if (t < 1) raf = requestAnimationFrame(tick);
		else el.textContent = final;
	};
	raf = requestAnimationFrame(tick);
	el.dataset.scrambleRaf = String(raf);
}
