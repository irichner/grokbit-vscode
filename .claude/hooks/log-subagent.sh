#!/usr/bin/env bash
# SubagentStop: append a one-line audit record each time a subagent finishes.
# Useful for seeing how often delegation happens and to which roles.
# Best-effort and async; never blocks.
set -uo pipefail

INPUT="$(cat)"
mkdir -p "$CLAUDE_PROJECT_DIR/.claude/logs" 2>/dev/null || exit 0

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

AGENT="$(json_get .agent_type)"; [ -z "$AGENT" ] && AGENT="$(json_get .subagent_type)"
[ -z "$AGENT" ] && AGENT="(unknown)"
printf '%s\t%s\n' "$(date -u +%FT%TZ)" "$AGENT" >> "$CLAUDE_PROJECT_DIR/.claude/logs/subagents.log" 2>/dev/null || true
exit 0
