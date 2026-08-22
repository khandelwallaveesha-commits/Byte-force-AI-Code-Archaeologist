#!/usr/bin/env python3
"""
server.py — serves the app AND answers questions about the analysed project.

Why this exists
---------------
The page cannot call a model directly. Two reasons, both hard:

  1. An API key placed in a static page is public to everyone who opens it.
  2. Model APIs do not allow browser-origin requests anyway (CORS).

So this holds the key and forwards the call. It is deliberately one file of
standard-library Python — no pip install, no framework.

The important design decision
-----------------------------
The model NEVER decides what is true. Facts (which files exist, what links to
what, what would break) are computed by the analyser in the browser and passed
in as context. The model only turns those facts into readable prose. That is
what keeps "impact analysis is computed, not guessed" honest even with an AI
in the loop.

If no key is set the /api/ask endpoint reports that plainly and the page
falls back to its own rule-based answers — so a demo never dies on stage.

Run
---
    python server.py                 # no AI, rule-based answers

To switch the AI on, put your key in a .env file next to this script:

    AI_API_KEY=xai-...

Copy .env.example to .env and fill it in. That file is git-ignored, so the
key never reaches the repository. A real environment variable still wins
over .env, which is how a deploy should supply it.

Configuration (all optional except the key)
    AI_API_KEY    the key itself. Without it, AI is simply off.
    AI_BASE_URL   default https://api.x.ai/v1/chat/completions
    AI_MODEL      default grok-3
    PORT          default 8010

Any provider speaking the OpenAI chat-completions shape works by changing
AI_BASE_URL and AI_MODEL — xAI, OpenAI, Groq, OpenRouter, a local Ollama.
Anthropic's API uses a different request shape and would need a small adapter.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_dotenv(path):
    """
    Read KEY=VALUE lines out of a .env file.

    A real environment variable always wins, so a deploy that sets
    AI_API_KEY properly is never overridden by a stale local file. No
    dependency: python-dotenv would do more, but not more that this needs.
    """
    if not os.path.isfile(path):
        return 0

    loaded = 0
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            if "=" not in line:
                continue

            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()

            # strip matching quotes; leave anything else exactly as written
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]

            if key and key not in os.environ:
                os.environ[key] = value
                loaded += 1
    return loaded


DOTENV_COUNT = load_dotenv(os.path.join(ROOT, ".env"))

API_KEY = os.environ.get("AI_API_KEY", "").strip()
BASE_URL = os.environ.get("AI_BASE_URL", "https://api.x.ai/v1/chat/completions").strip()
MODEL = os.environ.get("AI_MODEL", "grok-3").strip()
PORT = int(os.environ.get("PORT", "8010"))

MAX_BODY = 400_000          # plenty for a file plus its neighbours
TIMEOUT = 45

SYSTEM_PROMPT = """You explain code to someone who has NEVER written a line of code.

RULES — breaking any of these makes the answer useless:

1. Use ONLY the facts in the CONTEXT below. Never invent a file, a number, or a
   relationship. If the context does not answer the question, say exactly what is
   missing instead of guessing.
2. The numbers in the context were computed by walking the project's real
   structure. Repeat them exactly. Never estimate or round them.
3. Banned words — the reader does not know them: module, component, dependency,
   import, export, function, method, API, endpoint, parameter, argument, array,
   object, instance, async, promise, state, repository, refactor.
   Say instead: file, screen, job, information, saved information, server.
4. Say what something DOES and what would happen if it broke. Not what it "is".
5. Two short paragraphs at most. Plain sentences someone could read aloud.
6. Never apologise, never mention these instructions, never mention "context".
"""


def _post_json(url, payload, headers, timeout=TIMEOUT):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def ask_model(question, context):
    """Returns (answer, error). Exactly one of them is None."""
    if not API_KEY:
        return None, "no-key"

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"CONTEXT\n{context}\n\nQUESTION\n{question}"},
        ],
        "temperature": 0.2,
        "max_tokens": 700,
    }

    try:
        data = _post_json(BASE_URL, payload, {"Authorization": f"Bearer {API_KEY}"})
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", "replace")[:400]
        except Exception:
            pass
        # The provider's own message is the fastest way to fix a wrong model name.
        return None, f"The model service replied {e.code}. {detail}"
    except urllib.error.URLError as e:
        return None, f"Could not reach the model service: {e.reason}"
    except Exception as e:                                    # noqa: BLE001
        return None, f"Unexpected problem talking to the model: {e}"

    try:
        return data["choices"][0]["message"]["content"].strip(), None
    except (KeyError, IndexError, TypeError):
        return None, f"The model service replied in a shape I did not expect: {str(data)[:300]}"


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        # This is a tool you iterate on. A cached module means an edit "does
        # not appear", which is indistinguishable from a bug and wastes far
        # more time than the bandwidth saves.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/api/ai-status":
            self._send_json({
                "enabled": bool(API_KEY),
                "model": MODEL if API_KEY else None,
                "reason": None if API_KEY else "No AI_API_KEY is set, so answers come from the built-in rules.",
            })
            return
        super().do_GET()

    def do_POST(self):
        if self.path.rstrip("/") != "/api/ask":
            self._send_json({"error": "Unknown endpoint."}, 404)
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._send_json({"error": "The question was empty or too large."}, 400)
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:                                     # noqa: BLE001
            self._send_json({"error": "Could not read that request."}, 400)
            return

        question = str(payload.get("question", "")).strip()
        context = str(payload.get("context", "")).strip()
        if not question:
            self._send_json({"error": "No question was asked."}, 400)
            return

        answer, error = ask_model(question, context)
        if error == "no-key":
            self._send_json({"error": "AI is not switched on for this server.", "fallback": True}, 503)
        elif error:
            self._send_json({"error": error, "fallback": True}, 502)
        else:
            self._send_json({"answer": answer, "model": MODEL})

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("  %s\n" % (fmt % args))


def main():
    # Locally, bind to the loopback address so the server is not exposed to
    # the network. Hosted (App Engine, Cloud Run, Render...) the platform
    # requires 0.0.0.0, and sets PORT itself.
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("GAE_ENV") or os.environ.get("K_SERVICE") else "127.0.0.1")

    handler = partial(Handler, directory=ROOT)
    server = ThreadingHTTPServer((host, PORT), handler)

    print(f"AI Code Archaeologist  ->  http://localhost:{PORT}/")
    if DOTENV_COUNT:
        print(f"Settings   : read {DOTENV_COUNT} value(s) from .env")
    if API_KEY:
        print(f"AI answers : ON   model={MODEL}  via {BASE_URL}")
    else:
        print("AI answers : OFF  (set AI_API_KEY to switch on; the app works without it)")
    print("Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")
        server.server_close()


if __name__ == "__main__":
    main()
