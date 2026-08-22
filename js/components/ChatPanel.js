/* ChatPanel.js — §9 AI codebase chat.
   Answers are matched against the analysed structure and can drive the
   graph: trace a flow, focus a node, or run an impact report. */

import { icons } from '../lib/icons.js';
import { esc, qs, sleep, prefersReduced } from '../lib/dom.js';
import { LAYERS } from '../data/mockData.js';
import { getProject } from '../data/project.js';
import { dependencies, dependents, impactReport, getNode } from '../lib/graph.js';
import { isPlain } from '../store.js';
import { initAI, aiStatus, askAI } from '../lib/ai.js';
import {
  plainPurpose, plainExplanation, groupLabel, impactSentence, whereLine,
} from '../lib/plain.js';

/* ----------------------------------------------------------------------
   Questions about a specific module are answered from the graph, not from
   a canned list — otherwise "what does X do" returns the same paragraph
   whatever X is.
   ---------------------------------------------------------------------- */

/* Every way a user might name a module: display name, filename, or path.
   Rebuilt per question so it always reflects the project on screen. */
const moduleKeys = () => getProject().nodes.flatMap((n) => {
  const file = n.path.split('/').pop();
  return [n.name, file, file.replace(/\.[^.]+$/, ''), n.path]
    .map((k) => ({ key: String(k).toLowerCase(), id: n.id }));
});

/** Longest key wins, so "ProductDetails" beats "Product". */
function findModule(question) {
  const q = question.toLowerCase();
  let best = null;
  for (const { key, id } of moduleKeys()) {
    if (key.length < 3 || !q.includes(key)) continue;
    if (!best || key.length > best.key.length) best = { key, id };
  }
  return best ? getNode(best.id) : null;
}

const WANTS_IMPACT = /\b(break|breaks|broke|remove|removing|delete|deleting|change|changing|impact|affect|affects|risk|safe)\b/;
const WANTS_USAGE  = /\b(use|uses|used|using|call|calls|calling|depend|depends|import|imports|need|needs)\b/;

/** The same facts, told without a single technical word. */
function plainModuleAnswer(node, question, deps, used) {
  if (WANTS_IMPACT.test(question)) {
    const report = impactReport(node.id);
    return {
      text: `**${node.name}** — ${impactSentence(report)}` +
        (report.total ? `\n\nI have put the full list in the **What breaks** tab on the right.` : ''),
      impact: node.id,
      focus: node.id,
    };
  }

  if (WANTS_USAGE.test(question)) {
    return {
      text:
        `**${node.name}** ${used.length
          ? `is used by ${used.length} other file${used.length === 1 ? '' : 's'}: ${used.join(', ')}. ` +
            `${used.length === 1 ? 'That file' : 'Those files'} would stop working without it.`
          : 'is not used by any other file in this project. It is either where the app starts up, or leftover work nobody needs any more.'}` +
        `\n\nIt ${deps.length
          ? `calls on ${deps.length} file${deps.length === 1 ? '' : 's'} of its own: ${deps.join(', ')}.`
          : 'does not call on any other file.'}`,
      focus: node.id,
    };
  }

  return {
    text:
      `**${node.name}** — ${plainPurpose(node)}\n\n` +
      `${whereLine(node)}. It belongs to the **${groupLabel(node.layer)}** group.\n\n` +
      `${plainExplanation(node)}`,
    focus: node.id,
  };
}

