# L6 Webview UI (product + WIP overlay)

## Reviewed

- `media/chat.js` — markdown renderer (`:1961+`), collapse (`:3308+`), workflow builder (`:934+`), capability rows, escapeHtml
- `media/chat.css` — builder + collapsible (diff region)
- `media/webview-helpers.js` — collapse pure, builder pure, capability view model
- `media/launcher.js` — via test suite (37 tests) + known full-rebuild limit
- DOM tests: user-prompt-collapse, capabilities (builder craft), webview-ui (106)

## Sampling (DC9)

- chat.js **6947** lines: deep markdown/XSS, builder, collapse, capability row actions; sampled tool carousel / permission cards via tests rather than full re-read.

## Findings

### [Major] Markdown `javascript:` links (see L1)

- Same as L1; webview is the sink.

### [Major] Workflow Builder: no Escape / focus trap

- **Where:** `openWorkflowBuilder` / `renderWorkflowBuilder` `media/chat.js:971+`; no `keydown` Escape handler (repo grep: Escape only history/slash).
- **Why:** UI design standards blocker risk (keyboard, dialog pattern). `role="dialog"` without Escape or `aria-modal` focus management.
- **Fix:** Trap focus in overlay; Escape → same as Close (with dirty confirm); restore focus to Create tile.

### [Minor] Full `innerHTML` rebuild of builder on every keystroke-driven re-render for scope/phase moves

- **Where:** `renderWorkflowBuilder` clears `innerHTML` (`:1005`).
- **Why:** Loses focus on some interactions; goal field uses oninput without full re-render (good), but phase ops re-render all.
- **Fix:** Prefer targeted DOM updates or restore focus by data attribute after re-render.

### [Minor] Dirty confirm uses `window.confirm`

- **Where:** `closeWorkflowBuilder` `:949-955`.
- **Why:** Works; not themeable; acceptable for v1.
- **Fix:** Optional VS Code-style modal later.

## Clean / solid

- Craft is seed-only (`insertComposerPrompt` + no auto-send) — tested.
- Claude has no Create Workflow builder tile — tested.
- Collapse pure criterion + live/replay wire + CSS line-clamp — tested (1529 suite).
- User/agent markdown escapes `&<>` before inline formatting (`:2016-2017`).
- Capability synthetic Create tile uses `openWorkflowBuilder` flag (`webview-helpers.js:825`).
