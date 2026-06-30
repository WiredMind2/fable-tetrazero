const HEADER_OFFSET = 64;

const navLinksContainer = document.getElementById('nav-links');
const indicator = document.getElementById('nav-indicator');

if (navLinksContainer && indicator) {
	const desktopLinks = [
		...navLinksContainer.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'),
	];
	const allLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
	const sections = desktopLinks
		.map((link) => document.getElementById(link.dataset.section!))
		.filter((section): section is HTMLElement => section !== null);

	if (desktopLinks.length > 0 && sections.length === desktopLinks.length) {
		const linksBySection = new Map<string, HTMLAnchorElement[]>();
		for (const link of allLinks) {
			const section = link.dataset.section!;
			const group = linksBySection.get(section) ?? [];
			group.push(link);
			linksBySection.set(section, group);
		}

		const sectionIds = desktopLinks.map((link) => link.dataset.section!);
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		let ticking = false;

		const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

		const getSectionTops = () => sections.map((section) => section.offsetTop);

		const getActiveFloat = (tops: number[]) => {
			const y = window.scrollY + HEADER_OFFSET;

			if (y < tops[0]) return -1;
			if (y >= tops[tops.length - 1]) return tops.length - 1;

			for (let i = 0; i < tops.length - 1; i++) {
				if (y >= tops[i] && y < tops[i + 1]) {
					return i + (y - tops[i]) / (tops[i + 1] - tops[i]);
				}
			}

			return tops.length - 1;
		};

		const getLinkActive = (index: number, activeFloat: number) => {
			if (activeFloat < 0) return 0;

			const lastIndex = sectionIds.length - 1;
			if (activeFloat >= lastIndex) {
				return index === lastIndex ? 1 : 0;
			}

			const i = Math.floor(activeFloat);
			const t = activeFloat - i;

			if (index === i) return 1 - t;
			if (index === i + 1) return t;
			return 0;
		};

		const update = () => {
			ticking = false;

			const tops = getSectionTops();
			let activeFloat = getActiveFloat(tops);

			if (reducedMotion && activeFloat >= 0) {
				activeFloat = Math.round(activeFloat);
			}

			sectionIds.forEach((id, index) => {
				const active = getLinkActive(index, activeFloat);
				for (const link of linksBySection.get(id) ?? []) {
					link.style.setProperty('--nav-active', String(active));
				}
			});

			const nearestIndex =
				activeFloat < 0 ? -1 : Math.min(Math.round(activeFloat), sectionIds.length - 1);

			for (const link of allLinks) {
				const index = sectionIds.indexOf(link.dataset.section!);
				if (index === nearestIndex) {
					link.setAttribute('aria-current', 'true');
				} else {
					link.removeAttribute('aria-current');
				}
			}

			if (activeFloat < 0) {
				indicator.style.opacity = '0';
				return;
			}

			const containerRect = navLinksContainer.getBoundingClientRect();
			const lastIndex = desktopLinks.length - 1;
			const baseIndex = Math.min(Math.floor(activeFloat), lastIndex);
			const t = activeFloat >= lastIndex ? 0 : activeFloat - baseIndex;

			const rectA = desktopLinks[baseIndex].getBoundingClientRect();
			const rectB =
				baseIndex < lastIndex
					? desktopLinks[baseIndex + 1].getBoundingClientRect()
					: rectA;

			const left = lerp(rectA.left, rectB.left, t) - containerRect.left;
			const width = lerp(rectA.width, rectB.width, t);

			indicator.style.opacity = '1';
			indicator.style.width = `${width}px`;
			indicator.style.transform = `translateX(${left}px)`;
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
