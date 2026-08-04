# Intent — Workflow details inspector + per-agent prompt editing

## Problem
Workflows in Grokbit Actions are opaque tiles. A user can click one to seed the composer, or build a new one in the Workflow Builder, but there is no way to look *inside* an existing workflow: which agents it runs, in what phases, with what settings, and what each agent is actually told to do. The user wants a "details" affordance on a workflow that reveals all of its agents — settings and prompt — in an expandable/collapsible view, wants advice on whether workflows are the right surface to invest in (vs. some other "run multiple workflows" feature), and would like to be able to change a single agent by typing a natural-language prompt aimed at that agent, instead of regenerating the whole workflow.

## Done criteria
Each item checkable by a human performing an observable action.

- [ ] On a User Workflow tile (Grok `.rhai` or Claude `.js`), the user can open a Details view without anything being sent to the agent and without the workflow being executed.
- [ ] The Details view shows the workflow's name, description, and phases, and lists every agent call found in the script; each agent entry expands/collapses to reveal its prompt text and its settings (label, phase, model, effort, schema presence — whatever the file actually declares).
- [ ] Both workflow formats render details from a pure parse — the extension never executes `.rhai`/`.js` workflow scripts.
- [ ] A workflow whose script cannot be parsed into agents still shows an honest degraded view (name/description + "couldn't read the agent list") rather than an error or a blank pane.
- [ ] From an agent entry, the user can type an instruction describing a change to that agent and trigger the change through a defined mechanism (design decides: direct file edit vs. seeding the CLI agent with a precise edit brief).
- [ ] Bundled Grokbit suite tiles (`grokbit-explore`…`grokbit-ship`) have a defined, deliberate Details behavior (show the skill's pipeline summary, or no Details affordance) — not an accidental broken click.
- [ ] The plan's design section answers the strategic question — "are workflows the best place to start, or is there a better multi-workflow surface?" — with a concrete recommendation grounded in what Claude Code, Grok Build, and this extension can each actually do.

## Non-goals
- No workflow *execution* UI (live run monitoring, progress trees, run history) — runs still happen in the CLI chat; that is advice-level material, not this change.
- No cross-format transpile: a Grok workflow stays Rhai, a Claude workflow stays JS.
- No freeform graph editor — ADR 0004 chose the vanilla linear phase canvas; React Flow remains research.
- No editing of the bundled suite skills' content (they are extension-owned, rewritten on version change).
- No MCP server / plugin / persona enumeration.
- No new settings unless the design shows one is unavoidable.

## Constraints
- Stack / version limits: pure-logic modules stay framework-free; webview code is vanilla JS in `media/`; no `@media` queries in `chat.css`; `min(100%, …)` clamps wherever a track/basis has a pixel floor.
- Must not break: the 1336+ grok-free test floor; seed-only composer contract (nothing auto-sends); `CAPABILITY_VISIBLE_KINDS` scope rules; existing Workflow Builder and Craft-with-AI flows.
- Security: workflow files are untrusted repo content — parse only, bounded reads, no execution, no `eval`.
- Sequencing: plan only — no source edits until human approval.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` "Workflows" means the tiles in Grokbit Actions — agent-level detail applies to User Workflows (`kind: "workflow"`), the only kind that *contains* agents; suite tiles are skills and get the defined-behavior treatment instead.
- `UNVERIFIED` The "another feature where you run multiple workflows" question is answered as a recommendation in the design/gate, not committed as buildable scope in this plan.
- `UNVERIFIED` Per-agent change-by-prompt may deviate from the strict seed-only precedent (ADR 0004) only if the design explicitly justifies direct file writes; otherwise it composes an edit brief and seeds the composer. The choice is presented at the gate.
- `UNVERIFIED` The Details view lives inside the existing chat webview (overlay/panel idiom like the Workflow Builder), not a separate native editor tab.

## Questions asked
None — all material decisions were inferable from the repo (ADR 0004, Actions scope rules, existing Builder) and are recorded above as assumptions for the gate.
