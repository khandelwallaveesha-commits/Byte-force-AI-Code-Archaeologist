# AI Code Archaeologist — frontend

An interactive implementation of the three pages described in §12 of the idea
document, running entirely on the mock dataset from §17. No build step, no
dependencies, no backend.

## Run

```bash
python server.py          # http://localhost:8010
```

It must be served over HTTP — the app uses ES modules, which browsers refuse to
load from `file://`. `python -m http.server 8010` also works; you just lose the
AI answers described below.

### Optional: AI-written answers

```bash
set AI_API_KEY=xai-...        # Windows cmd   (PowerShell: $env:AI_API_KEY="...")
export AI_API_KEY=xai-...     # macOS / Linux
python server.py
```

| Variable | Default | |
| --- | --- | --- |
| `AI_API_KEY` | — | without it, AI is simply off |
| `AI_BASE_URL` | `https://api.x.ai/v1/chat/completions` | any OpenAI-shaped endpoint |
| `AI_MODEL` | `grok-3` | if the name is wrong the provider says so, verbatim |
| `PORT` | `8010` | |

The key lives in the server process, never in the page. Anthropic's API uses a
different request shape and would need a small adapter.

**The model never decides what is true.** Retrieval is a graph walk, not a
vector search: the file being asked about, the files that would break without
it, the files it uses, their source, and the numbers the analyser computed. All
of that is passed in as context, and the model only turns it into prose. Impact
numbers stay computed, so "nothing is guessed" is still true with AI switched
on. If the call fails — no key, rate limit, network — the chat says so and
answers from the built-in rules instead, so a demo never dies on stage.

## The three pages

| Route | Page | What works |
| --- | --- | --- |
| `#/` | Landing | Hero that morphs a wall of code into an architecture graph, animated counters, feature grid, live impact preview, how-it-works, CTA |
| `#/analyze` | Code Input | One question, four choices — sample project, upload (files / folder / ZIP), **a public GitHub link**, or paste. Everything is really parsed, in the browser |
| `#/dashboard` | Analysis Dashboard | Opens on a plain-English **summary**; the workspace (graph, details, files, chat) unfolds from there |

## It analyses what you actually give it

`js/lib/analyzer.js` builds the project model from your files — it does not fall
back to the sample. It reads `import` / `export … from` / `require()` / dynamic
`import()` and Python `import`, resolves those specifiers against the files you
uploaded (relative paths, extension guessing, `index.js`, and suffix matching for
aliased imports), and everything downstream follows from the resulting graph:

| Shown in the UI | Where it comes from |
| --- | --- |
| Nodes | one per source file, `node_modules` / `dist` / `.git` skipped |
| Edges | resolved imports between two files you uploaded |
| Layers | path conventions plus content — routes ⇒ API, SQL/ORM ⇒ Database, JSX/React ⇒ UI |
| Importance | in-degree; HIGH at 3+ dependents, or 2+ for API/Database files |
| Counts | files, UI components, functions, endpoints, edges, critical — all counted |
| Explanations | assembled from each file's own imports, exports and dependents |
| Chat | module names are matched against your files; project answers are computed |

Unresolved imports are recorded as external packages and reported, not dropped.

ZIPs are inflated with the browser's own `DecompressionStream`, so there is still
no dependency. A **GitHub link** is read directly by the browser: `api.github.com`
and `raw.githubusercontent.com` both send `Access-Control-Allow-Origin: *`, so two
API calls list the files and the contents come from the CDN rather than the
rate-limited API. Public repositories only — a private one is indistinguishable
from a missing one over this route, and the error says so instead of guessing.
Accepts `github.com/user/repo`, `…/tree/branch/subdir`, `…/blob/branch/file.js`,
a raw URL, or just `user/repo`. Dropped folders are walked via the entries API. An analysed project
is kept in `sessionStorage`, so a refresh does not silently revert to the sample.

**It is a heuristic pass, not a compiler.** Regex-based import extraction handles
ordinary code well and will miss exotic constructs (computed requires, heavy macro
use, non-standard aliasing). Every number shown is counted from your files; the
prose is assembled from those counts rather than written by a model.

## Written for people who do not code

The default wording assumes no programming knowledge at all. That is not a
coat of paint — a jargon audit over every string the app renders produced 133
confusing phrases, and two reviewers who had never written code rejected the
first set of replacements. Their corrections are the rules in `js/lib/plain.js`:

1. **"File" is explained once, up front.** *"To me a file is a PDF in my
   Downloads folder, not a piece of an app."* Nothing else lands until the
   summary says out loud what an app is made of.
2. **One relationship, two directions, never more.** The first draft used
   *needs / relies on / leans on / uses / points at* for a single idea, and
   readers assumed they were five different measurements. There are now exactly
   two phrasings, and they are not synonyms in English, so the direction
   survives being skim-read: **"uses"** and **"would stop working without"**.
3. **Numbers, not quantities.** Never "a few" or "a lot" — "3 files" is
   checkable, "a few" is a shrug.
4. **A count is not a judgement.** The badge states a fact ("7 files use this").
   The verdict states an opinion ("Risky change"). Phrased alike, the two
   collapse into one and the distinction is lost.
5. **Name the area, not only the file.** *"I cannot take a list of filenames to
   a standup."* Impact answers lead with the part of the product affected —
   "the Login screen, the Cart screen" — and say what to check before shipping.

