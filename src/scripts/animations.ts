import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scramble } from './scramble';

gsap.registerPlugin(ScrollTrigger);

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function init(): Promise<void> {
	// Wait for webfonts (Inter) so hero clamp sizing uses final metrics
	if (document.fonts?.ready) {
		await document.fonts.ready;
	}
	// Two frames: layout settles after font swap before measuring/animating
	await nextFrame();
	await nextFrame();

	const mm = gsap.matchMedia();

	mm.add('(prefers-reduced-motion: no-preference)', () => {
		// Hero entrance: fade supports + scramble the name from glyphs
		const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
		intro.to('[data-hero-fade]', {
			opacity: 1,
			y: 0,
			duration: 0.9,
			stagger: 0.1,
			delay: 0.15,
		});

		const heroName = document.querySelector<HTMLElement>('#top [data-scramble]');
		if (heroName) {
			gsap.delayedCall(0.35, () => scramble(heroName, 1100));
		}

		// Generic scroll reveals
		gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
			gsap.to(el, {
				opacity: 1,
				y: 0,
				duration: 0.9,
				ease: 'power3.out',
				scrollTrigger: {
					trigger: el,
					start: 'top 88%',
					once: true,
				},
			});
		});

		// Animated counters in the stats strip
		gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
			const target = Number(el.dataset.count);
			const counter = { value: 0 };
			el.textContent = '0';
			gsap.to(counter, {
				value: target,
				duration: 1.6,
				ease: 'power2.out',
				scrollTrigger: {
					trigger: el,
					start: 'top 90%',
					once: true,
				},
				onUpdate: () => {
					el.textContent = String(Math.round(counter.value));
				},
			});
		});

		// Section headings resolve from scrambled glyphs, once, on entry
		gsap.utils.toArray<HTMLElement>('[data-scramble]').forEach((el) => {
			if (el.closest('#top')) return; // hero name is handled above
			ScrollTrigger.create({
				trigger: el,
				start: 'top 88%',
				once: true,
				onEnter: () => scramble(el, 700),
			});
		});

		// Subtle parallax drift on ghost numerals
		gsap.utils.toArray<HTMLElement>('.ghost-index').forEach((el) => {
			gsap.fromTo(
				el,
				{ yPercent: 12 },
				{
					yPercent: -12,
					ease: 'none',
					scrollTrigger: {
						trigger: el,
						start: 'top bottom',
						end: 'bottom top',
						scrub: true,
					},
				}
			);
		});
	});

	ScrollTrigger.refresh();
}

void init();
