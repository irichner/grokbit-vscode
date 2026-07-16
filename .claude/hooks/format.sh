#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): auto-format the file Claude just touched.
# Runs async (see settings.json) so it never slows the agent down. Best-effort:
# a missing formatter is a no-op, never an error.
#
# >>> Tune the formatter-per-extension map below to match your project. <<<
set -uo pipefail

INPUT="$(cat)"

json_get() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r "$1 // empty" 2>/dev/null || true
  else
    printf '%s' "$INPUT" | python3 -c 'import sys,json
d=json.load(sys.stdin)
cur=d
for k in sys.argv[1].lstrip(".").split("."):
    cur=cur.get(k) if isinstance(cur,dict) else None
    if cur is None: break
print(cur if isinstance(cur,str) else "")' "$1" 2>/dev/null || true
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

FILE="$(json_get .tool_input.file_path)"
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.html|*.yaml|*.yml)
    if have prettier; then prettier --write "$FILE" >/dev/null 2>&1; fi
    case "$FILE" in *.ts|*.tsx|*.js|*.jsx)
      if have eslint; then eslint --fix "$FILE" >/dev/null 2>&1; fi ;;
    esac
    ;;
  *.py)
    if have ruff; then ruff format "$FILE" >/dev/null 2>&1; ruff check --fix "$FILE" >/dev/null 2>&1
    elif have black; then black "$FILE" >/dev/null 2>&1; fi
    ;;
  *.go)
    if have gofmt; then gofmt -w "$FILE" >/dev/null 2>&1; fi
    ;;
  *.rs)
    if have rustfmt; then rustfmt "$FILE" >/dev/null 2>&1; fi
    ;;
  *.sh)
    if have shfmt; then shfmt -w "$FILE" >/dev/null 2>&1; fi
    ;;
esac

exit 0
