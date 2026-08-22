/* ======================================================================
   sources.js — what counts as source code, in one place.

   These lists used to be copied into both the uploader and the analyzer.
   They drifted, and files that passed one filter were silently dropped by
   the other. One definition now, imported everywhere.
   ====================================================================== */

export const CODE_EXT = new RegExp(
  '\\.(jsx?|tsx?|mjs|cjs|mts|cts|py|pyw|java|kt|kts|go|rb|php|cs|vb|swift|dart|' +
  'rs|c|cc|cpp|cxx|h|hh|hpp|m|mm|scala|clj|cljs|ex|exs|erl|hs|lua|pl|pm|r|sql|' +
  'sh|bash|zsh|ps1|vue|svelte|astro|html|htm|css|scss|sass|less)$', 'i');

/**
 * Files that are not code but say what the project IS.
 *
 * These were being filtered out before analysis, which threw away the single
 * best answer to "what does this project do?" — the README — and left the
 * overview answering with counts instead of a description.
 */
export const META_FILES =
  /(^|\/)(readme(\.md|\.rst|\.txt)?|package\.json|pubspec\.yaml|cargo\.toml|go\.mod|composer\.json|pyproject\.toml|setup\.py|pom\.xml|build\.gradle(\.kts)?|info\.plist|[\w.-]+\.podspec|[\w.-]+\.csproj|requirements\.txt)$/i;

export const SKIP_DIR =
  /(^|\/)(node_modules|\.git|dist|build|out|vendor|__pycache__|\.next|coverage|target|\.venv|venv)(\/|$)/;

export const MAX_FILE = 2_000_000;   // 2 MB — bigger than any hand-written source file
export const MAX_FILES = 1500;

/** Everything the pickers should offer, derived from CODE_EXT. */
export const ACCEPT_ATTR = [
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.java', '.kt', '.go',
  '.rb', '.php', '.cs', '.swift', '.dart', '.rs', '.c', '.cc', '.cpp', '.h',
  '.hpp', '.m', '.scala', '.sql', '.sh', '.ps1', '.lua', '.r', '.vue',
  '.svelte', '.astro', '.html', '.css', '.scss', '.zip',
].join(',');
