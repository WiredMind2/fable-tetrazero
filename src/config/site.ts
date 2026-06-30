/** Site-wide metadata. Set fbAppId from https://developers.facebook.com/apps/ → your app → Settings → Basic → App ID */
export const siteConfig = {
	name: 'Tetrazero',
	fbAppId: import.meta.env.PUBLIC_FB_APP_ID ?? '',
} as const;
