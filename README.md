# tetrazero.com

Personal portfolio of William Michaud — built with [Astro](https://astro.build), [Tailwind CSS 4](https://tailwindcss.com) and [GSAP](https://gsap.com).

**v2 design:** monochrome (black / white / grays, no brand hue), glass pills and a
floating bottom dock, ghost typography, scramble reveals, and hand-rolled
**isometric SVG 3D modules** that explode, assemble, and park on hover —
no WebGL, no 3D library.

## Stack

- **Astro** — static output, zero JS by default
- **Tailwind CSS 4** — design tokens defined in `src/styles/global.css` via `@theme`
- **GSAP + ScrollTrigger** — scroll reveals, animated counters, parallax (respects `prefers-reduced-motion`)
- **Vanilla TypeScript** — isometric engine, scroll-spy, scramble, custom cursor, mobile nav, contact form

## Structure

- `src/pages/index.astro` — single-page portfolio (Hero, Stats, What I Do, Projects, Experience, Skills, Contact)
- `src/pages/privacy.astro`, `src/pages/terms.astro` — legal pages
- `src/data/*.json` — projects, experiences and skills content (typed via content collections in `src/content.config.ts`)
- `src/scripts/iso/` — the isometric engine:
  - `engine.ts` — phase clock (slow explode/collapse loop, Hermite hover-seek), projection, lighting, painter sort, shared rAF scheduler, IntersectionObserver gating, reduced-motion static frames
  - `modules.ts` — box tables for each shape (`mark`, `stack`, `agents`, `board`, `pipeline`, `chart`, `shelf`, `podium`)
- `src/scripts/animations.ts` — GSAP choreography + scramble triggers
- `src/scripts/scroll-spy.ts` — fractional dock highlighting
- `src/scripts/cursor.ts` — custom dot+ring cursor (fine pointers only)
- `src/scripts/scramble.ts` — text scramble utility

Drop a module anywhere with:

```html
<div class="iso" data-module="stack" data-iso-zone></div>
<!-- add data-iso-static="true" for a silent, non-animated render -->
```

## Commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start dev server at `localhost:4321`        |
| `npm run build`   | Build production site to `./dist/`          |
| `npm run preview` | Preview the production build locally        |

## Deployment

`npm run build` produces a fully static `dist/` folder deployable to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages...).

Production runs on **tetrazero.com**, served by Caddy + systemd (see `deploy/`).

```bash
npm run deploy                  # commit (if needed), push, rebuild on server
npm run deploy -- "fix hero copy" # same, with a custom commit message
```

In Cursor, `/deploy` runs the same workflow via the agent.

## Work register

Feature work is tracked in `docs/work/` (see `AGENTS.md`). Scan `docs/work/items/`
and `docs/work/archive/` before minting new story IDs.
