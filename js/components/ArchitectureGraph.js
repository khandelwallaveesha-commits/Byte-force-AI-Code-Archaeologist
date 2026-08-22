/* ======================================================================
   ArchitectureGraph.js — §5.3 interactive architecture graph.

   Hand-rolled SVG: zoom, pan, draggable nodes, click-to-select, animated
   dependency edges, blast-radius highlighting and flow tracing.
   ====================================================================== */

import { LAYERS } from '../data/mockData.js';
import { getProject } from '../data/project.js';
import { GROUPS, groupLabel, groupOneLiner } from '../lib/plain.js';
import { isPlain } from '../store.js';
import { icons } from '../lib/icons.js';
import { qs, qsa, esc, sleep, prefersReduced } from '../lib/dom.js';

const VIEW_W = 1240;
const VIEW_H = 760;
const MIN_K = 0.35;
const MAX_K = 2.4;

const layerColor = (layer) => `var(--layer-${layer === 'ui' ? 'ui' : layer === 'logic' ? 'logic' : layer === 'api' ? 'api' : 'data'})`;

/* ----------------------------------------------------------------------
   Layer view: the zoomed-out default. Four groups instead of 19 modules,
   so the first thing you see is the shape of the system, not the wiring.
   ---------------------------------------------------------------------- */
const LAYER_ORDER = ['ui', 'logic', 'api', 'data', 'other'];
const GROUP = { x: 400, w: 440, h: 92, gap: 170 };

/* Stacked by position among the layers this project actually has, so a
   project with no database does not leave a hole where one would be. */
const groupRectAt = (i) => ({ x: GROUP.x, y: 40 + i * GROUP.gap, w: GROUP.w, h: GROUP.h });

/** Roll the module edges up into layer-to-layer totals. */
function aggregateEdges(SOURCE_NODES, edges) {
  const layerOf = new Map(SOURCE_NODES.map((n) => [n.id, n.layer]));
  const between = new Map();
  const internal = {};

  edges.forEach((e) => {
    const a = layerOf.get(e.from);
    const b = layerOf.get(e.to);
    if (!a || !b) return;
    if (a === b) { internal[a] = (internal[a] || 0) + 1; return; }
    const key = `${a}>${b}`;
    between.set(key, (between.get(key) || 0) + 1);
  });

  const present = LAYER_ORDER.filter((l) => SOURCE_NODES.some((n) => n.layer === l));
  const pairs = Array.from(between, ([key, count]) => {
    const [from, to] = key.split('>');
    return { from, to, count, span: present.indexOf(to) - present.indexOf(from) };
  });
  return { pairs, internal, present };
}

/** Adjacent layers connect straight down; skips and back-edges route around. */
function groupEdgePath(a, b, span) {
  const cx = GROUP.x + GROUP.w / 2;

  if (span === 1) {                                   // straight down
    const y1 = a.y + a.h, y2 = b.y;
    const mid = (y1 + y2) / 2;
    return `M${cx},${y1} C${cx},${mid} ${cx},${mid} ${cx},${y2}`;
  }
  if (span > 1) {                                     // skips a layer — go left
    const lane = GROUP.x - 70;
    return `M${a.x + 40},${a.y + a.h} C${lane},${a.y + a.h + 40} ${lane},${b.y - 40} ${b.x + 40},${b.y}`;
  }
  const lane = GROUP.x + GROUP.w + 70;                // points back up — go right
  return `M${a.x + a.w - 40},${a.y} C${lane},${a.y - 40} ${lane},${b.y + b.h + 40} ${b.x + b.w - 40},${b.y + b.h}`;
}

/** Where to park the "n links" label for an aggregated edge. */
function groupLabelPoint(a, b, span) {
  if (span === 1) return { x: GROUP.x + GROUP.w / 2 + 12, y: (a.y + a.h + b.y) / 2 + 4 };
  if (span > 1)   return { x: GROUP.x - 74, y: (a.y + a.h + b.y) / 2 + 4 };
  return { x: GROUP.x + GROUP.w + 74, y: (b.y + b.h + a.y) / 2 + 4 };
}

