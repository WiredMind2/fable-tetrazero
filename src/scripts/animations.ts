import { gsap } from 'gsap';

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function init(): Promise<void> {
	if (document.fonts?.ready) {
		await document.fonts.ready;
	}
	await nextFrame();

	const mm = gsap.matchMedia();

	mm.add('(prefers-reduced-motion: no-preference)', () => {
		const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
		intro
			.from('[data-hero-copy] > *', {
				autoAlpha: 0,
				y: 22,
				duration: 0.8,
				stagger: 0.07,
				clearProps: 'opacity,visibility,transform',
			})
			.from(
				'[data-landscape-piece]',
				{
					autoAlpha: 0,
					y: 28,
					scale: 0.96,
					duration: 0.9,
					stagger: 0.1,
					clearProps: 'opacity,visibility,transform',
				},
				'-=0.55'
			);

		return () => intro.kill();
	});
}

void init();
