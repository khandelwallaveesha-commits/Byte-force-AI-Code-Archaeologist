"""
api/ai-status.py — does this deployment have an AI key?

Vercel turns every file under api/ into its own serverless function, named
after the file, so this answers GET /api/ai-status. server.py answers the
same URL locally, which is why one build works in both places.

The page asks this once on load. If the answer is no, the chat says so and
falls back to its own rule-based answers rather than looking broken.

Deliberately self-contained: Vercel bundles each function separately, and a
shared import is one more thing that can fail at build time on a demo day.
"""

import json
import os

from http.server import BaseHTTPRequestHandler

DEFAULT_MODEL = "openai/gpt-oss-120b"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        key = os.environ.get("AI_API_KEY", "").strip()
        model = os.environ.get("AI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

        body = json.dumps({
            "enabled": bool(key),
            "model": model if key else None,
            "reason": None if key else (
                "No AI key is set on this deployment, so answers come from the "
                "built-in rules."
            ),
        }).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