/** Compose an answer about one module out of its own record and its edges. */
function moduleAnswer(node, question) {
  const deps = dependencies(node.id).map((d) => getNode(d).name);
  const used = dependents(node.id).map((d) => getNode(d).name);
  const where = `\`${node.path}\` · ${LAYERS[node.layer].label} layer · ${node.importance} importance`;

  if (isPlain()) return plainModuleAnswer(node, question, deps, used);

  if (WANTS_IMPACT.test(question)) {
    const report = impactReport(node.id);
    const names = report.radius.slice(0, 6).map((r) => getNode(r.id).name);
    return {
      text:
        `Changing **${node.name}** is a **${report.level}** impact change.\n\n` +
        (report.total
          ? `${report.direct} module${report.direct === 1 ? '' : 's'} import it directly, and ` +
            `${report.total} sit downstream in total: ${names.join(', ')}` +
            (report.total > names.length ? ` and ${report.total - names.length} more` : '') + '.\n\n' +
            `The full blast radius is on the Impact tab.`
          : `Nothing depends on it, so the change is contained to this file.`),
      impact: node.id,
      focus: node.id,
    };
  }

  if (WANTS_USAGE.test(question)) {
    return {
      text:
        `**${node.name}** — ${where}.\n\n` +
        `**Depends on:** ${deps.length ? deps.join(', ') : 'nothing — it is a leaf.'}\n` +
        `**Used by:** ${used.length ? used.join(', ') : 'nothing references it. Possible dead code.'}\n\n` +
        `${node.explanation}`,
      focus: node.id,
    };
  }

  return {
    text:
      `**${node.name}** — ${node.purpose}\n\n${where}\n\n${node.explanation}\n\n` +
      `**Depends on:** ${deps.length ? deps.join(', ') : 'nothing'} · ` +
      `**Used by:** ${used.length ? used.join(', ') : 'nothing'}`,
    focus: node.id,
  };
}

