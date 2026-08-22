#!/usr/bin/env bash
# Same as deploy.cmd, for Git Bash.  ./deploy.sh login | use --add | (no args = deploy)
export PATH="/c/Users/lenovo/tools/node-v24.19.0-win-x64:$PATH"
cd "$(dirname "$0")" || exit 1
if [ $# -eq 0 ]; then firebase deploy --only hosting; else firebase "$@"; fi
