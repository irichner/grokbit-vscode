---
name: post-change-accuracy-protocol
description: >
  End-to-end accuracy protocol after non-trivial code changes: targeted tests
  (with fix loop), /review (with implement de-dupe), regression (with fix loop),
  UI verification when UI changed, /check-work. Max 3 full protocol cycles.
  Use after implementation or /post-change-accuracy-protocol.
disable-model-invocation: true
---

# Skill: Post-Change Accuracy Protocol

Lead may **re-enact this SKILL.md** (and nested skill files) when slash UI is unavailable; slash is preferred operator entry. Nested `/targeted-unit-test-loop` and `/regression-test-loop` mean: execute the steps in those skill files, not a hard requirement to slash-invoke.

## Host skills probe (before step 2 and 5)

Protocol depends on host-bundled **`/review`**, **`/check-work`**, and often **`/implement`**. These are **not** vendored under `.grok/skills/`.

1. Prefer `grok inspect` (or host skill list) when available.  
2. If `/review` or `/check-work` is missing: record **`HOST_SKILLS=PARTIAL`** in the protocol summary.  
3. **Never silent-skip:**  
   - Missing `/review` → run a **thin local review checklist** (correctness, tests, security triggers, data-loss) and treat open bug/gap the same as `/review`, **or** NO-GO for merge claims.  
   - Missing `/check-work` → Lead self-verify against exit criteria table below and record `check-work: DEGRADED (host skill missing)` — merge claims require explicit user accept or treat as incomplete.  
4. Full host present → `HOST_SKILLS=OK`.

## Order (mandatory)

1. **Targeted Unit Test Loop** (`/targeted-unit-test-loop`) — must be **GO** (or waived) before continuing when executable code/tests/SQL/runtime config changed. Implementer **Ready:yes** is not a substitute: green exit is necessary, not sufficient; this step still judges test accuracy.  
   - If targeted returns **WAITING_ON_PRODUCT**: stop protocol until product fix; do not burn protocol cycles on re-runs without a fix.  
   - On each new **protocol** cycle: nested targeted `cycle` resets to 0.

2. **Code review** — apply implement/review de-dupe from AGENTS.md:  
   - Clean `/implement` + **zero open bugs and zero gate-mapped gaps** + tree matches implement scope → **SKIP `/review` only** and record  
     `Review: SKIPPED (implement clean; bugs=0; gaps=0; tree=<note>)`  
   - If implement artifact missing/unclear → **do not de-dupe**; run `/review` (or thin local checklist if `HOST_SKILLS=PARTIAL`)  
   - **De-dupe never skips** targeted QA, coverage/lint, security, regression, UI verify, or `/check-work`  
   - Else run bundled **`/review`** (optional `/code-review` for maintainability)  
   - **Security pass (conditional, not covered by de-dupe):** diff touches auth, secrets handling, payments, or untrusted input parsing → also run bundled security review (`security-auditor`); findings map per severity gates  
   - Open **bug** or gate-mapped **gap** → fix → resume from step 1 or 2 as appropriate  

3. **Regression Test Loop** (`/regression-test-loop`) — must be **GO** (or waived). Nested cycle resets on each protocol cycle.  

4. **UI verification (conditional)** — when the diff touches UI surfaces (views, components, styling, user-facing states, including fixture sample UI):  
   - `read_file` `.grok/docs/ui-design-standards.md` first; its Blockers list is authoritative  
   - Verify against the plan’s design criteria (gate 8) with **observable evidence**  
   - Emit **UI Verification Report** (schema below)  
   - No UI tooling → record `NO UI TOOLING` + complete manual checklist mapping each Blocker pass/fail; merge claims need durable `ui-design` waiver **or** all blockers marked pass with evidence  
   - Design blocker → **gap** → fix → resume from the appropriate step  
   - No UI changed → **SKIPPED** with reason  

