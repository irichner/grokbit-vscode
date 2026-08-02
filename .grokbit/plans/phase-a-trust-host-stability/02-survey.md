# Survey — Phase A: Trust & host stability

Grounding pass. Citations are from reads in this planning session unless marked otherwise.

## Entities

| Entity | Status | Location |
|--------|--------|----------|
| Permission request emit | EXISTS | `src/acp.ts:648-656` — `session/request_permission` → `permissionRequest` event; response async via `respondPermission` |
| Permission host handler | EXISTS | `src/sidebar.ts:2400-2438` — plan pre-reject (Grok only), autoApprove, `pendingPermissions`, emit card |
| Permission answer | EXISTS | `src/sidebar.ts:2828-2837` — `permissionAnswer` → `respondPermission` + buffer + `persistPermissionAnswer` |
| Pending permission store | EXISTS | `src/session.ts:157` — `Map` of `{ title, toolCallId?, options }` only — **no path/content** |
| Persist answered perms | EXISTS | `src/sidebar.ts:1428-1448` — title/outcome/toolCallId for resume UI only |
| Permission UI + synthetic diff | EXISTS | `media/chat.js:4334-4384` — `permissionDiffFromRawInput`; no “synthetic” badge |
| Infer kind / synth diff pure | EXISTS | `media/webview-helpers.js:392-421` |
| `fs/write_text_file` gate | EXISTS | `src/acp.ts:588-611` — plan block via `shouldBlockWrite` if `quirks.clientPlanGate`; then `fsWrite` |
| `fsWrite` body | EXISTS | `src/sidebar.ts:2222-2231` — write only, **no approval correlation** |
| `terminal/create` gate | EXISTS | `src/acp.ts:613-623` — same `clientPlanGate` + `shouldBlockTerminal` |
| Plan-gate pure policy | EXISTS | `src/plan-gate.ts:241-255` — `shouldBlockWrite` / `shouldBlockTerminal` / `shouldRejectPermission` |
| Backend quirks | EXISTS | `src/backends.ts:48-118` — Grok `clientPlanGate: true`; Claude `false` |
| `AcpClient.planActive` | EXISTS | `src/acp.ts:177`, toggled with session |
| Claude adapter install | EXISTS | `src/claude-locator.ts:232-237` — **async** `execFileAsync`; `sidebar.ts:542-576` `withProgress` |
| Grok CLI on-demand update | EXISTS | `src/sidebar.ts:1903-1960` — `disposePool()` **no backend filter**; respawns **all** panels |
| `disposePool(backend?)` | EXISTS | `src/sidebar.ts:4534-4543` — optional backend filter already used by logout |
| Permission outcome pure | EXISTS | `acp-dispatch` `permissionOutcomeFor` (tests in `test/acp-dispatch.test.ts`) |
| Permission bind module | **DOES NOT EXIST** | No grant extract/match helpers |
| Tests: plan-gate | EXISTS | Likely `test/plan-gate*.ts` (suite has plan-gate consumers); permission DOM in `test/card-collapse-tasks.dom.test.ts` |

## Current behavior (facts)

### Permission → write gap

1. Host stores only UI metadata on permission (`session.ts:157`), not `rawInput` path/content/command.
2. On allow, host only calls `respondPermission` (`sidebar.ts:2828-2837`); nothing records a grant for later fs/terminal checks.
3. `fs/write_text_file` applies plan-gate (Grok) then unconditional write (`acp.ts:588-611`, `sidebar.ts:2222-2231`).
4. Documented known limit (CLAUDE.md): approved permission is not bound to the write/command previewed.

### Plan gate vs Claude

1. Single quirk `clientPlanGate` gates **both** fs/terminal blocking **and** permission pre-reject (`acp.ts:595-620`, `sidebar.ts:2409-2422`).
2. Claude: all false (`backends.ts:112-118`). Comments claim Claude enforces plan natively and pre-reject would block legitimate Claude plan asks.

### CLI update

1. Comment at `sidebar.ts:1922-1943` states whole pool teardown for binary lock (Windows).
2. `await this.disposePool()` has no `backend` arg — Claude processes die too.
3. Loop `for (const s of this.panels)` respawns every panel (`1947-1960`), including Claude (unnecessary restart).

### Claude install

1. Code is async (`claude-locator.ts:227-237`, `sidebar.ts:534-552`).
2. CLAUDE.md “Known limits” still describes synchronous install — **doc drift**.
3. `withProgress` has no `cancellable: true` / token wiring observed in `installClaudeAdapterOnDemand`.

### Synthetic preview

1. `diff = pendingDiffByToolCallId || permissionDiffFromRawInput(...)` (`chat.js:4370`).
2. No branch labels which source was used.

## Conventions observed

- Pure policy in `src/*` without vscode; glue in `sidebar.ts` / `acp.ts`.
- Backend differences via `BackendQuirks`, not scattered `if (backend === …)`.
- DOM tests drive real `media/chat.js`; pure tests for helpers.
- Mutation blocked already has event path: `mutationBlocked` → `planBlocked` (`sidebar.ts:2439-2441`) — reusable for bind failures.

## Supersession / adjacent

| Item | Callers / use | Likely disposition |
|------|----------------|-------------------|
| Unbound write path | All agent writes | REPLACE with grant-checked path when grants exist |
| Monolithic `clientPlanGate` | acp + sidebar | REPLACE or split into two quirks / two flags |
| CLAUDE.md sync-install claim | Docs only | REPLACE with accurate async description |
| `disposePool()` on grok update | one call site | REPLACE with `disposePool("grok")` + panel filter |
| `pendingPermissions` shape | persist + UI | COEXIST — extend or parallel `approvedGrants`; don’t break persist shape without migration |

## Gaps / absences

- No content digest on grants (intentional non-goal for v1).
- No electron integration test for multi-backend update (Phase D).
- Wire: toolCallId not on fs write — **cannot** key write by toolCallId without protocol change.

## Loop 2 note

Sampled permission, plan-gate, install, update paths; did not re-read entire `sidebar.ts` (~4.5k lines). Caller counts for `disposePool` / `clientPlanGate` from grep, not exhaustive AST.
