/* dom.js — minimal DOM helpers. Keeps component files declarative. */

export const qs  = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape untrusted text before dropping it into a template string. */
export function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Delegated listener: on(root, 'click', '.btn', (e, el) => ...) */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  });
}

/** Build an element from an HTML string. */
export function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Animate a number from 0 → value. Respects reduced-motion. */
export function countUp(el, value, duration = 1100) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.textContent = String(value); return; }
  /* Time the run off the rAF timestamp alone. Mixing performance.now() with
     the frame clock lets the two disagree — which produced a negative
     progress value, and an easing curve that counted down from zero. */
  let start = null;
  let settled = false;

  const settle = () => {
    settled = true;
    el.textContent = String(value);
  };

  const step = (now) => {
    if (settled) return;
    if (start === null) start = now;
    const p = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(value * eased));
    if (p < 1) requestAnimationFrame(step);
    else settle();
  };
  requestAnimationFrame(step);

  /* Frames can be throttled to nothing in a background tab or a low-power
     window. Never leave a stat reading 0 — land the real number regardless. */
  setTimeout(settle, duration + 400);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
