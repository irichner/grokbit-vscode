# Design — Session tab scroll position restore

## Options considered

### Option A — Host-persisted scroll + begin/end panel-replay restore
Approach: Keep `retainContextWhenHidden: false` and the existing `ready` → `replayInto` lifecycle. Continuously post the webview’s `stickToBottom` + `scrollTop` to the host (with an immediate flush on hide). Store on `Session`. On reveal, wrap buffer replay with `beginPanelReplay` / `endPanelReplay` so auto-scroll (including force-scroll) is suppressed during rebuild, then apply the saved pin/offset once.

Trade-off (against the intent's constraints): Small, localized change; preserves documented panel lifecycle; works with soft-torn-down tabs. Requires careful ordering so intentional clears still start pinned. Host↔webview chatter on scroll (debounced while visible; flushed on hide). Absolute `scrollTop` is imperfect if non-append layout changes while hidden (rare for chat).

### Option B — `retainContextWhenHidden: true`
Approach: Keep the webview DOM (and scroll) alive when the tab is backgrounded.

Trade-off: Breaks the load-bearing contract in `src/panel-router.ts:19–24` and `src/sidebar.ts:712–716`. Large architectural rewrite. Violates intent non-goal.

### Option C — Webview `setState` only
Approach: Extend `vscode.setState` with scroll metrics; restore after first replay.

Trade-off: Helps window reload; does not reliably flush on tear-down without continuous writes; host field next to `Session.buffer` is the natural primary store.

## Decision
**Chosen: A**

Rationale against constraints: Matches “must not break ready/replay”; reuses `shouldStickToBottom`, stick gate, and reveal replay; smallest blast radius. Rejected B (non-goal). Rejected C as primary (insufficient alone).

What the rejected options were better at:
- **B** — zero restore math / flicker.
- **C** — survives window reload with less host surface if setState always flushes.

## Shape of the change

### Locked wire sequence (single recipe — no alternatives)

On every panel `ready` path that rebuilds the view (`src/sidebar.ts:2727–2735` today: `markReady` → `postPanelConfig` → `replayInto`):

1. `markReady(session)` — existing  
2. `postPanelConfig(session)` — existing  
3. **`beginPanelReplay`** with restore payload (new; **before** clear)  
4. `router.replayInto(session, [modeChanged, chips, backendChanged])` — existing order: `clearMessages` then buffer then derived (`src/panel-router.ts:100–106`)  
5. **`endPanelReplay`** (new; **after** buffer + derived)

**Canonical implementation site:** `GrokSidebar.replayInto` posts begin on the bound panel port (or `postTo` after ready — same gate), then calls `this.router.replayInto(...)`, then posts end. Do **not** put begin in the derived-after-clear list. Do **not** implement a trailing-only `restoreScroll` without begin/end.

```
beginPanelReplay { restore: { stickToBottom: boolean, scrollTop: number } | null }
clearMessages
…buffer…
modeChanged, chips, backendChanged
endPanelReplay
```

`restore` is `null` when the host has no meaningful memory (first paint / just cleared in `startSession`) → end applies **pin to bottom** (today’s default).

When the user left mid-scroll: `restore = { stickToBottom: false, scrollTop: N }`.  
When the user left pinned: `restore = { stickToBottom: true, scrollTop: ignored }`.

### Data (host)
On `Session` (`src/session.ts`), in-memory only (not disk, not buffer):

```ts
/** Last known #messages pin + offset for this open panel. */
scrollStickToBottom: boolean = true;
scrollTop: number = 0;
```

### Reset scroll memory (anti-bleed)
**Reset to pin defaults** (`scrollStickToBottom = true`, `scrollTop = 0`) in:

1. **`startSession`** — same choke point as `session.buffer = []` (`src/sidebar.ts` ~2077). Covers effort/model restart, summarize-restart, backend switch, resume, fresh spawn.  
2. Any host path that intentionally empties the live view without going through a later `startSession` if such a path exists (audit at implement time against `emit({type:"clearMessages"})` sites ~2011, ~2113).

Reveal-only `clearMessages` inside `router.replayInto` must **not** clear host scroll memory (that is the value being restored).

### Inbound: `scrollState`
```ts
| { type: "scrollState"; stickToBottom: boolean; scrollTop: number }
```

Host: coerce boolean; `scrollTop = max(0, number or 0)`; assign onto session. No broadcast.

### Webview: report scroll
- On `#messages` scroll listener (after stick update): debounced post (~50–100ms) **only while** `!state.panelReplaying`.  
- **Immediate flush** (no debounce) when:
  - `document.visibilitychange` and `document.hidden` (tab/hide path before tear-down)  
  - `forceScrollToBottom` / scroll-button pin (live only)  
- **Never** post `scrollState` while `state.panelReplaying` (including during end’s scrollTop write if that fires a scroll event — use a short suppress or ignore listener while applying restore).

### Webview: `panelReplaying` (distinct from `state.replaying`)
- **Never** reuse `state.replaying` (that flag is session/load `historyReplay` only — `media/chat.js:5521–5534`).  
- `beginPanelReplay`: set `state.panelReplaying = true`; stash `pendingRestore` from message.  
- `resetForNewSession` (via `clearMessages`): if `state.panelReplaying`, **do not** set `stickToBottom = true` (leave false / pending); if not panel-replaying, keep today’s pin-to-bottom.  
- While `panelReplaying`:
  - `scrollToBottom()` → **no-op**  
  - `forceScrollToBottom()` → **no-op** (buffered userMessage / permission / question must not re-pin mid-rebuild)  
  - `scrollState` posts → **no-op**  
- `endPanelReplay`:
  1. Apply restore once:
     - `restore == null` or `restore.stickToBottom === true` → set stick true; `messagesEl.scrollTop = scrollHeight`  
     - else → `messagesEl.scrollTop = clamp(restore.scrollTop, 0, maxScroll)`; recompute stick via `shouldStickToBottom(...)`; `updateScrollBtn()`  
  2. Clear `panelReplaying`  
  3. Post one authoritative `scrollState` to host  
- **End restore wins:** do **not** scan for pending permission/question cards and force-pin after reveal (preserves mid-scroll done-criteria). Live **new** permission/question **after** end still call `forceScrollToBottom` as today.

### Pure helper
`clampScrollTop(scrollTop, scrollHeight, clientHeight)` in `media/webview-helpers.js` (or adjacent pure export). Reuse existing `shouldStickToBottom` — do not invent a second near-bottom predicate.

### CSS
None.

### Tests (required coverage)
- Pure: clamp; restore decision (pin vs mid).  
- DOM: begin (mid) + clear + tall content + end → scrollTop restored; stick false; button visible.  
- DOM: begin (pin/null) + end → bottom; button hidden.  
- DOM: during panelReplaying, both `scrollToBottom` and `forceScrollToBottom` no-op.  
- DOM: no `scrollState` posts while panelReplaying (spy postMessage).  
- DOM: visibility hidden flushes scrollState (or unit the flush helper).  
- Host/unit: `startSession` / pure `resetSessionScrollMemory` defaults; pick restore payload from session fields.  
- Existing panel-router tests unchanged if router signature unchanged (sidebar wrap only).

### Layout note (QA)
Async images / Mermaid / MathJax can change `scrollHeight` after end applies `scrollTop`. Absolute restore may drift slightly on media-heavy threads — acceptable; not a hard QA failure for v1.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Unconditional `stickToBottom = true` on every `resetForNewSession` | REPLACE | Reveal rebuild must not re-pin mid-scroll | Gate on `panelReplaying`; intentional clears still pin |
| Implicit “always end at bottom after buffer replay” via force/scroll | REPLACE (behavior) | Call sites stay; gate both scroll helpers during `panelReplaying` | No mass deletion of call sites |
| Lack of host scroll memory | LEAVE (gap → add) | New fields, not a delete | Add Session fields + messages |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Never scrolled / first open | restore null → pin bottom |
| Content shorter than viewport | `shouldStickToBottom` true after apply |
| `scrollTop` > max | clamp |
| Content grew while hidden, mid-scroll | keep absolute scrollTop |
| Content grew while hidden, pinned | pin bottom |
| Malformed scrollState | coerce / ignore NaN |
| Permission while **visible** mid-scroll | force after end only (live) |
| Permission only in buffer, mid-scroll restore | stay mid; no force at end |
| Fast tab switch | immediate flush on visibility hidden |
| Rapid re-hide mid-replay | no scrollState during panelReplaying; host memory unchanged until end |
| Same Session restart (effort/model/backend) | startSession resets scroll memory |
| Async media reflow after end | slight drift OK |

## Migration
Schema change: no  
Reversible: yes  
Existing rows: n/a  
Mixed-version: n/a  

## New dependencies
None.