export function graphPanel() {
  return `
  <section class="panel graph-panel view-layers" aria-label="Architecture graph">
    <div class="panel-head">
      <span class="panel-title">${icons.graph(14)} ${isPlain() ? 'How this project fits together' : 'Architecture'}</span>
      <div class="row" style="gap:.4rem">
        <div class="tabs" id="g-view" role="tablist" aria-label="Graph detail">
          <button class="tab active" data-view="layers" role="tab" aria-selected="true">${isPlain() ? 'Groups' : 'Layers'}</button>
          <button class="tab" data-view="modules" role="tab" aria-selected="false">${isPlain() ? 'Every file' : 'All modules'}</button>
        </div>
        <button class="btn btn-sm btn-ghost" id="g-impact-mode" data-tip="Blast radius of the selected node">
          ${icons.impact(13)} ${isPlain() ? 'What breaks?' : 'Impact'}
        </button>
        <button class="btn btn-sm btn-ghost" id="g-reset" data-tip="Clear highlights (Esc)">Reset</button>
      </div>
    </div>

    <div class="graph-canvas" id="graph-canvas">
      <svg id="graph-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet"
           role="application" aria-label="Dependency graph of the analysed project. Use the file explorer to select modules.">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="var(--text-faint)"/>
          </marker>
          <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="var(--accent)"/>
          </marker>
          <marker id="arrow-danger" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="var(--high)"/>
          </marker>
        </defs>
        <g id="graph-viewport">
          <g id="graph-edges"></g>
          <g id="graph-nodes"></g>
        </g>
      </svg>

      <div class="graph-hint" id="graph-hint">Click a group to see the files inside · drag to move the map · scroll to zoom</div>

      <div class="graph-legend">
        ${Object.entries(LAYERS).map(([key, l]) =>
          `<span title="${isPlain() ? groupOneLiner(key) : ''}"><i style="background:${l.color}"></i>${isPlain() ? groupLabel(key) : l.label}</span>`).join('')}
      </div>

      <div class="graph-controls">
        <button class="icon-btn" id="g-zoom-in"  aria-label="Zoom in">${icons.plus(15)}</button>
        <button class="icon-btn" id="g-zoom-out" aria-label="Zoom out">${icons.minus(15)}</button>
        <button class="icon-btn" id="g-fit"      aria-label="Fit to view">${icons.fit(15)}</button>
      </div>
    </div>
  </section>`;
}

/**
 * @param {HTMLElement} root  element containing the panel markup
 * @param {(id: string) => void} onSelect  called when a node is clicked
 */
