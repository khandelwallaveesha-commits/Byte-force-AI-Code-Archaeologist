/* ======================================================================
   analyzer.js — turns real uploaded files into the project model.

   This is a heuristic static pass, not a compiler: it reads imports,
   exports, function declarations, route definitions and query calls with
   regular expressions. That is enough to build a real dependency graph
   from a real codebase, and every number it reports is counted from the
   files you gave it rather than assumed.

   Output matches the shape the whole UI already reads:
     { meta, stats, nodes, edges, tree, chatIntents }
   ====================================================================== */

import { CODE_EXT, SKIP_DIR, META_FILES } from './sources.js';

const RESOLVE_EXT = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py',
  '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];

/* ---------------------------------------------------------------- parsing */

const RE = {
  esImport:   /^[ \t]*import\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/gm,
  esExportFrom: /^[ \t]*export\s+(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/gm,
  require:    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  dynImport:  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  pyFrom:     /^[ \t]*from\s+([.\w]+)\s+import\s/gm,
  pyImport:   /^[ \t]*import\s+([.\w]+)\s*$/gm,

  exportNamed: /\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g,
  exportDefaultFn: /\bexport\s+default\s+(?:async\s+)?function\s+(\w+)?/g,
  exportBrace: /\bexport\s*\{([^}]*)\}/g,
  pyDef:      /^[ \t]*def\s+(\w+)/gm,

  fnDecl:     /\bfunction\s+\w+|\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\bdef\s+\w+|\bclass\s+\w+|\([^)]*\)\s*=>\s*\{/g,
  endpoint:   /\b(?:router|app|server)\s*\.\s*(get|post|put|patch|delete|use)\s*\(\s*['"`]/gi,
  pyRoute:    /@(?:app|router)\.(?:get|post|put|patch|delete)\s*\(/gi,
  sql:        /\b(?:SELECT\s+[\s\S]{0,80}?\bFROM\b|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/gi,
  orm:        /\b(?:db|knex|prisma|sequelize|mongoose|pool|client)\s*\.\s*(?:query|one|many|none|any|tx|collection|model|findMany|findUnique|execute)\b/g,
  reactish:   /from\s+['"]react['"]|\buseState\b|\buseEffect\b|<\/[A-Za-z]|\/>/,
};

/* ----------------------------------------------------------------------
   What a file DECLARES.

   Swift, Java, C#, Kotlin and Go do not import their own project's files —
   everything in the module is already visible. Building the graph only from
   import statements therefore produced ZERO links for those projects, and
   every file fell back to the same "nothing uses this" sentence. So we also
   record what each file declares, and later look for those names elsewhere.
   ---------------------------------------------------------------------- */

const DECL = {
  type: /\b(?:public|private|internal|open|final|abstract|sealed|static|export|declare)?\s*\b(?:class|struct|enum|protocol|actor|interface|record|trait|object)\s+([A-Z][\w]*)/g,
  goType: /\btype\s+([A-Z][\w]*)\s+(?:struct|interface)/g,
  fn: /\b(?:func|fun|function|def|sub)\s+([A-Za-z_]\w*)/g,
  prop: /^[ \t]*(?:@\w+\s+)*(?:public|private|internal|open|final|static)?\s*\b(?:var|let|val)\s+([a-z_]\w*)\s*[:=]/gm,
};

/* Names too common to be evidence of a link between two files. */
const AMBIGUOUS = new Set([
  'View', 'Model', 'Item', 'Data', 'Text', 'List', 'State', 'Error', 'Value',
  'Type', 'Main', 'Test', 'Base', 'Core', 'Info', 'Node', 'Task', 'User',
  'Name', 'Size', 'Color', 'Style', 'Group', 'Entry', 'Field', 'Table',
  'Result', 'Config', 'Option', 'Content', 'Context', 'Manager', 'Service',
  'Handler', 'Helper', 'Utils', 'Util', 'Common', 'Shared', 'Constants',
  'String', 'Int', 'Bool', 'Double', 'Float', 'Array', 'Set', 'Map', 'Any',
]);

/** Everything this file introduces to the rest of the project. */
function declarationsOf(text) {
  const types = [...new Set([...allOf(text, DECL.type), ...allOf(text, DECL.goType)])];
  const fns = [...new Set(allOf(text, DECL.fn))];
  const props = [...new Set(allOf(text, DECL.prop))];
  return { types, fns, props };
}

/** Every identifier mentioned anywhere in the file, for reference lookups. */
/* "addItem" -> "add item", so a declared name reads as an action. */
const words = (name) => String(name)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .toLowerCase();

const identifiersIn = (text) =>
  new Set(String(text).match(/[A-Za-z_][\w]*/g) || []);

const countOf = (text, re) => {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null) n++;
  return n;
};

const allOf = (text, re, group = 1) => {
  re.lastIndex = 0;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) if (m[group]) out.push(m[group]);
  return out;
};

/* ---------------------------------------------------------------- paths */

const dirname = (p) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
const stem = (p) => basename(p).replace(/\.[^.]+$/, '');

function normalize(path) {
  const parts = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/** Strip the shared leading directory so paths read like a project. */
function stripCommonRoot(files) {
  if (files.length < 2) return files;
  const split = files.map((f) => f.path.split('/'));
  let prefix = 0;
  while (true) {
    const seg = split[0][prefix];
    if (seg === undefined || split[0].length - prefix < 2) break;
    if (!split.every((s) => s[prefix] === seg)) break;
    prefix++;
  }
  if (!prefix) return files;
  return files.map((f) => ({ ...f, path: f.path.split('/').slice(prefix).join('/') }));
}

/* ---------------------------------------------------------------- layers */

function classify(path, text, facts) {
  const p = path.toLowerCase();

  /* A file that defines HTTP routes belongs to the API layer even when it
     also runs queries — the routes are the point, the SQL is incidental. */
  if (/(^|\/)(controllers?|routes?|api|endpoints|handlers|resolvers)(\/|$)/.test(p)
      || facts.endpoints >= 1) return 'api';

  if (/(^|\/)(db|database|models?|schemas?|entities|repositories|migrations)(\/|$)/.test(p)
      || facts.queries >= 2) return 'data';

  if (/\.(jsx|tsx|vue|svelte)$/.test(p)
      || /(^|\/)(pages?|components?|screens?|views?|ui)(\/|$)/.test(p)
      || RE.reactish.test(text)) return 'ui';

  if (/(^|\/)(services?|contexts?|stores?|hooks|state|providers|lib|utils?|helpers)(\/|$)/.test(p))
    return 'logic';

  /* Fall back to the name. Swift, C#, Java and Kotlin projects carry the
     role in the filename far more reliably than in the folder. */
  const file = p.split('/').pop().replace(/\.[^.]+$/, '');
  if (/(view|screen|page|window|panel|cell|widget|component)$/.test(file)) return 'ui';
  if (/(controller|router|route|endpoint|api|client|request)$/.test(file)) return 'api';
  if (/(model|entity|schema|record|dto|repository|dao|storage|database)$/.test(file)) return 'data';
  if (/(service|manager|store|provider|coordinator|viewmodel|state|engine|worker|helper|util|utils|factory|builder|handler|delegate)$/.test(file))
    return 'logic';

  return 'other';
}

const LANGUAGES = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', py: 'Python', java: 'Java',
  go: 'Go', rb: 'Ruby', php: 'PHP', cs: 'C#', vue: 'Vue', svelte: 'Svelte',
};

/* ---------------------------------------------------------------- layout */

const NODE_W = 132;
const NODE_H = 44;
const LAYER_ROWS = ['ui', 'logic', 'api', 'data', 'other'];
const PER_ROW = 7;

function layout(nodes) {
  let y = 40;
  for (const layer of LAYER_ROWS) {
    const group = nodes.filter((n) => n.layer === layer);
    if (!group.length) continue;

    group.sort((a, b) => b._in - a._in || a.name.localeCompare(b.name));
    group.forEach((n, i) => {
      const row = Math.floor(i / PER_ROW);
      const col = i % PER_ROW;
      const inRow = Math.min(PER_ROW, group.length - row * PER_ROW);
      const rowWidth = inRow * NODE_W + (inRow - 1) * 60;
      n.x = Math.round(620 - rowWidth / 2 + col * (NODE_W + 60));
      n.y = y + row * (NODE_H + 26);
      n.w = NODE_W;
      n.h = NODE_H;
    });

    y += Math.ceil(group.length / PER_ROW) * (NODE_H + 26) + 74;
  }
}

/* ---------------------------------------------------------------- tree */

function buildTree(paths) {
  const root = [];
  const dirs = new Map([['', root]]);

  const ensureDir = (dir) => {
    if (dirs.has(dir)) return dirs.get(dir);
    const parent = ensureDir(dirname(dir));
    const node = { type: 'dir', name: basename(dir), open: true, children: [] };
    parent.push(node);
    dirs.set(dir, node.children);
    return node.children;
  };

  [...paths].sort().forEach(({ path, id }) => {
    ensureDir(dirname(path)).push({ type: 'file', name: basename(path), node: id });
  });
  return root;
}

/* ---------------------------------------------------------------- prose */

function describe(node, deps, used, externals) {
  const d = node._decl || { types: [], fns: [], props: [] };
  const list = (a, n = 3) =>
    a.slice(0, n).join(', ') + (a.length > n ? ` and ${a.length - n} more` : '');

  /* ---- what it does: lead with what the file actually declares ---- */
  let purpose;
  if (d.types.length) {
    const kind = d.types.length === 1 ? `"${d.types[0]}"` : list(d.types);
    purpose = `Sets up ${kind}`;
    if (d.props.length) purpose += `, which holds ${list(d.props, 4)}`;
    else if (d.fns.length) purpose += `, which can ${list(d.fns.map(words), 3)}`;
    purpose += '.';
  } else if (node._endpoints) {
    purpose = `Answers ${node._endpoints} request${node._endpoints === 1 ? '' : 's'} coming from the app.`;
  } else if (node._queries) {
    purpose = 'Looks up and saves information the app keeps.';
  } else if (d.fns.length) {
    purpose = `Provides ${d.fns.length} thing${d.fns.length === 1 ? '' : 's'} other code can run: ${list(d.fns, 4)}.`;
  } else if (node.layer === 'ui') {
    purpose = 'Draws part of what people see on screen.';
  } else {
    purpose = `${node._lines} lines, with nothing other files can call directly.`;
  }

  /* ---- the fuller description ---- */
  const parts = [];

  if (d.types.length || d.fns.length) {
    const bits = [];
    if (d.types.length) bits.push(`${d.types.length} main thing${d.types.length === 1 ? '' : 's'} (${list(d.types)})`);
    if (d.fns.length) bits.push(`${d.fns.length} step${d.fns.length === 1 ? '' : 's'} it can carry out`);
    parts.push(`${node.name} defines ${bits.join(' and ')}.`);
  } else {
    parts.push(`${node.name} is ${node._lines} lines long and defines nothing other files can call by name.`);
  }

  parts.push(used.length
    ? `${used.length} other file${used.length === 1 ? '' : 's'} mention${used.length === 1 ? 's' : ''} it: ${list(used, 4)}. ` +
      `${used.length === 1 ? 'That file' : 'Those files'} would be affected if it changed.`
    : 'No other file in this project refers to it by name, so it is either a starting point or unused.');

  if (deps.length) {
    parts.push(`It in turn uses ${list(deps, 4)}.`);
  }

  if (externals.length) {
    parts.push(`It also builds on ready-made code from elsewhere: ${list(externals, 3)}.`);
  }

  return { purpose, explanation: parts.join(' ') };
}

/* ----------------------------------------------------------------------
   What the project IS, rather than how big it is.
   ---------------------------------------------------------------------- */

/** The first real sentence of a README, with the badges and headings stripped. */
function readmeSummary(text) {
  const lines = String(text || '').split('\n');
  const clean = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue;                       // heading
    if (/^[[!<]/.test(line)) continue;                          // badge / image / html
    if (/^[-*=_]{3,}$/.test(line)) continue;                    // rule
    if (/^(\||```|>)/.test(line)) continue;                     // table, code, quote
    line = line
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')                // links and images
      .replace(/[*_`]/g, '')
      .trim();
    if (line.length < 25) continue;                             // fragments, not prose
    clean.push(line);
    if (clean.join(' ').length > 320) break;
  }
  return clean.join(' ').slice(0, 340) || null;
}

/** Name and one-line description out of a manifest, whatever the language. */
function manifestInfo(path, text) {
  try {
    if (/package\.json$|composer\.json$/i.test(path)) {
      const j = JSON.parse(text);
      return { name: j.name, about: j.description, deps: Object.keys(j.dependencies || {}) };
    }
  } catch (e) { /* malformed manifest — ignore it rather than fail the analysis */ }

  const grab = (re) => (String(text).match(re) || [])[1];
  return {
    name: grab(/^\s*name\s*[:=]\s*["']?([\w.-]+)/im)
       || grab(/<CFBundleName>\s*<string>([^<]+)/i),
    about: grab(/^\s*description\s*[:=]\s*["']([^"']{10,200})/im),
    deps: [],
  };
}

/* Suffixes that describe a file's ROLE, not the feature it belongs to. */
const ROLE_SUFFIX = /(View|ViewModel|ViewController|Screen|Page|Service|Manager|Controller|Store|Repository|Provider|Client|Handler|Helper|Delegate|Coordinator|Factory|Builder|Model|Models|Utils?|Config|Context|Hook|Reducer|Slice|Adapter|Mapper|Dto|Entity|Test|Tests|Spec)$/;

/**
 * Group files by the subject their names keep returning to.
 * TranscriptionView + TranscriptionService + TranscriptionModel all point at
 * one thing the app does — which is far more useful than "135 ui files".
 */
function featureAreas(nodes, limit = 6) {
  const tally = new Map();

  nodes.forEach((n) => {
    let stem = n.name;
    for (let i = 0; i < 3; i++) stem = stem.replace(ROLE_SUFFIX, '');   // e.g. FooViewModel
    stem = stem.replace(/^(A|The)(?=[A-Z])/, '');
    if (stem.length < 4) return;
    if (/^(index|main|app|utils?|helpers?|common|shared|base|core|types?|constants?)$/i.test(stem)) return;
    const key = stem;
    const entry = tally.get(key) || { name: key, files: [] };
    entry.files.push(n.name);
    tally.set(key, entry);
  });

  return [...tally.values()]
    .filter((a) => a.files.length > 1)          // one file is not a "feature area"
    .sort((a, b) => b.files.length - a.files.length)
    .slice(0, limit);
}

/* ----------------------------------------------------------------------
   Working out the subject WITHOUT a README.

   A README is the best source, but plenty of projects have none. The code
   still says a great deal about itself: the nouns it declares, the verbs it
   can perform, the text it shows people, and the outside tools it leans on.
   ---------------------------------------------------------------------- */

/* Prefixes that mean a function name is describing an action. */
const VERBS = /^(get|set|load|save|store|start|stop|pause|resume|create|make|build|add|remove|delete|update|edit|send|post|fetch|request|play|record|copy|paste|cut|export|import|download|upload|sync|refresh|reload|toggle|show|hide|open|close|select|choose|search|find|filter|sort|check|verify|validate|parse|format|convert|render|draw|print|connect|disconnect|login|logout|signin|signout|register|enable|disable|install|uninstall|apply|reset|clear|handle|process|run|execute|generate|calculate|compute)(?=[A-Z_]|$)/;

/** What the app can actually DO, read off its function names. */
function actionVerbs(nodes, limit = 8) {
  const seen = new Map();
  nodes.forEach((n) => {
    ((n._decl && n._decl.fns) || []).forEach((fn) => {
      if (!VERBS.test(fn) || fn.length < 5) return;
      const phrase = words(fn);
      if (!seen.has(phrase)) seen.set(phrase, 0);
      seen.set(phrase, seen.get(phrase) + 1);
    });
  });
  return [...seen.keys()].slice(0, limit);
}

/** Text the app puts in front of a person — its own words about itself. */
function humanStrings(nodes, limit = 6) {
  const out = [];
  const seen = new Set();

  nodes.forEach((n) => {
    const matches = String(n.code || '').match(/["']([^"'\n\\]{6,60})["']/g) || [];
    matches.forEach((raw) => {
      const t = raw.slice(1, -1).trim();
      if (seen.has(t.toLowerCase())) return;
      if (!/\s/.test(t)) return;                       // one word: probably a key
      if (!/^[A-Z]/.test(t)) return;                   // real UI text starts capitalised
      if (/[<>{}\\/=_]|https?:|\.\w{2,4}$|%@|\$\{/.test(t)) return;   // code, paths, formats
      if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i.test(t)) return;  // SQL
      seen.add(t.toLowerCase());
      out.push(t);
    });
  });
  return out.slice(0, limit);
}

/** Well-known packages that give away what KIND of thing this is. */
const TELLS = [
  [/^(react|next|vue|svelte|angular|solid)$/i, 'a web app'],
  [/^(react-native|expo|flutter)$/i, 'a mobile app'],
  [/^(swiftui|uikit|appkit|cocoa)$/i, 'an Apple app'],
  [/^(express|fastify|koa|nest|flask|django|fastapi|rails|gin|actix)$/i, 'a web server'],
  [/^(electron|tauri)$/i, 'a desktop app'],
  [/^(pytorch|torch|tensorflow|transformers|whisper|openai|anthropic|langchain)$/i, 'something built on machine-learning models'],
  [/^(three|babylon|phaser|unity)$/i, 'something with 3D or game graphics'],
  [/^(pandas|numpy|scipy|matplotlib)$/i, 'data analysis'],
];

function kindFromPackages(externals, nodes) {
  const all = [...externals];
  /* Swift and friends "import SwiftUI" rather than declaring a package. */
  nodes.forEach((n) => {
    (String(n.code || '').match(/^\s*import\s+(\w+)/gm) || [])
      .forEach((m) => all.push(m.replace(/^\s*import\s+/, '')));
  });

  const hits = [];
  TELLS.forEach(([re, label]) => {
    if (all.some((p) => re.test(p)) && !hits.includes(label)) hits.push(label);
  });
  return hits;
}

/* ---------------------------------------------------------------- main */

/**
 * @param {{path: string, content: string}[]} input
 * @param {{name?: string}} options
 * @returns {object} project model
 */
export function analyzeProject(input, options = {}) {
  const usable = input.filter((f) => !SKIP_DIR.test(f.path));
  const files = stripCommonRoot(usable.filter((f) => CODE_EXT.test(f.path)));

  /* README and manifests are not part of the graph, but they are the only
     places a project says in words what it is for. */
  const docs = usable.filter((f) => META_FILES.test(f.path) && !CODE_EXT.test(f.path));
  const readme = docs.find((f) => /readme/i.test(f.path));
  const manifest = docs.find((f) => !/readme/i.test(f.path));
  const about = readme ? readmeSummary(readme.content) : null;
  const mani = manifest ? manifestInfo(manifest.path, manifest.content) : {};

  if (!files.length) {
    throw new Error('No source files found. Supported: .js .jsx .ts .tsx .py .java .go .rb .php .cs .vue .svelte');
  }

  /* ---- pass 1: read every file ---- */
  const byPath = new Map();
  const nodes = files.map((f, i) => {
    const text = f.content || '';
    const specs = [
      ...allOf(text, RE.esImport), ...allOf(text, RE.esExportFrom),
      ...allOf(text, RE.require), ...allOf(text, RE.dynImport),
      ...allOf(text, RE.pyFrom), ...allOf(text, RE.pyImport),
    ];

    const exports = [
      ...allOf(text, RE.exportNamed),
      ...allOf(text, RE.exportDefaultFn),
      ...allOf(text, RE.pyDef),
      ...allOf(text, RE.exportBrace).flatMap((g) =>
        g.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)),
    ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

    const facts = {
      endpoints: countOf(text, RE.endpoint) + countOf(text, RE.pyRoute),
      queries: countOf(text, RE.sql) + countOf(text, RE.orm),
    };

    const node = {
      id: `n${i}`,
      name: stem(f.path),
      path: f.path,
      layer: classify(f.path, text, facts),
      line: 1,
      fns: countOf(text, RE.fnDecl),
      code: text.split('\n').slice(0, 400).join('\n'),
      hot: [],
      _lines: text.split('\n').length,
      _specs: specs,
      _exports: exports,
      _endpoints: facts.endpoints,
      _queries: facts.queries,
      _in: 0,
      _decl: declarationsOf(text),
      _ids: identifiersIn(text),
    };

    /* highlight the import block — the part that made the edges */
    node.hot = text.split('\n').slice(0, 400)
      .map((l, n) => (/^\s*(import|from|const .*require\()/.test(l) ? n + 1 : 0))
      .filter(Boolean).slice(0, 8);

    byPath.set(f.path, node);
    return node;
  });

  /* ---- pass 2: resolve imports into edges ---- */
  const pathList = files.map((f) => f.path);
  const externals = new Set();
  const externalsByNode = new Map();
  const edges = [];
  const seenEdge = new Set();

  const resolve = (fromPath, spec) => {
    if (spec.startsWith('.')) {
      const base = normalize(`${dirname(fromPath)}/${spec}`);
      for (const ext of RESOLVE_EXT) if (byPath.has(base + ext)) return byPath.get(base + ext);
      return null;
    }
    /* aliased or root-relative import: match by path suffix */
    if (spec.includes('/')) {
      const clean = spec.replace(/^[@~]\//, '');
      for (const ext of RESOLVE_EXT) {
        const hit = pathList.find((p) => p === clean + ext || p.endsWith(`/${clean}${ext}`));
        if (hit) return byPath.get(hit);
      }
    }
    return null;
  };

  nodes.forEach((node) => {
    const ext = [];
    node._specs.forEach((spec) => {
      const target = resolve(node.path, spec);
      if (!target) {
        const pkg = spec.split('/')[0].replace(/^@[^/]+$/, spec.split('/').slice(0, 2).join('/'));
        if (!spec.startsWith('.')) { externals.add(pkg); ext.push(pkg); }
        return;
      }
      if (target.id === node.id) return;
      const key = `${node.id}>${target.id}`;
      if (seenEdge.has(key)) return;
      seenEdge.add(key);
      edges.push({ from: node.id, to: target.id });
      target._in += 1;
    });
    externalsByNode.set(node.id, [...new Set(ext)]);
  });

  /* ---- pass 2b: links from symbol references ----
     For languages with no local imports this is the ONLY source of edges.
     For JavaScript it is a safety net for aliased or re-exported names. */
  const owner = new Map();
  nodes.forEach((n) => {
    n._decl.types.forEach((t) => {
      if (t.length < 4 || AMBIGUOUS.has(t)) return;
      if (!owner.has(t)) owner.set(t, n.id);          // first declaration wins
      else owner.set(t, null);                         // declared twice: ambiguous
    });
  });

  nodes.forEach((n) => {
    const declaredHere = new Set(n._decl.types);
    owner.forEach((ownerId, symbol) => {
      if (!ownerId || ownerId === n.id) return;
      if (declaredHere.has(symbol)) return;
      if (!n._ids.has(symbol)) return;
      const key = `${n.id}>${ownerId}`;
      if (seenEdge.has(key)) return;
      seenEdge.add(key);
      edges.push({ from: n.id, to: ownerId, via: 'reference' });
      const target = nodes.find((x) => x.id === ownerId);
      if (target) target._in += 1;
    });
  });

  /* ---- pass 3: importance, layout, prose ---- */
  const outDeg = (id) => edges.filter((e) => e.from === id).length;

  nodes.forEach((n) => {
    const inDeg = n._in;
    if (inDeg >= 3 || (inDeg >= 2 && (n.layer === 'data' || n.layer === 'api'))) n.importance = 'HIGH';
    else if (inDeg >= 1 || outDeg(n.id) >= 3) n.importance = 'MEDIUM';
    else n.importance = 'LOW';
  });

  layout(nodes);

  const nameOf = (id) => nodes.find((n) => n.id === id)?.name || id;
  nodes.forEach((n) => {
    const deps = edges.filter((e) => e.from === n.id).map((e) => nameOf(e.to));
    const used = edges.filter((e) => e.to === n.id).map((e) => nameOf(e.from));
    Object.assign(n, describe(n, deps, used, externalsByNode.get(n.id) || []));
  });

  /* ---- project-level numbers, all counted ---- */
  const totalLines = nodes.reduce((a, n) => a + n._lines, 0);
  const extCounts = {};
  files.forEach((f) => {
    const e = (f.path.match(/\.(\w+)$/) || [, ''])[1].toLowerCase();
    extCounts[e] = (extCounts[e] || 0) + 1;
  });
  const topExt = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const stats = [
    { key: 'files',      label: 'Files',            value: nodes.length },
    { key: 'components', label: 'Components',       value: nodes.filter((n) => n.layer === 'ui').length },
    { key: 'functions',  label: 'Functions',        value: nodes.reduce((a, n) => a + n.fns, 0) },
    { key: 'endpoints',  label: 'API Endpoints',    value: nodes.reduce((a, n) => a + n._endpoints, 0) },
    { key: 'deps',       label: 'Dependencies',     value: edges.length },
    { key: 'critical',   label: 'Critical Modules', value: nodes.filter((n) => n.importance === 'HIGH').length },
  ];

  const project = {
    meta: {
      about: about || mani.about || null,
      aboutSource: about ? (readme.path.split('/').pop()) : (mani.about ? manifest.path.split('/').pop() : null),
      areas: featureAreas(nodes),
      name: mani.name || options.name || 'your project',
      language: LANGUAGES[topExt] || 'Mixed',
      analyzedAt: 'just now',
      loc: totalLines,
      externals: [...externals],
      generated: true,
    },
    stats,
    nodes,
    edges,
    tree: buildTree(nodes.map((n) => ({ path: n.path, id: n.id }))),
    chatIntents: buildIntents(nodes, edges, externals, { about, aboutSource: about ? readme.path.split('/').pop() : null }),
    chatSuggestions: buildSuggestions(nodes),
  };

  return project;
}

/* ---------------------------------------------------------------- chat */

function buildIntents(nodes, edges, externals, meta = {}) {
  const deg = (id) =>
    edges.filter((e) => e.from === id).length + edges.filter((e) => e.to === id).length;
  const ranked = [...nodes].sort((a, b) => deg(b.id) - deg(a.id));
  const top = ranked[0];
  const dataNodes = nodes.filter((n) => n.layer === 'data');
  const critical = nodes.filter((n) => n.importance === 'HIGH');
  const orphans = nodes.filter((n) => n._in === 0 && n.layer !== 'ui');

  const layerCounts = {};
  nodes.forEach((n) => { layerCounts[n.layer] = (layerCounts[n.layer] || 0) + 1; });

  const areas = featureAreas(nodes, 6);
  const screens = nodes.filter((n) => n.layer === 'ui').length;
  const stores = nodes.filter((n) => n.layer === 'data').length;
  const talks = nodes.filter((n) => n.layer === 'api').length;

  const describe = () => {
    const out = [];
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

    /* A README is the best source, but it is only one source. */
    if (meta.about) out.push(`${meta.about}

_(from its ${meta.aboutSource})_`);

    /* One or two files is not a "project" — describe what is actually there. */
    if (nodes.length <= 2) {
      nodes.forEach((n) => {
        const d = n._decl || {};
        const bits = [];
        if ((d.types || []).length) bits.push(`sets up ${d.types.join(', ')}`);
        if ((d.fns || []).length) bits.push(`can ${d.fns.slice(0, 6).map(words).join(', ')}`);
        out.push(`**${n.name}** — ${bits.length ? bits.join(', and ') : `${n._lines} lines`}.`);
      });
      out.push(`That is everything I was given. Add the rest of the project and I can ` +
               `show you how these fit with it.`);
      return out.join('\n\n');
    }

    if (!meta.about) {
      /* Read the project's subject off the code instead. */
      const kinds = kindFromPackages(externals, nodes);
      const nouns = areas.length
        ? areas.map((a) => a.name)
        : [...new Set(nodes.flatMap((n) => (n._decl && n._decl.types) || []))].slice(0, 6);
      const verbs = actionVerbs(nodes);
      const said = humanStrings(nodes);

      const guess = [];
      if (kinds.length) guess.push(`Judging from what it is built with, this is ${kinds.join(' and ')}.`);
      if (nouns.length) guess.push(`It works with ${nouns.slice(0, 5).join(', ')}.`);
      if (verbs.length) guess.push(`Things it can do include: ${verbs.slice(0, 6).join(', ')}.`);
      if (said.length) guess.push(`Text it shows people includes ${said.slice(0, 3).map((t) => `"${t}"`).join(', ')}.`);

      if (guess.length) {
        out.push(`There is no README here, so this is read from the code itself.`);
        out.push(guess.join(' '));
      }
    }

    if (areas.length) {
      out.push(
        `The work is grouped around ${plural(areas.length, 'main subject')}: ` +
        areas.map((a) => `**${a.name}** (${plural(a.files.length, 'file')})`).join(', ') + '.'
      );
    }

    const shape = [];
    const one = (n) => n === 1;
    if (screens) shape.push(`${plural(screens, 'file')} draw${one(screens) ? 's' : ''} screens`);
    if (talks) shape.push(`${plural(talks, 'file')} send${one(talks) ? 's' : ''} and fetch${one(talks) ? 'es' : ''} information`);
    if (stores) shape.push(`${plural(stores, 'file')} look${one(stores) ? 's' : ''} after saved information`);
    if (shape.length) out.push(`Of ${plural(nodes.length, 'file')} in total, ${shape.join(', ')}.`);

    if (!out.length) {
      out.push(
        `These ${plural(nodes.length, 'file')} do not declare enough for me to work out a ` +
        `subject — no README, no repeated names, and little that looks like screens or ` +
        `saved information. Ask me about any single file by name and I can still tell you ` +
        `exactly what it does and what depends on it.`
      );
    }
    return out.join('\n\n');
  };

  return [
    {
      match: ['what does this project do', 'what is this project', 'overview', 'summary', 'about'],
      answer: describe(),
    },
    {
      match: ['which component is most important', 'most important', 'most connected', 'critical'],
      answer:
        `**${top.name}** is the most connected file — ${deg(top.id)} import links in and out.\n\n` +
        (critical.length
          ? `${critical.length} file${critical.length === 1 ? ' is' : 's are'} marked critical: ` +
            `${critical.slice(0, 6).map((n) => n.name).join(', ')}${critical.length > 6 ? ' and more' : ''}.`
          : 'Nothing crosses the threshold for critical — the project is loosely coupled.'),
      focus: top.id,
    },
    {
      match: ['where is the database connected', 'database connected', 'db connection', 'which tables'],
      answer: dataNodes.length
        ? `${dataNodes.length} file${dataNodes.length === 1 ? '' : 's'} look like the data layer: ` +
          `${dataNodes.map((n) => n.name).join(', ')}.\n\nThey were classified there because they run SQL or ORM calls, or live in a db/models directory.`
        : 'I did not find database access in these files — no SQL or ORM calls, and no db/models directory.',
      focus: dataNodes[0]?.id,
    },
    {
      match: ['is there dead code', 'unused', 'dead code', 'orphan'],
      answer: orphans.length
        ? `${orphans.length} file${orphans.length === 1 ? '' : 's'} are imported by nothing else here: ` +
          `${orphans.slice(0, 8).map((n) => n.name).join(', ')}${orphans.length > 8 ? ' and more' : ''}.\n\n` +
          'They may be entry points, test fixtures, or genuinely dead — worth a look.'
        : 'Every file is imported by at least one other. No obvious orphans.',
    },
  ];
}

function buildSuggestions(nodes) {
  const ranked = [...nodes].sort((a, b) => b._in - a._in);
  const top = ranked[0], second = ranked[1];
  return [
    'What does this project do?',
    'Which component is most important?',
    top ? `What does ${top.name} do?` : 'Is there dead code?',
    second ? `What breaks if I change ${second.name}?` : 'Where is the database connected?',
  ];
}
