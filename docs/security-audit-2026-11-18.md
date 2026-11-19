# Security audit — tetrazero.com (2026-11-18)

Scope: local repo (`fable-tetrazero`), live site through Cloudflare, and the origin
server (`william-server`, via SSH). All server commands were read-only.
Overlap noted with `docs/claude-review-2026-11-18.md` (its P1-1 = finding 1 below, still unfixed).

## Executive summary

The site is a small static Astro build behind Cloudflare → cloudflared tunnel → Caddy →
a stdlib Python static+API server (`contact.py`, 127.0.0.1:3080). Architecture soundness is
good — no inbound ports needed, traversal checks hold live, no plaintext secrets in git
history — but there is **one critical live secret leak**, one missing production security
component in version control, missing security headers sitewide, a critical-severity
Astro dependency advisory, and a surprisingly broad set of services listening on all
interfaces on the origin server.

### Top actions, in order

1. **Rotate the Discord webhook today** (finding 1) — it is live-leaked.
2. Switch the contact form back to the server-side relay `/api/contact` and restore
   `server/contact.py` to the repo (findings 1–2).
3. Add security headers at Caddy or Cloudflare (finding 3).
4. `npm audit fix` now; plan the Astro 7 upgrade (finding 4).
5. Reboot the server (kernel updates pending since Nov 13) and review the all-interface
   listeners (findings 5a/5b).

---

## Findings

### 1. CRITICAL — Discord webhook URL leaked to every visitor (and in git history)

**Evidence (verified live 2026-11-18):**
- `src/config/settings.ts` holds the webhook base64-encoded; the contact form
  (`src/components/Contact.astro:173`) decodes it in the browser and POSTs **directly to
  Discord**, bypassing the server relay entirely.
- The full base64 blob is inlined in the deployed page: `curl -s https://tetrazero.com/ |
  grep aHR0cHM6Ly9kaXNjb3Jk` returns it (webhook id `1439967046342283296`).
- It has been in a tracked file since the initial commit → it is in git history permanently.
- The server-side `contact.secret` (mode 600, correct) contains the **same webhook**
  (sha256 match `9bc815f2…` vs locally computed hash of the leaked URL).

**Impact:** anyone who views source can post arbitrary messages/embeds to your Discord
channel (spoofed "contact submissions", offensive content, phishing you via your own
channel) and can rename/delete the webhook, silently breaking the form. Rate limiting and
validation in `contact.py` are bypassed because the browser talks to Discord directly.

