"""
api/ask.py — answers a question about the analysed project.

Vercel turns every file under api/ into its own serverless function, so this
answers POST /api/ask. server.py answers the same URL locally; the browser
code cannot tell the difference.

The important design decision, unchanged from server.py
------------------------------------------------------
The model NEVER decides what is true. Which files exist, what links to what,
what would break — all of that is computed by the analyser in the browser and
arrives here as context. The model only turns those facts into readable
prose. That is what keeps "impact analysis is computed, not guessed" honest
even with an AI in the loop.

Configuration comes from Vercel's environment variables (Project → Settings →
Environment Variables), never from a file in the repository:

    AI_API_KEY    the key itself. Without it the page falls back to its rules.
    AI_BASE_URL   default Groq
    AI_MODEL      default openai/gpt-oss-120b

Deliberately self-contained and standard-library only: no requirements.txt,
so there is nothing to install and nothing to go wrong at build time.
"""

import json
import os
import re
import urllib.error
import urllib.request

from http.server import BaseHTTPRequestHandler

DEFAULT_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"

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


def ask_model(question, context):
    """Returns (answer, error). Exactly one of them is None."""
    key = os.environ.get("AI_API_KEY", "").strip()
    if not key:
        return None, "no-key"

    base_url = os.environ.get("AI_BASE_URL", "").strip() or DEFAULT_BASE_URL
    model = os.environ.get("AI_MODEL", "").strip() or DEFAULT_MODEL

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"CONTEXT\n{context}\n\nQUESTION\n{question}"},
        ],
        "temperature": 0.2,
        "max_tokens": 700,
    }

    req = urllib.request.Request(
        base_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            # Groq sits behind Cloudflare, which rejects Python's default
            # "Python-urllib/3.x" agent with a 403 (error 1010) before the
            # request ever reaches the API. Identify properly.
            "User-Agent": "AICodeArchaeologist/1.0 (+https://github.com/khandelwallaveesha-commits/Byte-force-AI-Code-Archaeologist)",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", "replace")[:400]
        except Exception:                                     # noqa: BLE001
            pass
        # The provider's own message is the fastest way to fix a wrong model name.
        return None, f"The model service replied {e.code}. {detail}"
    except urllib.error.URLError as e:
        return None, f"Could not reach the model service: {e.reason}"
    except Exception as e:                                    # noqa: BLE001
        return None, f"Unexpected problem talking to the model: {e}"

    try:
        message = data["choices"][0]["message"]
    except (KeyError, IndexError, TypeError):
        return None, f"The model service replied in a shape I did not expect: {str(data)[:300]}"

    answer = (message.get("content") or "").strip()

    # Reasoning models put their scratch work in the answer. Qwen wraps it in
    # <think> tags; strip those so the reader never sees the model talking to
    # itself about "banned words".
    answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.S).strip()
    answer = re.sub(r"^<think>.*", "", answer, flags=re.S).strip()

    if not answer:
        # Some models (openai/gpt-oss-20b on Groq) return only a `reasoning`
        # field and an empty `content`. Silently showing that blank looks like
        # the app is broken, so say what happened and let the rules answer.
        return None, (
            f'The model "{model}" replied with no usable text. '
            f"Try a different AI_MODEL — openai/gpt-oss-120b works well here."
        )

    return answer, None


class handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
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
            self._send_json({"error": "AI is not switched on for this deployment.", "fallback": True}, 503)
        elif error:
            self._send_json({"error": error, "fallback": True}, 502)
        else:
            self._send_json({"answer": answer, "model": os.environ.get("AI_MODEL", DEFAULT_MODEL)})