/** Minimal markdown: **bold**, `code`, ```blocks```, blank-line paragraphs. */
function format(text) {
  const blocks = String(text).split(/```/);
  return blocks.map((chunk, i) => {
    if (i % 2 === 1) return `<pre class="mono">${esc(chunk.trim())}</pre>`;
    return esc(chunk)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="mono">$1</code>')
      .replace(/\n{2,}/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }).join('');
}

const GREETING = () => (isPlain()
  ? 'I have read every file in this project. Ask me about **any file by name** — ' +
    'for example "what does Login.jsx do" or "what breaks if I change it". ' +
    'You can also ask what the whole project does.'
  : 'I have read this project. Ask about **any module by name** — or how a flow works, ' +
    'which module matters most, or what breaks if you change something.');

function fallback(question) {
  if (isPlain()) {
    return `Sorry — I could not match that to anything in this project.\n\n` +
           `Try naming a file exactly as it appears in the list on the left. For example: ` +
           `"what does Login.jsx do", "what would break if I change apiClient.js", ` +
           `"which files use Cart.jsx".\n\n` +
           `Or ask about the whole project: "what does this project do", or ` +
           `"which file is touched by the most others".\n\n(You asked: "${question}")`;
  }
  return `I could not match that to the analysed structure.\n\n` +
         `You can ask about **any module by name** — "what does CartService do", ` +
         `"who uses ApiClient", "what breaks if I change TokenService" — or about the ` +
         `project as a whole: the **authentication flow**, **where the database is ` +
         `connected**, or **which component is most important**.\n\n` +
         `(You asked: "${question}")`;
}

/* Common words carry no signal. Left in, "what does X do" matched the
   project-overview intent on "what" + "does" for every possible X. */
const STOP = new Set([
  'what', 'does', 'doing', 'this', 'that', 'the', 'is', 'are', 'was', 'how',
  'why', 'when', 'where', 'which', 'with', 'from', 'about', 'tell', 'show',
  'explain', 'give', 'into', 'have', 'has', 'can', 'could', 'would', 'should',
  'there', 'their', 'then', 'than', 'and', 'for', 'you', 'your', 'its',
  'project', 'code', 'file', 'files', 'module', 'modules', 'please', 'me',
]);

/** A phrase from the intent list appears verbatim. Highest confidence. */
function exactIntent(question) {
  const q = question.toLowerCase().trim();
  let best = null;
  let bestScore = 0;
  for (const intent of getProject().chatIntents) {
    for (const phrase of intent.match) {
      if (q.includes(phrase) && phrase.length > bestScore) {
        best = intent; bestScore = phrase.length;
      }
    }
  }
  return best;
}

/** Two *meaningful* words in common. Returns null rather than guess wrong. */
function looseIntent(question) {
  const words = question.toLowerCase().trim()
    .split(/\W+/).filter((w) => w.length > 3 && !STOP.has(w));
  if (words.length < 2) return null;

  for (const intent of getProject().chatIntents) {
    const hay = intent.match.join(' ');
    if (words.filter((w) => hay.includes(w)).length >= 2) return intent;
  }
  return null;
}

export function chatPanel() {
  return `
    <div class="panel-body flush" style="display:flex; flex-direction:column">
      <div class="chat-source" id="chat-source" hidden></div>
      <div class="chat-suggestions" id="chat-suggestions">
        ${(getProject().chatSuggestions || []).map((s) => `<button class="chip" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <div class="panel-body" id="chat-log" style="padding:.7rem">
        <div class="chat-log" id="chat-stream"></div>
      </div>
      <form class="chat-input-row" id="chat-form">
        <input class="input" id="chat-input" autocomplete="off"
               placeholder="${isPlain() ? 'Ask anything about this project…' : 'Ask about this codebase…'}"
               aria-label="Ask about this project">
        <button class="btn btn-primary btn-sm" type="submit" aria-label="Send">${icons.send(15)}</button>
      </form>
    </div>`;
}

/**
 * @param {HTMLElement} root
 * @param {{onTrace: Function, onFocus: Function, onImpact: Function}} hooks
 */
export function mountChat(root, hooks) {
  const stream = qs('#chat-stream', root);
  const scroller = qs('#chat-log', root);
  const form = qs('#chat-form', root);
  const input = qs('#chat-input', root);
  let busy = false;

  const scroll = () => { scroller.scrollTop = scroller.scrollHeight; };

  function push(role, html) {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.innerHTML = `
      <span class="msg-avatar">${role === 'user' ? 'You' : 'AI'}</span>
      <div class="msg-bubble">${html}</div>`;
    stream.appendChild(el);
    scroll();
    return el;
  }

  /** Type an answer in, character-chunk by chunk. */
  async function typeAnswer(text) {
    const el = push('ai', '<span class="typing"><i></i><i></i><i></i></span>');
    const bubble = qs('.msg-bubble', el);
    await sleep(prefersReduced() ? 60 : 520);

    if (prefersReduced()) {
      bubble.innerHTML = format(text);
      scroll();
      return;
    }

    const step = Math.max(3, Math.round(text.length / 90));
    for (let i = 0; i <= text.length; i += step) {
      bubble.innerHTML = format(text.slice(0, i)) + '<span class="caret"></span>';
      scroll();
      await sleep(12);
    }
    bubble.innerHTML = format(text);
    scroll();
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    input.value = '';
    push('user', esc(question));

    /* A named file beats a fuzzy intent guess: "what does CartService do"
       is a question about CartService, not about the project as a whole. */
    const named = findModule(question);
    let reply = exactIntent(question);
    if (!reply && named) reply = moduleAnswer(named, question.toLowerCase());
    if (!reply) reply = looseIntent(question);

    /* Move the map first, so the reader watches the right file while the
       answer is being written. */
    const focusId = (reply && reply.focus) || (named && named.id);
    if (focusId) hooks.onFocus(focusId);

    let answered = false;
    if (aiStatus().enabled) {
      const thinking = push('ai', '<span class="typing"><i></i><i></i><i></i></span>');
      const { answer, error } = await askAI(question, named);
      thinking.remove();

      if (answer) {
        await typeAnswer(answer);
        answered = true;
      } else if (error) {
        /* Never leave the reader with nothing: say what happened, then give
           the rule-based answer anyway. */
        push('ai', `<span class="chat-warn">${esc(error)} Falling back to the built-in answer.</span>`);
      }
    }

    if (!answered) {
      await typeAnswer(reply ? (reply.text || reply.answer) : fallback(question));
    }

    if (reply) {
      if (reply.impact) hooks.onImpact(reply.impact);
      if (reply.trace) { await sleep(220); hooks.onTrace(reply.trace); }
    }
    busy = false;
    input.focus();
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

  qs('#chat-suggestions', root).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ask]');
    if (btn) ask(btn.dataset.ask);
  });

  push('ai', format(GREETING()));

  initAI().then((s) => {
    const strip = qs('#chat-source', root);
    if (!strip) return;
    strip.hidden = false;
    strip.className = `chat-source${s.enabled ? ' on' : ''}`;
    strip.textContent = s.enabled
      ? `Answers written by ${s.model}, using only what the map found in your files.`
      : 'Answers come from the built-in rules — no AI is switched on.';
  });

  return { ask };
}
