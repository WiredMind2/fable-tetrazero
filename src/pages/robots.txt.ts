import type { APIRoute } from 'astro';

// robots.txt as a static endpoint so each build variant references its own
// canonical domain's sitemap (tetrazero.com / iamwilli.am). public/robots.txt
// was removed in favor of this file.
export const GET: APIRoute = ({ site }) => {
	const base = (site ?? new URL('https://tetrazero.com')).href.replace(/\/$/, '');
	const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap-index.xml\n`;
	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
