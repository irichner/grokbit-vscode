# Survey — Create Workflow screen UX

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Workflow Builder overlay open/close | EXISTS | `media/chat.js:1117–1191` (`closeWorkflowBuilder`, `openWorkflowBuilder`) |
| Builder form render (Goal, Name, Scope, Constraints, canvas, Craft) | EXISTS | `media/chat.js:1193–1433` (`renderWorkflowBuilder`) |
| Draft model `{ goal, name, scope, constraints, phases }` | EXISTS | `media/chat.js:1149–1158` |
| Pure validate helper | EXISTS | `media/webview-helpers.js:1041–1062` (`validateWorkflowBuilderDraft`) — **goal required; name optional format-only** |
| Pure craft brief builder | EXISTS | `media/webview-helpers.js:1069–1116` (`buildWorkflowCraftBrief`) — documents **seed-only; never auto-sends** |
| Default phase graph | EXISTS | `media/webview-helpers.js:1019–1035` (`defaultWorkflowGraphFromGoal`) |
| Synthetic Create Workflow tile | EXISTS | `media/webview-helpers.js:829–847` (`withCreateWorkflowTile`, `openWorkflowBuilder: true`) |
| Tile → open builder | EXISTS | `media/chat.js:941–945` |
| Composer seed helper | EXISTS | `media/chat.js:3374–3384` (`insertComposerPrompt`) |
| Auto-send / submit path | EXISTS | `media/chat.js:5986–6010` (`submitMessage` → `{ type: "send", text, chips }`) |
| Turn complete busy clear | EXISTS | `media/chat.js:6773–6779` (`agentEnd` → `state.busy = false`) |
| Host send message type | EXISTS | `src/sidebar.ts:156` |
| Builder CSS (side-by-side form + canvas) | EXISTS | `media/chat.css:2123–2238` (`#workflow-builder`, `.wf-builder-body` flex wrap, form vs canvas) |
| Existing switch control pattern | EXISTS | `media/chat.js:774–788` / CSS `media/chat.css:195–217` (`.popover-switch`) |
| Workflow deep parse (file → agents/phases) | EXISTS | `src/workflow-inspect.ts:521–563` (`parseWorkflowDetail`) |
| Workflow detail host path | EXISTS | `src/workflow-inspect.ts` + `src/sidebar.ts` workflow detail roots usage (`workflowDetailRoots` import ~144) |
| DOM tests: open builder, Craft seed-only | EXISTS | `test/capabilities.dom.test.ts:208–250` |
| Pure unit tests: validate + brief | EXISTS | `test/webview-helpers.test.ts:1044–1062` |
| ADR vanilla canvas | EXISTS | `docs/adr/0004-workflow-builder-canvas.md` |
| In-builder “AI working” notification / craft session flag | DOES NOT EXIST | searched: `workflowBuilder`, `Craft with AI`, `craft` in `media/chat.js` — Craft closes overlay and seeds only (`media/chat.js:1410–1429`) |
| Draft ← workflow detail mapper | DOES NOT EXIST | no `workflowDetailToBuilderDraft` / reverse of canvas in helpers |
| Constraints-free layout | DOES NOT EXIST | Constraints field still rendered `media/chat.js:1263–1267` |

## Reusable code

- `validateWorkflowBuilderDraft` / `buildWorkflowCraftBrief` / `defaultWorkflowGraphFromGoal` — pure helpers in `media/webview-helpers.js:1010–1116`; export list includes them `media/webview-helpers.js:1672`.
- `submitMessage` — already posts send and clears composer `media/chat.js:5986–6010`; can be called from Craft without user Send.
- `insertComposerPrompt` — only needed if we still want a visible seed; current Craft uses it then closes `media/chat.js:1423–1429`.
- `.popover-switch` — existing toggle chrome for Save scope `media/chat.css:195–217`, `media/chat.js:774–788`.
- `parseWorkflowDetail` — maps saved `.rhai` text → `name`, `phases`, `agents` with inferred phases `src/workflow-inspect.ts:521–563`; host already serves workflow detail for the Details inspector.
- Capability refresh pattern — `listCapabilities` re-scan used after disk writes (`buildCapabilitiesRefreshButton` comment `media/chat.js:1443–1445`).
- DOM test harness `bootWebview` / `sendCapabilities` / `click` in `test/capabilities.dom.test.ts` (builder cases ~208–272).

