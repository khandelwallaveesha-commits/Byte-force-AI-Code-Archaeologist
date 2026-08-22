/* NodeDetails.js — §7 component explanation panel.

   Two headings used to sit here: "Dependencies" and "Used by". A reader who
   had never coded said they read as synonyms and they would get the direction
   backwards half the time. So the two directions are now phrased as an action
   and a consequence, which stay distinct even when skim-read:
       "Uses these files"  /  "Would break without it"
*/

import { icons } from '../lib/icons.js';
import { esc, qs, on } from '../lib/dom.js';
import { getNode, dependencies, dependents } from '../lib/graph.js';
import { LAYERS } from '../data/mockData.js';
import { isPlain } from '../store.js';
import { explainSelection } from '../lib/explain.js';
import {
  GROUPS, groupLabel, plainPurpose, plainExplanation, whereLine,
  importanceBadge, USES_HEADING, BREAKS_HEADING, USES_EMPTY, BREAKS_EMPTY,
} from '../lib/plain.js';

const badgeClass = (importance) =>
  importance === 'HIGH' ? 'badge-high' : importance === 'MEDIUM' ? 'badge-med' : 'badge-low';

export function nodeDetailsPanel() {
  return `
  <section class="panel dash-right" aria-label="File details">
    <div class="panel-head">
      <span class="panel-title">${icons.eye(14)} <span id="nd-heading">This file</span></span>
      <div class="row" id="nd-actions" style="gap:.35rem">
        <button class="btn btn-sm btn-ghost" id="nd-code" disabled>
          ${icons.code(13)} <span id="nd-code-label">See the code</span>
        </button>
        <button class="btn btn-sm btn-ghost" id="nd-impact" disabled>
          ${icons.impact(13)} What breaks?
        </button>
      </div>
    </div>
    <div class="panel-body" id="nd-body"></div>
  </section>`;
}

function emptyState() {
  return `
    <div class="empty">
      ${icons.target(30)}
      <p>Pick a box on the map — or a file on the left — to see what it does
         and what would stop working without it.</p>
    </div>`;
}

export function renderNodeDetails(root, id) {
  const body = qs('#nd-body', root);
  const impactBtn = qs('#nd-impact', root);
  const heading = qs('#nd-heading', root);
  const node = id ? getNode(id) : null;
  const plain = isPlain();

  if (heading) heading.textContent = plain ? 'This file' : 'Component';
  if (impactBtn) {
    impactBtn.innerHTML = `${icons.impact(13)} ${plain ? 'What breaks?' : 'Impact'}`;
  }
  const fileActions = qs('#nd-actions', root);
  if (fileActions) fileActions.hidden = false;
  const codeBtn = qs('#nd-code', root);
  if (codeBtn) {
    codeBtn.innerHTML = `${icons.code(13)} ${plain ? 'See the code' : 'Source'}`;
  }

  if (!node) {
    body.innerHTML = emptyState();
    impactBtn.disabled = true;
    if (codeBtn) codeBtn.disabled = true;
    return;
  }
  impactBtn.disabled = false;
  if (codeBtn) codeBtn.disabled = false;

  const deps = dependencies(id);
  const used = dependents(id);

  const tagList = (ids, empty) =>
    ids.length
      ? `<div class="nd-tags">${ids.map((d) =>
          `<button class="nd-tag" data-goto="${esc(d)}">${esc(getNode(d)?.name || d)}</button>`).join('')}</div>`
      : `<p class="faint" style="font-size:.82rem; line-height:1.5">${esc(empty)}</p>`;

  /* ---- plain language (default) ---- */
  if (plain) {
    body.innerHTML = `
      <div class="anim-fade-in">
        <div class="nd-title">
          <span class="dot" style="background:${LAYERS[node.layer].color}"></span>
          <h3>${esc(node.name)}</h3>
        </div>
        <p class="nd-path">${esc(whereLine(node))}</p>

        <div class="nd-block">
          <span class="badge ${badgeClass(node.importance)}">${esc(importanceBadge(node))}</span>
        </div>

        <div class="nd-block">
          <div class="nd-label">What it does</div>
          <p style="color:var(--text)">${esc(plainPurpose(node))}</p>
        </div>

        <div class="nd-block">
          <div class="nd-label">In plain words</div>
          <p>${esc(plainExplanation(node))}</p>
        </div>

        <div class="nd-block">
          <div class="nd-label">${esc(USES_HEADING(deps.length))}</div>
          ${tagList(deps, USES_EMPTY)}
        </div>

        <div class="nd-block">
          <div class="nd-label">${esc(BREAKS_HEADING(used.length))}</div>
          ${tagList(used, BREAKS_EMPTY)}
        </div>

        <div class="nd-block">
          <div class="nd-label">Which group it is in</div>
          <p>${esc(groupLabel(node.layer))} — ${esc(GROUPS[node.layer]?.one || '')}</p>
        </div>
      </div>`;
    return;
  }

  /* ---- developer wording (opt-in) ---- */
  body.innerHTML = `
    <div class="anim-fade-in">
      <div class="nd-title">
        <span class="dot" style="background:${LAYERS[node.layer].color}"></span>
        <h3>${esc(node.name)}</h3>
        <span class="badge ${badgeClass(node.importance)}" style="margin-left:auto">${node.importance}</span>
      </div>
      <p class="nd-path mono">${esc(node.path)}</p>

      <div class="nd-block">
        <div class="nd-label">Purpose</div>
        <p style="color:var(--text)">${esc(node.purpose)}</p>
      </div>

      <div class="nd-block">
        <div class="nd-label">Dependencies · ${deps.length}</div>
        ${tagList(deps, 'Depends on nothing — a leaf module.')}
      </div>

      <div class="nd-block">
        <div class="nd-label">Used by · ${used.length}</div>
        ${tagList(used, 'Nothing imports this. Possible dead code.')}
      </div>

      <div class="nd-block">
        <div class="nd-label">Explanation</div>
        <p>${esc(node.explanation)}</p>
      </div>
    </div>`;
}

