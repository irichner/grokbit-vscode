# Review log — Phase A: Trust & host stability

Adversarial review against `01-intent.md`, `02-survey.md`, `03-design.md`.

## Round 1

### BLOCKER

1. **Empty-grant semantics must not be “deny all.”**  
   Intent non-goal: Agent may still write without permission. Design Option 1 says empty queue → allow. **Confirm tasks state this explicitly** so implementers don’t “strengthen” to Option 2.

2. **Auto-approve must record grants.**  
   DC3 requires YOLO path binding. Today autoApprove returns early without touching `pendingPermissions` (`sidebar.ts:2424-2427`). Design says push grant on allow — **task must cover autoApprove branch**, not only `permissionAnswer`.

### MAJOR

3. **Quirk split must not break Grok.**  
   Grok needs both fs gate and permission pre-reject. Tasks must assert Grok flags remain both true (regression test on quirk table or behavior).

4. **CLI update panel filter.**  
   `disposePool("grok")` alone leaves Claude in pool — good — but `cliUpdating` broadcast + restart loop currently hits all panels. Restarting Claude mid-update is the bug to fix; broadcasting `cliUpdating` to Claude may flash wrong UI. Prefer: broadcast only to grok panels / or ignore `cliUpdating` when `state.backend === "claude"`.

5. **Synthetic label source of truth.**  
   Must key off “used permissionDiffFromRawInput”, not “backend === claude”, so grok edge cases aren’t mislabeled and Claude with real pending diff isn’t labeled synthetic.

### MINOR

6. Install cancel is best-effort; don’t block Phase A on killable npm process.
7. Content hash deferred — restate in plan open assumptions so security review doesn’t reopen as BLOCKER mid-implement.

## Round 1 resolution (Architect)

- T1/T2 notes: empty grants → allow; autoApprove records grants.
- T3: split quirks; Grok both on; Claude fs on / permission reject off; tests for both backends’ plan write behavior.
- T4: grok-only dispose + grok-only restart; Claude ignores or doesn’t receive update chrome.
- T5: label only when synth path used.
- T6: docs + optional cancel; no hard kill requirement.
- assumptions.md: content-hash out of scope; Claude plan file path UNVERIFIED.

**Exit Round 1:** zero open BLOCKER/MAJOR after amendments absorbed into `plan.md`.

## Round 2

No second design revision needed; amendments folded into tasks. Residual items only in `assumptions.md`.
