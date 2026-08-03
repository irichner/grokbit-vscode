# Plan — Whole-product code review (Grokbit)

Slug: `complete-code-review` · Approach: Option B — fixed architectural layers + trust deep-dives + disclosed sampling · Blast radius: **0 product source files** (artifacts only under `.grokbit/plans/complete-code-review/`), 0 deps, no schema

Single-package repo — `cwd:` none. Verifies: **Windows PowerShell** + `npm run compile` + `npm test`.

> **Scope:** entire product (host + webview + tests/CI + known-limits honesty). Uncommitted WIP is elevated risk inside L6/tests, not the outer bound.  
> **Implement writes review markdown only.** Fixes are a later plan.

## Tasks

### T1 — Product surface inventory + risk heat map

- **intent:** Write `inventory.md` listing every `src/*.ts` module, every `media/*` product asset, CI/test floor, and dirty-tree overlay; assign each to layers L1–L7 with risk tier (critical/high/medium/low).
- **files:** `.grokbit/plans/complete-code-review/inventory.md` (create)
- **cwd:** none
- **depends:** none
- **verify:** `powershell -NoProfile -Command "(Get-ChildItem src\*.ts).Count; Test-Path .grokbit\plans\complete-code-review\inventory.md"` — inventory must claim ownership of all src modules (count match or explicit exception list)
- **removes:** none
- **baseline:** none
- **rollback:** delete inventory.md
- **state-after:** working
- **notes:** Seed from `02-survey.md` + `Claude.md` module map. Record `git status -sb` and short HEAD for DC9 freeze.

### T2 — L1 Trust / security deep-dive

- **intent:** Rubric security+correctness review of plan-gate, permission-bind, terminal-manager, env-filter, capabilities path/symlink containment + name validation, voice credential handling, telemetry content rules; file Critical/Major with path:line.
- **files:** read `src/plan-gate.ts`, `src/permission-bind.ts`, `src/terminal-manager.ts`, `src/env-filter.ts`, `src/capabilities.ts` (containment sections), `src/voice.ts` / recorder/streamer (key paths), `src/telemetry.ts`; write layer notes → merge in T8
- **cwd:** none
- **depends:** T1
- **verify:** layer notes or findings section contains headings/markers for `plan-gate` **and** `permission-bind` (e.g. Select-String both names under plan dir)
- **removes:** none
- **baseline:** none
- **rollback:** delete layer notes
- **state-after:** working
- **notes:** Prefer `security-auditor` subagent. Fail-open plan mode = Critical. Grant path/command bypass = Critical. Secrets in logs/events = Critical.

### T3 — L2 ACP + backends

- **intent:** Review spawn lifecycle, protocol dispatch, backend quirks, Windows CLI pin, Claude adapter locate/install/env stripping, media-gen path extraction.
- **files:** `src/acp.ts`, `src/acp-dispatch.ts`, `src/backends.ts`, `src/cli-locator.ts`, `src/claude-locator.ts` (+ tests as evidence)
- **cwd:** none
- **depends:** T1
- **verify:** findings/notes mention `backends` quirks or `GROK_STDIO` / claude adapter
- **removes:** none
- **baseline:** none
- **rollback:** delete notes
- **state-after:** working
- **notes:** Sample `acp.ts` if huge — list sampled functions (DC9). Cross-check #22 pin story vs constants.

### T4 — L3 Session / host lifecycle

- **intent:** Review multi-tab session pool, panel ready/replay, backend-aware open/resume, logout isolation, status bar, empty-primer recycle gates.
- **files:** `src/extension.ts`, `src/sidebar.ts` (force-checklist below), `src/session.ts`, `src/sessions.ts`, `src/session-pool.ts`, `src/session-store.ts`, `src/panel-router.ts`, `src/panel-restore.ts`, `src/status-bar.ts`
- **cwd:** none
- **depends:** T1
- **verify:** notes/findings explicitly name at least four of: `startSession`, `ready`/`replay`, `logout`, `resume`/`openTabForId`, `permission`
- **removes:** none
- **baseline:** none
- **rollback:** delete notes
- **state-after:** working
- **notes:** **Force-checklist (must touch each):** (1) `startSession` backend branch + quirks, (2) panel `ready` + `replayInto` / retainContext, (3) `logout` per-backend isolation, (4) permission request → webview card path, (5) plan approve/reject follow-up message contract, (6) resume/openTab with `backend` argument. Sample remainder of sidebar with DC9 list.

### T5 — L4 Plan mode

