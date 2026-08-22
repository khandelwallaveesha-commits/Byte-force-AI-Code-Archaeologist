/* ======================================================================
   plain.js — the plain-language layer.

   Every sentence a non-coder reads comes from here. Two personas who had
   never written code tore up the first attempt; these rules are their
   corrections, and breaking one of them breaks the whole thing:

   1. EXPLAIN "FILE" ONCE.  "To me a file is a PDF in my Downloads folder,
      not a piece of an app." Nothing else lands until that is said out loud.

   2. ONE RELATIONSHIP, TWO DIRECTIONS, NEVER MORE.  The first draft used
      needs / relies on / leans on / uses / points at / connected for a
      single idea. Readers assumed they were five different measurements.
      Here there is exactly one pair, and they are not synonyms in English,
      so the direction survives being read quickly:
          outgoing  ->  "uses"
          incoming  ->  "would stop working without"

   3. NUMBERS, NOT QUANTITIES.  Never "a few", "a lot", "several".
      "3 files" is checkable; "a few" is a shrug.

   4. A COUNT IS NOT A JUDGEMENT.  The badge states a fact ("7 files use
      this"). The verdict states an opinion ("Risky"). They must never be
      phrased alike or the distinction collapses.

   5. NAME THE AREA, NOT ONLY THE FILE.  "You cannot take a list of
      filenames to a standup." Every impact answer leads with the part of
      the product affected.

   Banned outright: module, component, dependency, import, export, function,
   endpoint, API, architecture, node, edge, leaf, parse, blast radius,
   downstream, critical, refactor, plus "part", "piece", "block" and "thing"
   as loose synonyms for file.
   ====================================================================== */

import { getProject } from '../data/project.js';
import { dependencies, dependents, getNode, blastRadius } from './graph.js';

/* ---------------------------------------------------------------- groups */

export const GROUPS = {
  ui: {
    label: 'Screens',
    one: 'The files that draw what people look at and click.',
    risk: 'A mistake here is visible to users straight away.',
  },
  logic: {
    label: 'Rules & decisions',
    one: 'Files that decide what should happen — prices, permissions.',
    risk: 'Changes here are invisible on screen but can affect several screens at once.',
  },
  api: {
    label: 'Sending & fetching',
    one: 'Files that ask the server for information and bring it back.',
    risk: 'If these break, screens load but come up empty.',
  },
  data: {
    label: 'Saved information',
    one: 'Files that look up and update information the app keeps.',
    risk: 'Mistakes here can affect information that is already saved.',
  },
  other: {
    label: 'Everything else',
    one: 'Helper files that do not fit the other groups.',
    risk: '',
  },
};

export const groupLabel = (key) => (GROUPS[key] || GROUPS.other).label;
export const groupOneLiner = (key) => (GROUPS[key] || GROUPS.other).one;

/* ---------------------------------------------------------------- primer */

/** Said once, at the top of the summary. Nothing else works without it. */
export const PRIMER =
  'An app is built out of hundreds of typed documents called <strong>files</strong>. ' +
  'Each file holds the instructions for one piece of the app — one screen, one rule, ' +
  'one place information gets saved. Files call on each other to get their work done. ' +
  'This map shows those files and, more importantly, <strong>which ones would stop ' +
  'working if you changed another</strong>.';

/* ---------------------------------------------------------------- naming */

/** "the Checkout screen", "the login rules" — something you can say out loud. */
export function areaName(node) {
  if (!node) return '';
  const clean = node.name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    /* "LoginPage" -> "Login", so we say "the Login screen" not
       "the Login Page screen" */
    .replace(/\s+(Page|Screen|View|Component|Controller|Service)$/i, '')
    .trim();
  if (node.layer === 'ui') return `the ${clean} screen`;
  if (node.layer === 'data') return `saving and loading ${clean.toLowerCase()}`;
  if (node.layer === 'api') return `fetching ${clean.toLowerCase()}`;
  return `the ${clean.toLowerCase()} rules`;
}

/** Group affected files into product areas a person can repeat in a meeting. */
export function affectedAreas(ids, limit = 3) {
  const nodes = ids.map(getNode).filter(Boolean);
  const screens = nodes.filter((n) => n.layer === 'ui');
  const rest = nodes.filter((n) => n.layer !== 'ui');

  const named = screens.slice(0, limit).map(areaName);
  if (named.length < limit && rest.length) {
    const groups = [...new Set(rest.map((n) => groupLabel(n.layer).toLowerCase()))];
    named.push(...groups.slice(0, limit - named.length));
  }
  return named;
}

