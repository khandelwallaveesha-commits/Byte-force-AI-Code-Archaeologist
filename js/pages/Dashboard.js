/* Dashboard.js — §12 page 3: the developer workspace.

   Progressive disclosure: you land on a plain-English summary, not on four
   panels at once. The workspace opens when you choose what to do, and the
   file tree and chat dock stay folded away until asked for. */

import { icons } from '../lib/icons.js';
import { qs, qsa } from '../lib/dom.js';
import { toast } from '../lib/toast.js';
import { getState, setState, persist } from '../store.js';

import { projectStats } from '../components/ProjectStats.js';
import { summaryView } from '../components/Summary.js';
import { fileExplorerPanel, mountFileExplorer } from '../components/FileExplorer.js';
import { graphPanel, mountGraph } from '../components/ArchitectureGraph.js';
import {
  nodeDetailsPanel, renderNodeDetails, wireNodeDetails, renderLineExplanation,
} from '../components/NodeDetails.js';
import { renderImpact, impactEmpty } from '../components/ImpactAnalysis.js';
import { chatPanel, mountChat } from '../components/ChatPanel.js';
import { renderCode, codeEmpty, mountCodeSelection } from '../components/CodeViewer.js';
import { getNode, widestReach, mostConnected } from '../lib/graph.js';
import { getProject } from '../data/project.js';

const DOCK_TABS_PLAIN = [
  { id: 'chat',   label: 'Ask',         icon: 'chat',   title: 'Ask about this project' },
  { id: 'impact', label: 'What breaks', icon: 'impact', title: 'What would stop working' },
  { id: 'code',   label: 'The code',    icon: 'code',   title: 'What is actually written in this file' },
];

const DOCK_TABS_TECH = [
  { id: 'chat',   label: 'AI Chat', icon: 'chat',   title: 'Ask the codebase' },
  { id: 'impact', label: 'Impact',  icon: 'impact', title: 'Change impact analysis' },
  { id: 'code',   label: 'Source',  icon: 'code',   title: 'Source' },
];

const dockTabs = () => (getState().plain ? DOCK_TABS_PLAIN : DOCK_TABS_TECH);

export function Dashboard() {
  return `
  <div class="page dash mode-summary no-files dock-closed" id="dash">
    ${projectStats()}

    ${summaryView()}

    ${fileExplorerPanel()}

    <div class="dash-main">
      ${graphPanel()}

      <section class="panel dock" aria-label="Analysis dock">
        <div class="panel-head">
          <span class="panel-title" id="dock-title">${icons.chat(14)} ${getState().plain ? 'Ask about this project' : 'Ask the codebase'}</span>
          <div class="row" style="gap:.4rem">
            <div class="tabs" role="tablist">
              ${dockTabs().map((t, i) => `
                <button class="tab ${i === 0 ? 'active' : ''}" role="tab"
                        data-tab="${t.id}" aria-selected="${i === 0}">
                  ${t.label}
                </button>`).join('')}
            </div>
            <button class="btn btn-sm btn-ghost" id="dock-size"
                    aria-label="Make this panel bigger" data-tip="Make this bigger">
              ${icons.expand(14)} <span id="dock-size-label">Bigger</span>
            </button>
            <button class="icon-btn" id="dock-toggle" aria-label="Expand panel"
                    aria-expanded="false">${icons.chevron(15)}</button>
          </div>
        </div>
        <div class="dock-body" id="dock-chat">${chatPanel()}</div>
        <div class="dock-body panel-body" id="dock-impact" hidden>${impactEmpty()}</div>
        <div class="dock-body panel-body flush" id="dock-code" hidden>${codeEmpty()}</div>
      </section>
    </div>

    ${nodeDetailsPanel()}
  </div>`;
}

