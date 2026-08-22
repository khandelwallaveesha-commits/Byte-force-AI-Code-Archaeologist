/* toast.js — transient status messages, announced politely for screen readers. */

import { esc } from './dom.js';

export function toast(message, ms = 2600) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="dot"></span><span>${esc(message)}</span>`;
  root.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, ms);
}
