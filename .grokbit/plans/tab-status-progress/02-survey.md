# Survey — Session tab status + progress

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Session status union | EXISTS | `src/session.ts:8` — `"idle" \| "working" \| "needs-you" \| "done" \| "error"` |
| Session state bag | EXISTS | `src/session.ts:21` — `class Session` |
| Dashboard / launcher dot policy | EXISTS | `src/session-pool.ts:24-35` — `Dot`, `computeDot` |
| Bare tab title formatter | EXISTS | `src/sessions.ts:109-114` — `tabTitleFor` |
| Settings-prefix tab title | EXISTS | `src/sessions.ts:167-199` — `TabTitleParts`, `composeTabTitle` |
| Tab title update glue | EXISTS | `src/sidebar.ts:4449-4457` — `updateTabTitle` |
| Status mutation glue | EXISTS | `src/sidebar.ts:4606-4618` — `setStatus` (updates status, unread meta, `pushDot`, `updateStatusBar` — **does not** call `updateTabTitle`) |
| Panel icon assignment | EXISTS | `src/sidebar.ts:736-740` — static blackhole light/dark SVGs on every panel |
| Status-bar HUD pure builder | EXISTS | `src/status-bar.ts:91-149` — `computeStatusBar` (spinner when `working`, bell count for needs-you) |
| Launcher dot labels | EXISTS | `media/launcher.js:83-84` — `working: "Working on it"`, `"needs-you": "Needs your OK"` |
| Activity step helpers (webview-only) | EXISTS | `media/webview-helpers.js:1185-1199` — `activityPeek`, `activityPosText` |
| Host-side turn progress / step total on Session | DOES NOT EXIST | searched: `progress`, `toolCount`, `stepCount` on `Session` / `setStatus` / `composeTabTitle` — no fields |
| Native tab progress API on WebviewPanel | DOES NOT EXIST | VS Code surface is `title` + `iconPath` only (see `bindPanel` / `updateTabTitle`) |
| Unit tests for tab titles | EXISTS | `test/sessions.test.ts:641+` (`tabTitleFor`), `738+` (`composeTabTitle`) |
| Unit tests for dots | EXISTS | `test/session-pool.test.ts:7-30` |
| Unit tests for status bar | EXISTS | `test/status-bar.test.ts` (referenced by CLAUDE.md; module `src/status-bar.ts`) |
| Blackhole tab icons | EXISTS | `resources/blackhole-icon-black.svg`, `resources/blackhole-icon-white.svg` |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- **`SessionStatus`** — `src/session.ts:8` — authoritative live states already set everywhere a turn starts, waits, finishes, or errors (`sidebar.ts` call sites include ~1248, ~2446, ~2466, ~4085, ~4176, ~4296, ~4310).
- **`computeDot`** — `src/session-pool.ts:26-35` — precedence `working → needs-you → unread(error?) → none`; proves product already maps status → user-visible attention model for non-tab surfaces.
- **`composeTabTitle`** — `src/sessions.ts:190-199` — pure, length-budgeted, settings prefix first so narrow tabs keep model/effort; natural extension point for a status/progress prefix segment.
- **`updateTabTitle`** — `src/sidebar.ts:4449-4457` — single impure write to `session.panel.title`; already invoked on name/model/effort changes, not on status.
- **`setStatus`** — `src/sidebar.ts:4606-4618` — single choke point for status transitions; already fans out to dots + status bar; ideal place to also refresh tab chrome.
- **`computeStatusBar`** — `src/status-bar.ts:127-129` — pattern for “working = loading glyph, needs-you = warning/bell”; status bar already does for *active* session what tabs lack for *every* session.
- **`activityPosText`** — `media/webview-helpers.js:1196-1199` — pure step counter text for the carousel; proves the product already has a step-count vocabulary, but it is webview-local today (not on the host Session).
- **Title unit tests** — `test/sessions.test.ts:738+` — pattern for pure title assertions (truncation, unnamed, backend fallback).

