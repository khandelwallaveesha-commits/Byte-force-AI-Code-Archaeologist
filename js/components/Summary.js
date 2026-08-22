/* Summary.js — the calm arrival screen.

   Analysis finishes on a plain-English answer to "what did you find?", with
   three obvious next moves. The full workspace stays one click away. */

import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';
import { isPlain } from '../store.js';
import {
  PRIMER, projectSummary, groupLabel, riskiestSentence, areaName,
} from '../lib/plain.js';
import { LAYERS } from '../data/mockData.js';
import { getProject } from '../data/project.js';
import {
  mostConnected, widestReach, layerSummary, criticalModules, getNode,
} from '../lib/graph.js';

/* The sample has a hand-written description; anything analysed gets one
   assembled from what was actually counted. */
function buildLede(meta, project, layerLine, esc) {
  if (!meta.generated) {
    return `An e-commerce application in ${esc(meta.language)} — about ` +
      `${meta.loc.toLocaleString()} lines across ${layerLine}. ` +
      'Shoppers browse a catalogue, fill a cart and check out. A service layer owns ' +
      'authentication, cart state and payments; three modules talk to the database. ' +
      'Every network call goes through one client, and every screen that needs a ' +
      'session reads one context.';
  }

  const externals = meta.externals || [];
  return `I read <strong>${project.nodes.length} source files</strong> in ` +
    `${esc(meta.language)} — ${meta.loc.toLocaleString()} lines — and found ` +
    `<strong>${project.edges.length} import links</strong> between them. ` +
    `They group into ${layerLine}. ` +
    (externals.length
      ? `The project also pulls in ${externals.length} external package${externals.length === 1 ? '' : 's'}` +
        ` (${externals.slice(0, 3).map(esc).join(', ')}${externals.length > 3 ? ', …' : ''}).`
      : 'It has no external package dependencies.');
}

export function summaryView() {
  const project = getProject();
  const { meta } = project;
  const connected = mostConnected(1)[0];
  /* if the busiest module is also the widest-reaching, show the runner-up
     rather than the same name in two cards */
  const reach = widestReach(3);
  const widest = reach.find((r) => r.id !== connected?.id && r.reach > 0) || reach[0];
  const critical = criticalModules();
  const layers = layerSummary();

  const parts = Object.entries(layers).map(([key, n]) => `${n} ${LAYERS[key].label}`);
  const total = Object.values(layers).reduce((a, b) => a + b, 0);
  const layerLine = parts.length > 1
    ? `${total} modules — ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : `${total} modules, all ${parts[0] || 'unclassified'}`;
  const plain = isPlain();
  const lede = plain ? projectSummary(project) : buildLede(meta, project, layerLine, esc);

  /* A small or loosely-coupled project can have no critical modules and no
     downstream reach at all — every card has to survive that. */
  const criticalNames = critical.slice(0, 3).map((n) => n.name).join(', ');
  const criticalRest = critical.length - Math.min(3, critical.length);

  const findings = plain ? [
    connected && {
      icon: 'target',
      label: 'Touched by the most files',
      value: connected.name,
      detail: connected.degree
        ? `${connected.degree} other file${connected.degree === 1 ? '' : 's'} either use this one or are used by it — more than any other file here.`
        : 'No file here uses any other, so nothing would break anything else.',
      goto: connected.id,
    },
    widest && widest.reach > 0 && {
      icon: 'impact',
      label: 'Riskiest to change',
      value: getNode(widest.id)?.name || widest.name,
      detail: riskiestSentence(widest.id),
      goto: widest.id,
    },
    {
      icon: 'warn',
      label: 'Files much of the app depends on',
      value: String(critical.length),
      detail: critical.length
        ? `${criticalNames}${criticalRest > 0 ? ` and ${criticalRest} more` : ''}. Changes to these reach further than changes anywhere else.`
        : 'No single file carries the app — most files stand on their own, so changes here are usually low risk.',
      goto: critical[0]?.id || connected?.id,
    },
  ].filter(Boolean) : [
    connected && {
      icon: 'target',
      label: 'Most connected',
      value: connected.name,
      detail: connected.degree
        ? `${connected.degree} module${connected.degree === 1 ? '' : 's'} link to or from it. The busiest junction here.`
        : 'Nothing links to anything yet — no imports were resolved between these files.',
      goto: connected.id,
    },
    widest && widest.reach > 0 && {
      icon: 'impact',
      label: 'Widest blast radius',
      value: getNode(widest.id)?.name || widest.name,
      detail: `Change it and ${widest.reach} other module${widest.reach === 1 ? '' : 's'} sit downstream.`,
      goto: widest.id,
    },
    {
      icon: 'warn',
      label: 'Critical modules',
      value: String(critical.length),
      detail: critical.length
        ? `${criticalNames}${criticalRest > 0 ? ` and ${criticalRest} more` : ''}.`
        : 'Nothing is depended on heavily enough to flag.',
      goto: critical[0]?.id || connected?.id,
    },
  ].filter(Boolean);

  return `
  <section class="summary" id="summary" aria-label="Analysis summary">
    <div class="summary-inner">
      <span class="badge badge-accent anim-fade-up">${icons.check(12)} Analysis complete</span>

      <h1 class="summary-title anim-fade-up" style="animation-delay:.06s">
        I read <span class="mono">${esc(meta.name)}</span> — here is what I found.
      </h1>

      ${plain ? `<p class="summary-primer anim-fade-up" style="animation-delay:.1s">${PRIMER}</p>` : ''}

      <p class="summary-lede anim-fade-up" style="animation-delay:.12s">${lede}</p>

      <div class="summary-findings">
        ${findings.map((f, i) => `
          <button class="summary-card" data-goto="${esc(f.goto)}"
                  style="animation-delay:${0.18 + i * 0.07}s">
            <span class="summary-icon">${icons[f.icon](17)}</span>
            <span class="summary-label">${f.label}</span>
            <strong class="summary-value">${esc(f.value)}</strong>
            <span class="summary-detail">${esc(f.detail)}</span>
          </button>`).join('')}
      </div>

      <p class="summary-next anim-fade-up" style="animation-delay:.42s">What would you like to do?</p>

      <div class="summary-actions anim-fade-up" style="animation-delay:.48s">
        <button class="btn btn-primary btn-lg" data-action="explore">
          ${icons.graph(16)} Show me the map
        </button>
        <button class="btn btn-lg" data-action="impact">
          ${icons.impact(16)} What breaks if I change something?
        </button>
        <button class="btn btn-lg" data-action="ask">
          ${icons.chat(16)} Ask a question about it
        </button>
      </div>

      <p class="summary-skip anim-fade-up" style="animation-delay:.54s">
        You can come back to this any time — <strong>Summary</strong> in the header.
      </p>
    </div>
  </section>`;
}
