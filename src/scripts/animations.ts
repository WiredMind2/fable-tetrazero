import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {
	// Hero entrance
	const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
	intro
		.to('[data-hero-line] .hero-line-inner', {
			y: 0,
			duration: 1.1,
			stagger: 0.12,
			delay: 0.15,
		})
		.to(
			'[data-hero-fade]',
			{ opacity: 1, y: 0, duration: 0.9, stagger: 0.1 },
			'-=0.7'
		);

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
