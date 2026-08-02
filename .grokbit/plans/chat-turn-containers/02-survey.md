# Survey — Chat turn containers & clean final answers

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Messages scroll container | EXISTS | `media/chat.css:160-168` (`.messages` — `flex:1; overflow-y:auto; flex-direction:column`) |
| User message bubble | EXISTS | `media/chat.js:2649-2698` (`addMessage`); styles `media/chat.css:526-549` |
| Agent message bubble | EXISTS | `media/chat.js:3739-3756` (`appendAgent` → `addMessage("agent")`); `media/chat.css:550-554` |
| Activity carousel (live) | EXISTS | `media/chat.js:2909-3043` (`ensureActivityBlock` / `finalizeActivity` / `activityStep`); CSS `media/chat.css:1018+` |
| Activity pure helpers | EXISTS | `media/webview-helpers.js:1182+` (`activityPeek`, `activityPosText`); exported ~1210 |
| Compact-activity setting | EXISTS | default `true` in webview state `media/chat.js:232-236`; host `src/sidebar.ts:3581-3586`, `initialState` ~4220 |
| Finalize-on-complete (keeps summary) | EXISTS | `finalizeActivity` freezes multi-item to `.done` summary or unwraps single item — `media/chat.js:3011-3043`; `commitAgentTurn` calls it `media/chat.js:3790` |
| Turn-container / accordion stack | DOES NOT EXIST | no `.turn` / turn accordion; transcript is flat children of `#messages` |
| Sticky user prompt | DOES NOT EXIST | no `position: sticky` on user prompts; `.messages` is plain scroll (`media/chat.css:160-168`) |
| Long-user-message collapse only | EXISTS | `makeCollapsible` `media/chat.js:2615-2634`; CSS `media/chat.css:2556-2610` — collapses **prompt body height**, not prior Q&A turns |
| Interactive permission card | EXISTS | `media/chat.js` permission path ~4121+; tests `test/card-collapse-tasks.dom.test.ts`, `test/permission-card.dom.test.ts` |
| Plan / question cards | EXISTS | plan card + question card paths in `media/chat.js`; tests `plan-card.dom.test.ts`, `question-card.dom.test.ts` |
| Segment break (cards finalize activity) | EXISTS | comments + `finalizeActivity()` before cards/deliverables — e.g. `media/chat.js:3461-3462`, `4251-4252` |
| Session replay into `#messages` | EXISTS | replay handlers ~5279+ (`userMessageChunk`), `promptComplete` → `commitAgentTurn` ~5419 |
| Primer-only restore welcome | EXISTS | `appendUserChunk` avoids `clearWelcome` on suppressed primer — `media/chat.js:3809-3813`; test `test/primer-only-restore.dom.test.ts` |
| Webview test harness | EXISTS | `test/webview-harness.ts` + many `*.dom.test.ts` |
| Activity carousel tests | EXISTS | `test/activity-carousel.dom.test.ts` (asserts freeze-to-summary + unwrap) |
| Tool summary / classic mode tests | EXISTS | `test/tool-summary.dom.test.ts` |
| Layout ADR | EXISTS | `docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md` |
| Host ACP / session store | EXISTS | not primary for this UI change; buffer delivery `src/panel-router.ts` (not opened this pass — webview-only layout) |

## Reusable code

Things that already do part of this job. Highest-value section.

- **Activity carousel strip chrome** — `ensureActivityBlock` / `renderActivityStrip` / `activityStep` (`media/chat.js:2929-3005`) — already implements single-line live label + peek nav + expand body. Closest existing building block for DC2.
- **`activityPeek` / `activityPosText`** — `media/webview-helpers.js:1182+` — pure, unit-tested (`test/webview-helpers.test.ts:611+`). Keep for live strip.
- **`summarizeTools` / tool categorization** — `media/chat.js:2793+` area — used for live labels; less relevant if done-state strip is removed.
- **`commitAgentTurn` boundary** — `media/chat.js:3773-3796` — the natural moment to tear down intermediate activity and seal the final answer (DC3/DC4).
- **`userMessage` / `appendUserChunk` boundaries** — `media/chat.js:3800+`, case `"userMessage"` ~5230 — natural moment to collapse the previous turn (DC5).
- **`makeCollapsible` pattern** — expand/collapse affordance + CSS classes (`media/chat.js:2615-2634`, `media/chat.css:2556+`) — UI idiom only; semantics are different from turn accordion but may inspire chevron/header styling.
- **Card segment-break discipline** — interactive cards call `finalizeActivity()` so they land outside the carousel (`media/chat.js:4251-4252` and siblings) — must be preserved or re-homed under the active turn without burying unresolved cards.
- **DOM test harness** — `bootWebview` / `dispatch` / `click` in `test/webview-harness.ts` — how all chat DOM contracts are proven today.
- **`transcript()` helper pattern** — `test/activity-carousel.dom.test.ts:19-20` filters `#messages` children excluding `#welcome` — will need updating if structure becomes nested turns.

