/*
	Custom cursor: a white dot + ring that follows the pointer on fine
	pointers only. The ring grows into "highlight" mode over links,
	buttons, form fields, and iso modules. Disabled entirely for touch
	input and reduced motion.
*/

import { prefersReducedMotion } from './scramble';

if (window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion()) {
	const dot = document.createElement('div');
	dot.className = 'cursor cursor--dot';
	const ring = document.createElement('div');
	ring.className = 'cursor cursor--ring';
	dot.setAttribute('aria-hidden', 'true');
	ring.setAttribute('aria-hidden', 'true');
	dot.style.opacity = '0';
	ring.style.opacity = '0';
	document.body.append(ring, dot);
	document.body.classList.add('has-cursor');

	let targetX = 0;
	let targetY = 0;
	let ringX = 0;
	let ringY = 0;
	let running = false;
	let shown = false;

	const HIGHLIGHT_SELECTOR =
		'a, button, [data-cursor="highlight"], input, textarea, [data-iso-zone]';

	const frame = () => {
		ringX += (targetX - ringX) * 0.18;
		ringY += (targetY - ringY) * 0.18;
		dot.style.transform = `translate(${targetX - 3}px, ${targetY - 3}px)`;
		const half = ring.offsetWidth / 2;
		ring.style.transform = `translate(${ringX - half}px, ${ringY - half}px)`;
		if (Math.abs(targetX - ringX) + Math.abs(targetY - ringY) > 0.5) {
			requestAnimationFrame(frame);
		} else {
			running = false;
		}
	};

	document.addEventListener(
		'pointermove',
		(e) => {
			targetX = e.clientX;
			targetY = e.clientY;
			if (!shown) {
				shown = true;
				ringX = targetX;
				ringY = targetY;
				dot.style.opacity = '1';
				ring.style.opacity = '1';
			}
			const hit = e.target instanceof Element && e.target.closest(HIGHLIGHT_SELECTOR);
			ring.classList.toggle('is-highlight', hit !== null);
			if (!running) {
				running = true;
				requestAnimationFrame(frame);
			}
		},
		{ passive: true }
	);

	document.addEventListener('pointerleave', () => {
		dot.style.opacity = '0';
		ring.style.opacity = '0';
	});
	document.addEventListener('pointerenter', () => {
		if (shown) {
			dot.style.opacity = '1';
			ring.style.opacity = '1';
		}
	});
}
