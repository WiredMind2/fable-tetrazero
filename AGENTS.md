# AGENTS.md — fable-tetrazero (tetrazero.com)

Astro 7 + Tailwind 4 static portfolio. Deploy with `npm run deploy` (see `scripts/deploy.ps1`).

## Lessons

- systemd *user* units cannot enforce capability-based sandboxing (ProtectSystem=strict,
  ProtectHome, ProtectKernel*, RestrictSUIDSGID, RestrictAddressFamilies → exit 218/
  CAPABILITIES, "Failed to drop capabilities"). Only NoNewPrivileges/PrivateTmp are safe
  there; full sandboxing needs the sudo-installed system unit. Verify unit changes on the
  host before walking away — this one crash-looped the origin into a ~2 min 502 outage
  (2026-11-19, fixed in `9bf0839`).

## Work register

This project tracks work in `docs/work/`:

- `docs/work/README.md` — index of item files and collisions
- `docs/work/items/US-XXX.md` — one story per file (points, status, Given/When/Then acceptance criteria)
- `docs/work/definition-of-done.md` — a story is not Done until every box is checked

When starting new project-scale work or adding a feature, edit `docs/work/items/`
directly. Before minting a new ID, scan `docs/work/items/` and, if it exists,
`docs/work/archive/` — IDs are stable and never reused. Never delete `docs/agile/`
or `docs/work/archive/`.
