# AGENTS.md — fable-tetrazero (tetrazero.com)

Astro 6 + Tailwind 4 static portfolio. Deploy with `npm run deploy` (see `scripts/deploy.ps1`).

## Work register

This project tracks work in `docs/work/`:

- `docs/work/README.md` — index of item files and collisions
- `docs/work/items/US-XXX.md` — one story per file (points, status, Given/When/Then acceptance criteria)
- `docs/work/definition-of-done.md` — a story is not Done until every box is checked

When starting new project-scale work or adding a feature, edit `docs/work/items/`
directly. Before minting a new ID, scan `docs/work/items/` and, if it exists,
`docs/work/archive/` — IDs are stable and never reused. Never delete `docs/agile/`
or `docs/work/archive/`.
