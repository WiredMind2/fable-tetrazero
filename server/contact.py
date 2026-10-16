#!/usr/bin/env python3
"""Localhost static + contact API for tetrazero.com (stdlib only)."""

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
DIST = ROOT / "dist"
NYC_TRIP_ROOT = Path("/var/www/nyc_trip")
NYC_TRIP_PREFIX = "/nyc_trip"
CALENDAR_ROOT = Path("/var/www/calendar")
CALENDAR_PREFIX = "/calendar"
SECRET_FILE = ROOT / "contact.secret"

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

_rate_lock = threading.Lock()
_rate_hits: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or handler.client_address[0]
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


def _lookup_static(url_path: str) -> Path | None:
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
    return _safe_root_path(raw, DIST)


def _safe_dist_path(url_path: str) -> Path | None:
    return _lookup_static(url_path)


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
        headers={"Content-Type": "application/json", "User-Agent": "tetrazero-contact/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status >= 400:
            raise RuntimeError(f"Discord returned {resp.status}")


class Handler(BaseHTTPRequestHandler):
    server_version = "tetrazero-contact/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {fmt % args}", file=sys.stderr)

    def _send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

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
        self.end_headers()

    def _send_file(self, path: Path) -> None:
        data = path.read_bytes()
        self._send_static_headers(path, data)
        self.wfile.write(data)

    def do_HEAD(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path in ("/api/contact", "/api/contact/"):
            self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            return
        path = _safe_dist_path(parsed.path)
        if path is None:
            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()
            return
        try:
            data = path.read_bytes()
        except OSError:
            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()
            return
        self._send_static_headers(path, data)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path in ("/api/contact", "/api/contact/"):
            self._send_json(HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "Method not allowed"})
            return

        path = _safe_dist_path(parsed.path)
        if path is None:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            self._send_file(path)
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND)

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
