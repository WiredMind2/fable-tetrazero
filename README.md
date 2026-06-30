# tetrazero.com

Personal portfolio of William Michaud - rebuilt from scratch with [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com) and [GSAP](https://gsap.com).

## Stack

- **Astro** - static output, zero JS by default
- **Tailwind CSS 4** - design tokens defined in `src/styles/global.css` via `@theme`
- **GSAP + ScrollTrigger** - hero intro, scroll reveals, animated counters, parallax (respects `prefers-reduced-motion`)
- **Vanilla TypeScript** - project filtering, mobile nav, contact form

## Structure

- `src/pages/index.astro` - single-page portfolio (Hero, Stats, About, Projects, Experience, Skills, Contact)
- `src/pages/privacy.astro`, `src/pages/terms.astro` - legal pages
- `src/data/*.json` - projects, experiences and skills content (typed via content collections in `src/content.config.ts`)
- `src/scripts/animations.ts` - all GSAP choreography

## Commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start dev server at `localhost:4321`        |
| `npm run build`   | Build production site to `./dist/`          |
| `npm run preview` | Preview the production build locally        |

## Deployment

`npm run build` produces a fully static `dist/` folder deployable to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages...).
