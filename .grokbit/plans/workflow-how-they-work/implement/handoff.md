# Implement handoff — workflow-how-they-work

## Completed
- T1 — five `how-it-works.md` guides (required H2s)
- T2 — pure path helpers + `hasDetail`/`detailPath` on suite items
- T3 — lazy `getCapabilityDetail` (allowlisted suite names, extension bundle only)
- T4 — Actions Details in-panel + safe `renderMarkdown` + Open in editor
- T5 — `docs/grokbit-workflows.md`, README link, WORKFLOW banner, suite README links
- T6 — `npm test` **1419** passed

Commits: deferred (CLAUDE.md no auto-commit)

## Blocked
(none)

## Surface changed
Files: guides under `resources/skills/*/references/how-it-works.md`, `src/skill-suite.ts`, `src/capabilities.ts`, `src/sidebar.ts`, `media/chat.js`, `media/chat.css`, `media/webview-helpers.js`, `docs/grokbit-workflows.md`, `docs/WORKFLOW.md`, `README.md`, `resources/skills/README.md`, tests listed above.

Endpoints: none  
Schema: none  
UI views: Grokbit Actions tiles (Details expand)  
Dependencies added: none

## Look here hard
- Details only appears when extension bundle has how-it-works files (dev workspace / packaged vsix). After rebuild, re-provision copies guides to home tier as part of skill dirs.
- `hasDetail` is data-driven; renderer does not branch on `kind`.
- Markdown detail uses `renderMarkdown` (escapes HTML in inline path).

## Deviations
See `deviations.md` — 0 counting; dirty-tree and commit deferred waivers only.

## Dirty-tree snapshot
| Kind | Identity | Restored at handoff? |
|---|---|---|
| none | — | n/a |

## Baseline reference
Captured: `test/baseline.md`

## hand_back_cycle
0
