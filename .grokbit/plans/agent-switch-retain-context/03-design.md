# Design — Switch Agents on any tab and retain context

## Options considered

### Option A — Buffer-preserving restart + bounded transcript handoff (recommended)
Approach:
1. Before flipping, **snapshot** `session.buffer` (and enough flags to restore “has real history”).
2. Build a pure **handoff transcript** from buffered user/agent text (and light structure for tools: titles only, not full stdout).
3. If over a char budget, **truncate** (prefer recent turns) and/or fall back to the existing **summarize** prompt against the *old* client before dispose.
4. Run process restart like today (`session.backend = target`, `startSession`) but **reseed the buffer** (and `hasHistory`) after start so `replayInto` on hide/reveal keeps the UI thread continuous.
5. After primer (grok) / live (claude), inject a **suppressed** handoff prompt (`[Context from previous session — switched from Grok/Claude]\n…`) reusing `suppressContent` + `sessionContext` banner patterns from `restartSession` (`src/sidebar.ts:2090-2102`).
6. **Never** `discardAbandonedBackendSession` when the pre-flip tab had real history; old id stays on the source store.
7. Replace the lose-history modal with either no modal or a soft informational confirm that states context will be carried.

Trade-off (against the intent's constraints): Best match for “full context” UI + strong agent seed; more host complexity; handoff is still **text**, not live ACP tool state; needs a pure module + careful `startSession` interaction.

### Option B — Reuse Summarize & Restart only
Approach: On history flip, call the same path as model/effort (`pickRestartMode` / `restartSession` summarize) after setting `session.backend`, and keep today’s buffer wipe.

Trade-off: Smallest diff; already-shipped inject/banner. **Fails** hide/reveal transcript retention (`startSession` clears buffer at `src/sidebar.ts:2134`) and is only a one-paragraph seed—weak against “full context.” Modal UX would still feel like a restart tax.

### Option C — Dual-tab handoff (open new tab on other agent; leave old tab)
Approach: “Switch agent” becomes “Open on Claude with exported transcript” without mutating the current session process.

Trade-off: Safest for disk identity; worse UX for “this tab continues”; does not match “on any tab… switch Agents.”

## Decision
**Chosen: A**

Rationale against constraints:
- Meets done-criteria for history tabs, visible continuity, and agent-usable prior text without inventing cross-store `session/load`.
- Reuses proven suppress-inject + banner chrome; adds pure extract/truncate (testable without vscode).
- Respects empty-flip discard and per-backend stores.
- Bounds risk with a hard char budget.

What the rejected options were better at:
- **B** is cheaper and reuses more code paths; prefer extracting a shared `injectSessionContext(session, text)` helper so B’s inject body is not duplicated, while A still owns buffer preserve + transcript build.
- **C** is safer if users often need both agents side-by-side; can remain a future non-goal or follow-up (“Duplicate to other agent”).

## Shape of the change

### Pure module (new)
e.g. `src/agent-handoff.ts` (name flexible; keep free of `vscode`):
- `buildAgentHandoffText(buffer: unknown[], opts): { text: string; truncated: boolean; turnCount: number }`
  - Walk buffer messages; collect structured lines:
    - `userMessage` → `User: …` (full text field)
    - consecutive `messageChunk` → coalesce into one `Assistant: …` turn
    - `toolCall` / completed tools → one line `Tool: <title|kind>` (no full diffs/stdout)
  - Skip pure chrome: `setBusy`, `tokenUsage`, `modeChanged`, `chips`, capability payloads, etc.
  - Ignore unknown types safely.
- `fitHandoffText(text, maxChars): { text; truncated }` — keep **tail** (recent) when cutting.
- Constants: `AGENT_HANDOFF_MAX_CHARS` (propose 48_000; named constant + tests for over-budget).
- **Precedence:** transcript extract + fit is primary. Summarize via old client only if extract is empty/unusable while `hadHistory` (e.g. pathological buffer). Do not inject both full transcript and a separate summary unless summarize is the sole content.

### Host (`switchBackend`)
Today (`src/sidebar.ts:618-649`): lose-history modal → `startSession` → discard if empty.

Target: run the **Restore algorithm** below. No lose-history modal. Block mid-turn (`promptInFlight` / pending permissions). Empty tabs unchanged (transparent + discard).

### Restore algorithm (normative — implements the Round 1 blockers)

`startSession` will keep clearing process-bound state (`src/sidebar.ts:2134-2172`). Handoff does **not** change that for all callers. Only `switchBackend` (history path) runs this after `await startSession(...)` returns (success or fail):

1. **Before any dispose/start**, snapshot:
   - `uiBuffer = session.buffer.slice()` (shallow copy of message refs)
   - `hadHistory = session.hasHistory`
   - `userMessageCount`, `latestUserMessageForTitle`
   - `oldBackend`, `oldId`, `oldClient` (for optional empty-buffer summarize fallback only)
2. **Build handoff text** from `uiBuffer` via pure builder (coalesce chunks; fit budget) **before** dispose when possible. Summarize via `oldClient` **only if** extract is empty/unusable and `hadHistory` (fallback), then dispose/start.
3. Flip `session.backend`, clear `effort`, `postTo backendChanged` (keep post-before-start wedge fix at `:635-647`).
4. `await startSession(session)` with **no `resumeId`** (must not take resume path; must not `emit clearMessages` — today only resume emits it at `:2176`).
5. **Immediately** reassign:
   - `session.buffer = uiBuffer` (replace whatever start buffered: busy/session chrome for this tab’s continuous UI is already live; replay truth is the conversation)
   - `session.hasHistory = hadHistory || uiBufferHasUserTurn`
   - `session.userMessageCount = snap.userMessageCount`
   - `session.latestUserMessageForTitle = snap.latestUserMessageForTitle`
6. If client live and handoff text non-empty: set `session.handoffPromise` (or reuse a local await) = inject path:
   - `await ensurePrimed(...)` when `planPrimer`
   - `emit({ type: "sessionContext", ... })` so banner is **in the restored buffer** (append after restore)
   - `suppressContent = true`; `client.prompt(handoffEnvelope + text)`; clear suppress
   - This **is** a real turn on the **new** backend session (persisted there). `SUPPRESS_TYPES` keeps chunks out of UI buffer (`src/sidebar.ts:4542-4564`), same as summarize.
7. **First user send** after flip must await the same handoff/primer promise (mirror first-send awaiting `primingPromise`) so the user message is not interleaved before context lands.
8. Empty path (`!hadHistory`): no handoff; keep `discardAbandonedBackendSession`.
9. History path: never `remove` old id; `broadcastSessionsList` so both rows can show.

Hide/reveal: `ready` → `replayInto` replays restored buffer (`src/panel-router.ts:100-106`) → transcript survives.

### Webview
- Prefer reusing `sessionContext` / banner; optional new copy via message field if needed (`media/chat.js:6058-6059`).
- No change to who may post `switchBackend` (history tabs already can).
- Ensure `backendChanged` still updates chips and re-requests capabilities on real flip (existing contract).
- Default: **no lose-history modal** on history flip (intent assumption). Still no-op while `priming`; block while `promptInFlight` with a short error/toast.

### History / identity
- New `activeSessionId` on target backend after `session/new`.
- Source session remains on disk under old backend (no `remove` on history flip).
- Tab title: restore `latestUserMessageForTitle` so the tab does not flash “New”; renames stay on globalState keys for ids actually discarded (empty path only). **Do not** steal the old history row’s id onto the new session.

### Auth / spawn failure
If target backend fails to start (missing adapter, auth), keep `session.backend` already flipped (current post-before-start behavior at `:635-647`) and show onboarding—**still run buffer/counter restore** so the transcript is not lost while fixing auth. Handoff inject skips until a client exists; retry switch or send after auth may re-run inject if handoff text was stashed on the session.

## Disposition of superseded code
Every item from the survey's supersession section.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| History-loss modal + fresh-only switch path | REPLACE | Product requires carry-context | Remove lose-history copy; implement handoff path in `switchBackend` |
| `docs/plans/claude-code-backend.md` non-goal line 44 | REPLACE (doc) | No longer true when feature ships | Update non-goal / add note that handoff is text+UI, not shared ACP session |
| User-facing warning string | REPLACE | Misleading once handoff exists | Delete or rewrite |
| Unconditional buffer loss on backend flip | REPLACE | Breaks hide/reveal + “full” UI context | Preserve/reseed buffer on handoff path only |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Flip while `promptInFlight` / mid-permission | Block with clear message; do not dispose mid-turn |
| Flip while priming | Keep existing early-return (`src/sidebar.ts:619`) |
| Handoff exceeds budget | Truncate (recent-first) and/or summarize; banner may note truncation |
| Summarize fails | Still inject truncated transcript if any; else banner “switched, context unavailable” |
| Target spawn fails | Onboarding; buffer restored; user can fix auth and retry switch or send |
| Empty tab flip | Transparent restart + `discardAbandonedBackendSession` (unchanged) |
| Very tool-heavy buffer | Tool lines title-only; still may truncate |
| User reopens old history row | Still loads original backend session via `openTabForId(id, backend)` — independent of flipped tab’s new id |

## Migration
Schema change: no  
Reversible: yes (feature flag not required; behavior change is product)  
Existing rows: unchanged on disk  
Mixed-version window: n/a (extension-only)

## New dependencies
None.
