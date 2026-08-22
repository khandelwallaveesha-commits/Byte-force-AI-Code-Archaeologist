/* ======================================================================
   explain.js — says what a selected line of code does, in plain words.

   Rule-based, like the analyzer. There is no model call at runtime, so
   every sentence here is derived from something actually visible in the
   line. That sets a hard limit worth being honest about: this describes
   what a line DOES, not why it was written. Where a line matches nothing,
   it says so rather than inventing a purpose.

   Rules run most-specific first; the first match wins.
   ====================================================================== */

/* Themes are collected across a selection to compose the summary. */
const T = {
  bring:   'bring in code from other files',
  define:  'set up something other files can use',
  fetch:   'ask the server for information',
  send:    'send information to the server',
  store:   'save or read information kept on the device',
  db:      'look up or change stored records',
  route:   'answer a request coming from the app',
  screen:  'draw something on screen',
  state:   'keep track of something that can change',
  decide:  'decide what happens next',
  loop:    'go through a list of items',
  fail:    'deal with something going wrong',
};

const q = (s) => (s || '').trim().replace(/[;,]$/, '');

/* Conditions used to be dropped into sentences verbatim — "If !items.length"
   is notation, not English, to the person this is written for. */
function cond(raw) {
  let t = q(raw);
  t = t.replace(/!\s*([\w.]+)\.length/g, 'there is nothing in $1');
  t = t.replace(/([\w.]+)\.length\s*===?\s*0/g, 'there is nothing in $1');
  t = t.replace(/([\w.]+)\.length/g, 'there is something in $1');
  t = t.replace(/!\s*([\w.]+)/g, 'there is no $1');
  t = t.replace(/\s*!==\s*/g, ' is not ');
  t = t.replace(/\s*===?\s*/g, ' is ');
  t = t.replace(/\s*\|\|\s*/g, ', or ');
  t = t.replace(/\s*&&\s*/g, ', and ');
  return t;
}

/* "preventDefault" -> "prevent default", so a method name reads as words. */
const words = (name) => String(name)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .toLowerCase();

/**
 * Say a VALUE in words instead of pasting the code in.
 * A reader who has never coded cannot read `{ email: '', password: '' }`
 * or `null` — those are the bits that were still landing on screen.
 */
