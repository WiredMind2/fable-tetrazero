// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// William Michaud variant for iamwilli.am — same pages, personal branding,
// no Tetrazero references. PUBLIC_SITE_VARIANT=william is set by the
// `npm run build:william` package script (Unix shell syntax; on Windows use
// cross-env or $env:PUBLIC_SITE_VARIANT='william' first). Output lands in
// dist-william/, which server/contact.py serves for Host iamwilli.am /
// www.iamwilli.am. https://astro.build/config
export default defineConfig({
	site: 'https://iamwilli.am',
	trailingSlash: 'always',
	outDir: './dist-william',
	integrations: [sitemap()],
	vite: {
		plugins: [tailwindcss()]
	}
});
