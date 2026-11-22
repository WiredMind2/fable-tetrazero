/** Site-wide metadata. Set fbAppId from https://developers.facebook.com/apps/ → your app → Settings → Basic → App ID */

// Dual-build branding. The default build (astro.config.mjs → dist/) serves
// tetrazero.com with Tetrazero branding; the William variant
// (astro.iamwilliam.config.mjs → dist-william/, PUBLIC_SITE_VARIANT=william
// set by `npm run build:william`) serves iamwilli.am with personal branding
// and no Tetrazero references.
const isWilliam = import.meta.env.PUBLIC_SITE_VARIANT === 'william';

/** Per-variant branding used across layouts, nav, footer and legal pages. */
export const brand = {
	name: isWilliam ? 'William Michaud' : 'Tetrazero',
	wordmarkBold: isWilliam ? 'william' : 'tetra',
	wordmarkMuted: isWilliam ? 'michaud' : 'zero',
	backToTopLabel: isWilliam ? 'William Michaud — back to top' : 'Tetrazero — back to top',
	defaultTitle: isWilliam ? 'William Michaud' : 'Tetrazero - William Michaud',
	ogImageAlt: isWilliam ? 'William Michaud' : 'Tetrazero',
	// Keep the tetrazero version in sync with siteConfig.ogImageVersion.
	ogImagePath: isWilliam ? '/og-image-william.png?v=1' : '/og-image.png?v=2',
	fallbackSiteUrl: isWilliam ? 'https://iamwilli.am' : 'https://tetrazero.com',
	copyrightName: isWilliam ? 'William Michaud' : 'William Michaud — Tetrazero',
	legalName: isWilliam ? 'William Michaud' : 'Tetrazero',
} as const;

export const siteConfig = {
	name: brand.name,
	/** Bump when og-image.png changes so Meta fetches the new file (cached by image URL). */
	ogImageVersion: '2',
	fbAppId: import.meta.env.PUBLIC_FB_APP_ID ?? '',
} as const;
