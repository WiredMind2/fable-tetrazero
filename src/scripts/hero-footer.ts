const LG_BREAKPOINT = 1024;

function updateFooterHeight(footer: HTMLElement) {
	document.documentElement.style.setProperty(
		'--hero-footer-h',
		`${footer.offsetHeight / 16}rem`
	);
}

function updateFooterPosition(
	hero: HTMLElement,
	footer: HTMLElement,
	reducedMotion: boolean
) {
	const heroBottom = hero.getBoundingClientRect().bottom;
	const vh = window.innerHeight;

	if (reducedMotion || window.scrollY === 0 || heroBottom >= vh) {
		footer.style.transform = '';
	} else {
		footer.style.transform = `translateY(${heroBottom - vh}px)`;
	}
}

function initHeroFooter() {
	const hero = document.querySelector<HTMLElement>('#top');
	const footer = document.querySelector<HTMLElement>('[data-hero-footer]');
	if (!hero || !footer) return;

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let rafId = 0;

	const update = () => {
		rafId = 0;
		if (window.innerWidth >= LG_BREAKPOINT) {
			footer.style.transform = '';
			return;
		}
		updateFooterHeight(footer);
		updateFooterPosition(hero, footer, reducedMotion);
	};

	const scheduleUpdate = () => {
		if (rafId) return;
		rafId = requestAnimationFrame(update);
	};

	updateFooterHeight(footer);
	update();

	window.addEventListener('scroll', scheduleUpdate, { passive: true });
	window.addEventListener('resize', scheduleUpdate, { passive: true });
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initHeroFooter);
} else {
	initHeroFooter();
}
