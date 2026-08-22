/* store.js — one shared state object with a tiny pub/sub.
   Stands in for React state; the React port maps this onto context. */

const state = {
  analyzed: false,      // has the pipeline been run this session?
  files: [],            // uploaded file descriptors
  code: '',             // pasted source
  language: 'auto',
  selected: null,       // focused graph node id
  impact: null,         // node id the impact panel is reporting on
  trace: null,          // node id path highlighted on the graph
  chat: [],             // { role, text }
  dockTab: 'chat',      // 'chat' | 'impact' | 'code'
  plain: true,          // plain language by default; technical view is opt-in
};

const listeners = new Set();

export const getState = () => state;

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state, patch));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Drop per-analysis state without forgetting the theme or chat history. */
export function resetAnalysis() {
  setState({ selected: null, impact: null, trace: null });
}

/* Session persistence: survives a refresh so a demo never loses its place. */
export function persist() {
  try {
    sessionStorage.setItem(
      'aca-session',
      JSON.stringify({ analyzed: state.analyzed, selected: state.selected, plain: state.plain })
    );
  } catch (e) { /* private mode — fine, just do not persist */ }
}

export function restore() {
  try {
    const raw = sessionStorage.getItem('aca-session');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      state.analyzed = Boolean(saved.analyzed);
      state.selected = saved.selected || null;
      if (typeof saved.plain === 'boolean') state.plain = saved.plain;
    }
  } catch (e) { /* ignore malformed state */ }
}

/** Are we showing plain language rather than developer wording? */
export const isPlain = () => state.plain;
