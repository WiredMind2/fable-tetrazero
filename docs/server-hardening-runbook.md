# Server hardening runbook — william-server (sudo required)

Items from `docs/security-audit-2026-11-18.md` that could not be executed from an
agent session (no passwordless sudo). Work top to bottom; each block is independent.
Verify after each step. Run from any shell on the server (`ssh tetrazero`, then `sudo -i`).

## 1. Reboot (do first — kernel updates pending since Nov 13)

```bash
cat /var/run/reboot-required   # confirm still pending
sudo reboot
# after it's back:
uptime -s && ls /var/run/reboot-required 2>/dev/null || echo "reboot clean"
systemctl --user status fable-tetrazero   # site origin should be active again
curl -sI http://127.0.0.1:3080/ | head -1
```

## 2. sshd: disable password auth explicitly

Currently only `KbdInteractiveAuthentication no` is set; password auth falls back to
the distro default (allowed). Cloudflare Access protects the public route, but direct
LAN reach on :22 makes this worth closing.

```bash
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'   # see current effective values
printf 'PasswordAuthentication no\nPermitRootLogin no\n' | sudo tee /etc/ssh/sshd_config.d/20-hardening.conf
sudo sshd -t && sudo systemctl reload ssh
# KEEP AN EXISTING SESSION OPEN; verify from a NEW terminal that key login still works.
```

## 3. Firewall: default-deny inbound

Everything public arrives via the Cloudflare tunnel (outbound) and Tailscale, so inbound
defaults can be closed. Adjust `allow` lines if you deliberately want LAN SSH:

```bash
sudo ufw status verbose
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0          # tailnet traffic stays open
sudo ufw enable
sudo ufw status verbose
```

## 4. Caddy admin API back to localhost

`:2019` is the Caddy admin endpoint (config mutation) and is currently bound to `*`.
The Caddyfile is generated — **edit the generator, not the Caddyfile**
(`~/TetrazeroDashboard/proxy/generate_caddyfile.py`): add a global option so the rendered
file starts with `{\n\tadmin localhost:2019\n}`. Then regenerate + reload per the
dashboard's normal procedure.

## 5. Identify the mystery listeners, then scope or disable

```bash
sudo ss -tlnp | grep -E ':(8080|3020|6333|6334|9000)\b'   # get process names/owners
```

Known so far: `:8092` is `william`'s `python -m src.main start`; `:9000` is the dashboard
behind `dashboard.tetrazero.com`; `:6333/:6334` are likely a JetBrains/IDE backend.
For each: if it only needs to be reachable through the tunnel/Caddy, rebind it to
`127.0.0.1` in its config. If unused, stop + disable it.

## 6. Legacy services on all interfaces

```bash
sudo systemctl disable --now apache2      # only if truly unused (Caddy serves everything)
systemctl status vsftpd 2>/dev/null || systemctl status ftpd 2>/dev/null   # identify the :21 FTP server
sudo systemctl disable --now vsftpd       # if unused; FTP is plaintext — do not expose
sudo systemctl disable --now smbd nmbd    # Samba 139/445/137, if unused
systemctl status xrdp 2>/dev/null         # :3389 RDP — if remote access goes via CF Access, bind to localhost or disable
```

## 7. Verify

```bash
sudo ss -tlnp | awk 'NR>1 && $4 !~ /^127\.|^\[::1\]/ && $4 !~ /^172\.(1[6-9]|2[0-9]|3[01])\./'
# expect: only tailscale-interface entries and anything you deliberately kept open
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
sudo ufw status verbose
```

## 8. Local (no sudo): remove stale worktrees — all sit on commits already in master

```bash
cd /c/Users/willi/Documents/Web/fable-tetrazero
git worktree remove .worktrees/portfolio-renando-theme
git worktree remove /c/Users/willi/Documents/Web/fable-tetrazero-signal-blocks-20261014
git worktree remove /c/Users/willi/Documents/Web/fable-tetrazero-system-landscapes
git worktree list   # only the main checkout should remain
```

## 9. Later: flip CSP to enforcing

`server/contact.py` ships `Content-Security-Policy-Report-Only`. Browse the site with
the console open (normal browsing for a few days); if no violations appear beyond the
policy's allowances, rename the header key to `Content-Security-Policy` in
`SECURITY_HEADERS` and deploy.