const list = (items) => {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

/**
 * A capped list that stays grammatical. The old form produced
 * "A, B, C and D, and more" — this gives "A, B, C and 4 more".
 */
function nameList(items, max = 3) {
  const all = items.filter(Boolean);
  if (!all.length) return '';
  if (all.length <= max) return list(all);
  return `${all.slice(0, max).join(', ')} and ${all.length - max} more`;
}

/** "loadModels" -> "load models", so a step name reads as an action. */
const spoken = (name) => String(name)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .toLowerCase();

/* ---------------------------------------------------------------- labels */

/* The two directions. Deliberately not synonyms in ordinary English. */
export const USES_HEADING   = (n) => `Uses ${n} other file${n === 1 ? '' : 's'} to do its job`;
export const BREAKS_HEADING = (n) => `${n} file${n === 1 ? '' : 's'} would stop working without this one`;

export const USES_EMPTY   = 'This file does not use any other file in this project — it works on its own.';
export const BREAKS_EMPTY =
  'No other file in this project uses this one. That means it is either where the app ' +
  'starts up, or leftover work nobody needs any more.';

export const PANEL_LABELS = {
  panel: 'This file',
  purpose: 'What it does',
  where: 'Where it lives',
  uses: 'Uses these files',
  breaks: 'Would break without it',
  explanation: 'In plain words',
  glance: 'Size',
};

/** A count, never a judgement — the verdict does the judging. */
export function importanceBadge(node) {
  const n = dependents(node.id).length;
  if (n === 0) return 'Nothing uses this yet';
  return `${n} file${n === 1 ? '' : 's'} use${n === 1 ? 's' : ''} this`;
}

/** "uses it directly" / "uses it through 2 other files" — always a verb. */
export function hopPhrase(hops) {
  if (hops <= 1) return 'uses it directly';
  if (hops === 2) return 'uses it through 1 other file';
  return `uses it through ${hops - 1} other files`;
}

/* ---------------------------------------------------------------- verdict */

export const VERDICT_TEXT = {
  HIGH:   'Risky change',
  MEDIUM: 'Some risk',
  LOW:    'Low risk',
};

/**
 * The sentence someone can act on: how many, which areas, what to do.
 * Every number here is counted from the files; nothing is estimated.
 */
export function impactSentence(report) {
  const { node, total, direct, radius, level } = report;
  if (!node) return '';

  if (total === 0) {
    return `Nothing else in this project uses ${node.name}, so changing it cannot break ` +
           `anything else here. It is safe to work on by itself.`;
  }

  const areas = affectedAreas(radius.map((r) => r.id));
  const screens = radius.map((r) => getNode(r.id)).filter((n) => n && n.layer === 'ui');

  const opening =
    `If ${node.name} changes, ${total} other file${total === 1 ? '' : 's'} could stop ` +
    `working — ${direct} of them use${direct === 1 ? 's' : ''} it directly.`;

  const where = areas.length
    ? ` The parts of the product affected are ${list(areas)}.`
    : '';

  let advice;
  if (level === 'HIGH') {
    advice = screens.length
      ? ` Before this ships, have someone open ${list(screens.slice(0, 2).map(areaName))} and check ` +
        `${screens.length === 1 ? 'it still works' : 'they still work'}.`
      : ' Worth a second pair of eyes and a test before it ships.';
  } else if (level === 'MEDIUM') {
    advice = ' Worth telling whoever looks after those parts before you change it.';
  } else {
    advice = ' Small enough to change in one go.';
  }

  return opening + where + advice;
}

/* ---------------------------------------------------------------- per file */

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One sentence: what this file is for, in words anyone can read. */
export function plainPurpose(node) {
  if (!node) return '';
  if (node.plain && node.plain.purpose) return node.plain.purpose;

  /* Say what this file actually sets up. Falling straight through to a
     layer-based stock phrase gave every screen in a project the identical
     sentence, which told the reader nothing about the file in front of them. */
  const d = node._decl || {};
  const types = d.types || [];
  const fns = d.fns || [];
  const props = d.props || [];

  if (types.length) {
    const name = types.length === 1 ? `"${types[0]}"` : nameList(types, 2);
    const can = fns.length ? ` It can ${nameList(fns.map(spoken), 3)}.` : '';

    if (node.layer === 'ui') {
      /* Those properties are values the screen keeps while it is open, not
         things it puts in front of the reader — "showing" overstated it. */
      const keeps = props.length ? ` It keeps track of ${nameList(props, 3)}.` : '';
      return `Draws ${name} on screen.${can || keeps}`;
    }
    if (props.length) return `Sets up ${name}, which holds ${nameList(props, 4)}.${can}`;
    return `Sets up ${name}.${can}`;
  }

  if (node._endpoints) {
    return `Other parts of the app can ask this file for ${plural(node._endpoints, 'different thing')}.`;
  }
  if (node._queries) {
    return 'Looks up and saves information the app needs to remember.';
  }
  if (fns.length) {
    return `Can do ${plural(fns.length, 'thing')} other files can ask for: ${nameList(fns.map(spoken), 4)}.`;
  }

  if (node.layer === 'ui') return 'Draws something people see and click on.';
  if (node.layer === 'api') return 'Fetches information from the server and brings it back.';
  if (node.layer === 'data') return 'Looks after information the app keeps.';
  return 'Works out what should happen when someone does something.';
}

/** Two or three sentences, consequence-first. */
export function plainExplanation(node) {
  if (!node) return '';
  if (node.plain && node.plain.explanation) return node.plain.explanation;

  const uses = dependencies(node.id).map((id) => getNode(id)?.name).filter(Boolean);
  const breaks = dependents(node.id).map((id) => getNode(id)?.name).filter(Boolean);
  const d = node._decl || {};
  const fns = d.fns || [];
  const out = [];

  /* The job first. This used to open with "it calls on 7 other files", which
     is a fact about wiring, not an answer to "what does this do?". */
  if (fns.length) {
    out.push(`It can ${nameList(fns.map(spoken), 5)} — ${plural(fns.length, 'separate thing')} it knows how to do.`);
  } else if ((d.types || []).length) {
    out.push(`It sets up ${nameList(d.types, 3)} and nothing else.`);
  }

  out.push(
    breaks.length
      ? `${plural(breaks.length, 'file')} would stop working without it: ${nameList(breaks, 4)}.`
      : BREAKS_EMPTY
  );

  out.push(
    uses.length
      ? `It needs ${plural(uses.length, 'other file')} to do its work: ${nameList(uses, 4)}.`
      : 'It does not need any other file in this project — it works on its own.'
  );

  if (node._lines) out.push(`About ${node._lines} lines long.`);
  return out.join(' ');
}

/** "Where it lives", said as a sentence rather than a bare path. */
export const whereLine = (node) => (node ? `Kept in ${node.path}` : '');

/* ---------------------------------------------------------------- project */

/** The one-line strip at the top. Every number gets an everyday unit. */
export function statLine(project) {
  const p = project || getProject();
  const screens = p.nodes.filter((n) => n.layer === 'ui').length;
  const leaned = p.nodes.filter((n) => n.importance === 'HIGH').length;
  const bits = [
    `${plural(p.nodes.length, 'file')}`,
    `${plural(screens, 'screen')}`,
    `${p.edges.length} times one file uses another`,
  ];
  if (leaned) bits.push(`${plural(leaned, 'file')} much of the app depends on`);
  return bits.join(' · ');
}

/** The summary paragraph, assembled only from what was counted. */
export function projectSummary(project) {
  const p = project || getProject();
  const counts = {};
  p.nodes.forEach((n) => { counts[n.layer] = (counts[n.layer] || 0) + 1; });

  const groups = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${n} for ${groupLabel(key).toLowerCase()}`);

  const externals = (p.meta.externals || []).length;

  /* Lead with what the project says it is. A count of files answers
     "how big is it", never "what does it do". */
  const areas = p.meta.areas || [];
  const out = [];

  if (p.meta.about) {
    out.push(`<strong>${p.meta.about}</strong>`);
  }
  if (areas.length) {
    out.push(`The work here is grouped around ${plural(areas.length, 'main subject')}: ` +
      list(areas.map((a) => `${a.name} (${a.files.length} files)`)) + '.');
  }
  out.push(`Across <strong>${plural(p.nodes.length, 'file')}</strong> — ${list(groups)} — ` +
    `there are <strong>${p.edges.length} places</strong> where one file needs another.`);
  if (externals) {
    out.push(`It also uses ${plural(externals, 'piece')} of software written by other companies.`);
  }
  return out.join(' ');
}

/** Riskiest file, phrased as a recommendation rather than a statistic. */
export function riskiestSentence(id) {
  const node = getNode(id);
  if (!node) return '';
  const reach = blastRadius(id).length;
  if (!reach) return `${node.name} has nothing depending on it.`;
  return `If ${node.name} changes, ${plural(reach, 'other file')} could stop working. ` +
         `Start your review here — this is the one most worth a second pair of eyes.`;
}
