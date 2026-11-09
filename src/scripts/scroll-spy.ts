/*
	Dock scroll-spy: computes a fractional "active" value per section and
	feeds it to each [data-nav-link] as --nav-active (0..1). The CSS uses
	it for text color and the ::before active pill. Fractional blending
	keeps the highlight moving smoothly between adjacent links.
*/

const SECTION_OFFSET = 96;

const allLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
const dockLinks = [...document.querySelectorAll<HTMLAnchorElement>('nav ul [data-nav-link]')];

if (dockLinks.length > 0) {
	const sections = dockLinks
		.map((link) => document.getElementById(link.dataset.section!))
		.filter((section): section is HTMLElement => section !== null);

	if (sections.length === dockLinks.length) {
		const linksBySection = new Map<string, HTMLAnchorElement[]>();
		for (const link of allLinks) {
			const section = link.dataset.section!;
			const group = linksBySection.get(section) ?? [];
			group.push(link);
			linksBySection.set(section, group);
		}

		const sectionIds = dockLinks.map((link) => link.dataset.section!);
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		let ticking = false;

		const getActiveFloat = () => {
			const tops = sections.map((section) => section.offsetTop);
			const y = window.scrollY + SECTION_OFFSET;

			if (y < tops[0]) return -1;
			const last = tops.length - 1;
			if (y >= tops[last]) return last;

			for (let i = 0; i < last; i++) {
				if (y >= tops[i] && y < tops[i + 1]) {
					return i + (y - tops[i]) / (tops[i + 1] - tops[i]);
				}
			}
			return last;
		};

		const linkActive = (index: number, activeFloat: number) => {
			if (activeFloat < 0) return 0;
			const last = sectionIds.length - 1;
			if (activeFloat >= last) return index === last ? 1 : 0;
			const i = Math.floor(activeFloat);
			const t = activeFloat - i;
			if (index === i) return 1 - t;
			if (index === i + 1) return t;
			return 0;
		};

		const update = () => {
			ticking = false;
			let activeFloat = getActiveFloat();
			if (reducedMotion && activeFloat >= 0) activeFloat = Math.round(activeFloat);

			sectionIds.forEach((id, index) => {
				const active = linkActive(index, activeFloat);
				for (const link of linksBySection.get(id) ?? []) {
					link.style.setProperty('--nav-active', String(active));
				}
			});

			const nearest =
				activeFloat < 0
					? -1
					: Math.min(Math.round(activeFloat), sectionIds.length - 1);
			for (const link of allLinks) {
				const index = sectionIds.indexOf(link.dataset.section!);
				if (index === nearest) link.setAttribute('aria-current', 'true');
				else link.removeAttribute('aria-current');
			}
		};

		const requestUpdate = () => {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(update);
			}
		};

		window.addEventListener('scroll', requestUpdate, { passive: true });
		window.addEventListener('resize', requestUpdate);
		update();
	}
}
