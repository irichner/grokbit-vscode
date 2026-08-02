# Design — Session tab status + progress

## Options considered

### Option A — Status + progress on the native editor tab (title prefix + optional icon)
Approach: Extend the pure title composer so every live session panel’s `title` encodes status (`working` / `needs-you` / finished-while-away) as a **leading** segment (survives end-truncation). Wire `setStatus` (and progress ticks) to `updateTabTitle`. Optionally swap `panel.iconPath` among a small set of status icons (or keep brand icons when idle). Progress during implementation is a **title progress cue**: host tracks in-turn activity steps (tool calls / batches the host already sees) as `done/total` when total is known, otherwise a growing step count or compact bar built from a known ratio; never invent a fake percentage.

Trade-off (against the intent's constraints):
- Uses only APIs the product already owns (`panel.title`, `panel.iconPath`) — fits VS Code limits called out in intent non-goals.
- Keeps multi-tab glance on the editor tab strip (the surface the user asked for).
- Title budget is tight (`composeTabTitle` max ~34 chars today, `src/sessions.ts:155`); status + progress must share budget with `Model·effort` without destroying either.
- True pixel progress bar in the tab strip is impossible; progress is text/unicode/icon, not a workbench widget.

### Option B — Webview-top progress ribbon + leave native tabs status-blind
Approach: Add a sticky progress strip inside the chat webview; rely on existing launcher dots + status bar for multi-session attention. Tab titles stay `Model·effort — Name` only.

Trade-off:
- Richer in-tab *content* progress UI, but **fails the core done-criteria**: a background tab’s webview is torn down (`retainContextWhenHidden:false`, CLAUDE.md / survey danger zones), so a webview-only ribbon is invisible when the user is in another tab—the exact moment status matters most.
- Duplicates activity-carousel information when the tab is focused.
- Leaves the editor tab strip as status-blind as today.

## Decision
**Chosen: A**

Rationale against constraints:
- Intent requires observable status on the **editor tab** for background sessions; Option B cannot meet that under the existing panel lifecycle.
- Option A reuses `SessionStatus`, `setStatus`, `composeTabTitle`, and unread policy (survey reusable code) instead of inventing a parallel status model.
- Progress is explicitly best-effort text/icon on the tab, matching the non-goal that a native OS tab progress widget does not exist.
- No new dependencies; pure formatting stays unit-testable like today’s title tests.

What the rejected option was better at:
- Option B would allow a wider, graphical progress bar and richer labels while the user is *inside* the chat. That remains available later as a focused-tab complement, not as the multi-tab attention mechanism.

## Shape of the change

### 1. Pure title policy (primary)
Extend `TabTitleParts` / `composeTabTitle` in `src/sessions.ts` (keep one call site) with a **pure view-model status**, not a hard dependency on the `Session` class:

| Field | Role |
|---|---|
| `tabStatus?: TabTitleStatus` | `"none" \| "working" \| "needs-you" \| "done-away" \| "error-away"` — computed in sidebar from `SessionStatus` + unread meta |
| `progressCurrent?: number` | Optional step count; only meaningful when `tabStatus === "working"` |
| `progressTotal?: number` | Optional; omit when unknown |

`TabTitleStatus` lives next to `composeTabTitle` (or as a string union on `TabTitleParts`) so `sessions.ts` does not import `session.ts` (avoids coupling / cycles — review finding).

**Locked leading markers** (ASCII-first for width predictability; tests pin exact strings):

| `tabStatus` | Leading cue | Progress segment |
|---|---|---|
| `working` | `…` | If `progressCurrent ≥ 1` and no total: `…7` (marker fused with count, max 3 digits). If total known: `…3/12` capped by status budget. If current is 0/undefined: bare `…` (still clearly running). |
| `needs-you` | `?` | Never show tool progress (attention beats progress). |
| `done-away` | `*` | Unread successful finish while away (`done` + unread). `*` is ASCII stand-in for “finished”; avoid multi-byte checkmarks that vary by OS font. |
| `error-away` | `!` | Unread error while away (`error` + unreadError). Distinct from `?` (needs-you). |
| `none` / omitted | *(empty)* | Idle, or done/error already seen — **byte-compatible with today’s titles**. |

Order (leading → trailing), consistent with end-truncation:

```
[status/progress][space][Model·effort][ — ][Name]
```

Budget rules:
- Raise `DEFAULT_SETTINGS_TITLE_MAX` from 34 → **40** to make room for a ≤6-char status head without starving the name (tests update any hard-coded length assumptions).
- Status/progress hard max **6** characters (e.g. `…999`, `…9/99`, `?`, `*`, `!`).
- Over budget: drop progress digits first, then shorten name (existing), **never** drop `needs-you` / away markers before the name when those statuses apply.
- Idle titles with `tabStatus` omitted or `"none"` match pre-change `composeTabTitle` output for the same name/model/effort (modulo the +6 total budget—which only changes truncation of long names, not short idle titles).

### 2. Progress source (host-visible only) — locked rules
Add on `Session` (`src/session.ts` bag style):

- `turnToolIds: Set<string>` or `turnProgressCurrent: number` + a seen-id set for de-dupe.
- `turnProgressTotal?: number` — leave undefined in v1 unless a future host event supplies a real total; **do not invent totals**.

**Increment rule (locked):** On `client.on("toolCall", …)` (`src/sidebar.ts:2367-2370`), if `session.status === "working"` and the payload’s `toolCallId` is new for this turn, increment `turnProgressCurrent` and call `updateTabTitle`. Do **not** double-count `toolCallUpdate` for the same id (updates are status/content, not new steps).

**Narration-only turns:** status marker `…` alone satisfies “running”; progress digits appear only after the first distinct tool id (`current ≥ 1`). That is the v1 “progress bar” equivalent called for in intent (step cue, not a pixel bar — non-goal).

**Reset rule (locked):** Clear progress + seen ids when:
- status transitions **to** `working` from a non-working state (new turn), or
- status leaves `working` to `done` / `error` / `idle` / `needs-you`, or
- user send starts a new turn (same place `setStatus(..., "working")` already runs).

While `needs-you`, freeze (do not show) progress; after allow, a new `working` clears and recounts.

Optional stretch only: proportional ASCII bar when `progressTotal` is known — **not required** for done-criteria.

### 3. Glue
- Pure helper `tabTitleStatusFrom(sessionStatus, unread, unreadError): TabTitleStatus` (can live in `sessions.ts` or `session-pool.ts`) — single place mapping live + meta → title status, aligned with `computeDot` semantics for away/finished.
- `updateTabTitle` (`sidebar.ts:4449`) always passes `tabStatus` + progress into `composeTabTitle`.
- `setStatus` (`sidebar.ts:4606`) **always** calls `updateTabTitle(session)` after mutation (with `pushDot` / `updateStatusBar`).
- Progress tick on new `toolCall` id calls `updateTabTitle` (skip write if title string unchanged).
- **Unread clear → title refresh (locked):** every path that clears session unread meta on open/reveal (same places dots drop “finished while away”) must call `updateTabTitle` so `*` / `!` disappear when the user has seen the tab — satisfies idle/viewed done-criterion.

### 4. Icons (secondary, same task or follow-on task)
- Keep brand blackhole for idle/default (`sidebar.ts:736-740`).
- Optionally set alternate `iconPath` URIs or monochrome status SVGs under `resources/` for working / needs-you / error. If ThemeIcon is not reliably supported on `WebviewPanel.iconPath`, do not depend on it—survey notes Uri pair only today.
- Icon is enhancement; **title status is the gate for done-criteria.**

### 5. Surfaces left alone
- `computeDot` / launcher labels — LEAVE behavior (may share a pure “status label” helper later; not required).
- `computeStatusBar` — LEAVE (already shows working + needs-you for active/global).
- Activity carousel — LEAVE.

### 6. Tests
- Extend `test/sessions.test.ts` for status/progress segments, truncation precedence, idle unchanged.
- If a pure `tabStatusPrefix` helper is extracted, unit-test it directly.
- No DOM tests required for native tab titles (host API). Optional pure test for progress reset policy if extracted.

## Disposition of superseded code
Every item from the survey's supersession section. No item may be omitted.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Status-blind `composeTabTitle` | REPLACE (in place) | Single title policy must own status/progress | Extend signature with optional fields; all call sites remain valid; tests updated for new cases; idle default matches old output |
| Static `panel.iconPath` only | COEXIST → optional REPLACE of assignment | Brand icon remains correct idle identity; status icons optional | If status icons ship: `bindPanel` + status updates set icon; idle restores brand pair. If deferred: LEAVE static icons and document as non-blocking |
| `setStatus` without title refresh | REPLACE (behavior) | Tab chrome must track status | Call `updateTabTitle` (and optional icon update) from `setStatus` |
| Launcher/history dots as only multi-session status | LEAVE | Still the right surface for history rows | Do not remove dots; tabs add a parallel glance surface |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Panel disposed / no `session.panel` | `updateTabTitle` no-ops (already `if (!session.panel) return`) |
| Status thrash (working → needs-you → working) | Title updates each `setStatus`; progress may reset or freeze while needs-you (prefer freeze current, clear on next working) |
| Unknown progress total | Show step count only; never fake % |
| Extremely long model id + status | Existing prefix truncation (`MAX_PREFIX_LEN`) + new status budget; name keeps `MIN_NAME_BUDGET` |
| Session error while backgrounded | Unread error + error marker on tab; consistent with red unread dot |
| Serializer restore mid-turn | Status rehydrates only if process live; cold restore stays idle title (no false working) |
| Two tabs working | Each panel title independent; status bar still describes active only |

## Migration
Schema change: no  
Reversible: yes (revert title/status wiring)  
Existing rows: n/a (no disk format change)  
Mixed-version window: n/a  

## New dependencies
| Package | Why nothing in-repo suffices | Size | License |
|---|---|---|---|
| *(none)* | — | — | — |