## Supersession

What this change replaces, duplicates, or makes dead. Caller counts capped where noted.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| `finalizeActivity` “freeze to `.done` summary” | `media/chat.js:3011-3043` | Many call sites via `commitAgentTurn`, card/deliverable boundaries, `agentReset` (grep: `finalizeActivity` ≥20 in `media/chat.js`) | DC3/DC4: intermediate work must **disappear**, not remain as a permanent summary row |
| Single-item unwrap leaving bare tool-group in transcript | `media/chat.js:3019-3024`; asserted `test/activity-carousel.dom.test.ts:131-140` | Same finalize path | Leaves permanent tool rows after turn end — conflicts with DC4 |
| Flat `#messages` child stream as sole layout model | `addMessage` appends to `messagesEl` `media/chat.js:2691`; activity appends `2965` | Entire chat render path | Needs turn wrappers for sticky prompt + collapse stack (DC1, DC5, DC6) |
| Activity-carousel tests expecting permanent `.done` / unwrapped tool groups | `test/activity-carousel.dom.test.ts:107-151` and related | Test suite only | Encode the old product contract; must be rewritten for ephemeral activity |
| Long-message `makeCollapsible` as “collapse” story | `media/chat.js:2615-2696` | User messages only | Different problem (overflow of one bubble). Not the multi-turn accordion; risk of two competing collapse UIs if both stay unlabeled |

## Prior attempts

- **`grok.compactActivity` carousel (default on)** — live product path; freezes work into one summary row per segment rather than deleting it. This request **evolves past** that freeze model; live strip is the prior attempt to re-use, not abandon wholesale.
- **Classic mode (`compactActivity: false`)** — full interleaved tool stream; tests in `activity-carousel.dom.test.ts:278+`, `tool-summary.dom.test.ts:240+`. Escape hatch, not the primary path.
- **`makeCollapsible` on long user prompts** — only height-clamps a single user bubble; not multi-turn Q&A accordion.
- No abandoned `.turn` / accordion prototype found in `media/` or `test/` (search terms: turn container, accordion transcript — only unrelated “collapse” for cards/tools/launcher).

## Conventions

- **UI logic in webview, pure policy in helpers:** complex DOM in `media/chat.js`; pure functions in `media/webview-helpers.js` with vitest unit tests — e.g. `activityPeek` (`webview-helpers.js:1182`, `webview-helpers.test.ts:611`).
- **DOM behavior proven by happy-dom tests driving real `chat.js`:** `test/activity-carousel.dom.test.ts:1-9`, harness `test/webview-harness.ts`.
- **Settings broadcast pattern:** host reads config, posts `initialState` + live `compactActivity` message (`src/sidebar.ts:3581-3586`, `media/chat.js:5044-5048`).
- **Segment boundaries:** interactive cards and deliverables call `finalizeActivity()` then append to `messagesEl` so chronology stays append-only (`media/chat.js:4251-4252` pattern).
- **Layout:** no `@media` under `zoom` — ADR 0002 (`docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md:62-69`).
- **Tests:** Vitest; `npm test` is the suite (`package.json` scripts; AGENTS.md project test commands).
- **Errors / failures:** tool failures tint rows / carousel (`media/chat.js` ~3453-3455); turn still commits via `promptComplete`.

## Absences

- No turn-level data model in the webview (`state` has `activeActivityEl` but no `activeTurnEl` / turn stack) — `media/chat.js:100-237`.
- No sticky pin for prompts.
- No product setting for “discard intermediate activity after answer” (behavior is currently “freeze summary”).
- No host change required for the pure-DOM approach (absence of server-side turn grouping is fine if replay reconstructs from message stream).

## Danger zones

- **`media/chat.js`** — very large, many intertwined render paths (tools, cards, replay, primer suppress). High blast radius; any turn-wrapper must thread live + replay + `clearWelcome` + `resetForNewSession`.
- **`finalizeActivity` call graph** — ≥20 call sites; changing semantics from “freeze” to “destroy intermediate” can orphan late `toolCallUpdate` attachments (tests explicitly cover late updates: `activity-carousel.dom.test.ts:154-175`).
- **Permission / plan / question ordering tests** — `test/card-collapse-tasks.dom.test.ts` assumes cards land in transcript relative to turns; nesting under `.turn` can break selectors.
- **Replay + primer suppress** — `appendUserChunk` / `suppressReplayTurn` (`media/chat.js:3811-3822`); wrong turn wrapping can break primer-only welcome (`test/primer-only-restore.dom.test.ts`).
- **`retainContextWhenHidden:false` replay** — full buffer replay must produce identical turn structure or users see layout jump on tab reveal (CLAUDE.md session pool; not re-opened this pass).
- **ADR 0002 / chat-layout tests** — `test/chat-layout.dom.test.ts` guards canvas width; sticky headers must not reintroduce a centered ribbon.
