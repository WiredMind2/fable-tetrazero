/** Site-wide metadata. Set fbAppId from https://developers.facebook.com/apps/ → your app → Settings → Basic → App ID */
export const siteConfig = {
	name: 'Tetrazero',
	/** Bump when og-image.png changes so Meta fetches the new file (cached by image URL). */
	ogImageVersion: '2',
	fbAppId: import.meta.env.PUBLIC_FB_APP_ID ?? '',
} as const;
