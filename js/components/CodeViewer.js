/* CodeViewer.js — §6 code-to-graph connection.

   Selecting a file opens its source here. Clicking a line — or dragging
   across several — asks what those lines do, which is answered by
   js/lib/explain.js and shown in the right-hand panel. */

import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';
import { codeBlock } from '../lib/highlight.js';
import { getNode } from '../lib/graph.js';
import { isPlain } from '../store.js';

export function codeEmpty() {
  return `
    <div class="empty">
      ${icons.code(30)}
      <p>${isPlain()
        ? 'Pick a box on the map and the text inside that file appears here.'
        : 'Click any node in the architecture graph and its source appears here, with the lines that matter highlighted.'}</p>
    </div>`;
}

/** The source was dropped to fit in session storage — say so, do not show a blank. */
function sourceMissing(node) {
  return `
    <div class="empty">
      ${icons.file(26)}
      <p><strong>${esc(node.name)}</strong> was analysed, but its text was not kept
         when the page reloaded.</p>
      <p style="margin-top:.2rem">Everything else about it — what uses it and what
         would break without it — is still accurate. Run the analysis again to read
         the file itself.</p>
      <a class="btn btn-sm" href="#/analyze" style="margin-top:.6rem">
        ${icons.scan(14)} Analyze again
      </a>
    </div>`;
}

export function renderCode(id) {
  const node = getNode(id);
  if (!node) return codeEmpty();
  if (typeof node.code !== 'string' || !node.code.trim()) return sourceMissing(node);

  /* Count from the text actually being rendered. The header used to read the
     stored line count and highlight list, which drifted from reality the
     moment either was trimmed. */
  const lines = node.code.split('\n').length;
  const start = node.line || 1;
  const hot = (node.hot || []).filter((n) => n >= start && n < start + lines);

  return `
    <div class="anim-fade-in">
      <div class="spread" style="padding:.55rem .8rem; border-bottom:1px solid var(--line-soft)">
        <div class="row" style="min-width:0">
          ${icons.file(14)}
          <span class="mono" style="font-size:.76rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
            ${esc(node.path)}
          </span>
        </div>
        <span class="faint mono" style="font-size:.7rem; flex:none">
          ${lines} line${lines === 1 ? '' : 's'}${hot.length ? ` · ${hot.length} highlighted` : ''}
        </span>
      </div>
      <div class="code-hint">
        ${icons.sparkle(12)}
        Click a line — or drag across several — to see what it does.
      </div>
      ${codeBlock(node.code, start, hot)}
    </div>`;
}

/**
 * Make the rendered lines pickable.
 * @param {HTMLElement} container element holding the output of renderCode()
 * @param {(from: number, to: number) => void} onPick absolute line numbers
 * @returns {{clear: Function}|null}
 */
export function mountCodeSelection(container, onPick) {
  const lines = container.querySelector('.code-lines');
  if (!lines) return null;

  const gutter = container.querySelector('.gutter');
  lines.classList.add('pickable');

  let anchor = null;
  let dragging = false;

  const rows = () => Array.from(lines.querySelectorAll('.cl'));

  function paint(a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    rows().forEach((el) => {
      const n = Number(el.dataset.line);
      el.classList.toggle('picked', n >= lo && n <= hi);
    });
    if (gutter) {
      Array.from(gutter.children).forEach((el) => {
        const n = Number(el.textContent);
        el.classList.toggle('picked', n >= lo && n <= hi);
      });
    }
  }

  const commit = (a, b) => { paint(a, b); onPick(Math.min(a, b), Math.max(a, b)); };

  lines.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.cl');
    if (!el) return;
    e.preventDefault();
    const n = Number(el.dataset.line);

    /* shift extends the run rather than starting a new one */
    if (e.shiftKey && anchor !== null) { commit(anchor, n); return; }
    anchor = n;
    dragging = true;
    commit(n, n);
  });

  lines.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const el = e.target.closest('.cl');
    if (el) paint(anchor, Number(el.dataset.line));
  });

  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    const el = e.target && e.target.closest ? e.target.closest('.cl') : null;
    commit(anchor, el ? Number(el.dataset.line) : anchor);
  };
  lines.addEventListener('pointerup', finish);
  lines.addEventListener('pointercancel', () => { dragging = false; });
  lines.addEventListener('pointerleave', () => { dragging = false; });

  return {
    clear() {
      rows().forEach((el) => el.classList.remove('picked'));
      if (gutter) Array.from(gutter.children).forEach((el) => el.classList.remove('picked'));
      anchor = null;
    },
  };
}
