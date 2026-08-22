/* Navbar.js — sticky header: brand, route links, theme toggle, CTA. */

import { icons } from '../lib/icons.js';
import { qs, qsa } from '../lib/dom.js';

const LINKS = [
  { href: '#/',          label: 'Overview' },
  { href: '#/analyze',   label: 'Analyze' },
  { href: '#/dashboard', label: 'Dashboard' },
];

export function renderNavbar(root) {
  root.innerHTML = `
    <header class="nav" id="nav">
      <div class="wrap">
        <a class="logo" href="#/" aria-label="AI Code Archaeologist — home">
          ${icons.logo()}
          <span class="logo-text">AI Code <b>Archaeologist</b></span>
        </a>

        <nav class="nav-links" aria-label="Primary">
          ${LINKS.map((l) => `<a class="nav-link" href="${l.href}" data-nav="${l.href}">${l.label}</a>`).join('')}
        </nav>

        <div class="nav-actions">
          <button class="icon-btn" id="theme-toggle" aria-label="Switch theme" data-tip="Theme">
            <span class="theme-icon"></span>
          </button>
          <a class="btn btn-primary btn-sm" href="#/analyze">
            ${icons.scan(15)} Analyze code
          </a>
        </div>
      </div>
    </header>`;

  const toggle = qs('#theme-toggle', root);
  const paintIcon = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    qs('.theme-icon', toggle).innerHTML = dark ? icons.sun(16) : icons.moon(16);
  };
  paintIcon();

  toggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('aca-theme', next); } catch (e) { /* no storage */ }
    paintIcon();
  });

  const nav = qs('#nav', root);
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** Highlight the link matching the current route. */
export function setActiveNav(route) {
  qsa('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === `#${route}`);
  });
}
