#!/usr/bin/env python3
"""Localhost static + contact API for tetrazero.com + iamwilli.am (stdlib only)."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

HOST = "127.0.0.1"
PORT = 3080
ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"  # tetrazero.com build (npm run build)
DIST_WM = ROOT / "dist-william"  # iamwilli.am build (npm run build:william)
WILLIAM_HOSTS = {"iamwilli.am", "www.iamwilli.am"}
NYC_TRIP_ROOT = Path("/var/www/nyc_trip")
NYC_TRIP_PREFIX = "/nyc_trip"
CALENDAR_ROOT = Path("/var/www/calendar")
CALENDAR_PREFIX = "/calendar"
SECRET_FILE = ROOT / "contact.secret"
CANONICAL_HOST = "tetrazero.com"

RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW_S = 600
MAX_BODY_BYTES = 32_768
MAX_FIELD_LEN = {
    "name": 100,
    "email": 254,
    "subject": 200,
    "message": 5000,
}

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Baseline browser protections on every response. The CSP ships in Report-Only
# mode first: check the browser console for violations, then flip to enforcing
# by renaming the header once the policy is proven complete.
SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy-Report-Only": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    ),
}

_rate_lock = threading.Lock()
_rate_hits: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    # Cloudflare sets CF-Connecting-IP to the real visitor and overwrites any
    # client-supplied copy, so trust it first. X-Forwarded-For is append-only
    # along the CF -> cloudflared -> Caddy chain, so a spoofed value survives
    # on the LEFT; the rightmost entry is the last proxy we can't fully vouch
    # for but is still far harder to forge than the leftmost.
    cf_ip = handler.headers.get("CF-Connecting-IP", "")
    if cf_ip.strip():
        return cf_ip.strip()
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[-1].strip() or handler.client_address[0]
    return handler.client_address[0]


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    with _rate_lock:
        hits = _rate_hits[ip]
        while hits and now - hits[0] > RATE_LIMIT_WINDOW_S:
            hits.popleft()
        if len(hits) >= RATE_LIMIT_MAX:
            return True
        hits.append(now)
        return False


def _load_webhook() -> str | None:
    env = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    if env:
        return env
    try:
        return SECRET_FILE.read_text(encoding="utf-8").strip() or None
    except OSError:
        return None


def _safe_root_path(url_path: str, root: Path) -> Path | None:
    raw = unquote(url_path)
    if ".." in raw.split("/"):
        return None
    # Dotfiles (.htaccess, .git, …) are never public assets.
    if any(seg.startswith(".") for seg in raw.split("/")):
        return None

    rel = raw.lstrip("/")
    if not rel or rel.endswith("/"):
        candidate = root / rel / "index.html"
    else:
        candidate = root / rel
        if candidate.is_dir():
            candidate = candidate / "index.html"

    try:
        resolved = candidate.resolve()
        resolved.relative_to(root.resolve())
    except (OSError, ValueError):
        return None
    return resolved if resolved.is_file() else None


def _dist_for_host(host: str | None) -> Path:
    """Pick the build output by Host: iamwilli.am serves the William variant."""
    h = (host or "").split(":")[0].strip().lower()
    return DIST_WM if h in WILLIAM_HOSTS else DIST


def _lookup_static(url_path: str, dist: Path) -> Path | None:
    raw = unquote(url_path)
    if raw.startswith("/api/"):
        return None
    if raw == NYC_TRIP_PREFIX or raw.startswith(NYC_TRIP_PREFIX + "/"):
        suffix = raw[len(NYC_TRIP_PREFIX) :] or "/"
        return _safe_root_path(suffix, NYC_TRIP_ROOT)
    if raw == CALENDAR_PREFIX or raw.startswith(CALENDAR_PREFIX + "/"):
        if CALENDAR_ROOT.is_dir():
            suffix = raw[len(CALENDAR_PREFIX) :] or "/"
            found = _safe_root_path(suffix, CALENDAR_ROOT)
            if found is not None:
                return found
    return _safe_root_path(raw, dist)


def _safe_dist_path(url_path: str, dist: Path) -> Path | None:
    return _lookup_static(url_path, dist)


def _discord_embed(data: dict[str, str]) -> dict:
    return {
        "embeds": [
            {
                "title": "New Contact Form Submission",
                "color": 0xC8F750,
                "fields": [
                    {"name": "Name", "value": data["name"], "inline": True},
                    {"name": "Email", "value": data["email"], "inline": True},
                    {"name": "Subject", "value": data["subject"], "inline": False},
                    {"name": "Message", "value": data["message"], "inline": False},
                ],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        ]
    }


def _post_discord(webhook: str, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "fable-contact/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status >= 400:
            raise RuntimeError(f"Discord returned {resp.status}")


class Handler(BaseHTTPRequestHandler):
    server_version = "fable-contact/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {fmt % args}", file=sys.stderr)

    # -- plumbing ---------------------------------------------------------- #

    def _canonical_redirect(self) -> bool:
        """301 www.tetrazero.com -> tetrazero.com, preserving path + query."""
        host = (self.headers.get("Host") or "").split(":")[0].strip().lower()
        if host != f"www.{CANONICAL_HOST}":
            return False
        location = f"https://{CANONICAL_HOST}{self.path}"
        self.send_response(HTTPStatus.MOVED_PERMANENTLY)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self._send_security_headers()
        self.end_headers()
        return True

    def _send_security_headers(self) -> None:
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)

    def _send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(raw)

    def _send_404(self) -> None:
        """Branded 404 (dist/404.html when the build provides it)."""
        page = _dist_for_host(self.headers.get("Host")) / "404.html"
        try:
            body = page.read_bytes()
            ctype = "text/html; charset=utf-8"
        except OSError:
            body = (
                b"<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                b"<title>404</title></head>"
                b"<body><h1>404</h1><p>Nothing here.</p>"
                b"<p><a href=\"/\">Back to home</a></p></body></html>"
            )
            ctype = "text/html; charset=utf-8"
        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def _content_type(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".html":
            return "text/html; charset=utf-8"
        if suffix == ".css":
            return "text/css; charset=utf-8"
        if suffix in (".js", ".mjs"):
            return "text/javascript; charset=utf-8"
        if suffix == ".svg":
            return "image/svg+xml"
        if suffix in (".json", ".webmanifest"):
            return "application/json; charset=utf-8"
        if suffix == ".xml":
            return "application/xml; charset=utf-8"
        if suffix == ".ics":
            return "text/calendar; charset=utf-8"
        ctype, _ = mimetypes.guess_type(str(path))
        return ctype or "application/octet-stream"

    def _send_static_headers(self, path: Path, data: bytes) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", self._content_type(path))
        self.send_header("Content-Length", str(len(data)))
        if path.suffix.lower() == ".ics":
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        self._send_security_headers()
        self.end_headers()

    def _send_file(self, path: Path) -> None:
        data = path.read_bytes()
        self._send_static_headers(path, data)
        self.wfile.write(data)

    # -- methods ----------------------------------------------------------- #

    def do_HEAD(self) -> None:  # noqa: N802
        if self._canonical_redirect():
            return
        parsed = urlparse(self.path)
        if parsed.path in ("/api/contact", "/api/contact/"):
            self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._send_security_headers()
            self.end_headers()
            return
        path = _safe_dist_path(parsed.path, _dist_for_host(self.headers.get("Host")))
        if path is None:
            self.send_response(HTTPStatus.NOT_FOUND)
            self._send_security_headers()
            self.end_headers()
            return
        try:
            data = path.read_bytes()
        except OSError:
            self.send_response(HTTPStatus.NOT_FOUND)
            self._send_security_headers()
            self.end_headers()
            return
        self._send_static_headers(path, data)

    def do_GET(self) -> None:  # noqa: N802
        if self._canonical_redirect():
            return
        parsed = urlparse(self.path)
        if parsed.path in ("/api/contact", "/api/contact/"):
            self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "Method not allowed"})
            return

        path = _safe_dist_path(parsed.path, _dist_for_host(self.headers.get("Host")))
        if path is None:
            self._send_404()
            return
        try:
            self._send_file(path)
        except OSError:
            self._send_404()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path not in ("/api/contact", "/api/contact/"):
            self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found"})
            return

        ip = _client_ip(self)
        if _rate_limited(ip):
            self._send_json(HTTPStatus.TOO_MANY_REQUESTS, {"ok": False, "error": "Too many requests"})
            return

        length_hdr = self.headers.get("Content-Length", "0")
        try:
            length = int(length_hdr)
        except ValueError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid Content-Length"})
            return
        if length < 0 or length > MAX_BODY_BYTES:
            self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "Body too large"})
            return

        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON"})
            return
        if not isinstance(data, dict):
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON"})
            return

        # Honeypot: bots fill this; humans leave it empty.
        if str(data.get("website", "")).strip():
            self._send_json(HTTPStatus.OK, {"ok": True})
            return

        fields: dict[str, str] = {}
        for key in ("name", "email", "subject", "message"):
            val = data.get(key, "")
            if not isinstance(val, str):
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"Invalid {key}"})
                return
            val = val.strip()
            if not val:
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"{key} is required"})
                return
            if len(val) > MAX_FIELD_LEN[key]:
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": f"{key} is too long"})
                return
            fields[key] = val

        if not EMAIL_RE.match(fields["email"]):
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid email"})
            return
        if len(fields["message"]) < 10:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Message too short"})
            return

        webhook = _load_webhook()
        if not webhook or not webhook.startswith("https://discord.com/api/webhooks/"):
            self.log_message("contact.secret / DISCORD_WEBHOOK_URL missing or invalid")
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": "Server misconfigured"})
            return

        try:
            _post_discord(webhook, _discord_embed(fields))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, OSError) as exc:
            self.log_message("Discord webhook failed: %s", exc)
            self._send_json(HTTPStatus.BAD_GATEWAY, {"ok": False, "error": "Delivery failed"})
            return

        self._send_json(HTTPStatus.OK, {"ok": True})


def main() -> None:
    if not DIST.is_dir():
        raise SystemExit(f"Missing dist/ at {DIST} — run npm run build first")

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Listening on http://{HOST}:{PORT} (dist={DIST})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
