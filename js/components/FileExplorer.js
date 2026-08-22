/* FileExplorer.js — left rail: searchable file tree wired to graph nodes. */

import { getProject } from '../data/project.js';
import { icons } from '../lib/icons.js';
import { qs, esc, on } from '../lib/dom.js';

const importanceColor = (id) => {
  const n = getProject().nodes.find((x) => x.id === id);
  if (!n) return 'transparent';
  return n.importance === 'HIGH' ? 'var(--high)'
       : n.importance === 'MEDIUM' ? 'var(--med)'
       : 'var(--low)';
};

export function fileExplorerPanel() {
  return `
  <section class="panel dash-left" aria-label="File explorer">
    <div class="panel-head">
      <span class="panel-title">${icons.folder(14)} Files</span>
      <span class="faint mono" style="font-size:.68rem">${getProject().nodes.length} total</span>
    </div>
    <div style="padding:.55rem .55rem 0">
      <div class="search-wrap">
        ${icons.search(14)}
        <input class="input" id="tree-search" placeholder="Filter files…" aria-label="Filter files">
      </div>
    </div>
    <div class="panel-body flush">
      <div class="tree" id="tree"></div>
    </div>
  </section>`;
}

function renderBranch(items, depth, filter) {
  return items.map((item) => {
    const pad = `padding-left:${0.5 + depth * 0.85}rem`;

    if (item.type === 'dir') {
      const inner = renderBranch(item.children, depth + 1, filter);
      if (filter && !inner.trim()) return '';
      const open = filter ? true : item.open !== false;
      return `
        <div>
          <div class="tree-item ${open ? 'open' : ''}" data-dir="1" style="${pad}">
            <span class="chev">${icons.chevron(12)}</span>
            ${icons.folder(13)}
            <span class="tree-name">${esc(item.name)}</span>
          </div>
          <div class="tree-children ${open ? '' : 'collapsed'}">${inner}</div>
        </div>`;
    }

    if (filter && !item.name.toLowerCase().includes(filter)) return '';
    return `
      <div class="tree-item" data-node="${esc(item.node || '')}" style="${pad}"
           title="${esc(item.name)}">
        ${icons.file(13)}
        <span class="tree-name">${esc(item.name)}</span>
        <span class="tree-dot" style="background:${importanceColor(item.node)}"></span>
      </div>`;
  }).join('');
}

export function mountFileExplorer(root, onSelect) {
  const host = qs('#tree', root);
  const search = qs('#tree-search', root);

  const draw = (filter = '') => {
    host.innerHTML = renderBranch(getProject().tree, 0, filter.trim().toLowerCase());
    if (!host.innerHTML.trim()) {
      host.innerHTML = `<p class="faint" style="padding:1rem; font-size:.82rem">No files match.</p>`;
    }
  };

  on(host, 'click', '.tree-item', (e, el) => {
    if (el.dataset.dir) {
      el.classList.toggle('open');
      const kids = el.nextElementSibling;
      if (kids) kids.classList.toggle('collapsed');
      return;
    }
    if (el.dataset.node) onSelect(el.dataset.node);
  });

  search.addEventListener('input', () => draw(search.value));

  draw();

  return {
    /** Mirror graph selection back into the tree. */
    highlight(id) {
      host.querySelectorAll('.tree-item[data-node]').forEach((el) => {
        el.classList.toggle('active', el.dataset.node === id);
      });
    },
  };
}
