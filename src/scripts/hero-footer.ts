const LG_BREAKPOINT = 1024;

type FooterState = 'static' | 'floating' | 'attached';

function updateFooterHeight(footer: HTMLElement) {
	document.documentElement.style.setProperty(
		'--hero-footer-h',
		`${footer.offsetHeight / 16}rem`
	);
}

function heroOverflows(hero: HTMLElement) {
	return hero.offsetHeight > window.innerHeight;
}

function shouldAttach(hero: HTMLElement) {
	return (
		window.scrollY > 0 &&
		hero.getBoundingClientRect().bottom <= window.innerHeight
	);
}

function applyState(hero: HTMLElement, footer: HTMLElement, state: FooterState) {
	footer.classList.toggle('is-floating', state === 'floating');
	footer.classList.toggle('is-attached', state === 'attached');
	hero.classList.toggle('is-footer-floating', state === 'floating');
	footer.style.transform = '';
}

function clearState(hero: HTMLElement, footer: HTMLElement) {
	footer.classList.remove('is-floating', 'is-attached');
	hero.classList.remove('is-footer-floating');
	footer.style.transform = '';
}

function resolveState(
	hero: HTMLElement,
	reducedMotion: boolean
): FooterState {
	if (shouldAttach(hero)) {
		return 'attached';
	}

	if (!reducedMotion && heroOverflows(hero)) {
		return 'floating';
	}

	return 'static';
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
			clearState(hero, footer);
			return;
		}

		updateFooterHeight(footer);
		applyState(hero, footer, resolveState(hero, reducedMotion));
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
