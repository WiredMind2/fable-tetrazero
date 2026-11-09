# Definition of done

A story is not Done until every box is checked and every acceptance criterion
in its item file is checked.

- [ ] All acceptance criteria in the item file are checked
- [ ] `npm run build` exits zero on branch `redesign/mono-iso`
- [ ] Section verified visually at 1440px and 390px in the dev server
- [ ] `prefers-reduced-motion: reduce` shows content (no hidden states, static
      iso frames where applicable)
- [ ] No JS at all still shows all text content (progressive enhancement)
- [ ] No leftover acid-green token references (`#c8f750`, `--color-acid`,
      `acid-` classes, AcidText) in shipped code for the touched components
- [ ] Item file status updated to `Done` and `docs/work/README.md` index row updated
