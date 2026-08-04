# Assumptions — Create Workflow screen UX

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake

- `UNVERIFIED` Name means kebab workflow id (`.rhai` stem), not a free-form display title.
- `UNVERIFIED` Save-scope toggle = project (`.grok/workflows/`) vs user (`~/.grok/workflows/`) — same as current buttons.
- `UNVERIFIED` “Display proposed workflow for edit” = re-populate builder draft + canvas (not a separate preview-only pane).
- `UNVERIFIED` Compact non-blocking craft chrome during agent work is acceptable so permissions remain usable.
- `UNVERIFIED` Success detection = craft flag + `agentEnd` (then load written workflow / detail), not prose-only scrape.

## From grounding (Loop 2)

- None unresolved. Exact sidebar postMessage names for workflow **detail** load were module-confirmed (`src/workflow-inspect.ts`, `src/sidebar.ts` import) but not line-cited for the webview message type — Plan T1 closes that before apply-path code.

## From adversarial review (Loop 3)

- None outstanding after Round 2.

## From verifiability (Loop 4)

- None.

## Resolution

Intake `UNVERIFIED` items are product defaults; human may override at the gate. T1 removes the host-message citation gap before implement writes craft-result wiring.
