/* icons.js — inline SVG icon set (stroke-based, currentColor). */

const svg = (paths, size = 16, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
     stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

export const icons = {
  scan: (s) => svg('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M3 12h18"/>', s),
  graph: (s) => svg('<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><path d="M10.4 6.9 6.6 16.6"/><path d="M13.6 6.9l3.8 9.7"/>', s),
  layers: (s) => svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>', s),
  impact: (s) => svg('<path d="M12 3v5"/><path d="m5.6 5.6 3.5 3.5"/><path d="m18.4 5.6-3.5 3.5"/><circle cx="12" cy="14" r="4"/><path d="M12 18v3"/>', s),
  chat: (s) => svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/>', s),
  code: (s) => svg('<path d="m9 17-5-5 5-5"/><path d="m15 7 5 5-5 5"/>', s),
  file: (s) => svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>', s),
  folder: (s) => svg('<path d="M3 7a2 2 0 0 1 2-2h3.6l2 2.4H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>', s),
  chevron: (s) => svg('<path d="m9 6 6 6-6 6"/>', s),
  upload: (s) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 9 5-5 5 5"/><path d="M12 4v12"/>', s),
  zip: (s) => svg('<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M10 4v3"/><path d="M13 7v3"/><path d="M10 10v3"/><path d="M13 13v3"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>', s),
  close: (s) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', s),
  check: (s) => svg('<path d="m5 13 4 4L19 7"/>', s),
  arrow: (s) => svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', s),
  play: (s) => svg('<path d="M7 4.5 19 12 7 19.5v-15Z"/>', s),
  send: (s) => svg('<path d="M21 3 3 10.5l7 3 3 7L21 3Z"/>', s),
  plus: (s) => svg('<path d="M12 5v14"/><path d="M5 12h14"/>', s),
  minus: (s) => svg('<path d="M5 12h14"/>', s),
  fit: (s) => svg('<path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/>', s),
  sun: (s) => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>', s),
  moon: (s) => svg('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>', s),
  warn: (s) => svg('<path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', s),
  db: (s) => svg('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>', s),
  users: (s) => svg('<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>', s),
  book: (s) => svg('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5V4.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 20.5Z"/>', s),
  git: (s) => svg('<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="12" r="2.6"/><path d="M6 8.6v6.8"/><path d="M15.4 12H12a6 6 0 0 1-6-6"/>', s),
  sparkle: (s) => svg('<path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.1 10.2 12.6 4.5 10.8 10.2 9 12 3.5Z"/>', s),
  target: (s) => svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>', s),
  eye: (s) => svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>', s),
  route: (s) => svg('<circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M15.6 5H10a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8H8.4"/>', s),
  cpu: (s) => svg('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 2v4"/><path d="M14 2v4"/><path d="M10 18v4"/><path d="M14 18v4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M18 10h4"/><path d="M18 14h4"/>', s),
  expand: (s) => svg('<path d="M9 4H5a1 1 0 0 0-1 1v4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M4 15v4a1 1 0 0 0 1 1h4"/>', s),
  shrink: (s) => svg('<path d="M4 9h4a1 1 0 0 0 1-1V4"/><path d="M20 9h-4a1 1 0 0 1-1-1V4"/><path d="M15 20v-4a1 1 0 0 1 1-1h4"/><path d="M9 20v-4a1 1 0 0 0-1-1H4"/>', s),
  logo: () => `
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle class="ring" cx="16" cy="16" r="12.5" stroke="currentColor" stroke-opacity=".22"
              stroke-width="1.4" stroke-dasharray="5 4"/>
      <circle cx="16" cy="16" r="6.4" stroke="var(--accent)" stroke-width="1.6"/>
      <circle class="beam" cx="16" cy="16" r="2.2" fill="var(--accent)"/>
      <path d="M16 3.5v4M16 24.5v4M3.5 16h4M24.5 16h4" stroke="var(--accent)"
            stroke-width="1.6" stroke-linecap="round" stroke-opacity=".75"/>
    </svg>`,
};
