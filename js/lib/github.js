/* ======================================================================
   github.js — pull a project straight from a link.

   Both endpoints this needs send `Access-Control-Allow-Origin: *`, so the
   browser can read a public repository on its own — no backend, no proxy,
   no token. Two calls to api.github.com list the files; the contents come
   from raw.githubusercontent.com, which is a CDN rather than the rate-
   limited API.

   Only public repositories work. A private one is indistinguishable from
   a missing one over this route, and the message says so rather than
   guessing.
   ====================================================================== */

import { CODE_EXT, SKIP_DIR, META_FILES, MAX_FILE, MAX_FILES } from './sources.js';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const POOL = 8;          // parallel file fetches — polite, and plenty fast

/**
 * Understand the shapes of link people actually paste.
 * @returns {{owner,repo,branch,subdir,file}|{direct:string}|null}
 */
export function parseLink(input) {
  const raw = String(input || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  if (!raw) return null;

  /* owner/repo typed on its own */
  const bare = raw.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (bare) return { owner: bare[1], repo: bare[2], branch: null, subdir: '', file: null };

  let u;
  try { u = new URL(raw.startsWith('http') ? raw : `https://${raw}`); } catch (e) { return null; }

  /* `new URL` happily turns a sentence into a hostname, so plain prose came
     back looking like a fetchable address. A real host has a dot and no spaces. */
  if (!/^[\w.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;

  const parts = u.pathname.split('/').filter(Boolean);

  if (/(^|\.)github\.com$/.test(u.hostname)) {
    if (parts.length < 2) return null;
    const [owner, repo, kind, branch, ...rest] = parts;
    if (kind === 'blob') return { owner, repo, branch, subdir: '', file: rest.join('/') };
    if (kind === 'tree') return { owner, repo, branch, subdir: rest.join('/'), file: null };
    return { owner, repo, branch: null, subdir: '', file: null };
  }

  if (/(^|\.)raw\.githubusercontent\.com$/.test(u.hostname)) {
    const [owner, repo, branch, ...rest] = parts;
    if (!owner || !repo) return null;
    return { owner, repo, branch, subdir: '', file: rest.join('/') };
  }

  /* Anything else: try it as a plain file. Most hosts refuse cross-origin
     reads, so this often fails — the caller says why. */
  return { direct: u.href };
}

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });

  if (res.status === 404) {
    throw new Error('Not found. Check the spelling — and note that private repositories cannot be read this way.');
  }
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
    const mins = reset ? Math.max(1, Math.round((reset - Date.now()) / 60000)) : null;
    throw new Error(
      'GitHub is rate-limiting this network (60 requests an hour without signing in)' +
      (mins ? `. Try again in about ${mins} minute${mins === 1 ? '' : 's'}` : '') +
      ', or download the repo and drop the folder in instead.'
    );
  }
  if (!res.ok) throw new Error(`GitHub replied ${res.status}.`);
  return res.json();
}

/** Run jobs a few at a time so a big repo does not open 300 sockets at once. */
async function pooled(items, size, worker, onEach) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      const r = await worker(items[idx]);
      if (r) out.push(r);
      if (onEach) onEach(out.length, items.length);
    }
  }));
  return out;
}

/**
 * @param {string} link
 * @param {{onProgress?: (done:number,total:number,stage:string)=>void}} opts
 * @returns {Promise<{files: {path,content,size}[], meta: object, report: object}>}
 */
export async function fetchFromLink(link, opts = {}) {
  const say = opts.onProgress || (() => {});
  const target = parseLink(link);
  if (!target) throw new Error('That does not look like a link I can read. Try a GitHub repository URL.');

  /* ---- a single file on some other host ---- */
  if (target.direct) {
    say(0, 1, 'Fetching the file');
    let res;
    try {
      res = await fetch(target.direct);
    } catch (e) {
      throw new Error(
        'That site will not let a web page read its files (a browser security rule called CORS). ' +
        'GitHub links work; for anything else, download the file and drop it in.'
      );
    }
    if (!res.ok) throw new Error(`That link replied ${res.status}.`);
    const content = await res.text();
    const path = target.direct.split('/').pop() || 'file.txt';
    if (!CODE_EXT.test(path)) throw new Error(`"${path}" is not a source file I can analyse.`);
    return {
      files: [{ path, content, size: content.length }],
      meta: { name: path, source: target.direct },
      report: { total: 1, notSource: 0, tooBig: 0, truncated: false, skippedBig: [] },
    };
  }

  const { owner, repo, subdir, file } = target;
  let branch = target.branch;

  /* ---- one named file inside a repo ---- */
  if (file) {
    say(0, 1, 'Fetching the file');
    if (!branch) branch = (await api(`/repos/${owner}/${repo}`)).default_branch;
    const res = await fetch(`${RAW}/${owner}/${repo}/${branch}/${file}`);
    if (!res.ok) throw new Error(`Could not read ${file} (${res.status}).`);
    const content = await res.text();
    return {
      files: [{ path: file, content, size: content.length }],
      meta: { name: file.split('/').pop(), source: link, branch },
      report: { total: 1, notSource: 0, tooBig: 0, truncated: false, skippedBig: [] },
    };
  }

  /* ---- a whole repository ---- */
  say(0, 0, 'Looking up the repository');
  if (!branch) branch = (await api(`/repos/${owner}/${repo}`)).default_branch;

  say(0, 0, 'Listing the files');
  const tree = await api(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const blobs = (tree.tree || []).filter((n) => n.type === 'blob');

  const inScope = subdir ? blobs.filter((n) => n.path.startsWith(`${subdir}/`)) : blobs;

  const report = { total: inScope.length, notSource: 0, tooBig: 0, truncated: Boolean(tree.truncated), skippedBig: [] };
  const wanted = [];
  for (const n of inScope) {
    if (SKIP_DIR.test(n.path)) { report.notSource++; continue; }
    if (!CODE_EXT.test(n.path) && !META_FILES.test(n.path)) { report.notSource++; continue; }
    if (n.size > MAX_FILE) { report.tooBig++; report.skippedBig.push(n.path); continue; }
    wanted.push(n);
  }

  if (!wanted.length) {
    throw new Error(
      `I read the file list for ${owner}/${repo}, but found no source code I can analyse` +
      `${subdir ? ` under "${subdir}"` : ''}. It may be documentation, data, or a language I do not read yet.`
    );
  }

  const capped = wanted.slice(0, MAX_FILES);
  report.capped = wanted.length - capped.length;

  const files = await pooled(
    capped,
    POOL,
    async (n) => {
      try {
        const res = await fetch(`${RAW}/${owner}/${repo}/${branch}/${n.path.split('/').map(encodeURIComponent).join('/')}`);
        if (!res.ok) return null;
        return { path: n.path, content: await res.text(), size: n.size };
      } catch (e) {
        return null;                                  // one bad file must not sink the repo
      }
    },
    (done, total) => say(done, total, 'Reading files')
  );

  report.unreadable = capped.length - files.length;

  return {
    files,
    meta: { name: repo, owner, branch, source: `https://github.com/${owner}/${repo}` },
    report,
  };
}
