#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): drop a marker recording that files were
# modified this session. The Stop gate (verify-on-stop.sh) only runs the
# project's checks when this marker exists — so a turn that just answered a
# question doesn't trigger the full test suite. The marker is cleared when the
# checks pass (verify-on-stop.sh) and at session start (session-start.sh).
#
# Runs synchronously and fast; it must land before the turn can end.
set -uo pipefail

touch "${TMPDIR:-/tmp}/claude_changed_$(basename "$(pwd)")" 2>/dev/null || true
exit 0
