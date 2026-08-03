# Design — User Workflows display + Workflow Builder (form + visual canvas)

## Options considered

### Option A — Display polish only + composer goal seed

**Approach:** Title Case + green + multi-line `/create-workflow` seed. No builder surface.

**Trade-off:** Fast. **Fails** revised intent (form wizard + visual canvas in scope).

### Option B — Goal form wizard only (no canvas graph)

**Approach:** Overlay with goal/name/scope fields → Craft seeds structured prompt. No phase/agent graph.

**Trade-off:** Clear goal-first UX; weaker for “shape the pipeline before AI runs.” User asked for visual canvas **in scope**.

### Option C — Form + visual canvas; AI crafts script (thin handoff) — **chosen**

**Approach:**

1. **Display parity** for User Workflow tiles (Title Case + green).
2. **Create Workflow** opens a **Workflow Builder** overlay on the session tab (full width of the chat canvas).
3. **Form wizard** (left or top): Goal (required), optional name, scope (project `.grok/workflows` vs user `~/.grok/workflows`), constraints.
4. **Visual canvas** (main): pipeline of **phases**; each phase holds **agent cards** (label + capability mode hint). User add/rename/reorder/remove. Seed graph from goal (e.g. default “Plan → Do → Verify”) or empty + templates.
5. **Craft with AI**: pure function builds a structured brief from form + graph → seed composer (and optionally auto-send if product chooses). Agent uses create-workflow skill path to author/save Rhai. Extension does **not** run workflows.
6. **ADR 0004** decides canvas tech: **React Flow** (new React + bundler) vs **zero-dep vanilla** pipeline canvas. Implementation follows ADR; both candidates are in scope until ADR ships.

**Trade-off:** Larger than display-only; needs careful modularization and tests. Stays thin-client on execution. ADR may add deps if React Flow wins.

### Option D — Extension authors and executes Rhai itself

**Approach:** Full IDE for Rhai + run engine in host.

**Trade-off:** Violates thin-client architecture (`docs/architecture.md`); duplicates CLI. Rejected.

## Decision

**Chosen: Option C**

Rationale:

- Satisfies display parity **and** form wizard **and** visual canvas.
- AI still crafts agents/script via existing skill; builder captures **intent structure** users can see.
- React Flow is **in scope as a candidate** under mandatory ADR (E6 gate), not banned — product may pick it; vanilla remains if ADR rejects React cost for v1.
- Rejected A/B as incomplete; D as architecture break.

What rejected options were better at:

- **A** — minimal risk.
- **B** — less canvas complexity.
- **D** — offline authoring without agent (not desired).

## Shape of the change

### Wave 0 — ADR (blocking for canvas ship, not for display polish)

Write `docs/adr/0004-workflow-builder-canvas.md` covering:

| Topic | Content |
|---|---|
| Context | Goal-first Workflow Builder; visual phase/agent canvas required |
| Options | (1) Vanilla DOM/SVG pipeline canvas, zero deps (2) React Flow + React + webview esbuild/bundler (3) Other graph lib |
| Forces | package size, CSP, testability (happy-dom), maintainability of vanilla chat.js, time-to-ship |
| Decision | Explicit pick for **v1** |
| Consequences | Build scripts, CSP script/style, how tests mount canvas |

**Default recommendation if ADR is undecided at implement start:** vanilla pipeline canvas for v1 (no React), with React Flow as v1.1 if ADR later chooses — **unless** human gate picks React Flow now.

### Wave 1 — Display parity (ship independently)

Same as prior design:

- `capabilityDisplayLabel(kind, name)` — workflow kebab → Title Case; grokbit strip preserved.
- `capabilityInvokeLabel(invoke)` — first token of first line (chip-safe).
- CSS: green for `[data-kind="workflow"]` with grokbit.
- Tests update “Create Workflow”.

### Wave 2 — Builder shell + form wizard

**Entry:** Create Workflow tile → `openWorkflowBuilder()` (not bare invoke-only). Optional secondary “advanced: seed skill only” is YAGNI unless needed.

