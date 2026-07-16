#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit) guard: never let the agent modify secrets,
# VCS internals, lockfiles, or this guard itself.
#
# Contract: inspect .tool_input.file_path. exit 2 blocks; exit 0 allows.
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

FILE="$(json_get .tool_input.file_path)"
[ -z "$FILE" ] && exit 0

# Extended-regex patterns of paths that are off-limits for writes.
# The last two protect the enforcement layer itself: if the agent could edit
# the hooks or the settings that wire them, every other guarantee (including
# the Stop gate) would be one Edit away from gone. Humans edit these files.
# Note: this guards the Edit/Write tools only — shell redirection can still
# write files. Wire guard-bash.sh (see that file) if you want Bash coverage too.
PROTECTED=(
  '(^|/)\.env($|\.)'
  '\.pem$'
  '\.key$'
  '(^|/)secrets?/'
  '(^|/)\.git/'
  '(^|/)id_rsa'
  '(^|/)\.ssh/'
  '(^|/)\.claude/hooks/'
  '(^|/)\.claude/settings\.json$'
)

for pat in "${PROTECTED[@]}"; do
  if printf '%s' "$FILE" | grep -Eq "$pat"; then
    echo "BLOCKED by protect-paths.sh: '$FILE' is a protected path (/$pat/)." >&2
    echo "Secrets, VCS internals, and key material must be edited by a human, not the agent." >&2
    exit 2
  fi
done

exit 0
