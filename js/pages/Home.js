/* Home.js — landing page (§12 page 1). */

import { icons } from '../lib/icons.js';
import { countUp, qs, qsa, prefersReduced } from '../lib/dom.js';
import { initReveal, initSpotlight } from '../lib/reveal.js';
import { stats } from '../data/mockData.js';
import { impactReport, impactReason } from '../lib/graph.js';

const FEATURES = [
  { icon: 'layers',  title: 'Automatic code splitting',
    body: 'A 500-line file becomes labelled blocks — auth, API calls, state, forms, error handling — each with an explanation attached.' },
  { icon: 'graph',   title: 'Interactive architecture graph',
    body: 'Zoom, pan, drag and click. Every node is a real module, every edge a real import the analyser found.' },
  { icon: 'code',    title: 'Graph wired to source',
    body: 'Click a node and the exact file opens beside it, with the relevant lines highlighted. Architecture to code in one click.' },
  { icon: 'impact',  title: 'Change impact analysis',
    body: 'Ask what breaks if you change a module. The answer is computed from the dependency edges — not guessed by a model.' },
  { icon: 'chat',    title: 'Codebase Q&A',
    body: 'Ask in plain English. Answers are grounded in the analysed structure, and the graph traces the path as it explains.' },
  { icon: 'target',  title: 'Critical module detection',
    body: 'Surfaces the most-connected code, the widest blast radii, and files nothing references any more.' },
];

const STEPS = [
  { title: 'Drop it in',   body: 'Paste code, upload files, or hand over a project ZIP.' },
  { title: 'We analyse',   body: 'Parsing, AST walk, component and dependency detection.' },
  { title: 'Explore',      body: 'An architecture map you can click through, wired to the source.' },
  { title: 'Predict',      body: 'Select anything and ask what a change would break.' },
];

const USERS = [
  { icon: 'users',  title: 'New team members',  body: 'Onboard in an afternoon instead of a fortnight.' },
  { icon: 'git',    title: 'Open-source contributors', body: 'Understand a project before opening a PR.' },
  { icon: 'book',   title: 'Students',          body: 'See how real-world projects are actually structured.' },
  { icon: 'cpu',    title: 'Software teams',    body: 'Check dependencies before agreeing to a change.' },
];

/* Small graph used in the hero visual. */
const HERO_NODES = [
  { id: 'login',  label: 'LoginPage',  x: 22,  y: 18,  c: 'var(--layer-ui)' },
  { id: 'cart',   label: 'CartPage',   x: 178, y: 18,  c: 'var(--layer-ui)' },
  { id: 'auth',   label: 'AuthService', x: 22, y: 88,  c: 'var(--layer-logic)' },
  { id: 'api',    label: 'ApiClient',  x: 100, y: 152, c: 'var(--layer-api)' },
  { id: 'db',     label: 'Users',      x: 100, y: 216, c: 'var(--layer-data)' },
];
const HERO_EDGES = [
  ['login', 'auth'], ['cart', 'api'], ['auth', 'api'], ['api', 'db'],
];

const NODE_W = 92, NODE_H = 26;

function heroGraph() {
  const find = (id) => HERO_NODES.find((n) => n.id === id);
  const edges = HERO_EDGES.map(([a, b], i) => {
    const s = find(a), t = find(b);
    const x1 = s.x + NODE_W / 2, y1 = s.y + NODE_H;
    const x2 = t.x + NODE_W / 2, y2 = t.y;
    const mid = (y1 + y2) / 2;
    return `<path class="gedge flow" d="M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}"
              stroke="var(--accent)" opacity=".5" style="animation-delay:${i * 0.3}s"/>`;
  }).join('');

  const boxes = HERO_NODES.map((n, i) => `
    <g style="animation: scale-in .5s var(--ease) ${0.25 + i * 0.12}s both">
      <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="7"
            fill="var(--bg-2)" stroke="${n.c}" stroke-width="1.3"/>
      <rect x="${n.x}" y="${n.y}" width="3" height="${NODE_H}" rx="1.5" fill="${n.c}"/>
      <text x="${n.x + 11}" y="${n.y + 17}" fill="var(--text)" font-size="10"
            font-family="Inter, sans-serif">${n.label}</text>
    </g>`).join('');

  return `<svg viewBox="0 0 292 258" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
            role="img" aria-label="Architecture graph: LoginPage and CartPage connect through AuthService and ApiClient to the Users table">
            ${edges}${boxes}
          </svg>`;
}

