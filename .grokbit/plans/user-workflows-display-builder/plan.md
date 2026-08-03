# Plan — User Workflows display + Workflow Builder (form + canvas)

Slug: `user-workflows-display-builder` · Approach: display parity → ADR → goal form + visual canvas → Craft-with-AI handoff · Blast radius: medium (media + tests + ADR; optional React stack if ADR picks Flow)

Single-package repo — `cwd:` none. Verifies: **PowerShell on Windows**.

## Tasks

### T1 — ADR 0004: workflow builder canvas technology

- **intent:** Record durable choice between vanilla pipeline canvas vs React Flow (+ bundler), covering CSP, size, tests, thin-client coexistence (E6 gate)
- **files:** `docs/adr/0004-workflow-builder-canvas.md`; optional status note in `docs/plans/grokbit-business-studio-3.0.md` E6
- **cwd:** none
- **depends:** none
- **verify:** `powershell -NoProfile -Command "Test-Path docs/adr/0004-workflow-builder-canvas.md"`
- **removes:** none
- **baseline:** E6 says canvas out of 3.0 / ADR required before work
- **rollback:** delete ADR file; revert roadmap note
- **state-after:** working
- **notes:** Human may pre-decide at approval gate (vanilla vs React Flow). ADR must state v1 decision explicitly. Display tasks T2–T4 do not wait on canvas implementation, but **T6+ canvas must not start without ADR Decision section filled**.

### T2 — Pure display labels + chip-safe invokeLabel

- **intent:** `create-workflow` → “Create Workflow”; disk kebab → Title Case; multi-line invoke chips stay single-token
- **files:** `media/webview-helpers.js`, `test/webview-helpers.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/webview-helpers.test.ts`
- **removes:** none
- **baseline:** workflow `label === name`; `invokeLabel = invoke.trim()`
- **rollback:** `git checkout -- media/webview-helpers.js test/webview-helpers.test.ts`
- **state-after:** working
- **notes:** `capabilityDisplayLabel` + `capabilityInvokeLabel`; do not Title Case skill/agent/command kinds.

### T3 — Green for User Workflows names

- **intent:** workflow names use `--neon-green-ink` like suite
- **files:** `media/chat.css`
- **cwd:** none
- **depends:** none
- **verify:** `powershell -NoProfile -Command "Select-String -Path media/chat.css -Pattern 'data-kind=.workflow.' | Select-Object -First 5"`
- **removes:** none
- **baseline:** only grokbit green
- **rollback:** `git checkout -- media/chat.css`
- **state-after:** working

### T4 — Create tile opens Workflow Builder (shell + form)

- **intent:** Grok Create Workflow tile opens builder overlay with goal-first form; Craft builds brief and seeds composer (no auto-send unless product later flips)
- **files:** `media/webview-helpers.js` (pure brief/validate), `media/chat.js`, `media/chat.css`, `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts` (or new `test/workflow-builder.dom.test.ts`)
- **cwd:** none
- **depends:** T2
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **removes:** none (create tile remains; action changes from bare seed-only to open builder — may still expose skill chip)
- **baseline:** click Create seeds `/create-workflow ` only
- **rollback:** restore prior click → invoke seed path
- **state-after:** working
- **notes:**
  - Display label “Create Workflow”; description goal-first.
  - Form: goal required; name; scope; constraints.
  - Pure `buildWorkflowCraftBrief` / `validateWorkflowBuilderDraft`.
  - Claude: no builder open (assert).
  - Close + dirty confirm; empty goal blocks Craft.

### T5 — Visual canvas (phases + agents) per ADR

- **intent:** Editable visual pipeline of phases/agents bound to the same draft as the form; Craft brief includes graph structure
- **files:** per ADR — vanilla: `media/chat.js` + `media/chat.css` + helpers; React Flow: new bundle entry + deps as ADR lists; tests
- **cwd:** none
- **depends:** T1, T4
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts` **and** if new test file: `npx vitest run test/workflow-builder.dom.test.ts` (create if used)
- **removes:** none
- **baseline:** no canvas
- **rollback:** remove canvas UI; keep form-only Craft
- **state-after:** working
- **notes:**
  - Add/rename/reorder/remove phase; agent cards with label + capability mode.
  - Cap counts (design: e.g. 12/8) with UI notice.
  - If ADR = React Flow: this task includes minimal bundler + CSP updates + package scripts; if too large, split implement progress but **do not ship canvas half-broken**.
  - a11y: keyboard operable controls (not drag-only).

### T6 — Display/DOM polish pass + full suite + docs

- **intent:** All display done-criteria + builder documented; `npm test` green; roadmap E6 status honest
- **files:** `test/capabilities.dom.test.ts`, `README.md` / `CLAUDE.md` as needed, `docs/plans/grokbit-business-studio-3.0.md` status
- **cwd:** none
- **depends:** T3, T4, T5
- **verify:** `npm test`
- **removes:** none
- **baseline:** floor suite
- **rollback:** revert docs + failing test expects
- **state-after:** working
- **notes:** Document: Create Workflow opens builder; AI crafts via agent; labels Title Case + green.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Create Workflow label + green | T2, T3, T6 |
| Disk Title Case + green | T2, T3, T6 |
| Chip = real invoke | T2, T4 |
| Builder opens from Create (Grok) | T4 |
| Goal-first form | T4 |
| Visual canvas edit phases/agents | T5 |
| Craft seeds structured AI brief | T4 + T5 |
| ADR records canvas tech | T1 |
| Claude no fake Create builder | T4 |
| Suite intact / npm test | T6 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 5 | labels, green CSS, create action, DOM expects, E6 “forever out” status for this surface |
| COEXIST | 0–1 | React stack only if ADR chooses Flow alongside remaining vanilla chat |
| LEAVE | 3 | host kebab names, suite polish, CLI run dashboard |

## Open assumptions

See `assumptions.md` — Craft auto-send; Claude builder; ADR vanilla vs React Flow.

## Approval

- [x] Human approved — 2026-08-02 (implement request: `/grokbit-implement this plan`)
- [x] Canvas tech preference (optional): `defer-to-ADR-author` → ADR chooses **vanilla** (default recommendation)
- [x] Craft: `seed-only` (default)
- [x] Claude v1: `grok-only-builder` (default)