5. **Final verify** — bundled **`/check-work`** when present (spawn description starts with `[checking my work]`; require `VERDICT: PASS`). This is a **session-adequacy** gate, not a substitute for QA GO / coverage. If host missing → DEGRADED path above.  

6. **Lead merge decision** per gates + `docs/waivers/`  
   - Protocol steps may pass with `merge-blocker: coverage-waiver-required` recorded — **that is not merge-ready** until waiver exists or tool lands.

7. **Commit metrics** — before any commit of this work: `python scripts/prepare_commit_metrics.py --model … --input N --output M` (or `--unmeasured`). Updates `VERSION` + ledger. Never invent counts.

## UI Verification Report schema

    # UI Verification Report
    - Surfaces (paths):
    - Standards read: .grok/docs/ui-design-standards.md (yes/no)
    - State inventory checked (empty/loading/error/disabled/focus):
    - Blockers (list each blocker: pass|fail + evidence path or note):
    - NO UI TOOLING: yes/no (if yes: waiver path or manual checklist complete?)
    - Result: PASS | FAIL | SKIPPED (no UI changed)
    - Risk if overridden:

## Full-protocol fix loop

```
protocol_cycle = 0
MAX = 3
while protocol_cycle < MAX:
  run steps 1→5 in order
  if step 1 is WAITING_ON_PRODUCT: stop — do not increment to burn cycles; resume after product fix
  if all steps PASS/SKIPPED(with reason)/DEGRADED(with recorded path) and check-work PASS or DEGRADED-accepted:
    exit protocol success (then step 7 when figures known)
    note any merge-blockers still open
  protocol_cycle += 1
  fix open bugs/gaps/test failures
  resume from the failed step (re-run earlier steps if the fix changed code; reset nested cycles)
if still failing after MAX:
  escalate with QA reports + review paths + waiver proposals — do not claim done
```

## Exit criteria (all required for “done”)

| Gate | Pass condition |
|------|----------------|
| Targeted | GO (tests green, lint green when real, accuracy pass, coverage gate or waiver/NO TOOL+waiver/UNMEASURED) |
| Review | No open bug/gap (incl. security pass when triggered), or SKIPPED with recorded bugs=0;gaps=0 reason, or durable waiver |
| Regression | GO (or durable waiver) |
| UI verification | No design blockers + UI Verification Report, or SKIPPED (no UI changed), or NO UI TOOLING + checklist/waiver |
| check-work | `VERDICT: PASS` or DEGRADED with explicit note when host skill missing |
| Host skills | `HOST_SKILLS=OK` or `PARTIAL` with non-silent fallback recorded |

**Implementers / Lead must not claim session done** when code changed and targeted tests were not run green (unless docs/comment-only escape hatch applies).

**Lead handoff:** If a specialist left Ready:**no** only because they lacked shell, Lead still runs this protocol (starting at targeted).

## Trivial escape

Docs/comment-only: skip except when executable code, tests, SQL, or runtime config changed — then at least relevant unit tests.

## Ownership

Do not run this skill concurrently with `/implement` mid-loop. Finish implement (or abort it), then run protocol.

## Summary table

| Step | Result | Evidence |
|------|--------|----------|
| Host probe | OK / PARTIAL | skill list or inspect note |
| Targeted | PASS/FAIL/WAITING_ON_PRODUCT | commands + coverage + lint + cycle N |
| /review | PASS/FAIL/SKIPPED | open bugs/gaps or skip reason; security pass if triggered |
| Regression | PASS/FAIL/WAITING_ON_PRODUCT | phase + commands + cycle N |
| UI verify | PASS/FAIL/SKIPPED | UI Verification Report |
| /check-work | PASS/FAIL/DEGRADED | VERDICT or degraded note |
| Protocol cycles | N of 3 | escalate if N==3 and failing |
| Merge blockers | none / list | e.g. coverage-waiver-required |
| Token ledger | updated / skipped | entry or “unknown — not recorded” |