## Supersession
What this change replaces, duplicates, or makes dead. Caller counts are required.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Status-blind `composeTabTitle` signature | `src/sessions.ts:190` | host via `updateTabTitle` + tests (`test/sessions.test.ts`); grep shows `composeTabTitle` used from `sidebar.ts` open/restore paths and `updateTabTitle` | Does not encode `SessionStatus` or progress; must gain optional fields without breaking existing call sites |
| Static `panel.iconPath` blackhole only | `src/sidebar.ts:736-740` | 1 assignment site (`bindPanel`) | Always the same icon; never reflects running / needs-you / done |
| `setStatus` omitting tab title/icon refresh | `src/sidebar.ts:4606-4618` | all status transitions funnel here | Dots + status bar update; tab chrome stays stale for the full turn lifecycle |
| Launcher/history dots as *only* per-session status surface | `computeDot` + `sessionDot` broadcast | launcher + history popover | Not dead — still required; but currently the *only* multi-tab glance surface, which is what forces users off the editor tab strip |

Caller count note: `setStatus` / `updateTabTitle` call sites in `sidebar.ts` are numerous (≥10 each for status mutations; ≥8 title updates) but one policy function each — supersession is of *behavior*, not of many duplicate helpers.

## Prior attempts
Earlier implementations of this same idea. Say which one live code actually uses.

- **Status-bar HUD** (`src/status-bar.ts`) — live; covers active session working + global needs-you count; does not mark individual background tabs.
- **Launcher dots** (`computeDot` + `media/launcher.js`) — live; multi-session, but only if the user looks at the activity-bar launcher / history list.
- **Activity carousel step counter** (`activityPosText` in webview) — live inside the chat transcript; invisible when the tab is backgrounded and not reflected in the editor tab label.
- No abandoned `composeTabTitle` v2 or status-prefix experiment found in `src/` or `.grokbit/plans/` (search: tab status / progress in plans).

## Conventions
How this repo actually works, with an example of each.

- **Errors:** host logs to output channel; session status `"error"` + optional unread error badge — `src/sidebar.ts:4614-4616`, `computeDot` error branch `src/session-pool.ts:33`.
- **Tests:** vitest, pure modules preferred; title tests live next to sessions helpers — `test/sessions.test.ts:641+`; no vscode required for pure policy.
- **State:** `Session` is a mutable bag; derived UI (dots, status bar, titles) recomputed from fields on events — `src/session.ts:21`, `setStatus` pattern.
- **Layout / tab titles:** settings prefix first because VS Code truncates from the end — documented on `composeTabTitle` `src/sessions.ts:184-187`.
- **Icons:** fixed extension resources under `resources/`, assigned once at panel bind — `src/sidebar.ts:736-740`.
- **Cross-platform:** pure string formatting for titles; Windows is a first-class test target for the suite (`npm test`).

## Absences
Missing infrastructure the plan may need to add.

- No `Session` field for in-turn progress (completed steps / total).
- No host→title bridge on status change (`setStatus` → `updateTabTitle` gap).
- No status-variant tab icons (only brand blackhole pair).
- No pure helper that maps `SessionStatus` (+ optional progress) → title segment / icon choice.
- Coverage tooling: `NONE` per project test commands (no change required for this feature).

## Danger zones
- `src/sidebar.ts` — large impure host; prefer extending pure helpers + thin `setStatus`/`updateTabTitle` hooks rather than scattering status string logic.
- `composeTabTitle` length budget (`DEFAULT_SETTINGS_TITLE_MAX = 34`, `MIN_NAME_BUDGET = 10`, `MAX_PREFIX_LEN = 14` in `src/sessions.ts:155-165`) — a status/progress prefix can starve the name or settings if not budgeted carefully.
- `retainContextWhenHidden:false` lifecycle — title/icon live on the **panel** (host), not the webview; safe across teardown; do not put the only status signal inside webview-only DOM.
- Unread meta + `done`/`error` interaction (`setStatus` `src/sidebar.ts:4614-4616`) — “finished while away” already exists as unread dots; tab “done” must not invent a second conflicting policy without mapping to this.
- Existing `composeTabTitle` tests will need updating if the default status segment appears for idle tabs (idle must remain settings-prefix–only or tests redefine expected strings).
