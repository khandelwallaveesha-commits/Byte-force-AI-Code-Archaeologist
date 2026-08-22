/* app.js — boot + hash router.
   Routes: #/ landing · #/analyze code input · #/dashboard workspace */

import { renderNavbar, setActiveNav } from './components/Navbar.js';
import { Home, mountHome } from './pages/Home.js';
import { CodeInput, mountCodeInput } from './pages/CodeInput.js';
import { Dashboard, mountDashboard } from './pages/Dashboard.js';
import { restore } from './store.js';
import { restoreProject } from './data/project.js';
import { qs, prefersReduced } from './lib/dom.js';

const ROUTES = {
  '/': {
    view: Home,
    mount: mountHome,
    title: 'AI Code Archaeologist — Drop in a codebase. Get an X-ray of how it works.',
  },
  '/analyze': {
    view: CodeInput,
    mount: mountCodeInput,
    title: 'Analyze a codebase — AI Code Archaeologist',
  },
  '/dashboard': {
    view: Dashboard,
    mount: mountDashboard,
    title: 'Analysis dashboard — AI Code Archaeologist',
  },
};

const main = qs('#main');

function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw || raw === '/') return { route: '/', anchor: null };
  if (raw.startsWith('/')) return { route: raw, anchor: null };
  return { route: null, anchor: raw };   // in-page anchor such as #features
}

function navigate(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = `#${path}`;
}

function render() {
  const { route, anchor } = parseHash();

  /* An in-page anchor (#features) scrolls without re-rendering — unless the
     page was loaded straight onto that anchor, in which case render the
     landing page first so there is something to scroll to. */
  if (!route && main.innerHTML.trim()) {
    const target = document.getElementById(anchor);
    if (target) target.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth' });
    return;
  }

  const match = ROUTES[route] || ROUTES['/'];

  /* let the outgoing page tear down its timers and listeners */
  if (typeof main._cleanup === 'function') { main._cleanup(); main._cleanup = null; }

  main.innerHTML = match.view();
  document.title = match.title;
  setActiveNav(route || '/');

  match.mount(main, navigate);

  window.scrollTo({ top: 0, behavior: 'auto' });
  main.focus({ preventScroll: true });

  /* deep link straight onto an anchor */
  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) target.scrollIntoView({ behavior: 'auto' });
  }
}

/* ---- boot ---- */
restoreProject();   // an analysed project survives a refresh
restore();
renderNavbar(qs('#nav-root'));
window.addEventListener('hashchange', render);
render();