function value(raw) {
  const t = q(raw);
  if (!t) return 'nothing';
  if (/^(null|undefined|void 0)$/.test(t)) return 'nothing';
  if (/^\[\s*\]$/.test(t)) return 'an empty list';
  if (/^\[/.test(t)) return 'a list';
  if (/^\{\s*\}$/.test(t)) return 'nothing filled in yet';
  if (/^\{/.test(t)) return 'a set of blank details';
  if (/^(''|""|``)$/.test(t)) return 'empty text';
  if (/^['"`]/.test(t)) return `the words ${t.replace(/['"`]/g, '"')}`;
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  if (/^(true)$/.test(t)) return 'yes';
  if (/^(false)$/.test(t)) return 'no';

  /* `<EmptyCart />` is a piece of screen, not a value to read out */
  const jsx = t.match(/^<\s*([A-Za-z][\w.]*)/);
  if (jsx) return `the ${jsx[1]} part of the screen`;

  const call = t.match(/^(?:await\s+)?([\w.]+)\s*\(/);
  if (call) return `whatever ${call[1].split('.').pop()} works out`;

  if (/^[\w.]+$/.test(t)) return t;
  return 'the value on this line';
}

/** Say a CONDITION in words. Calls inside it were being pasted in raw. */
function plainCond(raw) {
  let t = cond(raw);
  /* isExpired(token) -> "it has expired"; a very common shape in guards */
  t = t.replace(/[\w.]*\.?is([A-Z]\w*)\s*\([^)]*\)/g, (m, w) => `it is ${words(w)}`);
  t = t.replace(/[\w.]*\.?has([A-Z]\w*)\s*\([^)]*\)/g, (m, w) => `it has ${words(w)}`);
  /* any other call becomes a named check rather than pasted code */
  t = t.replace(/!\s*\(?\s*(?:await\s+)?([\w.]+)\s*\([^)]*\)\)?/g,
    (m, fn) => `the ${words(fn.split('.').pop())} check fails`);
  t = t.replace(/(?:await\s+)?([\w.]+)\s*\([^)]*\)/g,
    (m, fn) => `the ${words(fn.split('.').pop())} check passes`);
  return t;
}
const short = (s, n = 40) => (q(s).length > n ? `${q(s).slice(0, n - 1)}…` : q(s));

const RULES = [
  /* ---------------- comments and blanks ---------------- */
  { re: /^\s*$/, say: () => 'Blank line — spacing only.' },
  { re: /^\s*(\/\/|#|\*|\/\*)/, say: () => 'A note left by a developer for other developers. The app ignores it.' },

  /* ---------------- bringing code in ---------------- */
  { re: /^\s*import\s+\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/, theme: T.bring,
    say: (m) => {
      const names = q(m[1]).split(',').map(q).filter(Boolean);
      return `Uses ${names.join(', ')}, which ${names.length === 1 ? 'comes' : 'come'} from ${q(m[2])}.`;
    } },
  { re: /^\s*import\s+(\w+)\s*,?\s*(?:\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/, theme: T.bring,
    say: (m) => `Uses ${m[1]}, which comes from ${q(m[2])}.` },
  { re: /^\s*import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/, theme: T.bring,
    say: (m) => `Brings in everything from ${q(m[2])} under the name ${m[1]}.` },
  { re: /^\s*import\s*['"]([^'"]+)['"]/, theme: T.bring,
    say: (m) => `Loads ${q(m[1])}, which does its work just by being included.` },
  { re: /^\s*(?:const|let|var)\s*\{?([^=}]+)\}?\s*=\s*require\(\s*['"]([^'"]+)['"]/, theme: T.bring,
    say: (m) => `Brings in ${q(m[1])} from ${q(m[2])}.` },

  /* ---------------- routes (server side) ---------------- */
  { re: /(?:router|app|server)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)/i, theme: T.route,
    say: (m) => {
      const verb = m[1].toLowerCase();
      const what = verb === 'get' ? 'asks for' : verb === 'delete' ? 'asks to delete' : 'sends something to';
      return `When the app ${what} "${m[2]}", the steps below run and produce the answer.`;
    } },

  /* ---------------- talking to the server ---------------- */
  /* Case-sensitive `api.` missed `productApi.list(...)`, so the only line in
     a screen that talks to the server was described by its tail alone. */
  { re: /(?:await\s+)?[\w.]*[Aa]pi\s*\.\s*get\s*\(\s*['"`]([^'"`]+)/, theme: T.fetch,
    say: (m) => `Asks the server for "${m[1]}" and waits for the answer to come back.` },
  { re: /(?:await\s+)?[\w.]*[Aa]pi\s*\.\s*(?:post|put|patch|del|delete)\s*\(\s*['"`]([^'"`]+)/, theme: T.send,
    say: (m) => `Sends information to the server at "${m[1]}" and waits for it to confirm.` },
  { re: /([\w]*[Aa]pi)\s*\.\s*(\w+)\s*\([^)]*\)\s*\.\s*then\s*\(\s*(\w+)/, theme: T.fetch,
    say: (m) => `Asks the server to ${words(m[2])}, and when the answer comes back hands it to ${m[3]}.` },
  { re: /[\w]*[Aa]pi\s*\.\s*(\w+)\s*\(/, theme: T.fetch,
    say: (m) => `Asks the server to ${words(m[1])}.` },
  { re: /(?:await\s+)?fetch\s*\(\s*[^)]*?['"`]?([\w./-]*)/, theme: T.fetch,
    say: (m) => `Sends a request over the internet${m[1] ? ` to ${q(m[1])}` : ''} and waits for the reply.` },
  { re: /\.then\s*\(/, say: () => 'When the answer arrives, does this with it.' },
  { re: /\.catch\s*\(/, theme: T.fail, say: () => 'If the request failed, does this instead.' },

  /* ---------------- stored records ---------------- */
  { re: /SELECT[\s\S]*?\bFROM\s+([`"\w.]+)/i, theme: T.db,
    say: (m) => `Looks up records in "${q(m[1]).replace(/[`"]/g, '')}".` },
  { re: /INSERT\s+INTO\s+([`"\w.]+)/i, theme: T.db,
    say: (m) => `Adds a new record to "${q(m[1]).replace(/[`"]/g, '')}".` },
  { re: /UPDATE\s+([`"\w.]+)\s+SET/i, theme: T.db,
    say: (m) => `Changes records that are already saved in "${q(m[1]).replace(/[`"]/g, '')}".` },
  { re: /DELETE\s+FROM\s+([`"\w.]+)/i, theme: T.db,
    say: (m) => `Removes records from "${q(m[1]).replace(/[`"]/g, '')}".` },
  { re: /\b(?:db|knex|prisma|pool|client)\s*\.\s*(query|one|many|none|any|execute)\b/, theme: T.db,
    say: () => 'Runs a lookup against the stored information.' },

  /* ---------------- on-device storage ---------------- */
  { re: /localStorage\s*\.\s*setItem/, theme: T.store,
    say: () => 'Saves something on this device so it is still there next time the app opens.' },
  { re: /localStorage\s*\.\s*getItem/, theme: T.store,
    say: () => 'Reads back something that was saved on this device earlier.' },
  { re: /localStorage\s*\.\s*removeItem|sessionStorage\s*\.\s*removeItem/, theme: T.store,
    say: () => 'Deletes something that was saved on this device.' },

  /* ---------------- React-style screens ---------------- */
  { re: /(?:const|let)\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useState\s*\(([^)]*)\)/, theme: T.state,
    say: (m) => `Remembers "${m[1]}" while the screen is open — it can change as the ` +
                `person uses the page. It starts off as ${value(m[3])}, and "${m[2]}" is what changes it.` },
  { re: /useEffect\s*\(/, theme: T.state,
    say: () => 'Runs the steps below when the screen first appears, and again whenever the values it watches change.' },
  { re: /^\s*\}\s*,\s*\[([^\]]*)\]\s*\)\s*;?\s*$/, theme: T.state,
    say: (m) => (q(m[1])
      ? `Closes the block above. It re-runs whenever ${q(m[1])} changes.`
      : 'Closes the block above. It runs only once, when the screen first appears.') },
  { re: /useContext\s*\(\s*(\w+)/, theme: T.state,
    say: (m) => `Reads shared information (${m[1]}) that other parts of the app keep up to date.` },
  { re: /createContext\s*\(/, theme: T.state,
    say: () => 'Creates a shared place that any screen in the app can read from.' },
  { re: /^\s*return\s*\(\s*$/, theme: T.screen,
    say: () => 'Starts describing what to show on screen — the description runs over the lines below.' },
  { re: /^\s*return\s*\(?\s*<|^\s*<[A-Za-z]/, theme: T.screen,
    say: () => 'Describes what appears on screen at this point.' },
  /* `items={items}` is a setting on the piece of screen above, not an assignment. */
  { re: /^\s*([A-Za-z_][\w-]*)\s*=\s*\{([^}]*)\}\s*\/?>?\s*$/, theme: T.screen,
    say: (m) => `Hands "${m[1]}" to the part of the screen just above.` },
  { re: /^\s*([A-Za-z_][\w-]*)\s*=\s*"([^"]*)"\s*\/?>?\s*$/, theme: T.screen,
    say: (m) => `Sets "${m[1]}" to "${m[2]}" on the part of the screen just above.` },
  { re: /^\s*\.\.\.\s*\(?\s*([\w.]+)\s*&&/,
    say: (m) => `If ${q(m[1])} exists, adds it in here; if not, it is simply left out.` },
  { re: /^\s*\.\.\./, say: () => 'Folds in everything from the value on this line.' },

  /* ---------------- defining things ---------------- */
  { re: /^\s*export\s+default\s+(?:async\s+)?function\s*(\w*)/, theme: T.define,
    say: (m) => `This is the main thing the file makes${m[1] ? `, called "${m[1]}"` : ''} — ` +
                `it is what the rest of the app gets from this file.` },
  { re: /^\s*export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/, theme: T.define,
    say: (m) => `This is the start of a job called "${m[1]}". Other files can ask this ` +
                `file to run it${q(m[2]) ? `, and they hand it ${q(m[2])}` : ''}.` },
  { re: /^\s*export\s+(?:const|let|var)\s+(\w+)/, theme: T.define,
    say: (m) => `Defines "${m[1]}" and makes it available to other files.` },
  { re: /^\s*export\s*\{/, theme: T.define,
    say: () => 'Lists what this file makes available to other files.' },
  /* `const addItem = async (id, qty) => {` was read as "running async". */
  { re: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/, theme: T.define,
    say: (m) => `This is the start of a job called "${m[1]}" that the app can run later` +
                `${q(m[2]) ? `, using ${q(m[2])}` : ''}.` },
  { re: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(\w+)\s*=>/, theme: T.define,
    say: (m) => `Defines "${m[1]}", a job the app can run later, given ${m[2]}.` },
  { re: /^\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/, theme: T.define,
    say: (m) => `This is the start of a job called "${m[1]}", used only inside this file` +
                `${q(m[2]) ? `, using ${q(m[2])}` : ''}.` },
  { re: /^\s*def\s+(\w+)\s*\(([^)]*)\)/, theme: T.define,
    say: (m) => `Defines "${m[1]}", a job other code can run` +
                `${q(m[2]) ? `, given ${q(m[2])}` : ''}.` },
  { re: /^\s*class\s+(\w+)/, theme: T.define,
    say: (m) => `Defines "${m[1]}", a template for something the app works with.` },

  /* ---------------- deciding and failing ---------------- */
  /* `.+` is greedy, so it backtracks to the LAST bracket before `return`.
     `[^)]*` stopped at the first inner bracket and dropped the return
     entirely — which stated the opposite of what the line does. */
  { re: /^\s*if\s*\((.+)\)\s*\{?\s*return\b\s*(.*)$/, theme: T.decide,
    say: (m) => `If ${short(plainCond(m[1]), 66)}, it stops right here and sends back ` +
                `${value(m[2])}.` },
  { re: /^\s*\}?\s*else\s+if\s*\((.+)\)/, theme: T.decide,
    say: (m) => `If that was not true but ${short(plainCond(m[1]), 56)}, it does this instead.` },
  { re: /^\s*if\s*\((.+)\)/, theme: T.decide,
    say: (m) => `The next part only happens if ${short(plainCond(m[1]), 66)}.` },
  { re: /^\s*\}?\s*else\b/, theme: T.decide, say: () => 'Otherwise, does this instead.' },
  { re: /^\s*try\s*\{/, theme: T.fail, say: () => 'Tries the next few lines, knowing they might fail.' },
  { re: /^\s*\}?\s*catch\s*\(/, theme: T.fail,
    say: () => 'If those lines failed, does this instead of letting the app crash.' },
  { re: /^\s*throw\s+new\s+\w*Error\s*\(\s*['"`]?([^'"`)]*)/, theme: T.fail,
    say: (m) => `Stops and reports a problem${q(m[1]) ? `: "${short(m[1], 44)}"` : ''}.` },
  { re: /^\s*(?:await\s+)?\w*[Rr]es(?:ponse)?\s*\.\s*status\s*\(\s*(\d+)/, theme: T.route,
    say: (m) => `Answers with code ${m[1]} — ${m[1].startsWith('4') || m[1].startsWith('5') ? 'a refusal' : 'a success'}.` },
  { re: /^\s*(?:await\s+)?\w*[Rr]es(?:ponse)?\s*\.\s*json\s*\(/, theme: T.route,
    say: () => 'Sends the answer back to whoever asked for it.' },

  /* ---------------- lists ---------------- */
  { re: /\.map\s*\(/, theme: T.loop, say: () => 'Goes through each item and turns it into something else.' },
  { re: /\.filter\s*\(/, theme: T.loop, say: () => 'Keeps only the items that match, and drops the rest.' },
  { re: /\.reduce\s*\(/, theme: T.loop, say: () => 'Combines all the items into a single value.' },
  { re: /\.forEach\s*\(|^\s*for\s*\(|^\s*for\s+\w+\s+in\s+/, theme: T.loop,
    say: () => 'Goes through the items one at a time.' },
  { re: /^\s*while\s*\(([^)]*)\)/, theme: T.loop,
    say: (m) => `Keeps repeating for as long as ${short(m[1], 44)}.` },

  /* ---------------- general shapes ---------------- */
  { re: /^\s*return\s+(.+?);?\s*$/, say: (m) => `Sends back ${value(m[1])} as the answer.` },
  { re: /^\s*return\s*;?\s*$/, say: () => 'Stops here without sending anything back.' },
  { re: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?([\w.]+)\s*\(/,
    say: (m) => `Works out "${m[1]}" by running ${m[2]}, and keeps the answer under that name.` },
  { re: /^\s*(?:const|let|var)\s+\{([^}]+)\}\s*=\s*(.+)/,
    say: (m) => `Pulls ${q(m[1]).split(',').map(q).filter(Boolean).join(', ')} out of ${short(m[2], 30)}.` },
  { re: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(.+)/,
    say: (m) => `Gives the name "${m[1]}" to ${value(m[2])}.` },
  { re: /^\s*(\w[\w.]*)\s*=\s*(.+)/, say: (m) => `Sets ${m[1]} to ${short(m[2], 40)}.` },
  /* "Runs emit." and "Runs tokens.save." told the reader nothing at all. */
  { re: /^\s*(?:await\s+)?[\w$]*\.?preventDefault\s*\(/,
    say: () => 'Stops the browser doing its usual thing here, such as reloading the page.' },
  { re: /^\s*(?:await\s+)?emit\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*(\w+))?/,
    say: (m) => `Tells the rest of the app that "${m[1]}" happened` +
                `${m[2] ? `, passing along ${m[2]}` : ''}.` },
  { re: /^\s*(?:await\s+)?([\w$]+)\s*\.\s*(\w+)\s*\(\s*([^)]*)\)/,
    say: (m) => {
      const arg = q(m[3]);
      const same = arg && (m[1].toLowerCase().startsWith(arg.toLowerCase()) ||
                           arg.toLowerCase().startsWith(m[1].toLowerCase().replace(/s$/, '')));
      return `Asks ${m[1]} to ${words(m[2])}${arg ? (same ? ' it' : ` ${value(arg)}`) : ''}.`;
    } },
  { re: /^\s*(?:await\s+)?([\w.]+)\s*\(\s*([^)]*)\)/,
    say: (m) => `Runs ${m[1]}${q(m[2]) ? ` with ${short(m[2], 30)}` : ''}.` },
  { re: /^\s*(?:await\s+)?([\w.]+)\s*\(/, say: (m) => `Runs ${m[1]}.` },
  { re: /^\s*[)\]}]+\s*;?\s*$/, say: () => 'Closes the block that started above.' },
  { re: /^\s*\{\s*$/, say: () => 'Opens a block of steps.' },
];

/**
 * @returns {{text: string, theme: string|null, matched: boolean}}
 */
export function explainLine(line) {
  const src = String(line == null ? '' : line);
  for (const rule of RULES) {
    const m = src.match(rule.re);
    if (m) return { text: rule.say(m), theme: rule.theme || null, matched: true };
  }
  /* Honest about not knowing, rather than inventing a purpose. */
  return {
    text: 'Part of the step above — this line on its own does not do anything I can describe.',
    theme: null,
    matched: false,
  };
}

const listOf = (items) => {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

/**
 * Explain a run of lines together.
 * @param {string[]} lines   the selected source lines
 * @param {number} startLine absolute line number of lines[0]
 */
export function explainSelection(lines, startLine) {
  const perLine = lines.map((text, i) => {
    const r = explainLine(text);
    return { n: startLine + i, code: text, ...r };
  });

  const real = perLine.filter((l) => l.matched && !/^\s*$/.test(l.code));
  const themes = [];
  real.forEach((l) => { if (l.theme && !themes.includes(l.theme)) themes.push(l.theme); });

  let summary;
  if (!real.length) {
    summary = 'Nothing here does work on its own — these are blank lines, notes or closing brackets.';
  } else if (perLine.length === 1) {
    summary = null;                       // one line needs no summary of itself
  } else if (themes.length) {
    summary = `Together, these ${perLine.length} lines ${listOf(themes.slice(0, 3))}.`;
  } else {
    summary = `These ${perLine.length} lines work out values and pass them along.`;
  }

  return { summary, perLine, covered: real.length, total: perLine.length };
}
