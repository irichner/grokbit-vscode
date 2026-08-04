# Plan — Create Workflow screen UX (layout + in-place Craft)

Slug: `create-workflow-screen-ux` · Approach: column layout + required name + scope toggle; Craft auto-sends with compact status; apply proposal via workflow detail → draft · Blast radius: ~6–8 files, 0 new deps, no schema

Single-package repo — `cwd:` none. Verifies: **PowerShell / npm on Windows**.

## Tasks

### T1 — Ground workflow detail host↔webview path for craft apply

- **intent:** Prove the exact message names and handlers used today for User Workflow Details (or document that Path B needs a new narrow host read) so craft-result apply does not invent an API
- **files:** read-only: `src/sidebar.ts`, `src/workflow-inspect.ts`, `media/chat.js` (detail open path); write: `.grokbit/plans/create-workflow-screen-ux/implement/preflight.md` (or append citations into implement notes when implement starts) — **Plan phase may only note findings under this plan dir**
- **cwd:** none
- **depends:** none
- **verify:** `powershell -NoProfile -Command "Select-String -Path src/sidebar.ts,media/chat.js -Pattern 'workflowDetail|listWorkflow|workflow-detail|parseWorkflowDetail' | Select-Object -First 30"`
- **removes:** none
- **baseline:** none (read-only discovery)
- **rollback:** delete any plan-dir note written
- **state-after:** working
- **notes:** Survey already has `parseWorkflowDetail` at `src/workflow-inspect.ts:521`. Choose Path A (reuse detail message) vs Path B (add `workflowCraftResult`) in implement only after this verify output is recorded. Do not implement Path B in T1.

### T2 — Layout + validation: Name first (required, large), Goal, scope toggle, drop Constraints, canvas under Goal

- **intent:** Match done-criteria 1–5 for the Create Workflow form/canvas chrome without changing Craft send behavior yet (Craft may still seed-only until T3 if split helps, but prefer completing layout fully so T3 only changes Craft)
- **files:** `media/chat.js` (`renderWorkflowBuilder`, open focus), `media/chat.css` (column layout, larger name input, scope toggle), `media/webview-helpers.js` (`validateWorkflowBuilderDraft` name required; remove constraints from brief; drop constraints from draft typing), `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts` (or new `test/workflow-builder.dom.test.ts`)
- **cwd:** none
- **depends:** none (can parallel T1)
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **removes:** Constraints field UI; `draft.constraints` usage; Constraints section in `buildWorkflowCraftBrief`; optional name-only validate behavior
- **baseline:** Goal-first form; name optional; segmented scope; Constraints present; canvas side-by-side (`media/chat.js:1234–1398`, `media/chat.css:2148–2212`)
- **rollback:** `git checkout -- media/chat.js media/chat.css media/webview-helpers.js test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:**
  - Name required + kebab; empty name fails validate.
  - Scope = switch next to name (reuse `.popover-switch` patterns).
  - Focus name on open.
  - Canvas under Goal in one column.
  - Update pure tests: validate name required; brief has no `## Constraints`.

### T3 — Craft with AI: stay open, auto-send, working notification, apply proposal into draft

- **intent:** Craft validates → keeps Create Workflow surface open → `submitMessage(brief)` without composer Send → shows working notification (compact chrome during busy) → on successful turn end applies proposed workflow into editable builder fields/canvas
- **files:** `media/chat.js` (craft handler, craft state, `agentEnd`/`agentError`/`exit` hooks, compact chrome render), `media/chat.css` (status banner / compact mode), `media/webview-helpers.js` (`workflowDetailToBuilderDraft` pure), host only if T1 chose Path B (`src/sidebar.ts` + tests), `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts` (replace seed-only assertion)
- **cwd:** none
- **depends:** T1, T2
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **removes:** Craft path that closes builder + seed-only no-send (`media/chat.js:1426–1429` behavior)
- **baseline:** Craft closes overlay, fills composer, no `send` (`test/capabilities.dom.test.ts:228–250`)
- **rollback:** `git checkout --` touched files from T3
- **state-after:** working
- **notes:**
  - Disable Craft while `state.busy` unless this craft session owns the turn.
  - Compact chrome so permissions remain usable (design Option B).
  - Apply via detail/read path from T1; pure mapper for phases/agents.
  - Failure paths: agentError, missing file, opaque parse — banner + keep draft.
  - Happy-dom: assert `posted` contains `{ type: "send" }`, builder not hidden, working text visible; simulate result apply without real grok.

### T4 — Docs + full suite green

- **intent:** Align README/CLAUDE seed-only wording with in-place Craft; prove whole suite still green
- **files:** `README.md`, `CLAUDE.md` (and any one-liner in `docs/` only if it still claims seed-only Craft), tests already updated in T2–T3
- **cwd:** none
- **depends:** T3
- **verify:** `npm test`
- **removes:** none
- **baseline:** suite green before change; README says Craft seeds and nothing auto-sends (~line 240)
- **rollback:** `git checkout -- README.md CLAUDE.md`
- **state-after:** working
- **notes:** Do not expand scope into suite skill rewrites. Lint: `npx tsc -p . --noEmit` if host Path B touched TS.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Name first, larger, required | T2 verify + DOM assertions |
| Goal under Name | T2 DOM order assertion |
| Save scope toggle next to Name | T2 DOM/CSS |
| Constraints removed | T2 unit (brief) + DOM absence |
| Canvas under Goal | T2 DOM order / CSS column |
| Craft stays open, auto-sends, working notification | T3 DOM (`send` posted, builder visible, banner) |
| On complete, proposed workflow editable on screen | T3 unit mapper + DOM apply simulation |
| `npm test` green | T4 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 7 (layout fields, scope UI, constraints, CSS layout, craft seed-only, name optional validate, brief/docs seed-only claims) | T2–T4 |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 3 (`parseWorkflowDetail`, ADR 0004, Claude no-builder) | — |

Net lines: expected modest + (craft state + mapper + tests) / − (constraints + segmented scope + seed-only close). Not net-silent-COEXIST: superseded Craft/layout paths are replaced.

## Open assumptions

Pointer — full ledger in `assumptions.md`:

- `UNVERIFIED` kebab name id; scope semantics; draft re-populate meaning; compact craft chrome OK; agentEnd success detection.
- T1 closes host message citation gap before Path A/B code.

## Approval

- [x] Human approved — 2026-08-03 (`[Plan approved]`)
