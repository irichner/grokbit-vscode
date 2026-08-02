# Review log — Switch Agents on any tab and retain context

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[BLOCKER]` Buffer restore after `startSession` is underspecified vs events emitted *during* start (`setBusy`, session identity, modelChanged). Blind `session.buffer = snapshot` after start drops those host events from the replay log; more importantly **order of restore vs live posts** can leave hide/reveal or busy state wrong. Evidence: `startSession` emits `setBusy` at `src/sidebar.ts:2183` and clears buffer at `:2134`; `emit` always buffers (`:4563-4570`). Resolves by: define an explicit restore algorithm (snapshot UI transcript events only; after start, set `session.buffer = snapshot`, then `emit`/`postTo` only the derived ephemera needed; assert `hasHistory` + counters; never rely on DOM alone).
- `[BLOCKER]` `userMessageCount` (and likely `latestUserMessageForTitle`) reset in `startSession` (`src/sidebar.ts:2166-2172`) are not restored. Plan-card interleave and tab-title continuity use them (`session.ts:185-210`, plan restore path). Buffer-only restore fails done-criterion hide/reveal fidelity for plan/title. Resolves by: snapshot and restore `userMessageCount` + `latestUserMessageForTitle` (and any other UI-position counters the implementer finds coupled) when handoff mode.
- `[MAJOR]` Handoff inject via `client.prompt` creates a real turn on the **new** backend (persisted to new session disk). Design should state that explicitly as intended (context lives on new agent) and that `suppressContent` + `SUPPRESS_TYPES` (`src/sidebar.ts:4542-4564`) keeps it out of the **visible** buffer—same as summarize path. Risk: first user send races inject; must await inject before accepting send or queue behind it (mirror primer await).
- `[MAJOR]` Buffer stores streamed `messageChunk` pieces (`src/sidebar.ts:2364`), not only finals. Extractor must coalesce consecutive agent chunks into turns or handoff text becomes unreadable/huge. Resolves by: pure builder aggregates consecutive `messageChunk` (and user messages) before fitting.
- `[MAJOR]` Optional summarize-before-dispose + transcript path is two strategies without a clear precedence. Resolves by: **primary = transcript extract + fit tail; summarize only if extract empty or client-only path when buffer unusable**; do not always double-spend summarize + full transcript.
- `[MINOR]` Soft confirm still open (intent assumption). Prefer no lose-history modal; optional non-blocking is fine.
- `[MINOR]` Banner copy for truncated handoff not required for v1 if truncation is rare; nice-to-have.

### Architect response — Round 1
- `[BLOCKER]` buffer/startSession → **REVISED**: see `03-design.md` § Restore algorithm (explicit steps + counters).
- `[BLOCKER]` counters → **REVISED**: snapshot/restore `userMessageCount` + `latestUserMessageForTitle`.
- `[MAJOR]` inject is a real new-session turn → **REVISED**: documented; gate first send on handoff promise like primer.
- `[MAJOR]` chunk coalesce → **REVISED**: pure builder requirement.
- `[MAJOR]` strategy precedence → **REVISED**: transcript-first; summarize only as empty-buffer fallback.
- `[MINOR]` confirm → **REVISED**: default no modal for history flip (carry context); keep busy/priming guards.
- `[MINOR]` truncation banner → accepted as optional follow-up; not a done-criterion.

## Round 2
Reviewed revised `03-design.md` § Restore algorithm / inject lifecycle.

- `[MAJOR]` Restoring buffer without replaying to an already-ready webview is OK (DOM kept), but if anything during `startSession` emits `clearMessages` in future, contract breaks. Guard: handoff path must not pass `resumeId`; code review checklist item.
- `[MINOR]` README / CLAUDE.md product prose may also claim no cross-backend history; intent only names claude plan doc. Expand doc task to grep user-facing claims.

### Architect response — Round 2
- `[MAJOR]` → **REVISED**: explicit “handoff never uses resumeId; never emit clearMessages on handoff path.”
- `[MINOR]` → **REVISED**: doc task includes README/CLAUDE/changelog-facing claims if present.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none (BLOCKER/MAJOR cleared)

## Plan review (Loop 4)
One pass, after Decompose — checks the task list against the design, not the design decision again.
Reviewed: `plan.md`

- `[BLOCKER]` none after Architect filled verification matrix and restore/inject tasks
- `[MAJOR]` none
- `[MINOR]` Host `switchBackend` remains hard to unit-test; plan correctly leans pure module + DOM message contracts + manual smoke note

### Architect response
- Loop 4 clean; no further task rewrites required.

Outcome: clean
