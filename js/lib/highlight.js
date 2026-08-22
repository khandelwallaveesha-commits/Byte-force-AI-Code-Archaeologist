/* highlight.js — tiny dependency-free syntax highlighter (JS / JSX / Python).
   Tokenizes the raw source first, then escapes each token, so quotes and
   angle brackets inside strings can never break the markup. */

import { esc } from './dom.js';

const KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'import', 'from', 'export', 'default', 'await', 'async', 'class', 'new',
  'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'extends',
  'of', 'in', 'this', 'null', 'undefined', 'true', 'false',
  'def', 'self', 'None', 'True', 'False', 'elif', 'raise', 'with', 'as', 'pass',
];

const TOKEN = new RegExp(
  [
    '(\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',              // 1 comment
    '(\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*"|`(?:\\\\.|[^`\\\\])*`)', // 2 string
    '\\b(\\d+(?:\\.\\d+)?)\\b',                                      // 3 number
    `\\b(${KEYWORDS.join('|')})\\b`,                                 // 4 keyword
    '([A-Za-z_$][\\w$]*)(?=\\s*\\()',                                // 5 call
    '([{}()\\[\\];,.]|=>|[=+\\-*/<>!&|?:]+)',                        // 6 operator
  ].join('|'),
  'g'
);

const CLASS = ['t-com', 't-str', 't-num', 't-key', 't-fn', 't-op'];

/** Highlight one line (or block) of source into safe HTML. */
export function highlight(source) {
  const src = String(source || '');
  let out = '';
  let last = 0;
  let m;

  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src)) !== null) {
    out += esc(src.slice(last, m.index));
    for (let g = 1; g <= 6; g++) {
      if (m[g] !== undefined) {
        const cls = CLASS[g - 1];
        out += `<span class="${cls}">${esc(m[g])}</span>`;
        break;
      }
    }
    last = m.index + m[0].length;
    if (m[0].length === 0) TOKEN.lastIndex++; // guard against zero-width match
  }
  out += esc(src.slice(last));
  return out;
}

/**
 * Render a full code block with a line-number gutter.
 * @param {string} code       source text
 * @param {number} startLine  number shown on the first line
 * @param {number[]} hot      line numbers (absolute) to highlight
 */
export function codeBlock(code, startLine = 1, hot = []) {
  const lines = String(code || '').replace(/\t/g, '  ').split('\n');
  const hotSet = new Set(hot);

  const gutter = lines
    .map((_, i) => {
      const n = startLine + i;
      return `<span class="${hotSet.has(n) ? 'hl' : ''}">${n}</span>`;
    })
    .join('');

  const body = lines
    .map((line, i) => {
      const n = startLine + i;
      return `<div class="cl ${hotSet.has(n) ? 'hl' : ''}" data-line="${n}">${highlight(line) || '&nbsp;'}</div>`;
    })
    .join('');

  return `<div class="code-view mono"><div class="gutter">${gutter}</div><div class="code-lines">${body}</div></div>`;
}
