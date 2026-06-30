#!/usr/bin/env python3
"""Base64-encode a Discord webhook URL into src/config/settings.ts."""
import base64
import sys
from pathlib import Path

if len(sys.argv) != 2:
    print("Usage: python scripts/obfuscate.py <webhook_url>")
    sys.exit(1)

url = sys.argv[1]
encoded = base64.b64encode(url.encode("utf-8")).decode("utf-8")

config = Path(__file__).resolve().parent.parent / "src" / "config" / "settings.ts"
config.parent.mkdir(parents=True, exist_ok=True)
config.write_text(
    "// Obfuscated Discord webhook URL (base64). Regenerate with:\n"
    "//   python scripts/obfuscate.py <webhook_url>\n"
    f"export const configData =\n\t'{encoded}';\n",
    encoding="utf-8",
)

print(f"URL encoded and written to {config}")
