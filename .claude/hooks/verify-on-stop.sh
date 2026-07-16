#!/usr/bin/env bash
# Stop: the completion gate. Before Claude is allowed to finish a turn, run the
# project's real checks. If any fail, force Claude to keep working with a
# precise reason. This is the deterministic backbone of "green is not optional"
# — the model cannot declare done while the build is red.
#
# Loop safety: a bounded counter (MAX_BLOCKS) guarantees the gate gives up and
# hands control back to you rather than burning tokens forever on an
# un-passable check.
#
# >>> CONFIGURE: set the three commands for your stack. Leave a command empty to
#     skip it. If all three are empty, auto-detection below tries to fill them. <<<
set -uo pipefail

TYPECHECK_CMD=""   # e.g. "npm run typecheck"  |  "tsc --noEmit"  |  "mypy ."
LINT_CMD=""        # e.g. "npm run lint"       |  "ruff check ."  |  "cargo clippy"
TEST_CMD=""        # e.g. "npm test"           |  "pytest -q"     |  "cargo test"

MAX_BLOCKS=3

INPUT="$(cat)"
have() { command -v "$1" >/dev/null 2>&1; }

# ---- Only verify when something actually changed ----------------------------
# mark-changed.sh drops this marker on every Edit/Write. No marker means this
# turn touched no files (e.g. pure Q&A) — running the whole suite would be
# pointless friction. Note: edits made via raw shell commands bypass the
# marker; the gate still catches them on the next tool-edited turn.
CHANGED_FILE="${TMPDIR:-/tmp}/claude_changed_$(basename "$(pwd)")"
[ ! -f "$CHANGED_FILE" ] && exit 0

# ---- Auto-detect commands when not explicitly configured -------------------
if [ -z "$TYPECHECK_CMD$LINT_CMD$TEST_CMD" ]; then
  if [ -f package.json ]; then
    PM="npm"; [ -f pnpm-lock.yaml ] && PM="pnpm"; [ -f yarn.lock ] && PM="yarn"
    grep -q '"typecheck"' package.json && TYPECHECK_CMD="$PM run typecheck"
    grep -q '"lint"'      package.json && LINT_CMD="$PM run lint"
    # Skip npm's scaffolded placeholder ("Error: no test specified && exit 1")
    # — treating it as a real check would fail the gate on every fresh project.
    grep -q '"test"'      package.json && ! grep -q 'no test specified' package.json && TEST_CMD="$PM test"
  elif [ -f Cargo.toml ]; then
    TYPECHECK_CMD="cargo check"; have cargo-clippy && LINT_CMD="cargo clippy -- -D warnings"; TEST_CMD="cargo test"
  elif [ -f go.mod ]; then
    TYPECHECK_CMD="go build ./..."; LINT_CMD="go vet ./..."; TEST_CMD="go test ./..."
  elif ls ./*.py >/dev/null 2>&1 || [ -f pyproject.toml ]; then
    have mypy && TYPECHECK_CMD="mypy ."; have ruff && LINT_CMD="ruff check ."; have pytest && TEST_CMD="pytest -q"
  fi
fi

# Nothing to verify -> allow stop.
[ -z "$TYPECHECK_CMD$LINT_CMD$TEST_CMD" ] && exit 0

# ---- Run the checks --------------------------------------------------------
FAILURES=""
run_check() {
  local label="$1" cmd="$2"
  [ -z "$cmd" ] && return 0
  local out
  if ! out="$(eval "$cmd" 2>&1)"; then
    FAILURES="${FAILURES}
### ${label} FAILED  (\`${cmd}\`)
$(printf '%s\n' "$out" | tail -n 40)
"
  fi
}
run_check "Typecheck" "$TYPECHECK_CMD"
run_check "Lint"      "$LINT_CMD"
run_check "Tests"     "$TEST_CMD"

GATE_FILE="${TMPDIR:-/tmp}/claude_verify_gate_$(basename "$(pwd)")"

# ---- All green: reset the counter + change marker and allow stop -----------
if [ -z "$FAILURES" ]; then
  rm -f "$GATE_FILE" "$CHANGED_FILE" 2>/dev/null || true
  exit 0
fi

# ---- Red: apply bounded-retry policy ---------------------------------------
COUNT=0; [ -f "$GATE_FILE" ] && COUNT="$(cat "$GATE_FILE" 2>/dev/null || echo 0)"
COUNT=$((COUNT + 1))

if [ "$COUNT" -ge "$MAX_BLOCKS" ]; then
  rm -f "$GATE_FILE" 2>/dev/null || true
  # Give control back to the human rather than loop forever. A Stop hook that
  # exits 0 doesn't surface stderr anywhere, so emit the warning as a
  # systemMessage in the JSON output — that's what actually reaches the user.
  MSG="verify-on-stop.sh: checks still failing after ${MAX_BLOCKS} attempts. Releasing the gate so you can intervene. Do NOT consider this work done."
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg m "$MSG" '{systemMessage:$m}'
  else
    MSG="$MSG" python3 -c 'import json,os; print(json.dumps({"systemMessage":os.environ["MSG"]}))'
  fi
  exit 0
fi
echo "$COUNT" > "$GATE_FILE" 2>/dev/null || true

REASON="The completion gate is blocking: required checks are failing (attempt ${COUNT}/${MAX_BLOCKS}). Fix the root cause — do not weaken or skip the checks — then finish.
${FAILURES}"

# Emit the block decision as JSON (robustly escaped).
if command -v jq >/dev/null 2>&1; then
  jq -n --arg r "$REASON" '{decision:"block", reason:$r}'
else
  REASON="$REASON" python3 -c 'import json,os; print(json.dumps({"decision":"block","reason":os.environ["REASON"]}))'
fi
exit 0
