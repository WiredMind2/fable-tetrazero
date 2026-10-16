# Caddy: point tetrazero.com at the Python origin

Production contact + static site listens on `127.0.0.1:3080` (`server/contact.py`).
Cloudflare Tunnel still hits Caddy `:9080`; change the tetrazero/www upstream from Apache `:80` to the Python port.

If Caddy is generated from `~/TetrazeroDashboard/services.yaml`, set the tetrazero.com / www backend to `http://127.0.0.1:3080` and regenerate (`proxy/generate_caddyfile.py`), then reload Caddy. Example site block:

```
tetrazero.com, www.tetrazero.com {
	reverse_proxy 127.0.0.1:3080
}
```

Leave the Apache vhost unused for this hostname.

## Process manager

- System unit: [`fable-tetrazero.service`](fable-tetrazero.service) → `/etc/systemd/system/` (needs sudo).
- User unit (no sudo): [`fable-tetrazero.user.service`](fable-tetrazero.user.service) → `~/.config/systemd/user/fable-tetrazero.service`, with `loginctl enable-linger` so it survives logout.

`scripts/deploy.ps1` installs whichever works on the host.

