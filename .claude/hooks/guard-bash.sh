#!/usr/bin/env bash
# PreToolUse(Bash) guard: block irreversibly destructive shell commands.
#
# NOT WIRED BY DEFAULT — this template runs with permission prompts disabled
# and keeps shell friction-free. To enable, add to settings.json under
# "PreToolUse":
#   { "matcher": "Bash",
#     "hooks": [{ "type": "command",
#                 "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-bash.sh\"",
#                 "timeout": 10 }] }
#
# Why a hook and not just a permission rule: permission rules match command
# prefixes, but dangerous fragments can hide inside a larger one-liner
# (e.g. `cd /tmp && rm -rf "$HOME"`). This scans the whole command string.
#
# Contract: read the event JSON on stdin, inspect .tool_input.command.
#   exit 2  -> block the tool call; stderr is shown to Claude as the reason.
#   exit 0  -> allow.
set -euo pipefail

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

CMD="$(json_get .tool_input.command)"
[ -z "$CMD" ] && exit 0

# Each entry is an extended-regex of a command we never want to run unattended.
DANGER=(
  'rm[[:space:]]+(-[a-zA-Z]*[rf][a-zA-Z]*[[:space:]]+)+(/|~|\.|\*|\$HOME|\$\{HOME\})([[:space:]]|$)'
  ':\(\)[[:space:]]*\{[[:space:]]*:[[:space:]]*\|[[:space:]]*:'   # fork bomb
  'mkfs(\.|[[:space:]])'
  'dd[[:space:]]+if='
  '>[[:space:]]*/dev/(sd|nvme|hd|disk)'
  'chmod[[:space:]]+-R[[:space:]]+777[[:space:]]+/'
  'chown[[:space:]]+-R[[:space:]].*[[:space:]]+/([[:space:]]|$)'
  '(curl|wget)[[:space:]]+[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash)'
  'git[[:space:]]+push[[:space:]]+.*(--force|-f)([[:space:]]|$)'
  'git[[:space:]]+reset[[:space:]]+--hard'
  'sudo[[:space:]]+rm'
  '>[[:space:]]*/etc/'
)

for pat in "${DANGER[@]}"; do
  if printf '%s' "$CMD" | grep -Eq "$pat"; then
    echo "BLOCKED by guard-bash.sh: this command matches a destructive pattern (/$pat/)." >&2
    echo "Command: $CMD" >&2
    echo "If this is genuinely required, ask the operator to run it manually." >&2
    exit 2
  fi
done

exit 0
