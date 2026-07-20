---
name: astrojs-sitemap
description: Implements @astrojs/sitemap correctly for this repository. Use when working with @astrojs/sitemap, sitemap generation, robots.txt Sitemap URLs, or SEO crawl discovery for tetrazero.com.
---

# @astrojs/sitemap

## When to use this skill

- Changing sitemap generation or `integrations: [sitemap()]`
- Updating `site` / `trailingSlash` and needing sitemap URLs to stay correct
- Debugging missing `sitemap-index.xml` after build
- Adjusting `robots.txt` Sitemap directives

## Quick setup

- Install: `npm install @astrojs/sitemap`
- Config: [`astro.config.mjs`](../../astro.config.mjs) — `site`, `trailingSlash: 'always'`, `integrations: [sitemap()]`
- Robots: [`public/robots.txt`](../../public/robots.txt) points at `https://tetrazero.com/sitemap-index.xml`

## Safe defaults for this repository

- Always keep `site: 'https://tetrazero.com'` (apex, HTTPS) so sitemap entries match canonicals.
- Keep `trailingSlash: 'always'` so sitemap URLs match `/privacy/` and `/terms/`.
- Use the default `sitemap()` integration with no filters (only 3 static pages).
- Prefer `sitemap-index.xml` in robots.txt (what the integration emits).

## Core usage patterns

1. Integration only — no manual sitemap files under `public/`.
2. After `npm run build`, confirm `dist/sitemap-index.xml` and `dist/sitemap-0.xml` exist.
3. Deploy copies `dist/` via Apache; submit `https://tetrazero.com/sitemap-index.xml` in Search Console if Cloudflare overrides origin `robots.txt`.

## Pitfalls and guardrails

- Missing `site` → build fails or sitemap is empty — never remove `site`.
- Cloudflare may serve a managed AI content-signals `robots.txt`; sitemap file can still be fetched directly.
- Do not list non-trailing-slash URLs in custom sitemap options while `trailingSlash: 'always'` is set.

## Validation checklist

- [ ] `@astrojs/sitemap` matches package.json (currently ^3.x / installed 3.7.x)
- [ ] Build prints `[@astrojs/sitemap] sitemap-index.xml created at dist`
- [ ] Sitemap URLs use HTTPS apex + trailing slashes
- [ ] Docs: https://docs.astro.build/en/guides/integrations-guide/sitemap/