export function mountGraph(root, onSelect) {
  const panel    = qs('.graph-panel', root);
  const canvas   = qs('#graph-canvas', root);
  const viewport = qs('#graph-viewport', root);
  const edgeG    = qs('#graph-edges', root);
  const nodeG    = qs('#graph-nodes', root);
  const hint     = qs('#graph-hint', root);

  /* whatever project is currently loaded — sample or freshly analysed */
  const { nodes: SOURCE_NODES, edges } = getProject();

  /* mutable layout copy — dragging moves these, source data stays clean */
  const layout = new Map(SOURCE_NODES.map((n) => [n.id, { ...n }]));

  let view = { x: 0, y: 0, k: 1 };
  let selected = null;
  let impactSet = null;   // Set<string> — blast radius
  let hintTimer = null;
  let viewMode = 'layers'; // start zoomed out: four groups, not 19 modules

  const { pairs: LAYER_PAIRS, internal: LAYER_INTERNAL, present: LAYER_PRESENT } =
    aggregateEdges(SOURCE_NODES, edges);

  /* ---------------- geometry ---------------- */

  function anchors(a, b) {
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };

    if (b.y >= a.y + a.h) {                       // target below
      return { x1: ac.x, y1: a.y + a.h, x2: bc.x, y2: b.y, vertical: true };
    }
    if (b.y + b.h <= a.y) {                       // target above
      return { x1: ac.x, y1: a.y, x2: bc.x, y2: b.y + b.h, vertical: true };
    }
    const right = bc.x > ac.x;                    // side by side
    return {
      x1: right ? a.x + a.w : a.x, y1: ac.y,
      x2: right ? b.x : b.x + b.w, y2: bc.y,
      vertical: false,
    };
  }

  function edgePath(a, b) {
    const p = anchors(a, b);
    if (p.vertical) {
      const mid = (p.y1 + p.y2) / 2;
      return `M${p.x1},${p.y1} C${p.x1},${mid} ${p.x2},${mid} ${p.x2},${p.y2}`;
    }
    const mid = (p.x1 + p.x2) / 2;
    return `M${p.x1},${p.y1} C${mid},${p.y1} ${mid},${p.y2} ${p.x2},${p.y2}`;
  }

  /* ---------------- render ---------------- */

  function renderEdges() {
    edgeG.innerHTML = edges.map((e, i) => {
      const a = layout.get(e.from), b = layout.get(e.to);
      if (!a || !b) return '';
      return `<path class="gedge flow" data-from="${e.from}" data-to="${e.to}"
                d="${edgePath(a, b)}" stroke="var(--text-faint)" opacity=".45"
                marker-end="url(#arrow)" style="animation-delay:${(i % 7) * 0.4}s"/>`;
    }).join('');
  }

  function renderNodes() {
    nodeG.innerHTML = SOURCE_NODES.map((src) => {
      const n = layout.get(src.id);
      const color = layerColor(n.layer);
      const crit = n.importance === 'HIGH';
      return `
        <g class="gnode" data-id="${n.id}" transform="translate(${n.x},${n.y})"
           tabindex="0" role="button" aria-label="${esc(n.name)} — ${esc(n.purpose)}">
          <rect width="${n.w}" height="${n.h}" rx="9"
                fill="var(--bg-2)" stroke="${color}" stroke-width="1.3"/>
          <rect width="3.5" height="${n.h}" rx="1.75" fill="${color}"/>
          <text x="12" y="19" fill="var(--text)">${esc(n.name)}</text>
          <text x="12" y="33" class="sub" fill="var(--text-faint)">${esc(isPlain() ? groupLabel(n.layer) : `${LAYERS[n.layer].label} · ${n.fns} fns`)}</text>
          ${crit ? `<circle cx="${n.w - 11}" cy="13" r="3.2" fill="var(--high)"/>` : ''}
        </g>`;
    }).join('');
  }

  /* ---------------- layer (zoomed-out) view ---------------- */

  const rectOf = (layer) => groupRectAt(LAYER_PRESENT.indexOf(layer));

  function renderLayerEdges() {
    edgeG.innerHTML = LAYER_PAIRS.map((p, i) => {
      const a = rectOf(p.from), b = rectOf(p.to);
      const label = groupLabelPoint(a, b, p.span);
      return `<path class="gedge flow" d="${groupEdgePath(a, b, p.span)}"
                stroke="var(--text-faint)" opacity=".5" stroke-width="1.8"
                marker-end="url(#arrow)" style="animation-delay:${i * 0.35}s"/>
              <text x="${label.x}" y="${label.y}" fill="var(--text-faint)" font-size="11"
                    text-anchor="middle" font-family="Inter, sans-serif">${p.count}</text>`;
    }).join('');
  }

  function renderLayerNodes() {
    const plainMode = isPlain();
    const truncate = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
    const counts = {};
    SOURCE_NODES.forEach((n) => { counts[n.layer] = (counts[n.layer] || 0) + 1; });

    nodeG.innerHTML = LAYER_PRESENT.map((layer, i) => {
      const r = groupRectAt(i);
      const color = layerColor(layer);
      const n = counts[layer] || 0;
      const inner = LAYER_INTERNAL[layer] || 0;
      const names = SOURCE_NODES.filter((x) => x.layer === layer).slice(0, 4).map((x) => x.name);
      const more = n - names.length;

      return `
        <g class="lnode" data-layer="${layer}" transform="translate(${r.x},${r.y})"
           tabindex="0" role="button"
           aria-label="${LAYERS[layer].label} layer — ${n} modules. Open to see them."
           style="animation: fade-in .45s var(--ease) ${i * 0.08}s both">
          <rect width="${r.w}" height="${r.h}" rx="14"
                fill="var(--bg-2)" stroke="${color}" stroke-width="1.6"/>
          <rect width="5" height="${r.h}" rx="2.5" fill="${color}"/>
          <text x="22" y="32" fill="var(--text)" font-size="18" font-weight="600">
            ${esc(plainMode ? groupLabel(layer) : LAYERS[layer].label)}
          </text>
          <text x="22" y="52" fill="var(--text-dim)" font-size="12">
            ${n} file${n === 1 ? '' : 's'}${plainMode ? '' : `${inner ? ` · ${inner} internal link${inner === 1 ? '' : 's'}` : ''}`}
          </text>
          <text x="22" y="72" fill="var(--text-faint)" font-size="10.5">
            ${esc(plainMode ? truncate(groupOneLiner(layer), 78) : names.join(', ') + (more > 0 ? ` +${more}` : ''))}
          </text>
          <text x="${r.w - 20}" y="34" fill="${color}" font-size="12"
                text-anchor="end" font-weight="600">OPEN</text>
        </g>`;
    }).join('');
  }

  function refreshEdgeGeometry() {
    edgeG.querySelectorAll('path').forEach((p) => {
      const a = layout.get(p.dataset.from), b = layout.get(p.dataset.to);
      if (a && b) p.setAttribute('d', edgePath(a, b));
    });
  }

  /* ---------------- highlighting ---------------- */

  function paint() {
    /* the Reset control only earns its place once there is state to clear */
    panel.classList.toggle('has-highlight', Boolean(selected || impactSet));
    if (viewMode === 'layers') return;   // groups carry no selection state

    const neighbours = new Set();
    if (selected) {
      neighbours.add(selected);
      edges.forEach((e) => {
        if (e.from === selected) neighbours.add(e.to);
        if (e.to === selected) neighbours.add(e.from);
      });
    }

    nodeG.querySelectorAll('.gnode').forEach((g) => {
      const id = g.dataset.id;
      const inImpact = impactSet && impactSet.has(id);
      g.classList.toggle('selected', id === selected);
      g.classList.toggle('impacted', Boolean(inImpact));
      g.classList.toggle('dimmed',
        Boolean(selected) && !neighbours.has(id) && !inImpact);

      const rect = g.querySelector('rect');
      if (inImpact) {
        rect.setAttribute('stroke', 'var(--high)');
      } else if (id === selected) {
        rect.setAttribute('stroke', 'var(--accent)');
      } else {
        rect.setAttribute('stroke', layerColor(layout.get(id).layer));
      }
    });

    edgeG.querySelectorAll('path').forEach((p) => {
      const { from, to } = p.dataset;
      const touching = selected && (from === selected || to === selected);
      const inImpact = impactSet && impactSet.has(from) && (impactSet.has(to) || to === selected);

      p.classList.toggle('hot', Boolean(touching || inImpact));
      p.classList.toggle('dimmed', Boolean(selected) && !touching && !inImpact);

      if (inImpact) {
        p.setAttribute('stroke', 'var(--high)');
        p.setAttribute('marker-end', 'url(#arrow-danger)');
        p.setAttribute('opacity', '.95');
      } else if (touching) {
        p.setAttribute('stroke', 'var(--accent)');
        p.setAttribute('marker-end', 'url(#arrow-hot)');
        p.setAttribute('opacity', '.95');
      } else {
        p.setAttribute('stroke', 'var(--text-faint)');
        p.setAttribute('marker-end', 'url(#arrow)');
        p.setAttribute('opacity', '.45');
      }
    });
  }

  /* ---------------- view transform ---------------- */

  const applyView = () => {
    viewport.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  };

  function zoomBy(factor, cx, cy) {
    const k = Math.min(MAX_K, Math.max(MIN_K, view.k * factor));
    if (k === view.k) return;
    // keep the point under the cursor stationary
    const px = (cx - view.x) / view.k;
    const py = (cy - view.y) / view.k;
    view.x = cx - px * k;
    view.y = cy - py * k;
    view.k = k;
    applyView();
  }

  function fit(padding = 26) {
    const xs = [], ys = [];
    const boxes = viewMode === 'layers'
      ? LAYER_PRESENT.map((l, i) => groupRectAt(i))
      : Array.from(layout.values());
    boxes.forEach((n) => { xs.push(n.x, n.x + n.w); ys.push(n.y, n.y + n.h); });
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const k = Math.min(
      (VIEW_W - padding * 2) / (maxX - minX),
      (VIEW_H - padding * 2) / (maxY - minY),
      MAX_K
    );
    view.k = Math.max(MIN_K, k);
    view.x = (VIEW_W - (maxX - minX) * view.k) / 2 - minX * view.k;
    view.y = (VIEW_H - (maxY - minY) * view.k) / 2 - minY * view.k;
    applyView();
  }

  /** Screen coordinates → viewport (graph) coordinates. */
  function toGraph(clientX, clientY) {
    const ctm = viewport.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  /* ---------------- interaction ---------------- */

  let drag = null;   // { type: 'pan' | 'node', ... }
  let moved = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const nodeEl = e.target.closest('.gnode');
    moved = false;
    canvas.setPointerCapture(e.pointerId);

    if (nodeEl) {
      const n = layout.get(nodeEl.dataset.id);
      const p = toGraph(e.clientX, e.clientY);
      drag = { type: 'node', el: nodeEl, id: n.id, dx: p.x - n.x, dy: p.y - n.y };
    } else {
      /* Groups pan like the canvas; a click without movement opens the layer. */
      const groupEl = e.target.closest('.lnode');
      canvas.classList.add('grabbing');
      drag = {
        type: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y,
        group: groupEl ? groupEl.dataset.layer : null,
      };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    moved = true;

    if (drag.type === 'pan') {
      const scale = VIEW_W / canvas.clientWidth;
      view.x = drag.ox + (e.clientX - drag.sx) * scale;
      view.y = drag.oy + (e.clientY - drag.sy) * scale;
      applyView();
      return;
    }

    const p = toGraph(e.clientX, e.clientY);
    const n = layout.get(drag.id);
    n.x = p.x - drag.dx;
    n.y = p.y - drag.dy;
    drag.el.setAttribute('transform', `translate(${n.x},${n.y})`);
    refreshEdgeGeometry();
  });

  const endDrag = (e) => {
    if (!drag) return;
    if (drag.type === 'node' && !moved) select(drag.id, true);
    if (drag.type === 'pan' && drag.group && !moved) expandLayer(drag.group);
    canvas.classList.remove('grabbing');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scale = VIEW_W / rect.width;
    const cx = (e.clientX - rect.left) * scale;
    const cy = (e.clientY - rect.top) * scale;
    zoomBy(e.deltaY < 0 ? 1.14 : 1 / 1.14, cx, cy);
  }, { passive: false });

  /* keyboard: nodes and groups are focusable, Enter/Space activates */
  nodeG.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('.gnode');
    const l = e.target.closest('.lnode');
    if (!g && !l) return;
    e.preventDefault();
    if (g) select(g.dataset.id, true);
    else expandLayer(l.dataset.layer);
  });

  qs('#g-zoom-in', root).addEventListener('click',  () => zoomBy(1.22, VIEW_W / 2, VIEW_H / 2));
  qs('#g-zoom-out', root).addEventListener('click', () => zoomBy(1 / 1.22, VIEW_W / 2, VIEW_H / 2));
  qs('#g-fit', root).addEventListener('click', () => fit());

  function showHint(text, ms = 2600) {
    clearTimeout(hintTimer);
    hint.textContent = text;
    hint.style.opacity = '1';
    hintTimer = setTimeout(() => { hint.style.opacity = '0'; }, ms);
  }

  /* ---------------- view mode ---------------- */

  function renderCurrent() {
    if (viewMode === 'layers') { renderLayerEdges(); renderLayerNodes(); }
    else { renderEdges(); renderNodes(); }
    fit();
    paint();
  }

  function setViewMode(mode, { quiet = false } = {}) {
    if (mode === viewMode) return;
    viewMode = mode;
    panel.classList.toggle('view-layers', mode === 'layers');
    qsa('[data-view]', root).forEach((b) => {
      const on = b.dataset.view === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    renderCurrent();
    if (!quiet) {
      showHint(mode === 'layers'
        ? 'Zoomed out — click a group to see the files inside'
        : `All ${SOURCE_NODES.length} files`, 2600);
    }
  }

  /** Opening a group drops into module view with that layer highlighted. */
  function expandLayer(layer) {
    setViewMode('modules', { quiet: true });
    const first = SOURCE_NODES.filter((n) => n.layer === layer);
    nodeG.querySelectorAll('.gnode').forEach((g) => {
      const n = layout.get(g.dataset.id);
      g.classList.toggle('dimmed', n.layer !== layer);
    });
    showHint(`${isPlain() ? groupLabel(layer) : LAYERS[layer].label} — ${first.length} file${first.length === 1 ? '' : 's'}`, 3000);
    if (first.length && typeof onSelect === 'function') onSelect(first[0].id);
  }

  /* Anything that needs a specific module forces the detailed view. */
  const ensureModules = () => setViewMode('modules', { quiet: true });

  /* ---------------- public API ---------------- */

  function select(id, notify = false) {
    ensureModules();
    selected = id;
    impactSet = null;
    paint();
    if (notify && typeof onSelect === 'function') onSelect(id);
  }

  function setImpact(ids) {
    ensureModules();
    impactSet = ids && ids.length ? new Set(ids) : null;
    paint();
    if (impactSet) showHint(isPlain()
      ? `${impactSet.size} file${impactSet.size === 1 ? '' : 's'} would be affected`
      : `${impactSet.size} module${impactSet.size === 1 ? '' : 's'} in the blast radius`, 3200);
  }

  /** Walk a path of node ids, lighting each hop in turn. */
  async function trace(path) {
    if (!Array.isArray(path) || path.length < 2) return;
    ensureModules();
    const fast = prefersReduced();
    impactSet = null;
    selected = null;
    paint();

    nodeG.querySelectorAll('.gnode').forEach((g) => {
      g.classList.toggle('dimmed', !path.includes(g.dataset.id));
    });
    edgeG.querySelectorAll('path').forEach((p) => p.classList.add('dimmed'));

    for (let i = 0; i < path.length; i++) {
      const g = nodeG.querySelector(`.gnode[data-id="${path[i]}"]`);
      if (g) {
        g.classList.remove('dimmed');
        g.querySelector('rect').setAttribute('stroke', 'var(--accent)');
        g.classList.add('selected');
      }
      if (i > 0) {
        const p = edgeG.querySelector(`path[data-from="${path[i - 1]}"][data-to="${path[i]}"]`);
        if (p) {
          p.classList.remove('dimmed');
          p.classList.add('hot');
          p.setAttribute('stroke', 'var(--accent)');
          p.setAttribute('marker-end', 'url(#arrow-hot)');
          p.setAttribute('opacity', '1');
        }
      }
      await sleep(fast ? 30 : 420);
    }
    showHint(`Traced ${path.length} hops: ${path.join(' → ')}`, 4200);
  }

  function reset() {
    selected = null;
    impactSet = null;
    nodeG.querySelectorAll('.gnode').forEach((g) => g.classList.remove('selected', 'dimmed', 'impacted'));
    paint();
  }

  qsa('[data-view]', root).forEach((b) =>
    b.addEventListener('click', () => setViewMode(b.dataset.view)));

  renderCurrent();
  setTimeout(() => { hint.style.opacity = '0'; }, 5200);
  hint.style.transition = 'opacity .5s';

  return { select, setImpact, trace, reset, fit, showHint, setViewMode };
}