**Fix:**
1. Rotate the webhook in Discord now (it's burned — assume known).
2. Point the form at `fetch('/api/contact', …)` — the hardened relay is already running
   (`fable-tetrazero.user.service`, live, PID confirmed).
3. Delete the webhook from `settings.ts`; add a honeypot input named `website` to the
   client form (the server's honeypot only works if the field exists in the DOM).
4. Write the new webhook to `/var/www/fable-tetrazero/contact.secret` (600) — deploy.ps1:95
   already documents this flow.

### 2. HIGH — Production security component `server/contact.py` not in version control

The live origin server's source exists only as an **untracked** file on the server
(`git status` there shows `?? server/`) and a stale `__pycache__` locally. It was deleted
from the repo in commit `cc78bc0` but is still started by `deploy/fable-tetrazero*.service`
and still pkill'd/restarted by `scripts/deploy.ps1:66`. A security boundary that exists in
exactly one untracked copy is one `rm` away from disappearing. The last committed version
(recoverable via `git show c3afebb:server/contact.py`) matches what's running.

**Fix:** restore `server/contact.py` from git history, commit it, and keep deploys from a
tracked file. (Audited version is well written: `..`-segment check + `resolve()` +
`relative_to()` traversal guard — live traversal attempts returned 404 — body/field caps,
email regex, honeypot, per-IP rate limit, SSRF allowlist on the webhook prefix, binds
127.0.0.1 only.)

### 3. HIGH — No security headers on the live site

Live response headers (via Cloudflare) carry none of:

`Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`,
`X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`.

Also `www.tetrazero.com` serves an identical 200 (no apex redirect) — duplicate-origin
hygiene.

**Fix:** add `header` directives in the Caddyfile generator (`generate_caddyfile.py`) or
Cloudflare Transform Rules for both hostnames, and 301 www → apex. Suggested starter set:
`Strict-Transport-Security: max-age=31536000; includeSubDomains`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
and a CSP that at minimum restricts `script-src` to self + `googletagmanager.com` +
`fonts.googleapis.com`-related origins (watch the inline scripts; Astro's bundled scripts
will need hashes or `'unsafe-inline'` as a first step).

### 4. HIGH — 12 dependency advisories incl. critical in Astro itself

`npm audit`: **1 critical, 10 high, 1 low**. Installed: astro 6.4.6 (advisory range
≤7.4.6 — multiple XSS chains plus RCE via image optimization), vite 7.3.5 (range
7.0.0–7.3.6), esbuild 0.27.7 (**arbitrary file read via dev server on Windows** — you
develop on Windows), sharp 0.34.5.

Exposure context, honestly stated: the site builds fully static, so several runtime
advisories (SSR/image endpoint/dev-server) are not reachable in production; the practical
risk is on your dev/build machines running `npm run dev`/`build` with vulnerable tooling.

**Fix:** run `npm audit fix` now — 10 of 12 fixable without breaking changes (devalue,
js-yaml, nanoid, postcss, smol-toml, source-map-js, svgo, zod). Plan the Astro 7.4.13
major bump for the critical chain.

### 5. MEDIUM — Origin server attack surface (read-only checks; no sudo available)

a) **Reboot pending since Nov 13** (`/var/run/reboot-required`; booted Sep 25). Kernel/
   libc fixes aren't active until rebooted. `unattended-upgrades` is active and apt ran
   Nov 17 — good.

b) **All-interface listeners** (`ss -tlnp`, process owner hidden without sudo where
   marked): `:22` sshd (public path is behind Cloudflare Access, but direct LAN reach
   stays open; `PasswordAuthentication` is not explicitly set anywhere in
   sshd_config/sshd_config.d — Ubuntu default allows passwords, unverified at runtime),
   `:21` **FTP**, `:139/:445` + UDP `:137` **Samba**, `:3389` **RDP**, `:2019` **Caddy
   admin API** (default is localhost-only — binding `*` exposes config mutation to the
   LAN), `:9080` Caddy, `:80` Apache (still active although Caddy serves everything via
   tunnel; `.htaccess` is inert under this stack), plus `:3020`, `:9000`, `:8080`,
   `:8092`, `:6333/:6334` app ports.

   Everything works through the Cloudflare tunnel, so none of these need non-loopback
   bindings. If the router forwards any of them (RDP/FTP are the classic ones), they are
   internet-exposed — I could not verify forwarding from here.

c) **Fix:** reboot; then for each listener either bind to localhost/tailnet or firewall it
   (ufw status needs sudo — re-run as `sudo ufw status verbose`). Explicitly set
   `PasswordAuthentication no` and `PermitRootLogin no` in sshd_config (then
   `sudo sshd -t && sudo systemctl reload ssh`). Identify the owners of
   8080/3020/6333/6334 (`sudo ss -tlnp`). Disable Apache if truly unused. Confirm Caddy
   admin is `localhost:2019`.

### 6. MEDIUM — Rate limiter trusts the first `X-Forwarded-For` value

`contact.py` `_client_ip()` takes `XFF.split(",")[0]`. Cloudflare **appends** the visitor
IP to a client-supplied XFF, so a request with `X-Forwarded-For: 1.2.3.4` arrives as
`1.2.3.4, <real-ip>` and the limiter keys on the spoofed value → unlimited fake identities.
Dormant today (the form bypasses the relay — finding 1) but becomes live again the moment
the relay is re-adopted.

