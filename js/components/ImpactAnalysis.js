/* ImpactAnalysis.js — §8 change impact analysis.

   Reverse-reachability over the dependency graph, rendered as something a
   person can act on. A non-technical reader put it bluntly: "it hands me a
   list of filenames, and I cannot take a list of filenames to a standup."
   So the answer leads with the part of the product affected, states real
   numbers rather than "a lot", and says what to do before it ships. */

import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';
import { impactReport, impactReason, getNode } from '../lib/graph.js';
import { LAYERS } from '../data/mockData.js';
import { isPlain } from '../store.js';
import {
  VERDICT_TEXT, impactSentence, hopPhrase, affectedAreas, groupLabel,
} from '../lib/plain.js';

const VERDICT = {
  HIGH:   { cls: 'high', text: 'HIGH IMPACT' },
  MEDIUM: { cls: 'med',  text: 'MEDIUM IMPACT' },
  LOW:    { cls: 'low',  text: 'LOW IMPACT' },
};

export function impactEmpty() {
  return `
    <div class="empty">
      ${icons.impact(30)}
      <p>Pick a file, then ask what would stop working if you changed it.
         The answer is followed through the code, so it is the same every time.</p>
    </div>`;
}

/**
 * @returns {{html: string, report: object}} markup plus the computed report,
 *          so the caller can light the same files on the map.
 */
export function renderImpact(id) {
  const report = impactReport(id);
  const node = getNode(id);
  if (!node) return { html: impactEmpty(), report: null };

  const plain = isPlain();
  const verdict = VERDICT[report.level];
  const areas = affectedAreas(report.radius.map((r) => r.id), 4);

  const rows = report.radius.map((r, i) => {
    const n = getNode(r.id);
    const severity = r.hops === 1 ? 'var(--high)' : r.hops === 2 ? 'var(--med)' : 'var(--text-faint)';
    return `
      <div class="impact-item" data-goto="${esc(r.id)}" style="animation-delay:${i * 0.05}s"
           title="Open ${esc(n.name)}">
        <span class="dot" style="background:${severity}"></span>
        <span>${esc(n.name)}</span>
        <span class="badge" style="border:0; background:transparent; color:${LAYERS[n.layer].color}">
          ${esc(plain ? groupLabel(n.layer) : LAYERS[n.layer].label)}
        </span>
        <span class="hop">${esc(plain ? hopPhrase(r.hops) : `${r.hops} hop${r.hops === 1 ? '' : 's'}`)}</span>
      </div>`;
  }).join('');

  const html = plain
    ? `
    <div class="impact-run anim-fade-in">
      <div class="spread">
        <div class="row">
          <span class="faint" style="font-size:.8rem">If you change</span>
          <span class="badge badge-accent">${esc(node.name)}</span>
        </div>
      </div>

      <div class="impact-verdict ${verdict.cls}">
        ${icons.warn(17)} ${esc(VERDICT_TEXT[report.level])}
      </div>

      <p class="impact-reason">${esc(impactSentence(report))}</p>

      ${areas.length ? `
        <div class="nd-label" style="margin-top:.5rem">Parts of the product affected</div>
        <p style="font-size:.86rem; color:var(--text)">${esc(areas.join(' · '))}</p>` : ''}

      ${report.total ? `
        <div class="nd-label" style="margin-top:.5rem">
          The ${report.total} file${report.total === 1 ? '' : 's'} that would be affected
        </div>${rows}` : ''}
    </div>`
    : `
    <div class="impact-run anim-fade-in">
      <div class="spread">
        <div class="row">
          <span class="faint" style="font-size:.8rem">If you change</span>
          <span class="badge badge-accent">${esc(node.name)}</span>
        </div>
        <span class="faint mono" style="font-size:.7rem">${report.total} affected</span>
      </div>

      <div class="impact-verdict ${verdict.cls}">
        ${icons.warn(17)} ${verdict.text}
      </div>

      ${report.total
        ? `<div class="nd-label" style="margin-top:.3rem">Affected modules</div>${rows}`
        : `<p class="faint" style="font-size:.85rem">Nothing depends on this module.</p>`}

      <div class="nd-label" style="margin-top:.5rem">Reason</div>
      <p class="impact-reason">${esc(impactReason(report))}</p>
    </div>`;

  return { html, report };
}
