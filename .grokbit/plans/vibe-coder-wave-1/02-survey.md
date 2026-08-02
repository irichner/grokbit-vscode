# Survey — Vibe-coder Wave 1 (trust + mid-turn flow)

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Permission grant model | EXISTS | `src/permission-bind.ts:29-36` — `PermissionGrant { kind, value, durable, toolCallId? }` — **no content digest field** |
| `extractGrant` | EXISTS | `src/permission-bind.ts:108-137` — path from `file_path`/`path` or command; ignores `content`/`old_string`/`new_string` for binding |
| `consumeWriteGrant` | EXISTS | `src/permission-bind.ts:151-162` — path match only |
| `consumeTerminalGrant` | EXISTS | `src/permission-bind.ts:168-179` |
| Bind enforcement choke point | EXISTS | `src/acp.ts:647-654` (write), `667-671` (terminal) — uses `params.path` / `params.command`; **does not read `params.content` for bind** |
| `params.content` on write | EXISTS | `src/acp.ts:655` — `await this.fsWrite(params.path, params.content)` after bind |
| `approvedGrants` on client | EXISTS | `src/acp.ts:214-219` — `pushApprovedGrant` |
| Pending permission + rawInput | EXISTS | `src/session.ts:184-189`; set `src/sidebar.ts:2619-2622`; grant on answer `3036-3044` |
| Mid-turn queue state | EXISTS | `src/session.ts:113-117` — `pendingUserSends: { text, sentChips, sentImages }[]` |
| `promptInFlight` lane | EXISTS | `src/session.ts:98`, used `src/sidebar.ts:4438-4440` |
| `queueFollowUpSend` | EXISTS | `src/sidebar.ts:4422-4434` — snapshot + push; **no webview ack** |
| Deferred UI ack | EXISTS | `src/sidebar.ts:4419-4420`, `4471-4475` — bubble at drain in `executeUserSend` when `alreadyAcked` |
| Cancel clears queue | EXISTS | `src/sidebar.ts:2954-2955` (comment); mid-turn cancel path exists |
| Webview mid-turn send | EXISTS | `media/chat.js:5369-5419` — busy + content → `submitMessage` → `{type:"send"}`; empty busy no-op; Stop separate |
| Steer / redirect send | DOES NOT EXIST | searched: `steer`, `Stop and Send`, `redirect` in src/media — only additive queue + cancel |
| Queue-visible user bubble | DOES NOT EXIST | webview posts send; no `{type:"userMessageQueued"}` or similar; host defers emit until drain |
| Content-hash helpers | DOES NOT EXIST | searched: `contentHash`, `bodyHash`, `grantMatches` — none in `src/` |
| Phase A content-hash decision | EXISTS (docs) | `.grokbit/plans/phase-a-trust-host-stability/01-intent.md:22` non-goal; `03-design.md:75` LEAVE; `assumptions.md` A3 |
| Paste / image pipeline | EXISTS | `src/pending-images.ts`, `session.pendingImages`, tests `test/paste-image.dom.test.ts` — **out of this wave** |
| Research priorities | EXISTS | deep-research report (session workflow scratch); product roadmap `docs/plans/product-improvement-roadmap.md:41-48` mentions content hash as Phase A goal (path-only landed) |

## Reusable code

- `src/permission-bind.ts` — pure grant extract/consume; extend in place rather than a second binder.
- `BIND_BLOCKED_*` constants + `mutationBlocked` kind `"bind"` — `src/acp.ts:651-652`; webview already surfaces mutation blocks (reuse message path).
- `queueFollowUpSend` / `handleSend` / `executeUserSend` — single mid-turn lane; steer should cancel + clear queue then call the idle send path, not invent a second queue.
- `media/chat.js` `submitMessage` / `sendOrStop` / `stopGeneration` — extend message types; keep Enter = queue when busy.
- `test/permission-bind.test.ts` — pattern for pure grant tests.
- `test/acp-integration.test.ts` — fake-CLI bind/plan block collection pattern for `mutationBlocked`.
- `Session.pendingPermissions.rawInput` already holds `content` when Claude Write permission carries it — no new store for hash source.

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Path-only write bind (no digest) | `permission-bind.ts:151-162`, `acp.ts:647-654` | 1 consume site + tests | Wave adds optional `contentDigest` on path grants when extractable |
| Phase A “content-hash LEAVE / non-goal v1” | phase-a plan artifacts | docs only | Explicitly reversed for Write-shaped `rawInput.content` only |
| Deferred mid-turn UI-only ack (silent composer clear) | `sidebar.ts:4419-4420`, `4422-4434` | `handleSend` when `promptInFlight` | Queue path must emit immediate queued ack for DC4 |
| Enter-only mid-turn behavior (no steer) | `chat.js:5406-5419` | send button / keyboard | Add steer path; default queue stays |

Caller counts: `consumeWriteGrant` used from `acp.ts` only (1); `queueFollowUpSend` private from `handleSend` (1); `submitMessage` local in chat.js (several keyboard/mic call sites — ≥3, same function).

## Prior attempts

- Phase A permission-bind v1: **live** — path/command only; content-hash Option 3 considered and LEAVE’d (`phase-a-trust-host-stability/03-design.md`).
- Mid-turn **cancel-on-send** (pre-CHANGELOG behavior): **replaced** by additive FIFO queue; CHANGELOG documents current additive policy. Do not reintroduce cancel as default.
- Paste-screenshots mid-turn image snapshot on queue: **live** — `sentImages` in `pendingUserSends` (`session.ts:113-117`). Steer/queue UI must preserve image snapshots.

## Conventions

- **Errors:** JSON-RPC `respondError` with custom codes + `emit("mutationBlocked", { kind, target })` — `acp.ts:643-652`.
- **Tests:** vitest, `test/*.test.ts` and `test/*.dom.test.ts`; `npm test` grok-free — `package.json` scripts (unit tests: `npm test`).
- **State:** per-session bags on `Session` (`session.ts`); pure policy modules without `vscode`.
- **Layout:** host `src/`, webview `media/`, pure helpers shared via `webview-helpers.js` when webview-testable.
- **Shell:** Windows PowerShell / cmd; verify commands use `npm test -- <file>` from repo root.

## Absences

- No content digest on grants.
- No steer / stop-and-send message type.
- No host→webview “queued follow-up” event for deferred sends.
- Coverage tool: NONE (project test commands).

## Danger zones

- `src/acp.ts` — fs/terminal choke points; false rejects break Auto-accept and Agent mode.
- `src/sidebar.ts` `handleSend` / cancel — turn-lane races (`gen`, `promptInFlight`, queue drain).
- `media/chat.js` send/stop button state machine — busy/locked/stoppable already subtle (`chat.js:5331-5355`).
- Phase A tests that assert path-only behavior — must stay green for path-only grants.

## Survey shortcuts

- Did not re-open every autoApprove grant call site; survey assumes same `extractGrant` / `pushApprovedGrant` path as `permissionAnswer` (confirm during implement by grepping `pushApprovedGrant` / `extractGrant` in `sidebar.ts`).
- Webview mutationBlocked UI: not line-cited; existing bind blocks already surface — re-verify string for content-mismatch if new error message added.
