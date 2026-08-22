# Putting this on the internet, on Google, for free

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

## Which to choose

For a hackathon demo, **Option A**. It is free with no card, deploys in one
command, and the parts judges will actually poke at — upload a repo, watch the
map build, click a file, ask what breaks — are all client-side and work fully.

Take Option B only if an AI-written answer is central to what you are showing.

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