- **intent:** Review primer, plan restore decision, plan-review snapshot naming, mode-prefs, and consistency with L1 gate.
- **files:** `src/grok-primer.ts`, `src/plan-restore.ts`, `src/plan-review.ts`, `src/mode-prefs.ts`
- **cwd:** none
- **depends:** T2
- **verify:** notes mention primer version/marker or `decideRestoreState` / restore policy
- **removes:** none
- **baseline:** none
- **rollback:** delete notes
- **state-after:** working
- **notes:** Primer must not reintroduce tool-using pre-turns (v4 constraints). Claude quirks: planPrimer false, clientPlanGate true.

### T6 — L5 Capabilities / skills

- **intent:** Review capability scan bounds, suite provision/re-key order, MCP config handling, slash filter; Actions visibility policy vs host payload.
- **files:** `src/capabilities.ts`, `src/skill-suite.ts`, `src/mcp-config.ts`, `src/slash-filter.ts`; webview filter touchpoints only as cross-ref
- **cwd:** none
- **depends:** T1
- **verify:** notes mention `applySuiteKind` or `CAPABILITY_` / symlink containment
- **removes:** none
- **baseline:** none
- **rollback:** delete notes
- **state-after:** working
- **notes:** Re-key after scan before groups (suite double-render bug class).

### T7 — L6 Webview UI (full product + WIP overlay)

- **intent:** Product-wide webview review: chat surfaces, launcher, helpers; UI standards blockers; XSS; permission/question/plan cards; Actions/workflows; **plus** dirty-tree collapse + Workflow Builder as elevated WIP.
- **files:** `media/chat.js`, `media/chat.css`, `media/webview-helpers.js`, `media/launcher.js` (+ relevant `test/*.dom.test.ts` as evidence)
- **cwd:** none
- **depends:** T1
- **verify:** notes cover both a core surface (e.g. permission card or activity carousel) **and** at least one of builder/collapse if still present in tree
- **removes:** none
- **baseline:** none
- **rollback:** delete notes
- **state-after:** working
- **notes:** Mandatory UI blockers checklist. Escape/focus for builder. Seed-only craft. Launcher clear-all / delete safety. Disclose chat.js sample regions (DC9).

### T8 — L7 Peripheral modules + suite/compile + synthesize product verdict

- **intent:** Review chips/prompt-builder/file-ref/pending-images/agent-handoff/workspace-*/voice/telemetry/token-metrics; map major modules to tests; run **`npm run compile`** and **`npm test`**; merge all layers into `findings.md` with sampling notes, Known-limits honesty (DC7), product verdict, Critical/Major backlog.
- **files:** remaining `src/*` from inventory not fully covered; `test/` map; `.github/workflows/ci.yml`; write `.grokbit/plans/complete-code-review/findings.md`
- **cwd:** none
- **depends:** T2, T3, T4, T5, T6, T7
- **verify:** `npm run compile` exit 0; `npm test` exit 0; `powershell -NoProfile -Command "Test-Path .grokbit\plans\complete-code-review\findings.md"`; findings contain `Verdict` and sections or markers for L1–L7
- **removes:** optional intermediate `findings-L*.md` after merge
- **baseline:** none
- **rollback:** delete findings.md
- **state-after:** working
- **notes:** Always synthesize. Red compile/suite ⇒ cannot Approve. Optional: if human expanded gate to live tests, run `npm run test:live` and attach results (not required by default).

## Verification matrix

| Done criterion | Proven by |
|---|---|
| DC1 Product surface map | T1 inventory.md |
| DC2 Rubric findings | T8 findings.md |
| DC3 Product ship verdict | T8 Verdict line |
| DC4 Layer coverage L1–L7 | T2–T8 sections |
| DC5 Trust deep-dive | T2 |
| DC6 Suite + compile | T8 |
| DC7 Known-limits honesty | T8 (cross-layer notes) |
| DC8 Remediation backlog | T8 Critical/Major list |
| DC9 Sampling disclosed | T3/T4/T7/T8 sampling notes |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 (WIP-only plan; feature Clean-as-Approve; ad-hoc review) | T1–T8 / findings.md authoritative |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 2 (suite-multi-dimensional-review archive; CLAUDE Known limits content pending honesty check) | T8 DC7 may file drift |

Net lines: plan-dir markdown only. Product code: **0**.

## Open assumptions

See `assumptions.md`.

- Live `test:live` optional unless human requires it at approval.
- Fixes out of scope until separate implement / explicit request.
- “Complete” means layered full-product coverage with disclosed sampling — not every historical line of git history.

## Approval

- [x] Human approved — 2026-08-02 (via `/grokbit-implement this plan`)
