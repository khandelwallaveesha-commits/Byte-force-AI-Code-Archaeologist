/* CodeInput.js — §12 page 2.

   One decision, not a control panel. Whatever you hand over is really read:
   files are decoded, ZIPs are inflated in the browser, folders are walked,
   and the result goes through the analyzer to build a genuine project model. */

import { icons } from '../lib/icons.js';
import { qs, qsa, esc, on, sleep, prefersReduced } from '../lib/dom.js';
import { toast } from '../lib/toast.js';
import { initReveal } from '../lib/reveal.js';
import { sampleProject, setProject, useSample } from '../data/project.js';
import { analyzeProject } from '../lib/analyzer.js';
import { readZip, canUnzip } from '../lib/zip.js';
import { setState } from '../store.js';
import { fetchFromLink } from '../lib/github.js';
import {
  CODE_EXT, SKIP_DIR as SKIP, META_FILES, MAX_FILE, MAX_FILES, ACCEPT_ATTR,
} from '../lib/sources.js';

/* §16 — the AI processing pipeline, surfaced as visible progress. */
const PIPELINE = [
  'Reading files',
  'Language detection',
  'Code parsing',
  'Function & component detection',
  'Dependency detection',
  'Relationship mapping',
  'Logical module grouping',
  'Impact analysis',
];

