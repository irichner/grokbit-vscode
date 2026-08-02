# Review log — Simplify session-tab welcome chrome

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`  
Context: re-read from disk after design write; adversarial Plan Reviewer role.

- `[MAJOR]` Design mentions confirming whether `startingPhase` is only for version UI, but does not require a concrete disposition if it has other side effects — risk of implementer deleting `startingPhase` and breaking voice-queue flush / send locking during priming — evidence: design Shape of the change; survey cites `setBusy` ~5805-5815 — resolves by: survey/design must pin `startingPhase` usages before tasks, or plan task must "preserve `startingPhase` unless proven version-only."
- `[MAJOR]` Intent done-criterion says transient Starting/Updating line not shown on **normal ready** welcome, which Option A satisfies by deleting the node entirely — including during priming and CLI update. That is stronger than the criterion and matches user "remove everything above… except Grokbit." OK if stated, but onboarding tests that assert version-line strings will fail — design says rewrite, good. Residual: ensure done-criterion language and design agree that priming also has no status line (composer busy remains).
- `[MINOR]` Optional padding tweak on `.welcome` is unconstrained — fine as non-goal cosmetic.
- `[MINOR]` LEAVE on ADR/CLAUDE is correct for scope; no BLOCKER.
- Spot-check citations: `src/sidebar.ts:4793-4804` welcome tree confirmed; `media/chat.css:271-295` logo/tagline; `media/chat.js:687-710` guide; `test/webview-harness.ts:33-44` mirror — match design claims.
- Intent coverage: logo, tagline, guide, version, keep title + cards + onboarding + suite green — all mapped.
- Supersession table: every survey row has REPLACE or LEAVE — no silent omit.
- Non-goals: launcher logo preserved — design obligation names it.
- Reinvention: none; pure removal.

### Architect response — Round 1
- `[MAJOR]` startingPhase → **REVISED**: Design Shape of the change now requires: **keep `startingPhase` and all non-version uses**; only remove DOM writes to `#welcome-version`. Task notes will cite a quick grep of `startingPhase` at implement time; default is preserve.
- `[MAJOR]` priming/status → **REVISED**: Design unhappy path already says no Starting line during priming; align intent criterion wording in assumptions if needed — treat full removal of the status line (including priming/update) as intentional, not only "ready" state. Add explicit note in design Unhappy paths (already present) and plan notes.
- `[MINOR]` padding → accepted, optional only.
- `[MINOR]` docs LEAVE → accepted.

## Round 2
Reviewed: revised design intent on `startingPhase` preservation and full status-line removal.

- `[MINOR]` No remaining MAJOR/BLOCKER if `startingPhase` preserve rule is in plan task notes.
- Verifiability of done criteria will be checked at Loop 4 against plan tasks.

### Architect response — Round 2
- No design file rewrite required beyond Round 1 notes; plan.md will carry explicit `startingPhase` preserve constraint.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none (MINORs non-blocking)

## Plan review (Loop 4)
One pass, after Decompose — checks the task list against the design, not the
design decision again.
Reviewed: `plan.md` (re-read from disk)

- `[MINOR]` T2 verify greps `startingPhase` absence after T2, but mentions `npm test -- test/webview-helpers.test.ts` "after T3" — slightly awkward order. Acceptable: T3 owns helper unit-test deletion; T2 verify can be string-absence only until T3.
- `[MINOR]` T1 `state-after: working` notes suite may fail until T2–T3 — honest; prefer implementing T1–T3 in one implement slice if intermediate red is undesirable.
- No BLOCKER: every REPLACE disposition has a removes: path; Verification matrix covers all done criteria; `flushVoiceQueue` / `cliVersion` preservation stated; launcher logo out of scope; `npm test` is the real OS-appropriate verify for T3.
- Disposition summary matches design (6 REPLACE + 1 LEAVE).

### Architect response
- `[MINOR]` T2 verify wording → **REVISED** in plan: T2 verify is string-absence + keep flushVoiceQueue/cliVersion; full suite is T3 only.
- `[MINOR]` single-slice preference → noted at gate, not a plan block.

Outcome: clean (no BLOCKER)
