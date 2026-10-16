const HEADER_OFFSET = 88;
const allLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
const sectionIds = [...new Set(allLinks.map((link) => link.dataset.section).filter(Boolean))] as string[];
const sections = sectionIds
	.map((id) => document.getElementById(id))
	.filter((section): section is HTMLElement => section !== null);

if (sections.length === sectionIds.length && sections.length > 0) {
	let ticking = false;

	const update = () => {
		ticking = false;
		const position = window.scrollY + HEADER_OFFSET;
		let activeId: string | null = null;

		for (const section of sections) {
			if (position >= section.offsetTop) activeId = section.id;
		}

		for (const link of allLinks) {
			if (link.dataset.section === activeId) {
				link.setAttribute('aria-current', 'location');
			} else {
				link.removeAttribute('aria-current');
			}
		}
	};

	const requestUpdate = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(update);
	};

	window.addEventListener('scroll', requestUpdate, { passive: true });
	window.addEventListener('resize', requestUpdate);
	update();
}
