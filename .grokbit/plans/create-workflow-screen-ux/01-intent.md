# Intent — Create Workflow screen UX (layout + in-place Craft)

## Problem

The Create Workflow overlay works, but the form order and density feel wrong (Goal first, optional kebab Name, segmented Save scope, separate Constraints, canvas beside the form). Craft with AI also drops the user out of the builder into the composer with a seed they still have to send — and never brings a proposed workflow back into the builder for editing.

## Done criteria

Each item must be checkable by a human performing an observable action.

- [ ] Opening Create Workflow shows **Name** first, at a clearly larger input size than secondary fields; empty Name + valid Goal → Craft is blocked with a clear error that Name is required.
- [ ] **Goal** appears directly under the Name row.
- [ ] **Save scope** is a **toggle** (project vs user home) placed **on the same row as Name** (not a full-width segmented control below Goal).
- [ ] **Constraints** field is gone from the builder UI; constraints text is no longer a separate draft field (any limits live in Goal).
- [ ] **Pipeline canvas** sits **under Goal** in the main scroll column (not a side-by-side form|canvas pair as the primary layout).
- [ ] **Craft with AI** keeps the Create Workflow surface open (does not close the overlay and dump a seed only into the composer). It **sends** the craft brief without requiring a second Send click, and shows a clear **in-builder notification** that AI is working.
- [ ] When the craft turn **completes successfully**, the Create Workflow screen shows the **proposed workflow** in editable form (name / goal / scope / pipeline canvas populated or refreshed from the proposal) so the user can edit without leaving the screen.
- [ ] Existing happy-dom / pure-helper tests for builder open / validate / brief are updated and green; `npm test` stays green.

## Non-goals

- Claude Create Workflow tile / Claude builder (Grok-only remains).
- React Flow or freeform graph canvas (ADR 0004 vanilla stays).
- Implementing a full visual `.rhai` code editor or executing workflows in the extension.
- Rewriting the `/create-workflow` skill itself (CLI skill remains the author; extension remains thin client).
- Auto-saving canvas edits back to disk without a further Craft / agent turn (unless already written by the craft turn — no separate silent file writer).
- Changing Grokbit suite tiles, Actions filter, or history launcher.

## Constraints

- Stack / version limits: webview is plain `media/chat.js` + `media/chat.css` + pure helpers in `media/webview-helpers.js` (no new deps / no webview bundler) — `docs/adr/0004-workflow-builder-canvas.md`.
- Must not break: capability browser open builder path; Escape/dirty-close; Claude absence of builder; seed brief still based on draft graph when present.
- Must remain testable with vitest + happy-dom (no real `grok` binary in `npm test`).
- Permission / question cards must remain reachable if craft needs user input (full-screen modal cannot permanently cover chat for the whole agentic craft).

## Assumptions

Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` (product default) Name means the kebab workflow id (same as today’s optional field / `.rhai` stem), not a free-form display title.
- `UNVERIFIED` (product default) Save-scope toggle maps project = `.grok/workflows/` vs user = `~/.grok/workflows/` (same semantics as current Project / User home buttons).
- `UNVERIFIED` (product default) “Display proposed workflow for edit” means **re-populate the existing builder draft model + canvas**, not a second read-only preview pane.
- `UNVERIFIED` (product default) During craft, a compact non-blocking status on the Create Workflow surface is acceptable so chat permissions/questions stay usable; full modal form returns when craft ends.
- `UNVERIFIED` Successful craft is detected primarily from the session **turn end** (`agentEnd`) while a craft-session flag is set, then loading the written workflow (or a structured proposal) into the draft — not by scraping free-form prose alone.

## Questions asked

None. Layout and Craft behaviors are specified tightly enough that different answers would not change the plan’s task shape beyond the design options already compared in `03-design.md`.
