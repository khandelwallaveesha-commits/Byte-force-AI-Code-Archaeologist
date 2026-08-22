/* ======================================================================
   ai.js — optional AI answers, grounded in the graph.

   The retrieval here is the whole point. Ordinary RAG chops a codebase into
   chunks, embeds them, and hopes similarity finds the right ones. We already
   know exactly which files are connected to which, so retrieval is a graph
   walk: the file being asked about, the files that would break without it,
   the files it uses, and the numbers the analyser computed.

   That is more precise than a vector search could be, and it means the model
   is never the thing deciding what is true — it only writes the prose. The
   impact numbers stay computed, so "nothing is guessed" remains honest.
   ====================================================================== */

import { getProject } from '../data/project.js';
import {
  getNode, dependencies, dependents, impactReport, mostConnected,
} from './graph.js';
import { groupLabel } from './plain.js';

const FOCUS_LINES = 160;      // source lines from the file being asked about
const NEIGHBOUR_LINES = 40;   // and from each of its closest neighbours
const MAX_NEIGHBOURS = 4;

let status = { enabled: false, model: null, reason: 'not checked yet' };

/*
 * Built from the directory the page is served from, not from the site root.
 * GitHub Pages serves a project under /repo-name/, so an absolute /api/...
 * would leave the site entirely. This way the same build works locally
 * against server.py and hosted under any sub-path.
 */
const apiUrl = (name) => new URL(`api/${name}`, `${location.origin}${location.pathname}`).href;

/** Ask the server once whether a key is configured. */
export async function initAI() {
  try {
    const res = await fetch(apiUrl('ai-status'));
    if (!res.ok) throw new Error(String(res.status));
    status = await res.json();
  } catch (e) {
    status = {
      enabled: false,
      model: null,
      reason: 'This page is being served without the helper server, so answers come from the built-in rules.',
    };
  }
  return status;
}

export const aiStatus = () => status;

const head = (code, n) => String(code || '').split('\n').slice(0, n).join('\n');

/** Facts about one file, straight from the graph. */
function fileContext(node) {
  const uses = dependencies(node.id).map((id) => getNode(id)).filter(Boolean);
  const breaks = dependents(node.id).map((id) => getNode(id)).filter(Boolean);
  const report = impactReport(node.id);
  const decl = node._decl || {};

  const lines = [
    `FILE: ${node.path}`,
    `GROUP: ${groupLabel(node.layer)}`,
    decl.types && decl.types.length ? `DECLARES: ${decl.types.join(', ')}` : null,
    decl.fns && decl.fns.length ? `STEPS IT CAN CARRY OUT: ${decl.fns.slice(0, 12).join(', ')}` : null,
    `FILES THAT WOULD BREAK WITHOUT IT (${breaks.length}): ${breaks.map((n) => n.name).join(', ') || 'none'}`,
    `FILES IT USES (${uses.length}): ${uses.map((n) => n.name).join(', ') || 'none'}`,
    `IF IT CHANGES: ${report.total} file(s) could stop working, ${report.direct} of them directly. Risk level: ${report.level}.`,
    '',
    `SOURCE OF ${node.name}:`,
    '```',
    head(node.code, FOCUS_LINES),
    '```',
  ].filter(Boolean);

  /* Neighbours give the model what it needs to explain how the file is used,
     which is exactly the question the rules cannot answer. */
  const near = [...breaks, ...uses].slice(0, MAX_NEIGHBOURS);
  near.forEach((n) => {
    if (!n.code) return;
    lines.push('', `SOURCE OF A CONNECTED FILE, ${n.path}:`, '```', head(n.code, NEIGHBOUR_LINES), '```');
  });

  return lines.join('\n');
}

/** Facts about the project as a whole. */
function projectContext() {
  const p = getProject();
  const counts = {};
  p.nodes.forEach((n) => { counts[n.layer] = (counts[n.layer] || 0) + 1; });

  const top = mostConnected(6);
  const orphans = p.nodes.filter((n) => dependents(n.id).length === 0);

  const lines = [];
  /* The README is the highest-value context there is — the project saying in
     its own words what it is for. It was being filtered out before analysis. */
  if (p.meta.about) lines.push(`WHAT THE PROJECT SAYS IT IS (from its ${p.meta.aboutSource}):`, p.meta.about, '');
  if ((p.meta.areas || []).length) {
    lines.push(`SUBJECTS THE FILE NAMES KEEP RETURNING TO: ${p.meta.areas.map((a) => `${a.name} (${a.files.length} files: ${a.files.slice(0, 5).join(', ')})`).join('; ')}`, '');
  }

  return [
    ...lines,
    `PROJECT: ${p.meta.name}`,
    `LANGUAGE: ${p.meta.language}`,
    `SIZE: ${p.nodes.length} files, ${p.edges.length} links between them, about ${p.meta.loc || '?'} lines`,
    `GROUPS: ${Object.entries(counts).map(([k, v]) => `${v} ${groupLabel(k)}`).join(', ')}`,
    `MOST CONNECTED: ${top.map((t) => `${t.name} (${t.degree} links)`).join(', ')}`,
    `NOTHING REFERS TO THESE (${orphans.length}): ${orphans.slice(0, 10).map((n) => n.name).join(', ') || 'none'}`,
    '',
    'ALL FILES:',
    ...p.nodes.slice(0, 120).map((n) => {
      const used = dependents(n.id).length;
      return `  ${n.path} — ${groupLabel(n.layer)}; ${used} file(s) would break without it`;
    }),
  ].join('\n');
}

/**
 * Build the retrieval context for a question.
 * @param {object|null} node the file the question is about, if any
 */
export function buildContext(node) {
  return node ? `${projectContext()}\n\n---\n\n${fileContext(node)}` : projectContext();
}

/**
 * @returns {Promise<{answer?: string, error?: string, fallback?: boolean}>}
 */
export async function askAI(question, node) {
  if (!status.enabled) return { error: status.reason, fallback: true };

  try {
    const res = await fetch(apiUrl('ask'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: buildContext(node) }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || `Server replied ${res.status}.`, fallback: true };
    return { answer: data.answer };
  } catch (e) {
    return { error: 'Could not reach the helper server.', fallback: true };
  }
}