`Technical details` in the header switches the whole vocabulary back to
developer wording. Same data, same map, same numbers; only the sentences change.
The internal keys (`node.layer`, `node.importance`, `report.level`) still drive
the logic and the CSS, so nothing downstream depends on the copy.

## Progressive disclosure

The dashboard used to present four panels at once. It now reveals itself in stages:

1. **Summary first** — what the project is, three computed findings, and three next
   actions. No panels, no graph, nothing to decode.
2. **Layers before modules** — the graph opens on four layer groups (UI, Logic, API,
   Database) with the link count between them. Click a group, or `All modules`, to
   drop into the full 19-node map.
3. **Panels on demand** — the file tree and the chat dock start folded away.
   `Files` / `Ask` in the header, or <kbd>B</kbd> / <kbd>/</kbd>, bring them in.

Every level is still one click from the next; nothing was removed.

The top bar carries a single line of counts rather than six stat tiles, the
`Reset` control only appears once something is highlighted, and the colour legend
is hidden in layer view where the groups label themselves.

## Dashboard controls

| Action | How |
| --- | --- |
| Inspect a module | Click a node, or a file in the left rail |
| Pan / zoom | Drag the canvas · scroll to zoom · buttons bottom-right |
| Move a node | Drag it — edges follow |
| Run impact analysis | `Impact` in the graph header, the button in the details panel, or press <kbd>I</kbd> |
| Ask a question | Press <kbd>/</kbd>, or use a suggestion chip |
| Ask about one module | Name it — "what does CartService do", "who uses ApiClient", "what breaks if I change TokenService". Answers are built from that module's own record and edges |
| Fit / clear | <kbd>F</kbd> to fit, <kbd>Esc</kbd> to clear highlights |
| Show the file tree | `Files` in the header, or <kbd>B</kbd> |
| Back to the summary | `Summary` in the header |

## Impact analysis is computed, not generated

`js/lib/graph.js` derives the blast radius by walking the dependency edges
**backwards** from the selected node, breadth-first. The verdict (HIGH / MEDIUM
/ LOW) comes from the direct count, the transitive count and the module's
importance flag. Nothing about it is a language-model guess, so it returns the
same answer every time — which matters on stage.

The AI's job is to *phrase* the result, not to derive it.

## Structure

```
server.py         serves the app, and holds the API key if you set one
index.html
styles/
  base.css          tokens, reset, motion primitives
  components.css    navbar, buttons, cards, panels, chat, toasts
  pages.css         landing, code input, dashboard layouts
js/
  app.js            hash router + boot
  store.js          shared state with pub/sub
  lib/
    ai.js           optional AI answers, grounded in the graph
    plain.js        the plain-language layer — every sentence a non-coder reads
    explain.js      what a selected line of code does, in plain words
    github.js       pull a project straight from a public repo link
    sources.js      one definition of what counts as source code
    analyzer.js     real static analysis: files -> nodes, edges, layers, stats
    zip.js          dependency-free ZIP reader (DecompressionStream)
    graph.js        dependency analysis — blast radius, paths, degree
    highlight.js    dependency-free syntax highlighter
    dom.js, icons.js, reveal.js, toast.js
  data/
    project.js      the project on screen — sample or freshly analysed
    mockData.js     the bundled sample project
  components/       Navbar, Summary, FileExplorer, ArchitectureGraph,
                    NodeDetails, ImpactAnalysis, ChatPanel, CodeViewer, ProjectStats
  pages/            Home, CodeInput, Dashboard
```

The component and page names match §14 of the idea document, so the React port
is mostly mechanical: each `xPanel()` string becomes JSX, each `mountX()` becomes
`useEffect`, and `store.js` becomes a context provider.

## Swapping in the real backend

Everything the UI renders comes from one object shape:

```js
{ meta, stats, nodes, edges, tree, chatIntents }
```

When the backend (§15) is ready, have it emit that shape and replace the import
in `js/data/mockData.js` with a fetch. No component needs to change — the graph,
the impact analysis and the file tree all read from those six keys.

## Demo path (§18)

1. Open `#/analyze` → **Use the sample project** — one click runs the pipeline
   overlay through its nine analysis stages.
2. Land on the summary: what the project is, and the three findings that matter.
   Hit **Explore the map** for the layer view, then `All modules`.
3. Click **AuthService** → explanation, dependencies, used-by, and the source
   file with the relevant lines highlighted.
4. Press <kbd>I</kbd> → **HIGH IMPACT**, six modules lit red on the graph.
5. Press <kbd>/</kbd> → ask *"Explain the authentication flow"* → the graph
   traces LoginPage → AuthService → ApiClient → AuthController → Users.

## Known limits

- The chat matches on module names and a list of intents; it is not a language
  model. Unrecognised questions say so rather than guessing — an earlier version
  fuzzy-matched on words like "what" and "does" and returned the same paragraph
  for every question.
- The syntax highlighter covers JS/JSX/Python well enough for display; it is not
  a parser.
- Analysed projects are laid out automatically (banded by layer); the sample's
  coordinates are still authored by hand in `mockData.js`.
- Very large repositories are capped at 400 files, and each file's source view at
  400 lines, to keep the browser responsive.
