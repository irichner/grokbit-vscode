# Design — Changed-files strip: one chip per file

## Options

### Option A — Aggregate by path at render time (keep Map keyed by toolCallId)

- Keep `state.changedFiles: Map<toolCallId, { path, adds, dels }>` as the source of applied edits.
- In `renderChangedFilesStrip`, group values by `path`, **sum** `adds` and `dels` per path, then emit one chip per path.
- `recordChangedFile` / `forgetChangedFile` / `clearChangedFiles` stay toolCallId-based (failure removal stays correct).
- Label count becomes number of **unique paths**, not Map size.

**Trade-off:** Minimal behavioral surface; failure/replay/clear paths unchanged. Slight cost: O(n) group on every render (n = edits this turn — tiny). Does not change storage comments/shape fully toward "file" model.

### Option B — Re-key Map by path; nest per-edit contributions

- `Map<path, { path, adds, dels, byToolCallId: Map<toolCallId, {adds,dels}> }>` or similar.
- `record` merges into path entry; `forget` removes one toolCallId contribution and recomputes sums or deletes path if empty.

**Trade-off:** Storage matches user model ("files"). More invasive rewrite of three functions + state comment; higher chance of forget/render bugs for no product gain over A.

### Option C — Overwrite per path (latest edit wins metrics)

- Key by path only; each new edit replaces `adds`/`dels`.
- Simpler than B, but **under-reports** multi-edit churn and makes `forget` wrong if an earlier edit still "counts" after a later tool fails (or vice versa) unless you still track toolCallIds — which collapses back to A/B.

**Trade-off:** Fails done-criterion "all metrics updated" if interpreted as cumulative turn impact; worse failure semantics.

## Decision

**Choose Option A** — render-time aggregation by path with summed metrics; keep toolCallId-keyed storage for forget/clear.

### Why

- Matches done criteria with the smallest blast radius (survey: all strip logic is local to `media/chat.js:3473–3524` + existing tests).
- Preserves plan-gate failure removal by toolCallId (survey: `markToolFailed` → `forgetChangedFile`).
- Summing per-edit line counts is honest "this turn's edit churn" without inventing a true first-old/last-new merge (intent non-goal).
- Rejected B as unnecessary structure; rejected C for wrong metrics and weaker failure handling.

### Rejected options would have been better at

- **B:** Cleaner long-term data model if strip later gains path-level actions beyond open.
- **C:** Slightly less code if product only ever wanted "last edit stats" (it does not).

## Disposition table (from survey supersession)

| Item | Disposition | Reason |
|---|---|---|
| toolCallId-keyed Map as **storage** of applied edits | `LEAVE` | Still required for per-edit failure removal (`forgetChangedFile`); not dead |
| toolCallId-keyed Map as **display** model (one chip per entry) | `REPLACE` | Render must emit one chip per unique path with summed metrics |
| State comment "files edited … toolCallId → …" | `REPLACE` | Comment should describe storage vs display so the bug does not reappear |

## Detailed design

### Aggregation rules

1. **Identity key:** exact string `diff.path` as received (no case fold, no resolve). Two different path strings = two chips.
2. **Metrics:** for each path, `adds = sum(entry.adds)`, `dels = sum(entry.dels)` over remaining Map entries with that path.
3. **Order:** stable first-seen order of paths as Map insertion order of first contributing toolCallId (iterate Map values, insert into ordered aggregation Map only if path not yet present — when summing, add into existing).
4. **Label:** `1 file changed` / `N files changed` where N = unique path count.
5. **Open:** chip still posts `{ type: "openFile", path }` with the full path string stored on the aggregated entry.
6. **Zero metrics:** if both adds and dels are 0 after sum, still show the chip (path was touched); omit `+0`/`−0` spans as today (`if (f.adds)` / `if (f.dels)`).

### Code touch points

| Function | Change |
|---|---|
| `renderChangedFilesStrip` | Build path→aggregated map before creating chips; label uses unique count |
| `recordChangedFile` | Unchanged behavior (still set by toolCallId); optional comment |
| `forgetChangedFile` | Unchanged (delete toolCallId → re-render aggregates remaining) |
| State comment `:136–139` | Clarify: Map is per applied edit; strip aggregates by path |

### Tests (`test/changed-files-strip.dom.test.ts`)

Add (at minimum):

1. **Same path, two toolCallIds** → 1 chip; label "1 file changed"; `+`/`−` equal sum of both diffs' line counts.
2. **Same path, second edit then first tool fails** → chip remains with only second edit metrics (or disappears if only the failed one had been recorded — cover both if cheap).
3. Keep existing six tests green (distinct files, clear, replay, click, fail-all).

Optional pure unit extraction of `aggregateChangedFilesByPath(entries)` into `webview-helpers.js` is **not** required; can stay private in chat.js unless tests want to unit-test aggregation without DOM — prefer DOM test matching production path (convention).

### Unhappy paths

| Case | Behavior |
|---|---|
| Same path appears in one toolCall with multiple diff blocks | Current loop records last write per toolCallId (Map set); unchanged; still one path chip |
| Different paths, same basename | Two chips both labelled `foo.ts`; tooltips differ — pre-existing LEAVE |
| Replay | `recordChangedFile` still no-ops when `state.replaying` |
| Clear turn | `clear` empties Map; strip hides |

## Assumptions used

- Summing metrics (intent assumption) — recorded in `assumptions.md`.