export function mountDashboard(root) {

  const dash = qs('#dash', root);
  const dockTitle = qs('#dock-title', root);
  const dockToggle = qs('#dock-toggle', root);
  const bodies = {
    chat:   qs('#dock-chat', root),
    impact: qs('#dock-impact', root),
    code:   qs('#dock-code', root),
  };

  /* ---------------- layout modes ---------------- */

  function showSummary(on) {
    dash.classList.toggle('mode-summary', on);
    qs('#t-summary', root)?.classList.toggle('active', on);
    if (on) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function setDock(open) {
    dash.classList.toggle('dock-closed', !open);
    dockToggle.setAttribute('aria-expanded', String(open));
    dockToggle.setAttribute('aria-label', open ? 'Collapse panel' : 'Expand panel');
  }

  function setFiles(on) {
    dash.classList.toggle('no-files', !on);
    qs('#t-files', root)?.classList.toggle('active', on);
  }

  dockToggle.addEventListener('click', () => setDock(dash.classList.contains('dock-closed')));

  /* Three sizes, not two. Going straight from a 290px strip to hiding the
     map entirely is a big jump; "half" keeps the map in view while giving a
     long answer room to be read. The button says what it will do next. */
  const SIZES = ['normal', 'half', 'full'];
  const NEXT_LABEL = { normal: 'Bigger', half: 'Full screen', full: 'Smaller' };
  const sizeBtn = qs('#dock-size', root);
  const sizeLabel = qs('#dock-size-label', root);
  let dockSize = 'normal';

  function setSize(size) {
    dockSize = size;
    dash.classList.toggle('dock-half', size === 'half');
    dash.classList.toggle('dock-full', size === 'full');
    if (size !== 'normal') { showSummary(false); setDock(true); }

    const next = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
    sizeLabel.textContent = NEXT_LABEL[size];
    sizeBtn.innerHTML = `${size === 'full' ? icons.shrink(14) : icons.expand(14)} ` +
                        `<span id="dock-size-label">${NEXT_LABEL[size]}</span>`;
    sizeBtn.setAttribute('aria-label', `Make this panel ${NEXT_LABEL[size].toLowerCase()}`);
    sizeBtn.dataset.tip = size === 'full' ? 'Back to normal (Esc)' : `Make this ${NEXT_LABEL[size].toLowerCase()}`;
    if (size !== 'normal') setTimeout(() => qs('#chat-input', root)?.focus(), 60);
    return next;
  }

  sizeBtn.addEventListener('click', () => {
    setSize(SIZES[(SIZES.indexOf(dockSize) + 1) % SIZES.length]);
  });
  const setFull = (on) => setSize(on ? 'full' : 'normal');

  /* ---------------- dock tabs ---------------- */

  function showTab(id, { open = true } = {}) {
    qsa('[data-tab]', root).forEach((t) => {
      const on = t.dataset.tab === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    Object.entries(bodies).forEach(([key, el]) => { el.hidden = key !== id; });

    const tab = dockTabs().find((t) => t.id === id);
    dockTitle.innerHTML = `${icons[tab.icon](14)} ${tab.title}`;
    setState({ dockTab: id });
    if (open) setDock(true);
  }

  qsa('[data-tab]', root).forEach((t) =>
    t.addEventListener('click', () => showTab(t.dataset.tab)));

  /* ---------------- shared selection ---------------- */

  let explorer, graph;

  function selectNode(id, { silent = false, leaveSummary = true } = {}) {
    const node = getNode(id);
    if (!node) return;

    setState({ selected: id });
    persist();
    if (leaveSummary) showSummary(false);

    graph.select(id);
    explorer.highlight(id);
    renderNodeDetails(root, id);
    bodies.code.innerHTML = renderCode(id);
    armCodeSelection(node);

    if (!silent) toast(`${node.name} — ${node.path}`, 1800);
  }

  /* Re-armed every time the code panel is redrawn, because innerHTML
     replaces the elements the listeners were attached to. */
  let picker = null;
  function armCodeSelection(node) {
    picker = mountCodeSelection(bodies.code, (from, to) => {
      renderLineExplanation(root, node, from, to);
    });
  }

  function runImpact(id) {
    const target = id || getState().selected;
    if (!target) { toast('Select a component first'); return; }

    if (target !== getState().selected) selectNode(target, { silent: true });
    showSummary(false);

    const { html, report } = renderImpact(target);
    bodies.impact.innerHTML = html;
    showTab('impact');
    setState({ impact: target });

    if (report) graph.setImpact(report.radius.map((r) => r.id));
  }

  /* ---------------- mount children ---------------- */

  graph = mountGraph(root, (id) => selectNode(id));
  explorer = mountFileExplorer(root, (id) => selectNode(id));

  wireNodeDetails(root, {
    onGoto: (id) => selectNode(id),
    onImpact: () => runImpact(getState().selected),
    /* The dock is folded away by default, so selecting a file was not enough
       to actually see its text — this opens it straight onto the code. */
    onShowCode: () => { showSummary(false); showTab('code'); },
  });

  root.addEventListener('click', (e) => {
    const back = e.target.closest('#ex-back');
    if (!back) return;
    if (picker) picker.clear();
    renderNodeDetails(root, back.dataset.node);
  });

  bodies.impact.addEventListener('click', (e) => {
    const row = e.target.closest('[data-goto]');
    if (row) selectNode(row.dataset.goto);
  });

  const chat = mountChat(root, {
    onFocus: (id) => selectNode(id, { silent: true }),
    onImpact: (id) => runImpact(id),
    onTrace: (path) => graph.trace(path),
  });

  /* ---------------- summary screen ---------------- */

  const summary = qs('#summary', root);

  summary.addEventListener('click', (e) => {
    const card = e.target.closest('[data-goto]');
    if (card) { selectNode(card.dataset.goto); return; }

    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'explore') {
      showSummary(false);
      setDock(false);
      graph.showHint('Click a layer to open it', 3000);
    } else if (action === 'impact') {
      runImpact(widestReach(1)[0].id);
    } else if (action === 'ask') {
      showSummary(false);
      showTab('chat');
      setTimeout(() => qs('#chat-input', root)?.focus(), 60);
    }
  });

  /* ---------------- top toolbar ---------------- */

  qs('#t-summary', root).addEventListener('click', () => showSummary(true));
  qs('#t-plain', root).addEventListener('click', () => {
    /* Swap the whole vocabulary. Same data, same graph — only the wording
       changes, so the page is rebuilt from the store rather than patched. */
    const wasSummary = dash.classList.contains('mode-summary');
    setState({ plain: !getState().plain });
    persist();

    if (typeof root._cleanup === 'function') { root._cleanup(); root._cleanup = null; }
    root.innerHTML = Dashboard();
    mountDashboard(root);
    if (!wasSummary) qs('#dash', root).classList.remove('mode-summary');

    toast(getState().plain ? 'Plain language' : 'Developer wording');
  });
  qs('#t-files', root).addEventListener('click', () => setFiles(dash.classList.contains('no-files')));
  qs('#t-ask', root).addEventListener('click', (e) => {
    showSummary(false);
    showTab('chat');
    /* Shift-click, or a second click while chat is already open, goes full
       screen — the quickest route to a roomy conversation. */
    if (e.shiftKey || (!dash.classList.contains('dock-closed') && getState().dockTab === 'chat')) {
      setFull(true);
    } else {
      setTimeout(() => qs('#chat-input', root)?.focus(), 60);
    }
  });

  /* ---------------- keyboard shortcuts ---------------- */

  const onKey = (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (typing && e.key !== 'Escape') return;

    if (e.key === '/') {
      e.preventDefault();
      showSummary(false);
      showTab('chat');
      qs('#chat-input', root)?.focus();
    } else if (e.key.toLowerCase() === 'i') {
      runImpact(getState().selected);
    } else if (e.key.toLowerCase() === 'f') {
      graph.fit();
    } else if (e.key.toLowerCase() === 'b') {
      setFiles(dash.classList.contains('no-files'));
    } else if (e.key === 'Escape') {
      if (dockSize !== 'normal') { setSize('normal'); return; }
      if (typing) { document.activeElement.blur(); return; }
      graph.reset();
    }
  };
  document.addEventListener('keydown', onKey);
  root._cleanup = () => document.removeEventListener('keydown', onKey);

  /* ---------------- graph header actions ---------------- */

  qs('#g-impact-mode', root).addEventListener('click', () => runImpact(getState().selected));
  qs('#g-reset', root).addEventListener('click', () => {
    graph.reset();
    bodies.impact.innerHTML = impactEmpty();
    renderNodeDetails(root, null);
    explorer.highlight(null);
    setState({ selected: null, impact: null });
    toast('Cleared');
  });

  /* ---------------- first paint ---------------- */

  /* Prime the panels without leaving the summary screen. Whatever project is
     loaded decides the opening module — never a hardcoded id. */
  const saved = getState().selected;
  const initial = (saved && getNode(saved))
    ? saved
    : (mostConnected(1)[0]?.id || getProject().nodes[0]?.id);
  if (!initial) return;
  renderNodeDetails(root, initial);
  bodies.code.innerHTML = renderCode(initial);
  armCodeSelection(getNode(initial));
  explorer.highlight(initial);
  setState({ analyzed: true, selected: initial });
  showTab('chat', { open: false });
}
