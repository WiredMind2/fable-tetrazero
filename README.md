# tetrazero.com

Personal portfolio of William Michaud - rebuilt from scratch with [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com) and [GSAP](https://gsap.com).

## Stack

- **Astro** - static output, zero JS by default
- **Tailwind CSS 4** - design tokens defined in `src/styles/global.css` via `@theme`
- **GSAP** - one restrained hero sequence that respects `prefers-reduced-motion`
- **Vanilla TypeScript** - scroll-aware navigation, accessible mobile menu and contact form

## Structure

- `src/pages/index.astro` - single-page portfolio (Hero, Stats, About, Projects, Experience, Skills, Contact)
- `src/pages/privacy.astro`, `src/pages/terms.astro` - legal pages
- `src/data/*.json` - projects, experiences and skills content (typed via content collections in `src/content.config.ts`)
- `src/components/ProjectVisual.astro`, `SystemLandscape.astro` - authored technical illustrations
- `src/scripts/animations.ts` - hero choreography

## Commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start dev server at `localhost:4321`        |
| `npm run build`   | Build production site to `./dist/`          |
| `npm run preview` | Preview the production build locally        |

## Deployment

`npm run build` produces a static `dist/` folder. `npm run deploy` pushes `master` and rebuilds `/var/www/fable-tetrazero` on tetrazero.

```bash
npm run deploy                  # commit (if needed), push, rebuild on server
npm run deploy -- "fix hero copy" # same, with a custom commit message
```

In Cursor, `/deploy` runs the same workflow via the agent.
