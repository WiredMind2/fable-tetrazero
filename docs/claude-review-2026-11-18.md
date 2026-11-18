# Code review: tetrazero.com (2026-11-18)

Scope: `src/` (components, layouts, pages, scripts, styles), `astro.config.mjs`, `public/`, `package.json`, plus the deploy files where they bear on a finding. Report only; nothing below has been fixed.

Severity: **P1** bug, **P2** should fix, **P3** nit. Line numbers refer to the working tree on 2026-11-18.

## P1

### P1-1. Discord webhook URL ships to every visitor
`src/config/settings.ts:3-4`, `src/components/Contact.astro:118`, `src/components/Contact.astro:173`

The contact form decodes a base64 string and POSTs straight to a Discord webhook from the browser. Base64 is not protection. The blob is inlined into the built `dist/index.html` (verified after `npm run build`), so anyone can read it from page source. A Discord webhook URL embeds its own token: whoever has it can post arbitrary messages to the channel, and can also rename or delete the webhook, which would silently break the form. The deploy tooling already expects a server-side relay that keeps the webhook in `contact.secret` (`scripts/deploy.ps1:95`, `deploy/CADDY.md`, `deploy/fable-tetrazero.service:10`), but the client was never switched to it. Also, `server/contact.py`, which the service unit and `deploy.ps1:66` start, is not tracked in the repo, so I could not confirm the relay exists. Treat the current webhook as leaked: it has been in the tracked file since the initial commit. Rotate it, and send the form to the same-origin relay.

## P2

### P2-1. Messages longer than 1,024 characters always fail to send
`src/components/Contact.astro:92`, `src/components/Contact.astro:182-185`

Each form value goes into a Discord embed field. Discord caps an embed field value at 1,024 characters and a whole embed at 6,000. The textarea has no `maxlength` and the validator only enforces a minimum of 10 characters. A visitor who writes a detailed message gets a 400 from Discord and the generic "Something went wrong" error, with no hint of why. Retrying fails the same way. This becomes moot if P1-1 moves sending to a server that can split or truncate, but the client still needs a length limit or a split.

### P2-2. Skills podium shows on mobile and tablet despite `hidden lg:block`
`src/styles/global.css:250-256`, `src/components/Skills.astro:23`

`.iso { display: grid }` is written as plain, unlayered CSS in `global.css`. Tailwind 4 emits `.hidden` inside `@layer utilities`, and unlayered rules beat layered ones whatever their specificity. I confirmed this in the built CSS: `.iso` sits outside any layer, while `.hidden` and `.lg:block` are in `@layer utilities`. As a result, the 150 px podium renders below `lg` beside the "Skills" heading, which takes width from the title on small screens. The same mechanism makes `.card { border-radius: 1.25rem }` override `rounded-2xl` on `Contact.astro:29` and `:60`. That one is only cosmetic.

### P2-3. `text-faint` small text fails WCAG AA contrast
`src/styles/global.css:15`, `src/components/Experience.astro:108`, `src/components/Skills.astro:35`

`--color-faint: #626262` measures about 3.2:1 on `--color-surface` (`#0e0e10`, the Experience background) and about 3.4:1 on black. Both uses are `text-xs` mono labels: the Experience group labels ("Professional", "Research", …) and the Skills sub-indexes ("04.1"). WCAG 1.4.3 requires 4.5:1 for text this size. The group labels carry real information, so this matters more than a decorative index would.

### P2-4. Contact form errors are not exposed to assistive tech
`src/components/Contact.astro:64-98`, `src/components/Contact.astro:124-130`, `src/components/Contact.astro:163-167`

On a failed submit, the script only toggles a red border and un-hides a `<p>`. Inputs get no `aria-invalid`, error paragraphs are not linked through `aria-describedby`, the paragraphs are not live regions, and focus stays on the button. A screen-reader user presses "Send message" and hears nothing: no error and no field to fix. The success and error status line does have `role="status"`, so only validation errors are affected.

### P2-5. Privacy policy does not describe what the site actually does
`src/pages/privacy.astro:17-44`, `src/layouts/Base.astro:59-65`

GA4 loads unconditionally on every page, and form contents go to Discord, a third party. The policy mentions "Analyze website usage" in general terms but never names Google Analytics, cookies or Discord. It also says personal information is not transferred to third parties. A visitor reading the policy gets an inaccurate picture. The owner is EU-based, and GA4 runs with no consent step. Whether that requires a consent banner is a regulatory question I am not asserting an answer to. It is worth checking against the CNIL's own guidance on audience-measurement cookies.

## P3

### P3-1. Reduced-motion and static scenes are not drawn at the rest pose
`src/scripts/iso/engine.ts:439-441`

Every scene gets a staggered start phase `(i * 0.37) % 1`, including static ones (`animated = false`, from reduced motion or `data-iso-static`). A static scene is drawn once at that phase. It therefore freezes part-way through a collapse or explode, with up to ±0.3 rad of yaw, instead of at the resting exploded pose the modules are designed for. This affects the Experience mini icons and every module under `prefers-reduced-motion`. A static scene could use phase 0.

