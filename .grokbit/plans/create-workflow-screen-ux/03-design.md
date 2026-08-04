# Design — Create Workflow screen UX

## Options considered

### Option A — Layout polish only + Craft auto-send into composer while builder stays open (no result round-trip)

Approach: Reorder fields (Name required + large, Goal, scope toggle, drop Constraints, canvas under Goal). Craft validates, calls `submitMessage(brief)` without closing, shows a static “Working…” banner, but does **not** re-apply AI output into the draft; user still reads the transcript (under or after close) for the written workflow.

Trade-off: Meets layout + “no second Send” cheaply, but fails done-criteria “display proposed workflow on Create Workflow screen for edit.” Also leaves full-screen modal over chat during agentic craft (permission risk).

### Option B — In-place Craft session with compact status + apply proposal into builder draft (chosen)

Approach:

1. **Layout** — single column body: Name row (large required input + scope switch) → Goal → Pipeline canvas; remove Constraints from draft/UI/brief.
2. **Craft** — validate (goal + name required); set `workflowBuilderCraft = { status: "working", expectedName, scope, startedAt }`; show in-builder notification; **auto-send** brief via existing `submitMessage` (do **not** require composer Send); **do not** `closeWorkflowBuilder`.
3. **During craft** — demote full-screen modal to a **compact crafting chrome** (status banner + optional “Show full form” / keep Cancel) so messages/permission cards remain interactive (`agentEnd`/`setBusy` already drive busy). Full form remains the same DOM root (`#workflow-builder`) with a mode class, not a second surface.
4. **On success** — when craft session is active and turn ends with success (`agentEnd` while craft working; not `agentError`/`exit`):
   - Prefer **host/detail path**: resolve expected path under project or user workflow root for `{name}.rhai`, reuse `parseWorkflowDetail` (or existing detail message path), pure **`workflowDetailToBuilderDraft(detail, priorDraft)`** maps name + phases/agents into editable draft; fill goal from prior draft (file meta description may replace description-like fields if present).
   - Fallback if file not yet visible: keep status “Still finishing…” one more turn **or** show soft error “Workflow not found on disk yet — Refresh or edit Goal and Craft again” without closing.
5. **Re-render** full builder in edit mode with applied draft; clear craft working status; mark baseline so dirty tracking restarts after apply.
6. **Brief** — drop Constraints section; require name in brief; still include pipeline structure; keep pure helper (auto-send is the button’s job, not the brief builder’s).

Trade-off: More webview state + a thin host or webview file resolve path; reverse map is lossy vs full Rhai. Correctly meets “stay on screen + notify + edit proposal.”

### Option C — Structured JSON proposal in agent final answer only (no disk read)

Approach: Change brief to demand a fenced `workflow-builder-draft` JSON block; webview scrapes last agent message on `agentEnd` and applies to draft; file write optional/skill-side.

Trade-off: No filesystem dependency and works even if skill does not write; fragile against model format drift; harder to unit-test without inventing agent message fixtures; diverges from thin-client “skill writes the real artifact” story.

## Decision

**Chosen: B**

Rationale against constraints:

- Layout items 1–5 are pure UI/CSS/helper validation — zero new deps (ADR 0004 preserved).
- Auto-send reuses `submitMessage` (`media/chat.js:5986–6010`) instead of inventing a second transport.
- Result-for-edit reuses `parseWorkflowDetail` + existing workflow roots rather than a free-form prose scrape (Option C).
- Compact craft chrome addresses the full-screen permission trap (survey danger zone) without abandoning “stay on Create Workflow screen.”

What the rejected options were better at:

- **A** — smaller diff, fewer failure modes.
- **C** — works before a file hits disk; better if skill only “proposes.”

## Shape of the change

### Draft model

- Keep `{ goal, name, scope, phases }`.
- **Remove** `constraints` from open default, dirty baseline, validate, brief, and render (`media/chat.js:1149–1158`, `media/webview-helpers.js:1041–1116`).

### Validation (`validateWorkflowBuilderDraft`)

