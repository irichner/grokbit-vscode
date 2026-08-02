# Survey — Changed-files strip: one chip per file

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Changed-files DOM host element | EXISTS | `src/sidebar.ts:4863` (`#changed-files`); harness mirror `test/webview-harness.ts:45` |
| Strip CSS | EXISTS | `media/chat.css:1443–1481` (`.changed-files`, chips, add/del colors) |
| State bag `changedFiles` Map | EXISTS | `media/chat.js:136–139` — comment: `toolCallId → { path, adds, dels }` |
| `recordChangedFile` | EXISTS | `media/chat.js:3473–3478` — keys by **toolCallId** |
| `forgetChangedFile` | EXISTS | `media/chat.js:3480–3482` — deletes by **toolCallId** |
| `clearChangedFiles` | EXISTS | `media/chat.js:3484–3488` |
| `renderChangedFilesStrip` | EXISTS | `media/chat.js:3490–3524` — one chip per Map **value** (no path dedupe) |
| `countDiffLines` / `baseNameOf` | EXISTS | `media/chat.js:3460–3471` |
| Diff intake → strip | EXISTS | `applyToolDiffs` `media/chat.js:3439–3449` calls `recordChangedFile(call.toolCallId, diff)` per `type:"diff"` content item |
| Failure → drop strip entry | EXISTS | `markToolFailed` `media/chat.js:3604–3606` → `forgetChangedFile(toolCallId)` |
| Clear on new user turn | EXISTS | `media/chat.js:5564` (`userMessage` handler) |
| Clear on agent reset | EXISTS | `media/chat.js:5769` |
| Clear on session switch | EXISTS | `media/chat.js:2685` |
| Line-diff pure helper | EXISTS | `media/webview-helpers.js:258` `computeLineDiff`; imported in chat.js `:1114` |
| DOM tests for strip | EXISTS | `test/changed-files-strip.dom.test.ts` (full file, 6 cases) |
| Same-path multi-edit test | DOES NOT EXIST | searched suite for repeated path / dedupe; only distinct-path multi-file case at `test/changed-files-strip.dom.test.ts:55–65` |
| Product description | EXISTS | `CLAUDE.md:130` (Changed-files strip contract); `README.md:263` |

## Reusable code

- **`state.changedFiles` + `record` / `forget` / `clear` / `render` cluster** — `media/chat.js:3473–3524` — the entire feature; fix lives here, not a new subsystem.
- **`computeLineDiff`** — `media/webview-helpers.js:258` — already used by `countDiffLines`; keep using it; no second diff algorithm.
- **`bootWebview` / `dispatch` harness** — `test/webview-harness.ts` — existing DOM tests drive real `media/chat.js`; extend same style.
- **Diff fixture helper** — `test/changed-files-strip.dom.test.ts:11–13` `diffBlock(path, oldText, newText)`.

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| `toolCallId`-keyed Map semantics for strip **display** | `media/chat.js:139`, `3476`, `3492` | 1 Map + `record`/`forget`/`render` (internal) | One entry per tool call duplicates the same path when the agent re-edits a file; display must be path-unique while failure still needs per-toolCallId removal |
| Comment claiming `toolCallId → { path, adds, dels }` as the user-facing model | `media/chat.js:136–139` | comment only | User-facing model is "files this turn", not "edits this turn" |

No separate dead helpers or prior strip implementations found.

## Prior attempts

- none found — single implementation path; no `Legacy` / v2 strip code.

## Conventions

- **Tests:** Vitest + happy-dom DOM tests driving shipped `media/chat.js` via `bootWebview`/`dispatch` — `test/changed-files-strip.dom.test.ts:1–9`, `22–41`.
- **State:** Session UI state on a plain object + `Map`s in `media/chat.js` (`state.changedFiles` at `:139`); re-render rebuilds strip `innerHTML` each time (`:3494`).
- **Errors / failed writes:** `markToolFailed` drops strip contribution by toolCallId (`:3604–3606`).
- **Layout:** Webview-only CSS in `media/chat.css`; host only emits the empty `#changed-files` shell (`src/sidebar.ts:4863`).
- **Commands:** Unit suite `npm test` (AGENTS.md Project Test Commands); Windows shell is the developer's environment.

## Absences

- No test for two `toolCallId`s targeting the same path (the reported bug).
- No pure helper extracted for "aggregate changed files by path" (logic is inline in chat.js).
- Coverage tooling: NONE in repo (AGENTS.md).

## Danger zones

- `media/chat.js` — large webview entry; many concerns; keep fix localized to the changed-files block (`~3473–3524`) and call sites that already exist.
- `forgetChangedFile` semantics — plan-gate / failed tools must still remove the right contribution without wiping unrelated files.
- Display uses `baseNameOf` only (`media/chat.js:3506–3507`); two different paths with the same basename already look identical in the chip label (tooltip still has full path `:3503`) — pre-existing; not the reported multi-edit bug.

## Root cause (grounded)

`recordChangedFile` does:

```text
state.changedFiles.set(toolCallId, { path, adds, dels });
```

(`media/chat.js:3476`)

`renderChangedFilesStrip` then emits one chip per Map value (`:3492–3521`) with no grouping by `path`. Multiple successful edits to `src/auth.ts` therefore produce multiple chips that all show `auth.ts`.