**Fix:** key on the **rightmost** non-trusted hop or `CF-Connecting-IP` once traffic
reaches contact.py only via Cloudflare→Caddy.

### 7. LOW — Dotfiles in `dist/` are served

`https://tetrazero.com/.htaccess` returns 200 (contact.py serves any file under dist/).
Content is benign redirect rules, but it shouldn't be fetchable and proves the class.

**Fix:** in `contact.py._safe_root_path`, reject path parts starting with `.`; and/or
remove `public/.htaccess` from a Caddy-served deployment.

### 8. LOW — Default `http.server` error pages disclose stack

The live 404 page is Python's stock "Error response" page. Cosmetic fingerprinting.

**Fix:** serve a branded `404.html` from dist and `send_response` + custom body instead of
`send_error`.

### 9. LOW — Live user systemd unit runs unsandboxed

The **system** unit has `NoNewPrivileges`/`PrivateTmp`; the **user** unit (the one actually
active) has neither. Impact is small (localhost-only, runs as `william`), but the system
unit's hardening should be mirrored where possible.

### 10. LOW — Privacy policy doesn't match reality

GTM (`GTM-NXG9VLKT`) loads for every visitor but `privacy.astro` mentions no
analytics/cookies/third parties, and the form ships names/emails to Discord. For EU
visitors this is a GDPR gap more than a technical one.

**Fix:** disclose Google (GTM) and Discord processing in the privacy page; consider a
consent gate for GTM; also delete the vestigial `gtag()`/`dataLayer` shim in
`Base.astro:60-64` (leftover from the GA4 era, does nothing with GTM).

### 11. INFO / hygiene

- `scripts/cache.db` (update_projects cache) isn't gitignored; `deploy.ps1` runs
  `git add -A`, so it can be swept into a commit. The .gitignore comment shows this class
  of accident already happened once (`.agents/`, `.zcode/`).
- `scripts/obfuscate.py` referenced by `settings.ts` doesn't exist.
- `.worktrees/portfolio-renando-theme/` holds a stale full copy incl. an old `dist/` —
  clutter, and a stale-build-deploy hazard.
- GTM loaded without SRI — normal (dynamic script, SRI impossible); CSP is the right tool.
- XSS sweep: only one `innerHTML` sink (`src/scripts/iso/engine.ts:335`) and all its
  inputs are computed from static constants — safe. No other sinks; Astro auto-escaping
  covers the rest. No secrets in any of the 41 commits in plaintext (verified; the only
  leaked secret is the base64 webhook of finding 1).

## What's already good

- Cloudflare tunnel architecture: the website needs zero inbound ports.
- SSH public path behind Cloudflare Access; skill-managed key aliases.
- `contact.py`: traversal guard (verified live), size/length caps, honeypot, SSRF
  allowlist, localhost-only bind, custom `server_version`.
- Secrets hygiene in scripts: `update_projects.py` uses env vars only; `.gitignore`
  covers `.env*` and `contact.secret`; server file is mode 600.
- `unattended-upgrades` active; apt history current.
- HTTP→HTTPS enforced at the edge (301).

## Re-verification commands

```bash
# webhook leak (should be empty after fix):
curl -s https://tetrazero.com/ | grep -c aHR0cHM6Ly9kaXNjb3Jk
# headers (should list HSTS etc. after fix):
curl -sI https://tetrazero.com/ | grep -iE 'strict-transport|content-security|x-content-type|referrer|x-frame|permissions'
# relay adoption (form should POST here, 405 on GET is expected):
curl -s -o /dev/null -w '%{http_code}\n' https://tetrazero.com/api/contact
# deps: npm audit
# server: sudo ufw status verbose; sudo ss -tlnp; systemctl is-active fable-tetrazero
```
