# Plan — Session tabs survive VS Code reload / restart

Slug: `session-tab-window-restore` · Approach: Pure restore policy + keep resume id + re-stash setState on ready · Blast radius: ~6–8 files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

`cwd:` is optional — omit or write `none` for a single-package repo. Every
`verify:` runs from the repo root on Windows via `npm test`.

## Tasks

### T1 — Pure `decidePanelRestore` policy
- **intent:** Encode serializer restore decisions (resume / reveal-existing / dispose-orphan) in a framework-free module with exhaustive unit tests.
- **files:** `src/panel-restore.ts`, `test/panel-restore.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/panel-restore.test.ts` exits 0 and covers at least: (1) missing/empty id → dispose-orphan; (2) alreadyOpen → reveal-existing; (3) id + visible → resume spawn now + backend default grok; (4) id + backend claude + not visible → resume pending; (5) whitespace id treated as missing.
- **removes:** none
- **baseline:** none (new pure module)
- **rollback:** `git revert` the commit for this task
- **state-after:** working
- **notes:** Mirror `src/session-scroll.ts` style. Import `BackendId` from `src/backends.ts` only if that import stays runtime-pure (no vscode) — it does today.

### T2 — Keep `activeSessionId` for the whole resume start
- **intent:** While `startSession` is resuming, the tab remains findable as that session id so launcher/history cannot open a duplicate and CLI-update respawn still sees the id.
- **files:** `src/sidebar.ts`, `test/panel-restore.test.ts` or `test/session-start-identity.test.ts` (pure helper if extracted)
- **cwd:** none
- **depends:** none
- **verify:** Prefer extracting a one-liner pure helper e.g. `activeSessionIdForStart(resumeId?: string): string | undefined` in `src/panel-restore.ts` used at the old wipe site; `npm test -- test/panel-restore.test.ts` asserts resume keeps id and new clears. Plus source-text test that `startSession` no longer unconditionally assigns `undefined` without consulting resume (pattern like `test/panel-replay-scroll.test.ts`).
- **removes:** none (behavior of wipe-on-resume replaced)
- **baseline:** During resume, `activeSessionId` is undefined from startSession entry until load completes (`src/sidebar.ts:2125` then `2578`) — openTabForId can miss the panel.
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Do not change `session.buffer = []` or scroll reset. New sessions still clear id until `session/new`.

### T3 — Wire `restorePanel` to pure policy (no silent new session)
- **intent:** Serializer restore either resumes a real id or disposes the orphan panel; never `startSession` without resume id for a “restored” tab.
- **files:** `src/sidebar.ts`, `test/panel-restore.test.ts` (source-order / call-shape tests if needed)
- **cwd:** none
- **depends:** T1, T2
- **verify:** `npm test -- test/panel-restore.test.ts` green; source-text test that `restorePanel` references `decidePanelRestore` (or the export name) and that the old “missing id still bind + startSession” path is gone (e.g. no `startSession(session, id)` when policy would dispose — assert absence of `pendingStart = id ?? ""` empty-string new-session pattern or equivalent).
- **removes:** silent new-session fallback for empty serializer state in `restorePanel`
- **baseline:** `restorePanel` with undefined id still binds and starts a new session (`src/sidebar.ts:808–821`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** **Must not await** full `startSession` inside `restorePanel` (serializer responsiveness — `04-review.md` BLOCKER). Log dispose-orphan via `this.output.appendLine`. `reveal-existing` keeps today’s dispose + reveal.

### T4 — Re-stash webview serializer state on ready when id is known
- **intent:** After reload, as soon as the host knows the session id (including pendingStart / pre-load), the webview persists `{id, backend}` so the *next* reload does not lose identity.
- **files:** `src/sidebar.ts`, `media/chat.js`, `test/backend-chip.dom.test.ts` or `test/panel-restore.dom.test.ts`
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/backend-chip.dom.test.ts` (or new dom file) exits 0; new case: dispatch host identity message (name chosen in implement; e.g. `sessionIdentity`) with id+backend → `states` last entry equals `{id, backend}`. Existing `session` event stash tests remain green.
- **removes:** none
- **baseline:** `setState` only on ACP `session` event (`media/chat.js:5547`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Post from `ready` handler after `postPanelConfig` when `session.activeSessionId` or non-empty `pendingStart` is set. Backend from `session.backend`.

### T5 — Full suite + manual reload checklist
- **intent:** Prove grok-free suite still green; document human steps for done-criteria that need real VS Code Reload Window.
- **files:** optional note under this plan’s `assumptions.md` Resolution for manual results
- **cwd:** none
- **depends:** T3, T4
- **verify:** `npm test` exits 0
- **removes:** none
- **baseline:** suite green before change
- **rollback:** n/a
- **state-after:** working
- **notes:** Manual (not CI): two history tabs → Reload Window → history + backends; duplicate open while connecting; one background tab; optional full quit/reopen. No `@vscode/test-electron` in this plan.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Reload Window: tabs restore with prior conversation | T2+T3 identity/resume + T5 manual (history via existing session/load path) |
| Full quit/reopen when VS Code restores panels | T4 re-stash + T5 manual; launcher fallback already product behavior |
| Claude tab stays Claude | T1 backend in resume decision + T3 wire + T5 manual |
| Grok tab stays Grok | T1 default backend + T5 manual |
| No duplicate tab while connecting | T2 stable id + T5 manual |
| Background tab resumes on first focus | T1 spawn pending + T3 pendingStart + T5 manual |
| Missing disk session fails clearly | existing startSession error path + T5 manual smoke |

## Disposition summary
Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 2 | T2 (activeSessionId wipe on resume), T3 (missing-id new session) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 2 | Webview-primary identity (T4 assist only); short beginOpen (by design after review) |

Net lines: roughly +150–250 / −20. Not silently all-additive: two REPLACE behaviors.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` Primary user symptom is identity/history, not scroll-only.
- Manual Reload Window remains the proof for end-to-end history (no Electron suite yet).

## Approval
- [x] Human approved — 2026-08-02
