#!/usr/bin/env bash
# SessionStart: print a short repo snapshot. stdout is injected into Claude's
# context, so the agent begins each session already oriented. Also resets the
# completion-gate retry counter (see verify-on-stop.sh).
set -uo pipefail

# Reset the per-project Stop-gate counter and the "files changed" marker on
# every fresh start/resume. The gate verifies changes made in *this* session.
rm -f "${TMPDIR:-/tmp}/claude_verify_gate_$(basename "$(pwd)")" \
      "${TMPDIR:-/tmp}/claude_changed_$(basename "$(pwd)")" 2>/dev/null || true

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repository."; exit 0; }

BRANCH="$(git branch --show-current 2>/dev/null || echo '?')"
DIRTY_COUNT="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

echo "## Repository snapshot"
echo "- Branch: ${BRANCH}"
if [ "${DIRTY_COUNT}" = "0" ]; then
  echo "- Working tree: clean"
else
  echo "- Working tree: ${DIRTY_COUNT} uncommitted change(s)"
  echo "- Changed files:"
  git status --porcelain 2>/dev/null | sed 's/^/    /' | head -n 20
fi
echo "- Recent commits:"
git log --oneline -5 2>/dev/null | sed 's/^/    /'

exit 0
