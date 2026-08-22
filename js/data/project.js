/* ======================================================================
   project.js — the single source of truth for "the project on screen".

   Everything used to import the sample dataset directly, which is why an
   upload could never change what the dashboard showed. Components now read
   through here, so whatever the analyzer produces is what gets rendered.
   ====================================================================== */

import {
  meta, stats, nodes, edges, tree, chatIntents, chatSuggestions,
} from './mockData.js';

/* The hand-authored stats claimed 42 files while the map draws 19 — a reader
   spotted the contradiction and stopped trusting both numbers. Count them from
   the same data the map uses so they can never disagree again. */
const sampleStats = [
  { key: 'files',      label: 'Files',            value: nodes.length },
  { key: 'components', label: 'Components',       value: nodes.filter((n) => n.layer === 'ui').length },
  { key: 'functions',  label: 'Functions',        value: nodes.reduce((a, n) => a + (n.fns || 0), 0) },
  { key: 'endpoints',  label: 'API Endpoints',    value: stats.find((s) => s.key === 'endpoints').value },
  { key: 'deps',       label: 'Dependencies',     value: edges.length },
  { key: 'critical',   label: 'Critical Modules', value: nodes.filter((n) => n.importance === 'HIGH').length },
];

export const sampleProject = {
  meta, stats: sampleStats, nodes, edges, tree, chatIntents, chatSuggestions,
};

let current = sampleProject;
let index = null;

export const getProject = () => current;

export const isSample = () => current === sampleProject;

const KEY = 'aca-project';

export function setProject(project) {
  current = project;
  index = null;

  /* Survive a refresh, or the dashboard silently reverts to the sample —
     which is exactly the bug this whole file exists to fix. Source text is
     dropped first if the payload is too big for sessionStorage. */
  try {
    if (project === sampleProject) { sessionStorage.removeItem(KEY); return; }

    /* Step down in stages rather than jumping straight to dropping the source.
       Losing the code entirely made the viewer render a blank panel, so trim
       it first, and only strip it as a last resort — flagged, so the viewer
       can say what happened instead of showing nothing. */
    const trimmed = (limit) => ({
      ...project,
      nodes: project.nodes.map((n) => ({
        ...n,
        code: (n.code || '').split('\n').slice(0, limit).join('\n'),
      })),
    });

    for (const attempt of [
      () => project,
      () => trimmed(150),
      () => trimmed(40),
      () => ({
        ...project,
        meta: { ...project.meta, codeStripped: true },
        nodes: project.nodes.map((n) => ({ ...n, code: '' })),
      }),
    ]) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify(attempt()));
        return;
      } catch (quota) { /* too big — try the next, smaller shape */ }
    }
  } catch (e) { /* private mode — memory only, which is fine */ }
}

/** Reload a project analysed earlier in this tab. */
export function restoreProject() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.nodes) || !saved.nodes.length) return false;
    current = saved;
    index = null;
    return true;
  } catch (e) {
    return false;
  }
}

export const useSample = () => setProject(sampleProject);

/** Memoised id lookup, rebuilt whenever the project changes. */
export function nodeById(id) {
  if (!index) index = new Map(current.nodes.map((n) => [n.id, n]));
  return index.get(id) || null;
}