/**
 * Explain a run of selected lines in the right-hand panel.
 * @param {number} from absolute first line, @param {number} to absolute last line
 */
export function renderLineExplanation(root, node, from, to) {
  const body = qs('#nd-body', root);
  const heading = qs('#nd-heading', root);
  if (!node || typeof node.code !== 'string') return;

  const start = node.line || 1;
  const all = node.code.split('\n');
  const slice = all.slice(from - start, to - start + 1);
  const { summary, perLine, covered, total } = explainSelection(slice, from);

  if (heading) {
    heading.textContent = from === to ? `Line ${from}` : `Lines ${from}–${to}`;
  }
  /* The panel is 320px wide; the file buttons do not fit beside a longer
     heading, and they are about the file rather than the selection. */
  const fileActions = qs('#nd-actions', root);
  if (fileActions) fileActions.hidden = true;

  body.innerHTML = `
    <div class="anim-fade-in">
      <div class="ex-head">
        <button class="ex-back" id="ex-back">← Back to ${esc(node.name)}</button>
      </div>

      ${summary ? `<p class="ex-summary">${esc(summary)}</p>` : ''}

      ${perLine.map((l) => `
        <div class="ex-line">
          <span class="ex-no">LINE ${l.n}</span>
          <code class="ex-code mono">${esc(l.code.trim() || ' ')}</code>
          <span class="ex-say ${l.matched ? '' : 'unknown'}">${esc(l.text)}</span>
        </div>`).join('')}

      ${covered < total ? `
        <p class="faint" style="font-size:.76rem; margin-top:.8rem; line-height:1.5">
          ${total - covered} of these ${total} lines are blank, notes or brackets —
          they do not do anything on their own.
        </p>` : ''}
    </div>`;

  const back = qs('#ex-back', root);
  if (back) back.dataset.node = node.id;
}

/** Clicking a file chip jumps the whole dashboard to that file. */
export function wireNodeDetails(root, { onGoto, onImpact, onShowCode }) {
  on(root, 'click', '[data-goto]', (e, el) => onGoto(el.dataset.goto));
  qs('#nd-impact', root).addEventListener('click', () => onImpact());
  qs('#nd-code', root).addEventListener('click', () => onShowCode());
}