- Goal required (unchanged).
- **Name required** (non-empty after trim) **and** kebab-case `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (today format only when non-empty — `media/webview-helpers.js:1046–1049`).

### Layout (`renderWorkflowBuilder` + CSS)

- Body column (stack), not form|canvas side-by-side primary:
  1. **Name row**: large `input[data-wf-name]` + scope toggle (`.popover-switch` or compact switch labeled “Project” / “User home”).
  2. Goal textarea under name row.
  3. Canvas under goal (same phase/agent controls).
- Focus on open: **name** field first (today focuses goal — `media/chat.js:1189–1190`).

### Craft session

```
Craft click
  → validate
  → craftState = working
  → render compact “AI is creating your workflow…” notification
  → submitMessage(buildWorkflowCraftBrief(draft))  // auto-send
  → on agentError/exit: craftState = failed + message; restore full form
  → on agentEnd while craftState=working:
        resolve {scope}/{name}.rhai via allowed roots / listCapabilities+detail
        → apply workflowDetailToBuilderDraft
        → craftState = idle; full form with editable proposal
```

### Pure helpers (new)

- `workflowDetailToBuilderDraft(detail, prior)` → `{ name, goal?, scope?, phases: [{ title, agents: [{ label, capabilityMode }] }] }`
  - Group agents by `inferredPhase` / explicit phase; default capabilityMode `read-only` when unknown.
  - Preserve prior.goal / prior.scope when detail lacks them.
- Optionally `expectedWorkflowRelativePath(name, scope)` for tests.

### Host surface

Minimal change preferred:

- **Path A (prefer):** webview posts existing `listCapabilities` / `workflowDetail` (or whatever message Details already uses) after `agentEnd` to load the new file — no new host API if detail path already exists for User Workflow Details.
- **Path B (if detail only works for listed tiles):** add a narrow `readWorkflowDraft { name, scope }` host handler that uses `workflowDetailRoots` + `parseWorkflowDetail` and posts `{ type: "workflowCraftResult", ok, draft|error }` — still no Rhai execution.

Survey: detail plumbing lives in `src/workflow-inspect.ts` + sidebar; implement must cite the exact message names when coding (open the Details path in implement preflight if not already memorized).

### Tests

- Unit: name required; no constraints in brief; `workflowDetailToBuilderDraft` grouping.
- DOM: layout markers (name before goal; no Constraints label); Craft posts `send` and leaves builder visible; craft banner present; simulated `agentEnd` + craft result applies phases.
- Update `test/capabilities.dom.test.ts:228–250` (current “seeds without auto-send” + `builder.hidden === true`).

### Docs

- README / CLAUDE one-liners that still say “seeds… nothing auto-sends” must flip for Craft (`README.md` ~240, `CLAUDE.md` Grokbit Actions paragraph).

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Goal-first order + optional Name | REPLACE | Intent name-first required | Rewrite `renderWorkflowBuilder` field order + validate |
| Segmented Save scope buttons | REPLACE | Toggle beside name | New switch UI; remove `.wf-builder-scope` button pair or repurpose CSS |
| Constraints field + draft.constraints | REPLACE | Goal holds limits | Remove UI + draft field + brief section; update tests |
| Side-by-side form\|canvas CSS | REPLACE | Canvas under Goal | Column layout CSS; keep phase cards |
| Craft close + seed-only | REPLACE | In-place auto-send + apply | New craft session; rewrite DOM test + docs |
| Name optional validate | REPLACE | Name required | Helper + unit tests |
| Brief “never auto-sends” comment | REPLACE | Button auto-sends; helper stays pure | Comment reflects pure brief only |
| `parseWorkflowDetail` | LEAVE | Reused for apply path | No change to parser contract unless bug |
| ADR 0004 vanilla canvas | LEAVE | Still binding | No React Flow |
| Claude no-builder rule | LEAVE | Out of scope | Keep `openWorkflowBuilder` Grok-only |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Empty/invalid name or goal on Craft | Show errors; no send; stay on form |
| Session already busy | Queue via existing `submitMessage` mid-busy behavior **or** disable Craft with “Wait for the current turn to finish” — prefer disable Craft while `state.busy && !craftState.working` to avoid nested craft |
| Craft turn errors (`agentError`/`exit`) | Banner error; restore full form; draft kept |
| File not found after agentEnd | Soft failure message; keep draft; user can Craft again |
| Lossy parse (opaque agents) | Apply what is readable; note in banner if counts show opaque/overflow |
| User hits Escape during craft | Confirm cancel craft? Prefer: Escape cancels craft UI but does not cancel agent (Stop in composer still available) — document in notes |
| Permission request mid-craft | Compact chrome so chat cards remain clickable |
| Dirty form + Close during craft | Confirm discard; craft flag cleared; agent may still finish in background (user sees transcript) |

## Migration

Schema change: no  
Reversible: yes (git revert)  
Existing rows: n/a  
Mixed-version window: n/a (extension webview only)

## New dependencies

None.
