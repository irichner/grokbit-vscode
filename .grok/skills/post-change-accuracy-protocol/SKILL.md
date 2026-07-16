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

## Order (mandatory)

1. **Targeted Unit Test Loop** (`/targeted-unit-test-loop`) — must be **GO** (or waived) before continuing when executable code/tests/SQL/runtime config changed. Implementer **Ready:yes** is not a substitute: green exit is necessary, not sufficient; this step still judges test accuracy.  

2. **Code review** — apply implement/review de-dupe from AGENTS.md:  
   - Clean `/implement` + zero open bugs + tree matches → **SKIP `/review` only** and record reason  
   - **De-dupe never skips** targeted QA, coverage/lint, security, regression, UI verify, or `/check-work`  
   - Else run bundled **`/review`** (optional `/code-review` for maintainability)  
   - **Security pass (conditional, not covered by de-dupe):** diff touches auth, secrets handling, payments, or untrusted input parsing → also run bundled security review (`security-auditor`); findings map per severity gates  
   - Open **bug** or gate-mapped **gap** → fix → resume from step 1 or 2 as appropriate  
3. **Regression Test Loop** (`/regression-test-loop`) — must be **GO** (or waived).  
4. **UI verification (conditional)** — when the diff touches UI surfaces (views, components, styling, user-facing states, including fixture sample UI):  
   - `read_file` `.grok/docs/ui-design-standards.md` first; its Blockers list is authoritative  
   - Verify against the plan’s design criteria (gate 8) with **observable evidence**  
   - No UI tooling → record `NO UI TOOLING` + manual checks; merge claims need waiver discipline like `NO COVERAGE TOOL`  
   - Design blocker → **gap** → fix → resume from the appropriate step  
   - No UI changed → **SKIPPED** with reason  
5. **Final verify** — bundled **`/check-work`** (spawn description starts with `[checking my work]`; require `VERDICT: PASS`)  
6. **Lead merge decision** per gates + `docs/waivers/`  
7. **Commit metrics** — before any commit of this work: `python scripts/prepare_commit_metrics.py --model … --input N --output M` (or `--unmeasured`). Updates `VERSION` + ledger. Never invent counts.

## Full-protocol fix loop

```
protocol_cycle = 0
MAX = 3
while protocol_cycle < MAX:
  run steps 1→5 in order
  if all steps PASS/SKIPPED(with reason) and /check-work VERDICT: PASS:
    exit protocol success (then step 7 when figures known)
  protocol_cycle += 1
  fix open bugs/gaps/test failures
  resume from the failed step (re-run earlier steps if the fix changed code)
if still failing after MAX:
  escalate with QA reports + review paths + waiver proposals — do not claim done
```

## Exit criteria (all required for “done”)

| Gate | Pass condition |
|------|----------------|
| Targeted | GO (tests green, lint green when real, accuracy pass, coverage gate or waiver/NO TOOL/UNMEASURED) |
| Review | No open bug/gap (incl. security pass when triggered), or SKIPPED with recorded reason, or durable waiver |
| Regression | GO (or durable waiver) |
| UI verification | No design blockers + evidence recorded, or SKIPPED (no UI changed), or `NO UI TOOLING` + waiver path |
| check-work | `VERDICT: PASS` |

**Implementers / Lead must not claim session done** when code changed and targeted tests were not run green (unless docs/comment-only escape hatch applies).

**Lead handoff:** If a specialist left Ready:**no** only because they lacked shell, Lead still runs this protocol (starting at targeted).

## Trivial escape

Docs/comment-only: skip except when executable code, tests, SQL, or runtime config changed — then at least relevant unit tests.

## Ownership

Do not run this skill concurrently with `/implement` mid-loop. Finish implement (or abort it), then run protocol.

## Summary table

| Step | Result | Evidence |
|------|--------|----------|
| Targeted | PASS/FAIL | commands + coverage + lint + cycle N |
| /review | PASS/FAIL/SKIPPED | open bugs/gaps or skip reason; security pass if triggered |
| Regression | PASS/FAIL | phase + commands + cycle N |
| UI verify | PASS/FAIL/SKIPPED | evidence paths or blockers or NO UI TOOLING |
| /check-work | PASS/FAIL | VERDICT |
| Protocol cycles | N of 3 | escalate if N==3 and failing |
| Token ledger | updated / skipped | entry or “unknown — not recorded” |