function codeWall() {
  const widths = [62, 88, 45, 96, 71, 54, 83, 40, 92, 66, 78, 49, 87, 58, 94, 44, 80, 69,
                  57, 91, 48, 84, 73, 39, 95, 61, 76, 52, 89, 47, 82, 68];
  return widths
    .map((w, i) => `<div class="cw" style="width:${w}%; animation-delay:${i * 0.035}s"></div>`)
    .join('');
}

export function Home() {
  const report = impactReport('AuthService');
  const affected = report.radius.slice(0, 4);

  return `
  <div class="page">
    <!-- ============ HERO ============ -->
    <section class="hero">
      <div class="hero-grid"></div>
      <div class="hero-glow"></div>
      <div class="wrap">
        <div class="hero-inner">
          <div>
            <span class="pill-live"><span class="dot dot-live"></span> Running on a sample project — no signup</span>
            <h1>Drop in a codebase.<br>Get an <span class="grad">X-ray</span> of how it works.</h1>
            <p class="hero-lede">
              Joining a project with 10,000 lines and no documentation? Paste it in.
              Get an interactive map of every module, how they connect, and what breaks
              if you change one.
            </p>
            <div class="hero-cta">
              <a class="btn btn-primary btn-lg" href="#/analyze">${icons.scan(17)} Analyze your code</a>
              <a class="btn btn-lg btn-ghost" href="#/dashboard">${icons.play(15)} See a live demo</a>
            </div>
            <p class="hero-note">${icons.check(14)} Works on a paste, a folder, or a ZIP — nothing leaves your machine in this demo.</p>
          </div>

          <div class="xray" data-reveal="120">
            <div class="xray-bar">
              <i></i><i></i><i></i>
              <span class="mono" id="xray-label">scanning shopfront-web…</span>
            </div>
            <div class="xray-stage">
              <div class="xray-face code-wall" id="face-code">
                ${codeWall()}
                <div class="scanline"></div>
              </div>
              <div class="xray-face hide" id="face-graph" style="padding:.6rem">
                ${heroGraph()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ STATS ============ -->
    <section class="wrap" data-reveal>
      <div class="stats-strip">
        ${stats.map((s) => `
          <div class="stat">
            <b data-count="${s.value}">0</b>
            <span>${s.label}</span>
          </div>`).join('')}
      </div>
      <p class="faint center" style="margin-top:.8rem; font-size:.78rem">
        Extracted from the sample project in about four seconds.
      </p>
    </section>

    <!-- ============ FEATURES ============ -->
    <section class="sect wrap" id="features">
      <div class="sect-head center" data-reveal>
        <span class="sect-tag">What it does</span>
        <h2>Four layers: understand, organise, visualise, predict</h2>
        <p>Most AI tools explain a snippet. This one explains the relationships between every part of a system — and what depends on what.</p>
      </div>
      <div class="cards-3">
        ${FEATURES.map((f, i) => `
          <article class="card card-hover feature-card" data-reveal="${i * 70}">
            <div class="feature-icon">${icons[f.icon](19)}</div>
            <h3>${f.title}</h3>
            <p>${f.body}</p>
          </article>`).join('')}
      </div>
    </section>

    <!-- ============ IMPACT ============ -->
    <section class="sect wrap">
      <div class="impact-demo">
        <div data-reveal>
          <span class="sect-tag">The killer feature</span>
          <h2>"What happens if I remove this?"</h2>
          <p class="dim" style="margin:.9rem 0 1.2rem; max-width:46ch">
            Select any module and the platform walks the dependency edges backwards
            to find everything downstream of it. Because it is graph traversal rather
            than a language model guessing, the answer is the same every time.
          </p>
          <p class="dim" style="margin-bottom:1.4rem; max-width:46ch">
            That turns the tool from a code explainer into something you can actually
            make a decision with.
          </p>
          <a class="btn btn-primary" href="#/dashboard">${icons.impact(16)} Try it on the sample project</a>
        </div>

        <div class="impact-visual" data-reveal="120">
          <div class="spread" style="margin-bottom:.9rem">
            <div class="row">
              <span class="badge badge-accent">AuthService</span>
              <span class="faint mono" style="font-size:.72rem">src/services/authService.js</span>
            </div>
            <span class="badge badge-high">${report.level} impact</span>
          </div>
          <div class="impact-list">
            ${affected.map((a, i) => `
              <div class="impact-row" style="animation-delay:${i * 0.09}s">
                <span class="dot" style="background:${a.hops === 1 ? 'var(--high)' : 'var(--med)'}"></span>
                <span>${a.id}</span>
                <span class="mono">${a.hops} hop${a.hops === 1 ? '' : 's'}</span>
              </div>`).join('')}
          </div>
          <p class="dim" style="font-size:.82rem; margin-top:.9rem; line-height:1.5">${impactReason(report)}</p>
        </div>
      </div>
    </section>

    <!-- ============ HOW IT WORKS ============ -->
    <section class="sect wrap">
      <div class="sect-head center" data-reveal>
        <span class="sect-tag">How it works</span>
        <h2>From upload to answer in four steps</h2>
      </div>
      <div class="steps">
        ${STEPS.map((s, i) => `
          <div class="step" data-reveal="${i * 90}">
            <span class="step-num">${i + 1}</span>
            <span class="step-line"></span>
            <h3>${s.title}</h3>
            <p>${s.body}</p>
          </div>`).join('')}
      </div>
    </section>

    <!-- ============ USERS ============ -->
    <section class="sect wrap">
      <div class="sect-head center" data-reveal>
        <span class="sect-tag">Who it is for</span>
        <h2>Anyone who inherits code they did not write</h2>
      </div>
      <div class="users">
        ${USERS.map((u, i) => `
          <article class="card card-hover user-card" data-reveal="${i * 70}">
            ${icons[u.icon](20)}
            <div><h3>${u.title}</h3><p class="dim">${u.body}</p></div>
          </article>`).join('')}
      </div>
    </section>

    <!-- ============ CTA ============ -->
    <section class="sect wrap">
      <div class="cta-band" data-reveal>
        <h2>Stop reading files. Start seeing systems.</h2>
        <p>Load the sample project, or drop in something of your own and watch it come apart into a map.</p>
        <div class="row" style="justify-content:center; flex-wrap:wrap">
          <a class="btn btn-primary btn-lg" href="#/analyze">${icons.upload(17)} Analyze a codebase</a>
          <a class="btn btn-lg btn-ghost" href="#/dashboard">${icons.arrow(15)} Skip to the dashboard</a>
        </div>
      </div>
    </section>

    <footer class="foot">
      <div class="wrap">
        <p>AI Code Archaeologist — an AI-powered X-ray for codebases.</p>
        <div class="foot-links">
          <a href="#features">Features</a>
          <a href="#/analyze">Analyze</a>
          <a href="#/dashboard">Dashboard</a>
        </div>
      </div>
    </footer>
  </div>`;
}

