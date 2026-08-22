# Putting this on the internet, for free

There are two halves to this app, and they host differently:

| | What it is | Hosting |
| --- | --- | --- |
| The app | HTML, CSS, plain JavaScript. No build step. | Any static host |
| `server.py` | Holds the AI key and forwards questions | Needs somewhere that runs Python |

**Everything except the AI answers works on static hosting** — uploading a folder,
pulling a GitHub repo, the analysis, the map, impact, line explanations. The chat
still answers, using the built-in rules; it just says so.

So pick based on whether you need the AI on the live site.

---

## Option A — Firebase Hosting (recommended)

Free, HTTPS included, a `*.web.app` address, no card required on the Spark plan.
The AI is off; everything else works.

**The tooling is already installed.** Node lives in
`C:\Users\lenovo\tools\node-v24.19.0-win-x64` — portable, so nothing was added to
your PATH and no admin rights were needed — and `firebase-tools` is installed
against it. `deploy.cmd` points at both, so you never have to think about it.

Three commands from this folder. The first two are one-offs.

### 1. Sign in

```bat
deploy.cmd login
```

Opens your browser. Use the Google account you want the site under.
**Only you can do this step** — it is your account, not something I can authorise.

### 2. Pick a project

Create one first at <https://console.firebase.google.com> → **Add project**
(any name, skip Analytics if you like). Then:

```bat
deploy.cmd use --add
```

Choose it from the list and give it an alias such as `default`.

### 3. Publish

```bat
deploy.cmd
```

You get a URL like `https://your-project.web.app`. Run that same command again
after any change.

> `firebase.json` is already written and excludes `server.py`, the deploy scripts
> and the docs — **37 files, 311 KB** go up. **Do not run `firebase init hosting`**;
> it will offer to overwrite that config.

On Git Bash, `./deploy.sh` does the same thing.

---

## Option B — Google App Engine (keeps the AI working)

This runs `server.py` itself, so `/api/ask` works and the chat gets real AI
answers. `app.yaml` is already written.

**Requires a billing account on the Google Cloud project.** Usage this small sits
inside the always-free tier, but Google still asks for a card. Check the current
free-tier limits before relying on it — they change.

### 1. Install the Google Cloud CLI

<https://cloud.google.com/sdk/docs/install> (no Node needed for this route.)

```bash
gcloud init
gcloud app create           # choose a region — this cannot be changed later
```

### 2. Deploy with your key

Never commit a real key. Pass it at deploy time:

```bash
gcloud app deploy --set-env-vars AI_API_KEY=xai-...,AI_MODEL=grok-3
```

Or leave the key out entirely and the site behaves exactly like Option A.

```bash
gcloud app browse           # open it
gcloud app logs tail -s default
```

`min_instances: 0` means it scales to zero when nobody is using it, so an idle
demo costs nothing.

---

---

## Option D — Vercel (recommended: free, no card, and the AI keeps working)

The only free option here that runs Python **and** does not ask for a card,
which means `/api/ask` works on the live site and the chat gives real answers
instead of falling back to its rules.

`server.py` is not what runs there. Vercel turns each file under `api/` into
its own small function named after the file, so `api/ask.py` answers
`/api/ask` and `api/ai-status.py` answers `/api/ai-status` — the same two URLs
`server.py` answers locally. The browser cannot tell the difference, and one
build works in both places. Both files are standard-library only: no
`requirements.txt`, nothing to install, nothing to break at build time.

### 1. Import the repository

<https://vercel.com/new> → sign in with GitHub → pick
**Byte-force-AI-Code-Archaeologist** → **Import**.

Leave every setting alone. Framework preset **Other**, no build command, no
output directory. `vercel.json` is already written.

### 2. Add the key

Before the first deploy — or afterwards in **Settings → Environment
Variables**, then **Redeploy**:

| Name | Value |
| --- | --- |
| `AI_API_KEY` | your `gsk_...` key |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1/chat/completions` |
| `AI_MODEL` | `openai/gpt-oss-120b` |

Tick all three environments (Production, Preview, Development).

**Never commit the key.** It belongs in that screen and in your local `.env`,
both of which stay out of the repository.

### 3. Deploy

Vercel builds and gives you `https://your-project.vercel.app`. Every later
`git push` redeploys it on its own.

To check the AI came up, open `/api/ai-status` on the live site. It should say
`"enabled": true`. If it says false, the environment variable did not save, or
the project was not redeployed after it did.

> `ask.py` is allowed 60 seconds in `vercel.json` and gives up on the model at
> 45. Groq answers in about 3–7 seconds; the headroom is for a cold start.
> `.vercelignore` keeps `.env`, `server.py` and the other hosts' files out of
> the upload — the CLI does not read `.gitignore`, so that file matters.

---

## Which to choose

**Option D, Vercel.** It is the only one that is free, needs no card, and
still runs the Python that makes the chat give real answers. Import the repo,
paste three environment variables, done.

Everything the judges will actually poke at — upload a repo, watch the map
build, click a file, follow a branch, ask what breaks — is client-side and
works on every option here. The AI chat is the only difference:

| | Card needed | AI chat |
| --- | --- | --- |
| **D — Vercel** | no | **real answers** |
| B — App Engine | yes | real answers |
| A — Firebase | no | built-in rules |
| C — GitHub Pages | no | built-in rules |

The rule-based fallback is not a failure state — it is why a demo never dies
on stage. But if you can have the real thing for free, have it.

---

## Before you deploy

- **Check `git status`.** `app.yaml` has a commented-out `AI_API_KEY`. If you
  ever fill it in, do not commit that file.
- **Nothing is uploaded by users anywhere.** Files dropped into the app are read
  in the browser and never leave it, on any host. That claim stays true.
- **GitHub links keep working.** `api.github.com` and `raw.githubusercontent.com`
  allow any origin, so fetching a repo works the same from a hosted page.
- The whole app is about 430 KB.

## If the deployed site looks stale

Firebase caches aggressively. `firebase.json` sets `no-cache` on `index.html` and
one hour on assets, so a hard refresh (Ctrl+Shift+R) is enough. The local
`server.py` sends `no-store` and never caches.

## Other free hosts

Nothing here is Google-specific — it is a folder of static files. GitHub Pages,
Netlify and Cloudflare Pages all work with the same folder, and Render or Fly
will run `server.py` if you want the AI without a Google billing account.

---

## Option C — GitHub Pages (no card, no CLI, already half done)

The repository is the site: `index.html` sits at its root and every path in
the app is relative, so Pages can serve the branch as-is. Verified by serving
the folder under a sub-path locally, which is exactly what Pages does.

1. Open the repo → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main`, folder `/ (root)` → **Save**

Live in about a minute at

    https://khandelwallaveesha-commits.github.io/Byte-force-AI-Code-Archaeologist/

Every later `git push` republishes it. `.nojekyll` is committed so Pages
copies the files straight across instead of running them through Jekyll.

The AI chat falls back to the built-in rule answers here, same as Option A —
`server.py` is not running, and `js/lib/ai.js` builds its request URL from
the page's own directory so it reports that cleanly instead of erroring.
