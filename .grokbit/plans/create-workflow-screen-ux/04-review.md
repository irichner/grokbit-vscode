# Review log — Create Workflow screen UX

Append-only. Never overwrite a previous round.

## Round 1

Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[BLOCKER]` Full-screen builder left open during multi-turn craft would cover permission/question cards (`#workflow-builder` `z-index:40`, `media/chat.css:2123–2132`) — evidence: survey danger zones — resolves by: design must demote modal during craft (Option B compact chrome), not only “stay open.”
- `[MAJOR]` Done-criterion “display proposed workflow” had no grounded apply path — scraping prose is fragile; resolves by: Option B + `parseWorkflowDetail` / detail message + pure `workflowDetailToBuilderDraft`.
- `[MAJOR]` Auto-send while busy / nested craft not specified — resolves by: disable Craft when busy unless already in craft working state; rely on single-flight agent turns.
- `[MINOR]` Escape-during-craft policy underspecified — resolves by: unhappy path table entry.
- `[MINOR]` README/CLAUDE seed-only copy will go stale — resolves by: disposition + plan task for docs.

### Architect response — Round 1

- `[BLOCKER]` Full-screen cover → **REVISED**: Option B explicitly demotes to compact crafting chrome so chat remains interactive; full form returns on complete/fail (`03-design.md` Shape § Craft session).
- `[MAJOR]` Apply path → **REVISED**: Prefer detail/`parseWorkflowDetail` mapper; Option C demoted to rejected; fallback when file missing documented.
- `[MAJOR]` Busy nesting → **REVISED**: Unhappy paths table — disable Craft when busy (non-craft).
- `[MINOR]` Escape → **REVISED**: Unhappy paths row added.
- `[MINOR]` Docs → **ACCEPTED**: docs task in plan.

## Round 2

Reviewed: revised `03-design.md`

- `[MAJOR]` Host message names for workflow detail not cited at `path:line` in survey (only module-level existence) — implement could invent a wrong message type — resolves by: either ground exact message in survey or plan a first implement preflight task that opens sidebar detail handler before coding Path A/B.
- `[MINOR]` Lossy Rhai→canvas may disappoint users who expect exact script edit — already non-goal of full code editor; ensure banner honesty.

### Architect response — Round 2

- `[MAJOR]` Host message names → **REVISED**: Plan T1 is a grounding spike (read-only citations into implement notes / extend survey if needed) before layout/craft code; design Path A vs B stays, but no invented API without open-file proof.
- `[MINOR]` Lossy map → **REVISED**: Unhappy path already notes opaque agents; done-criteria language is “proposed workflow” editable draft, not byte-identical Rhai editor.

## Outcome

Rounds used: 2 of 3  
Outstanding at exit: none blocking. Residual product defaults stay in `assumptions.md` as `UNVERIFIED` intake items (kebab name meaning, compact chrome OK, turn-end detection).

## Plan review (Loop 4)

One pass, after Decompose — checks the task list against the design, not the design decision again.  
Reviewed: `plan.md`

- `[MAJOR]` Without a host-grounding task, T3 craft apply might invent `readWorkflowDraft` — resolves by: T1 read-only path discovery with verify that cites real message type or documents Path B add.
- `[MINOR]` Docs-only task should not claim visual done-criteria alone.

### Architect response

- `[MAJOR]` → **REVISED**: T1 added; T3 depends on T1; verify for T1 is grep/read of real handlers.
- `[MINOR]` → **REVISED**: Docs task maps only to copy accuracy criterion; UI criteria map to T2–T4.

Outcome: revised, clean for gate.
