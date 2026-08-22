/* ======================================================================
   graph.js — the analysis layer (§4 "Predict", §8 "Change Impact").

   Impact is computed, not guessed: it is a reverse-reachability walk over
   the dependency edges. Deterministic, instant, and impossible to
   hallucinate — the AI only has to phrase the result, never derive it.

   Reads the *current* project, so it works the same on the bundled sample
   and on a codebase you just uploaded.
   ====================================================================== */

import { getProject, nodeById } from '../data/project.js';

export const getNode = (id) => nodeById(id);

/** Nodes this one depends on (outgoing edges). */
export const dependencies = (id) =>
  getProject().edges.filter((e) => e.from === id).map((e) => e.to);

/** Nodes that depend on this one (incoming edges) — §7 "Used By". */
export const dependents = (id) =>
  getProject().edges.filter((e) => e.to === id).map((e) => e.from);

/**
 * Everything downstream of a change, breadth-first over reversed edges.
 * @returns {{id: string, hops: number}[]} sorted nearest-first
 */
export function blastRadius(id) {
  const seen = new Set([id]);
  const out = [];
  let frontier = [id];
  let hops = 0;

  while (frontier.length) {
    hops += 1;
    const next = [];
    for (const current of frontier) {
      for (const parent of dependents(current)) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        out.push({ id: parent, hops });
        next.push(parent);
      }
    }
    frontier = next;
  }
  return out;
}

/** Direct + transitive counts drive the verdict. */
export function impactReport(id) {
  const node = getNode(id);
  const radius = blastRadius(id);
  const direct = radius.filter((r) => r.hops === 1).length;
  const total = radius.length;

  let level = 'LOW';
  if (node && node.importance === 'HIGH' && total >= 3) level = 'HIGH';
  else if (total >= 5) level = 'HIGH';
  else if (total >= 2) level = 'MEDIUM';

  const affectedUi = radius
    .map((r) => getNode(r.id))
    .filter((n) => n && n.layer === 'ui').length;

  return { id, node, level, direct, total, affectedUi, radius };
}

/** Plain-language justification, assembled from the graph facts. */
export function impactReason(report) {
  const { node, direct, total, affectedUi, level } = report;
  if (!node) return '';
  if (total === 0) {
    return `Nothing depends on ${node.name}. It is a leaf — safe to change in isolation, and a candidate for dead-code review if nothing calls it at runtime either.`;
  }

  const parts = [];
  parts.push(
    `${direct} module${direct === 1 ? '' : 's'} import ${node.name} directly, and ${total} in total sit downstream of it.`
  );
  if (affectedUi > 0) {
    parts.push(
      `${affectedUi} of those ${affectedUi === 1 ? 'is a screen the user sees' : 'are screens the user sees'}, so a regression here is visible immediately.`
    );
  }
  if (node.importance === 'HIGH') {
    parts.push(`${node.name} is marked critical, so changes should ship behind a test.`);
  }
  if (level === 'LOW') {
    parts.push('The surface is small enough to change safely in one pass.');
  }
  return parts.join(' ');
}

/** Shortest dependency path between two nodes, if one exists. */
export function pathBetween(fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];

  while (queue.length) {
    const current = queue.shift();
    for (const next of dependencies(current)) {
      if (prev.has(next)) continue;
      prev.set(next, current);
      if (next === toId) {
        const path = [next];
        let step = current;
        while (step !== null) { path.unshift(step); step = prev.get(step); }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Nodes with the largest blast radius — "change this and the most breaks". */
export function widestReach(limit = 3) {
  return getProject().nodes
    .map((n) => ({ id: n.id, name: n.name, reach: blastRadius(n.id).length }))
    .sort((a, b) => b.reach - a.reach)
    .slice(0, limit);
}

/** Module counts per layer, for the plain-English summary. */
export function layerSummary() {
  const counts = {};
  getProject().nodes.forEach((n) => { counts[n.layer] = (counts[n.layer] || 0) + 1; });
  return counts;
}

/** Modules flagged critical. */
export const criticalModules = () =>
  getProject().nodes.filter((n) => n.importance === 'HIGH');

/** Most-connected nodes, for the "critical modules" callout. */
export function mostConnected(limit = 5) {
  return getProject().nodes
    .map((n) => ({
      id: n.id,
      name: n.name,
      degree: dependencies(n.id).length + dependents(n.id).length,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, limit);
}