const fmtSize = (bytes) =>
  bytes < 1024 ? `${bytes} B`
  : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB`
  : `${(bytes / 1048576).toFixed(1)} MB`;

export function CodeInput() {
  return `
  <div class="page input-page">
    <div class="wrap narrow">
      <div class="input-head center" data-reveal>
        <h1>What should I analyze?</h1>
        <p class="dim" style="max-width:48ch; margin:.7rem auto 0">
          Pick one. Files are read and parsed in your browser — nothing is uploaded anywhere.
        </p>
      </div>

      <div class="choices" data-reveal="80">
        <button class="choice recommended" data-choice="sample">
          <span class="choice-icon">${icons.play(20)}</span>
          <span class="choice-title">Use the sample project</span>
          <span class="choice-sub">${esc(sampleProject.meta.name)} — ready to go</span>
          <span class="badge badge-accent choice-flag">Fastest</span>
        </button>

        <button class="choice" data-choice="upload">
          <span class="choice-icon">${icons.upload(20)}</span>
          <span class="choice-title">Upload your code</span>
          <span class="choice-sub">Files, a folder, or a ZIP</span>
        </button>

        <button class="choice" data-choice="link">
          <span class="choice-icon">${icons.git(20)}</span>
          <span class="choice-title">From a link</span>
          <span class="choice-sub">Paste a public GitHub URL</span>
        </button>

        <button class="choice" data-choice="paste">
          <span class="choice-icon">${icons.code(20)}</span>
          <span class="choice-title">Paste code</span>
          <span class="choice-sub">A single file is enough</span>
        </button>
      </div>

      <div class="choice-panel" id="panel-upload" hidden>
        <div class="drop" id="drop" tabindex="0" role="button"
             aria-label="Upload files — click to browse, or drop files here">
          <span class="drop-icon">${icons.upload(26)}</span>
          <h3>Drop files, a folder, or a .zip here</h3>
          <p>or click to browse</p>
          <input type="file" id="file-input" multiple hidden
                 accept="${ACCEPT_ATTR}">
          <input type="file" id="dir-input" webkitdirectory directory multiple hidden>
        </div>
        <div class="row" style="justify-content:center; margin-top:.6rem">
          <button class="btn btn-sm btn-ghost" id="pick-folder">${icons.folder(14)} Choose a folder instead</button>
        </div>
        <div class="file-list" id="file-list"></div>
        <p class="skip-report" id="skip-report" hidden></p>
      </div>

      <div class="choice-panel" id="panel-link" hidden>
        <div class="link-row">
          <input class="input" id="link-url" type="url" spellcheck="false"
                 placeholder="https://github.com/user/repo"
                 aria-label="Public GitHub repository or file URL">
          <button class="btn btn-primary" id="link-go">${icons.arrow(15)} Fetch</button>
        </div>
        <p class="faint" style="font-size:.78rem; margin-top:.5rem">
          Works with a repository, a folder inside one, or a single file —
          <span class="mono">github.com/user/repo</span>,
          <span class="mono">…/tree/main/src</span>,
          <span class="mono">…/blob/main/app.js</span>. Public repositories only.
        </p>
        <p class="link-status" id="link-status" hidden></p>
      </div>

      <div class="choice-panel" id="panel-paste" hidden>
        <div class="editor-shell">
          <div class="editor-bar">
            ${icons.code(15)}
            <span style="font-size:.82rem; font-weight:500">Paste code</span>
            <span class="faint" style="font-size:.76rem; margin-left:auto">Language detected automatically</span>
          </div>
          <div class="editor-wrap">
            <div class="editor-gutter" id="gutter">1</div>
            <textarea class="editor-area" id="code" spellcheck="false"
                      aria-label="Source code"
                      placeholder="// Paste one or more files here."></textarea>
          </div>
        </div>
      </div>

      <div class="analyze-row" id="analyze-row" hidden>
        <p class="faint" style="font-size:.82rem" id="input-summary"></p>
        <button class="btn btn-primary btn-lg" id="analyze">
          ${icons.scan(17)} Analyze codebase
        </button>
      </div>

      <p class="input-error" id="input-error" hidden></p>

      <p class="center faint" style="font-size:.78rem; margin-top:2.5rem">
        Reads JavaScript, TypeScript, Python, Java, Kotlin, Go, Ruby, PHP, C#, Swift,
        Dart, Rust, C/C++, Scala, SQL, shell, Vue, Svelte and more. Anything left out
        is listed above rather than dropped quietly.
      </p>
    </div>
  </div>`;
}

export function mountCodeInput(root, navigate) {
  initReveal(root);

  const panels    = {
    upload: qs('#panel-upload', root),
    link:   qs('#panel-link', root),
    paste:  qs('#panel-paste', root),
  };
  const analyzeRow= qs('#analyze-row', root);
  const analyze   = qs('#analyze', root);
  const summary   = qs('#input-summary', root);
  const errorBox  = qs('#input-error', root);
  const drop      = qs('#drop', root);
  const fileIn    = qs('#file-input', root);
  const dirIn     = qs('#dir-input', root);
  const list      = qs('#file-list', root);
  const code      = qs('#code', root);
  const gutter    = qs('#gutter', root);

  /** Real content, not just names: { path, content, size } */
  let loaded = [];

  /* Every reason a file did not make it in. Silent skipping was the bug. */
  let skipped = { notSource: [], tooBig: [], unreadable: [], capped: 0, ignoredDirs: new Set() };
  const resetSkips = () => {
    skipped = { notSource: [], tooBig: [], unreadable: [], capped: 0, ignoredDirs: new Set() };
  };

  const showError = (msg) => {
    errorBox.hidden = !msg;
    errorBox.textContent = msg || '';
  };

  const refresh = () => {
    const ready = loaded.length > 0 || code.value.trim().length > 0;
    analyzeRow.hidden = !ready;
    if (!ready) return;
    const bits = [];
    if (loaded.length) bits.push(`${loaded.length} file${loaded.length === 1 ? '' : 's'}`);
    if (code.value.trim()) bits.push(`${code.value.split('\n').length} pasted lines`);
    summary.textContent = `Ready: ${bits.join(' + ')}`;
  };

  /* ---------- ingest ---------- */

  const addEntries = (entries) => {
    const fresh = [];
    entries.forEach((e) => {
      if (SKIP.test(e.path)) {
        const dir = (e.path.match(SKIP) || [])[2];
        if (dir) skipped.ignoredDirs.add(dir);
        return;
      }
      if (!CODE_EXT.test(e.path) && !META_FILES.test(e.path)) { skipped.notSource.push(e.path); return; }
      fresh.push(e);
    });

    const seen = new Set(loaded.map((f) => f.path));
    const incoming = fresh.filter((f) => !seen.has(f.path));
    const room = Math.max(0, MAX_FILES - loaded.length);
    if (incoming.length > room) skipped.capped += incoming.length - room;
    loaded = loaded.concat(incoming.slice(0, room));

    renderFiles();
    renderSkipReport();
    refresh();

    if (fresh.length) {
      toast(`Read ${fresh.length} source file${fresh.length === 1 ? '' : 's'}`);
      showError('');
    } else if (entries.length) {
      showError(
        `I read ${entries.length} file${entries.length === 1 ? '' : 's'}, but none of them ` +
        `are source code I can analyse. I look for code files — .js .ts .py .java .go .rb ` +
        `.php .cs .rs .kt .swift .c .cpp .sql and similar. Images, documents and lock files ` +
        `are skipped on purpose.`
      );
    }
  };

  /** Nothing should vanish without the page saying so. */
  function renderSkipReport() {
    const box = qs('#skip-report', root);
    if (!box) return;
    const bits = [];
    if (skipped.notSource.length) bits.push(`${skipped.notSource.length} not source code`);
    if (skipped.tooBig.length) bits.push(`${skipped.tooBig.length} over 2 MB`);
    if (skipped.unreadable.length) bits.push(`${skipped.unreadable.length} unreadable`);
    if (skipped.ignoredDirs.size) bits.push(`${[...skipped.ignoredDirs].join(', ')} ignored`);
    if (skipped.capped) bits.push(`${skipped.capped} over the ${MAX_FILES}-file limit`);

    box.hidden = !bits.length;
    box.textContent = bits.length ? `Left out: ${bits.join(' · ')}.` : '';
  }

  /** Decode a FileList, expanding any ZIP archives found in it. */
  async function ingestFiles(fileList) {
    const entries = [];
    for (const file of Array.from(fileList)) {
      const path = file.webkitRelativePath || file.name;

      if (/\.zip$/i.test(file.name)) {
        if (!canUnzip()) { showError('This browser cannot open ZIP files. Drop the folder instead.'); continue; }
        try {
          const inner = await readZip(await file.arrayBuffer());
          inner.forEach((e) => entries.push({ path: e.path, content: e.content, size: e.content.length }));
          toast(`Unpacked ${file.name}`);
        } catch (err) {
          showError(`Could not read ${file.name}: ${err.message}`);
        }
        continue;
      }

      if (file.size > MAX_FILE) { skipped.tooBig.push(path); continue; }
      try {
        entries.push({ path, content: await file.text(), size: file.size });
      } catch (err) {
        skipped.unreadable.push(path);
      }
    }
    addEntries(entries);
  }

  /**
   * readEntries() hands back AT MOST 100 entries per call and gives no hint
   * that more remain — you have to keep asking until it returns nothing.
   * Calling it once silently truncated every folder over 100 items.
   */
  async function readAllEntries(reader) {
    const all = [];
    for (;;) {
      const batch = await new Promise((res) => reader.readEntries(res, () => res([])));
      if (!batch.length) return all;
      all.push(...batch);
    }
  }

  /** Walk a dropped file or directory via the entries API. */
  async function walkEntry(entry, prefix = '') {
    if (entry.isFile) {
      try {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        if (file.size > MAX_FILE) { skipped.tooBig.push(prefix + file.name); return []; }
        return [{ path: prefix + file.name, content: await file.text(), size: file.size }];
      } catch (e) {
        skipped.unreadable.push(prefix + entry.name);
        return [];
      }
    }
    if (entry.isDirectory) {
      const here = `${prefix}${entry.name}`;
      if (SKIP.test(here)) { skipped.ignoredDirs.add(entry.name); return []; }
      const kids = await readAllEntries(entry.createReader());
      const nested = await Promise.all(kids.map((k) => walkEntry(k, `${here}/`)));
      return nested.flat();
    }
    return [];
  }

  /* ---------- file list ---------- */

  const renderFiles = () => {
    list.innerHTML = loaded.slice(0, 60).map((f, i) => `
      <div class="file-row" style="animation-delay:${Math.min(i, 12) * 0.03}s">
        ${icons.file(15)}
        <span class="name">${esc(f.path)}</span>
        <span class="size">${fmtSize(f.size)}</span>
        <button data-remove="${i}" aria-label="Remove ${esc(f.path)}">${icons.close(13)}</button>
      </div>`).join('') +
      (loaded.length > 60 ? `<p class="faint" style="font-size:.78rem; padding:.4rem .2rem">and ${loaded.length - 60} more…</p>` : '');
  };

  on(list, 'click', '[data-remove]', (e, el) => {
    loaded.splice(Number(el.dataset.remove), 1);
    renderFiles();
    refresh();
  });

  /* ---------- fetch from a link ---------- */

  let linkMeta = null;

  const linkStatus = (msg, kind) => {
    const el = qs('#link-status', root);
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = `link-status${kind ? ` ${kind}` : ''}`;
  };

  async function runLink() {
    const url = qs('#link-url', root).value.trim();
    if (!url) { linkStatus('Paste a link first.', 'bad'); return; }

    const go = qs('#link-go', root);
    go.disabled = true;
    go.innerHTML = `<span class="spinner"></span> Fetching`;
    showError('');
    linkStatus('Looking up the repository…');

    try {
      const { files, meta, report } = await fetchFromLink(url, {
        onProgress: (done, total, stage) => {
          linkStatus(total ? `${stage}… ${done} of ${total}` : `${stage}…`);
        },
      });

      linkMeta = meta;
      skipped.notSource.push(...Array(report.notSource || 0).fill('(from the repo)'));
      skipped.tooBig.push(...(report.skippedBig || []));
      if (report.capped) skipped.capped += report.capped;

      addEntries(files);

      const bits = [`Read ${files.length} source file${files.length === 1 ? '' : 's'} from ${meta.name}`];
      if (meta.branch) bits.push(`branch ${meta.branch}`);
      if (report.truncated) {
        bits.push('the repo is large enough that GitHub returned only part of its file list');
      }
      linkStatus(`${bits.join(' · ')}.`, 'good');
    } catch (err) {
      linkStatus(err.message, 'bad');
    } finally {
      go.disabled = false;
      go.innerHTML = `${icons.arrow(15)} Fetch`;
    }
  }

  qs('#link-go', root).addEventListener('click', runLink);
  qs('#link-url', root).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runLink(); }
  });

  /* ---------- choices ---------- */

  function pick(which) {
    qsa('[data-choice]', root).forEach((b) =>
      b.classList.toggle('active', b.dataset.choice === which));
    Object.entries(panels).forEach(([key, el]) => { el.hidden = key !== which; });
    if (which === 'upload' || which === 'link') { resetSkips(); renderSkipReport(); }
    if (which === 'link') setTimeout(() => qs('#link-url', root).focus(), 80);
    if (which === 'paste') setTimeout(() => code.focus(), 80);
    refresh();
  }

  qsa('[data-choice]', root).forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (btn.dataset.choice === 'sample') {
        useSample();
        await runPipeline();
        setState({ analyzed: true, selected: null, impact: null, trace: null });
        navigate('/dashboard');
        return;
      }
      pick(btn.dataset.choice);
    }));

  /* ---------- drag & drop ---------- */

  drop.addEventListener('click', () => fileIn.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); }
  });
  qs('#pick-folder', root).addEventListener('click', () => dirIn.click());

  fileIn.addEventListener('change', async () => { await ingestFiles(fileIn.files); fileIn.value = ''; });
  dirIn.addEventListener('change', async () => { await ingestFiles(dirIn.files); dirIn.value = ''; });

  ['dragenter', 'dragover'].forEach((t) =>
    drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) =>
    drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));

  drop.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    if (!dt) return;

    /* Walk EVERY dropped item, files and folders alike. Filtering to
       directories meant a drop of "one folder + two loose files" quietly
       lost the two files. */
    const items = Array.from(dt.items || [])
      .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
      .filter(Boolean);

    if (items.length) {
      const zips = Array.from(dt.files || []).filter((f) => /\.zip$/i.test(f.name));
      if (zips.length) await ingestFiles(zips);
      const walked = await Promise.all(items.filter((en) => !/\.zip$/i.test(en.name)).map((en) => walkEntry(en)));
      addEntries(walked.flat());
      return;
    }
    if (dt.files && dt.files.length) await ingestFiles(dt.files);
  });

  /* ---------- editor ---------- */

  const syncGutter = () => {
    const lines = code.value.split('\n').length || 1;
    gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    gutter.scrollTop = code.scrollTop;
  };
  code.addEventListener('input', () => { syncGutter(); refresh(); });
  code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
  code.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value } = code;
    code.value = value.slice(0, a) + '  ' + value.slice(b);
    code.selectionStart = code.selectionEnd = a + 2;
    syncGutter();
  });

  /* ---------- run the real analysis ---------- */

  analyze.addEventListener('click', async () => {
    const input = loaded.slice();
    if (code.value.trim()) {
      input.push({ path: 'pasted-snippet.js', content: code.value, size: code.value.length });
    }

    showError('');
    analyze.disabled = true;
    analyze.innerHTML = `<span class="spinner"></span> Analyzing…`;

    let project = null;
    let failure = null;
    try {
      project = analyzeProject(input, { name: (linkMeta && linkMeta.name) || projectName(input) });
    } catch (err) {
      failure = err;
    }

    await runPipeline();

    analyze.disabled = false;
    analyze.innerHTML = `${icons.scan(17)} Analyze codebase`;

    if (failure) { showError(failure.message); return; }

    setProject(project);
    setState({ analyzed: true, selected: null, impact: null, trace: null });
    navigate('/dashboard');
  });

  syncGutter();
  refresh();
}

/** Name the project after its common root folder, if it has one. */
function projectName(files) {
  if (!files.length) return 'your project';
  const first = files[0].path.split('/');
  if (first.length > 1 && files.every((f) => f.path.split('/')[0] === first[0])) return first[0];
  return files.length === 1 ? files[0].path.split('/').pop() : 'your project';
}

/** Full-screen pipeline overlay. Resolves when the last stage completes. */
async function runPipeline() {
  const fast = prefersReduced();
  const overlay = document.createElement('div');
  overlay.className = 'pipe-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="pipe-card">
      <h3>${icons.cpu(18)} Analyzing codebase</h3>
      <p>Parsing structure, mapping relationships, and grouping modules.</p>
      <div class="pipe-steps">
        ${PIPELINE.map((label, i) => `
          <div class="pipe-step" data-step="${i}">
            <span class="mark">${i + 1}</span><span>${label}</span>
          </div>`).join('')}
      </div>
      <div class="pipe-bar"><i id="pipe-fill"></i></div>
    </div>`;
  document.body.appendChild(overlay);

  const steps = qsa('.pipe-step', overlay);
  const fill = qs('#pipe-fill', overlay);

  for (let i = 0; i < steps.length; i++) {
    steps[i].classList.add('active');
    fill.style.width = `${((i + 0.5) / steps.length) * 100}%`;
    await sleep(fast ? 30 : 170 + Math.round(Math.sin(i) * 60 + 80));
    steps[i].classList.remove('active');
    steps[i].classList.add('done');
    steps[i].querySelector('.mark').innerHTML = icons.check(11);
    fill.style.width = `${((i + 1) / steps.length) * 100}%`;
  }

  await sleep(fast ? 30 : 280);
  overlay.style.transition = 'opacity .3s';
  overlay.style.opacity = '0';
  await sleep(300);
  overlay.remove();
}