/** Wire up animations after the page is in the DOM. */
export function mountHome(root) {
  initReveal(root);
  initSpotlight(root);

  /* animated counters */
  const runCounters = () => {
    qsa('[data-count]', root).forEach((el) => {
      if (el.dataset.done) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.dataset.done = '1';
        countUp(el, Number(el.dataset.count));
      }
    });
  };
  runCounters();
  window.addEventListener('scroll', runCounters, { passive: true });

  /* hero: code wall → architecture graph, on a loop */
  const faceCode = qs('#face-code', root);
  const faceGraph = qs('#face-graph', root);
  const label = qs('#xray-label', root);
  if (!faceCode || !faceGraph) return;

  if (prefersReduced()) {
    faceCode.classList.add('hide');
    faceGraph.classList.remove('hide');
    label.textContent = 'shopfront-web — architecture';
    return;
  }

  let showingGraph = false;
  const flip = () => {
    showingGraph = !showingGraph;
    faceCode.classList.toggle('hide', showingGraph);
    faceGraph.classList.toggle('hide', !showingGraph);
    label.textContent = showingGraph ? 'shopfront-web — architecture' : 'scanning shopfront-web…';
  };
  const first = setTimeout(flip, 2400);
  const loop = setInterval(flip, 4600);

  /* stop the loop when the page is swapped out */
  root._cleanup = () => { clearTimeout(first); clearInterval(loop); };
}