## Supersession

What this change replaces, duplicates, or makes dead. Caller counts from this session’s reads/greps (not exhaustive AST).

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Goal-first field order + optional Name label | `media/chat.js:1234–1247` | 1 render path | Intent: Name first, larger, required |
| Segmented Project/User scope buttons | `media/chat.js:1248–1261` | 1 render path | Intent: toggle next to Name |
| Constraints textarea + draft.constraints | `media/chat.js:1153,1263–1267`; brief `media/webview-helpers.js:1074,1091–1093` | builder + brief | Intent: constraints live in Goal |
| Side-by-side form \| canvas layout | `media/chat.css:2148–2212` | CSS + body append order `media/chat.js:1269–1398` | Intent: canvas under Goal |
| Craft: close + seed composer, no send | `media/chat.js:1410–1429`; tests `test/capabilities.dom.test.ts:228–250` | 1 craft handler + 1 DOM test + README/CLAUDE copy | Intent: stay open, auto-send, notify, apply result |
| `validateWorkflowBuilderDraft` name optional | `media/webview-helpers.js:1046–1049` | unit tests `test/webview-helpers.test.ts:1045–1048` | Intent: name required |
| Brief comment “seed-only; never auto-sends” | `media/webview-helpers.js:1065–1066` | docs/tests | Behavior flips for Craft button (brief helper may stay pure) |

## Prior attempts

- `user-workflows-display-builder` plan (`.grokbit/plans/user-workflows-display-builder/plan.md`) shipped the current builder: goal-first form, Craft seeds composer without auto-send (T4 notes).
- ADR 0004 chose vanilla pipeline canvas (no React Flow) — still binding.
- No prior plan for in-place craft result round-trip into the builder.

## Conventions

- **Errors:** form validation via pure helper → show `.wf-builder-errors` string join `media/chat.js:1411–1420`.
- **Tests:** vitest + happy-dom driving real `media/chat.js`; pure logic in `test/webview-helpers.test.ts`; DOM builder cases live in `test/capabilities.dom.test.ts` (not a separate `workflow-builder.dom.test.ts` yet).
- **State:** module-level `workflowBuilderDraft` / `workflowBuilderBaseline` in `media/chat.js:1079–1083`; dirty = JSON stringify compare `media/chat.js:1095–1098`.
- **Layout:** full-screen fixed overlay `position:fixed; inset:0; z-index:40` `media/chat.css:2123–2132`.
- **Thin client:** AI authors via CLI skill; extension seeds/sends prompts and inspects files — does not execute Rhai.

## Absences

- No craft-in-progress flag or in-builder status banner.
- No pure mapper from `WorkflowDetail` / agent list → builder `phases[]`.
- No host message type dedicated to “craft finished” (could be webview-only on `agentEnd` + optional detail fetch).
- No headless browser visual regression in CI (DOM tests only).

## Danger zones

- `media/chat.js` — large webview; builder + send + message switch live here; easy to break permission cards if full-screen overlay stays up for whole multi-turn craft (`z-index:40` covers chat).
- `submitMessage` while overlay open still drives normal chat transcript underneath — expected for craft, but UX must not trap permissions under the modal.
- `parseWorkflowDetail` is best-effort (opaque/dynamic agents) — reverse-mapping to canvas will be lossy; plan must not claim perfect Rhai round-trip.
- Capability / workflow paths: reading written scripts must reuse existing containment (`workflow-inspect` / allowed roots), never open arbitrary paths from agent prose.