### P3-2. `npm run build` does not typecheck, and `engine.ts` has type errors
`package.json:8-14`, `src/scripts/iso/engine.ts:377`, `src/scripts/iso/engine.ts:383`

Neither `typescript` nor `@astrojs/check` is installed, and `astro build` does not typecheck client scripts. A one-off `tsc --strict` run reports TS2339 `Property 'pointerType' does not exist on type 'Event'` twice. The cause is that `closest()` returns `Element`, whose event map has no pointer events. The code works at runtime, but a green build here does not mean the scripts typecheck.

### P3-3. `<span>` is a direct child of `<ol>`
`src/components/Experience.astro:63-67`

The timeline rail `<span>` sits directly inside `<ol>`, which only allows `<li>` children. This is invalid HTML. Some screen readers announce list item counts from the children, and validators flag it. Moving the rail to the wrapping `div` avoids it.

### P3-4. Smooth scrolling ignores reduced motion
`src/styles/global.css:34`

`scroll-behavior: smooth` is applied globally. Every other motion effect is gated on `prefers-reduced-motion`, but anchor jumps from the dock and buttons still animate for users who opted out.

### P3-5. Weak focus indicator on form fields
`src/styles/global.css:476-480`

`.field:focus` removes the outline and relies on a border change to `#4cc9ff66`. Over the surface color, that gives roughly 2.5:1, below the 3:1 non-text contrast target (WCAG 1.4.11). Keyboard users can lose track of the focused field.

### P3-6. Status message can vanish early
`src/components/Contact.astro:160`

Each `showStatus` call schedules a hide 6 s later without clearing the previous timer. If a second submit happens within 6 s, the first timer hides the second message early.

### P3-7. Legal pages reuse the home page meta description
`src/layouts/Legal.astro:13`, `src/layouts/Base.astro:12`

`/privacy/` and `/terms/` pass only `title`, so they inherit the portfolio description and `og:description`. The three pages end up with duplicate descriptions in search results and link previews.

### P3-8. Dead module mapping for AnimeManager
`src/components/Projects.astro:30`

`AnimeManager` is mapped to `shelf`, but it has `featured: false` in `src/data/projects.json`, and only featured projects render. The entry is dead code. If the intent was to feature it, the data is wrong instead.

### P3-9. Stock Astro favicon served publicly
`public/favicon.svg`

The file is the default Astro logo. Nothing references it (`Base.astro` uses `.webp` and `.ico`), but it is deployed at `/favicon.svg`, and some tools probe that path.

### P3-10. GA4 also fires in dev and preview
`src/layouts/Base.astro:59-65`

The tag is not gated on `import.meta.env.PROD`, so `npm run dev` and `npm run preview` sessions send hits to the production property and skew the numbers.

### P3-11. Hero text stays invisible until webfonts finish loading (uncertain impact)
`src/scripts/animations.ts:13-18`, `src/styles/global.css:447-456`

`[data-hero-fade]` starts at `opacity: 0`, and the fade-in waits for `document.fonts.ready` plus two frames. On a slow connection, the hero text (the LCP candidate) stays hidden until the Google Fonts files arrive, even though `display=swap` would have shown fallback text earlier. I have not measured this. Worth a Lighthouse run on a throttled profile before changing anything.

### P3-12. Duplicate Citeos bullet across two tracks (content)
`src/components/About.astro:13`, `src/components/About.astro:27`

The Freelance and AI Tooling cards both list the Citeos streetlight-audit result, almost word for word. It may be intentional; it reads as repetition when the cards sit side by side.

## Categories checked with nothing to report

- **GA4 snippet**: the loader and `gtag` bootstrap are correct, and the measurement ID is the same in both places. The only issues are policy (P2-5) and dev traffic (P3-10).
- **Duplicate ids**: none found. `nav-toggle`, `nav-menu`, `contact-form`, `form-status`, the `cf-*` ids and the section ids are all unique.
- **Internal links**: every in-page anchor (`#top`, `#stats`, `#about`, `#projects`, `#experience`, `#skills`, `#contact`) resolves, and `/privacy/` and `/terms/` match `trailingSlash: 'always'`. External URLs were not fetched.
- **Event listener leaks**: none. It is a single page, and the iso, cursor, nav and scroll-spy listeners are each bound once at load.
- **Animation race conditions**: none confirmed. The shared iso rAF stops when idle, hidden duplicate scenes (the two Hero `mark` instances) never get scheduled while `display: none`, and the 4 s assembly failsafe is harmless for off-screen scenes.
- **SEO and meta**: canonical, OG and Twitter tags are consistent, and the declared `og:image` size (512×512) matches the file. The extra `public/anthropic-academy-fr/` page carries `noindex, nofollow`.
- **Data**: every Skills icon file exists, every Experience id is in `idOrder`, and every `data-module` value resolves to a key in `MODULES`.