**DOM:** Overlay `#workflow-builder` (or panel region) with:

- Header: “Create Workflow” + Close
- Form fields: goal (textarea), name (optional kebab), scope (segmented project/user), constraints (optional)
- Actions: **Craft with AI**, Cancel
- Empty/error: goal required before Craft

**Pure model** in `webview-helpers.js` (or `media/workflow-builder-helpers.js` if size warrants):

```js
// conceptual
buildWorkflowCraftBrief({ goal, name, scope, constraints, phases }) → string
// phases: [{ title, agents: [{ label, capabilityMode }] }]
validateWorkflowBuilderDraft(draft) → { ok, errors }
defaultWorkflowGraphFromGoal(goal) → phases[]  // optional smart default
```

**Craft handoff:** brief includes goal, structure, save path convention, instruction to use create-workflow / author runnable workflow. Seeds via `insertComposerPrompt` / replace mode. Auto-send is a product flag (default: seed only).

**Claude v1:** either hide Builder entry (empty state only) or open form that produces a Claude-oriented brief (`.claude/workflows` + `export const meta`) — default **Grok-only open**, Claude unchanged unless gate says otherwise.

### Wave 3 — Visual canvas

**UX:**

- Horizontal or vertical **phase columns/rows** with connecting edges.
- Per phase: title edit, add agent card, drag reorder (or ↑↓ buttons for v1 a11y).
- Agent card: label, optional capability mode (`read-only` / `read-write` / `execute` / `all` matching skill host API).
- Templates: e.g. “Review → Verify”, “Explore → Implement → Test”.
- Canvas edits update the same draft model the form uses for Craft.

**Tech:** implement per ADR 0004.

**Tests:** pure model unit tests; DOM: open builder, fill goal, add phase, Craft seeds composer with structure text; locked when session busy if required.

### Wave 4 — Docs + roadmap honesty

- README / CLAUDE: Create Workflow opens builder; AI crafts; display labels.
- Update `docs/plans/grokbit-business-studio-3.0.md` E6 status to **in progress / superseded by user-workflows-display-builder** for Grokbit Workflows builder (not full Business Studio export).

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Raw kebab workflow labels | REPLACE | Title Case | view-model + tests |
| Green CSS grokbit-only | REPLACE | include workflow | CSS selector |
| Create = seed only | REPLACE | open Builder | `withCreateWorkflowTile` / row action for create synthetic item |
| E6 “canvas out of scope forever” for this product | REPLACE (roadmap status) | product in-scope | ADR + roadmap status note |
| DOM display expects `create-workflow` | REPLACE | Create Workflow | DOM tests |
| Host workflow `name` kebab | LEAVE | identity | display only |
| Suite label/green | LEAVE | already correct | no rewrite |
| CLI workflow runtime / `/workflows` dashboard | LEAVE | non-goal | — |
| React in webview today | COEXIST or REPLACE per ADR | if React Flow: introduce bundle path; if vanilla: leave stack | ADR obligation |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Empty goal + Craft | Inline validation; no seed |
| Close with dirty draft | Confirm discard |
| Session busy | Disable Craft or queue message; show locked |
| Craft then user never sends | Composer holds brief; no file until agent runs |
| Agent fails / no file written | Existing chat errors; builder can stay open with draft |
| Claude Create click | No builder (v1) or limited brief — per gate |
| React Flow ADR rejects deps | Ship vanilla canvas; React Flow remains future ADR amendment |
| Long goal/graph | Cap phases/agents (e.g. 12 phases / 8 agents) with UI notice |

## Migration

Schema: no DB. Optional: no persisted drafts v1 (session-memory only).  
Reversible: feature-flag not required if Create path is additive.  
ADR is the reversible tech decision record.

## New dependencies

| Package | When | Why |
|---|---|---|
| `react`, `react-dom`, `@xyflow/react` (React Flow) | **Only if ADR chooses React Flow** | Graph canvas |
| esbuild (or similar) webview bundle | **Only if React path** | webview cannot load JSX/npm without bundling |

Vanilla path: **zero** new runtime deps.
