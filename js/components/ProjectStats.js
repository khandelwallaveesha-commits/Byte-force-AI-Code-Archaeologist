/* ProjectStats.js — §10 project overview.

   Was six stat tiles across the top. That band cost a lot of attention for
   numbers you read once, so it is now a single line beside the project name.
   The findings that actually matter live on the summary screen. */

import { getProject } from '../data/project.js';
import { statLine } from '../lib/plain.js';
import { isPlain } from '../store.js';
import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

export function projectStats() {
  const project = getProject();
  const { meta, stats } = project;
  const line = isPlain()
    ? statLine(project)
    : stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(' · ');

  return `
  <section class="dash-stats" aria-label="Project overview">
    <div class="spread">
      <div class="row" style="min-width:0; flex-wrap:wrap; gap:.5rem">
        ${icons.scan(15)}
        <strong style="font-size:.9rem">${esc(meta.name)}</strong>
        <span class="badge badge-accent">${esc(meta.language)}</span>
        <span class="faint stat-line">${esc(line)}</span>
      </div>
      <div class="row" style="gap:.35rem; flex:none">
        <button class="chip active" id="t-summary">${icons.book(13)} Summary</button>
        <button class="chip" id="t-files" data-tip="Toggle file tree (B)">${icons.folder(13)} Files</button>
        <button class="chip" id="t-ask" data-tip="Ask a question (/)">${icons.chat(13)} Ask</button>
        <button class="chip ${isPlain() ? '' : 'active'}" id="t-plain"
                data-tip="${isPlain() ? 'Show the developer wording' : 'Back to plain language'}">
          ${icons.code(13)} ${isPlain() ? 'Technical details' : 'Plain language'}
        </button>
      </div>
    </div>
  </section>`;
}
