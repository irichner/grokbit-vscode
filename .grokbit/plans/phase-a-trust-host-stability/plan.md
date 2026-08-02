# Plan — Phase A: Trust & host stability

Slug: `phase-a-trust-host-stability` · Approach: Path-scoped grant queue + split plan quirks + grok-only CLI update · Blast radius: ~8–12 files, 0 new deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

Also tracked at roadmap level: `docs/plans/product-improvement-roadmap.md` Phase A.

## Tasks

### T1 — Pure permission-bind module (extract + match + consume)
- **intent:** Add unit-tested pure helpers to extract grants from permission payloads and match/consume them against write paths and terminal commands; empty grant list always allows.
- **files:** `src/permission-bind.ts` (new), `test/permission-bind.test.ts` (new)
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/permission-bind.test.ts`
- **removes:** none
- **baseline:** none (new module)
- **rollback:** delete the two new files
- **state-after:** working
- **notes:** Cover: Claude `file_path`+`content` write; `file_path`+old/new edit; grok path shapes if different; Windows separators; command grant match; allow_once consume vs allow_always durable; no path → no scoped grant; empty list → allow write. Do not import vscode.

### T2 — Record grants on allow; enforce on fs/terminal
- **intent:** On user allow and autoApprove allow, push grants; in `AcpClient` (or host fsWrite wrapper) refuse mismatched writes/commands when scoped grants exist; surface block via existing mutationBlocked/planBlocked path with distinct copy.
- **files:** `src/session.ts`, `src/acp.ts`, `src/sidebar.ts`, `test/permission-bind.test.ts` and/or fake-CLI/integration test if present, possibly `test/acp*.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/permission-bind.test.ts` plus any new acp/sidebar unit tests; `npm test` if acp integration fixture can express bind
- **removes:** none
- **baseline:** `fsWrite` always writes after plan-gate (`src/sidebar.ts:2222-2231`); autoApprove responds without recording grants (`src/sidebar.ts:2424-2427`); `permissionAnswer` only `respondPermission` (`:2828-2837`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Review R1: autoApprove must record grants (DC3). Empty grants → allow (DC Agent mode). Prefer enforce inside `acp.ts` handleServerRequest after plan-gate so one choke point matches plan-gate. Session field e.g. `approvedGrants: Grant[]`. Clear single-consume grants on promptComplete optional. allow_always keeps durable path grant. Emit block event with kind like `bind` or reuse mutationBlocked with clear target text.

### T3 — Split plan quirks; Claude fs/terminal gate on
- **intent:** Grok keeps plan permission pre-reject + fs/terminal gate; Claude enables client fs/terminal plan gate only; permission pre-reject stays grok-only so Claude plan UX is not auto-denied.
- **files:** `src/backends.ts`, `src/acp.ts`, `src/sidebar.ts`, tests for backends quirks / plan-gate wiring
- **cwd:** none
- **depends:** none (can parallel T1); merge carefully with T2 if both touch acp.ts
- **verify:** `npm test -- test/backends.test.ts test/plan-gate.test.ts` (adjust names to existing test files) AND full `npm test` if quirk tests live elsewhere
- **removes:** none (may rename/split quirk fields)
- **baseline:** Claude `clientPlanGate: false` (`src/backends.ts:112-118`); pre-reject and fs gate both keyed off same flag (`src/acp.ts:595-620`, `src/sidebar.ts:2409-2422`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Preferred shape: `clientPlanGate` = fs/terminal (true both backends); new `clientPlanPermissionReject` = true Grok only. Update comments in backends.ts and CLAUDE.md known-limits bullet about Claude having no client backstop. If existing tests assert Claude false, update them intentionally.

### T4 — Grok CLI update disposes only grok sessions
- **intent:** `updateGrokCliOnDemand` tears down and respawns only grok backend sessions/panels; Claude tabs keep their live process; busy warning counts grok sessions.
- **files:** `src/sidebar.ts`, tests if any pure extract possible — else document manual verify + defensive unit on filter helper if extracted
- **cwd:** none
- **depends:** none
- **verify:** Prefer extract pure `panelsAffectedByGrokCliUpdate(sessions)` tested with unit test; `npm test --` that file; manual smoke: two tabs (grok+claude), update grok, Claude pid survives
- **removes:** none
- **baseline:** `await this.disposePool()` unfiltered (`src/sidebar.ts:1945`); all panels restarted (`:1953-1960`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Use `disposePool("grok")`. Do not set Claude `pendingStart` or call `startSession` for Claude. `cliUpdating` should not brick Claude UI (filter broadcast or webview ignore when backend is claude).

### T5 — Synthetic permission preview label
- **intent:** When the card’s diff comes from `permissionDiffFromRawInput` (not structured pending diff), show “Preview from agent input”.
- **files:** `media/chat.js`, `media/chat.css` (minimal), `test/card-collapse-tasks.dom.test.ts` or new `test/permission-preview.dom.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/card-collapse-tasks.dom.test.ts` (or new DOM test file)
- **removes:** none
- **baseline:** `chat.js:4370` uses synth fallback with no label
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Branch on source of truth, not backend id (Review R1 #5). Theme tokens only.

### T6 — Docs + install honesty (async already)
- **intent:** Align CLAUDE.md known limits with async install; note best-effort cancel if added; refresh Phase A bullets in product roadmap status if desired.
- **files:** `CLAUDE.md`, optionally `src/sidebar.ts` (`cancellable: true` on withProgress), `docs/plans/product-improvement-roadmap.md`
- **cwd:** none
- **depends:** T4 optional; can land after T2–T5
- **verify:** `rg -n "synchronous.*120|120 MB npm install" CLAUDE.md` shows no false “sync freeze” claim; `npm test` still green
- **removes:** stale known-limit sentence about synchronous install
- **baseline:** CLAUDE.md Known limits claims sync install; code is async (`src/claude-locator.ts:232-237`)
- **rollback:** restore doc sentences
- **state-after:** working
- **notes:** Optional cancel is MINOR; do not fail Phase A if npm cannot be killed. No network in tests.

### T7 — Regression suite green
- **intent:** Full grok-free suite passes after T1–T6.
- **files:** any test fixes required
- **cwd:** none
- **depends:** T1–T6
- **verify:** `npm test`
- **removes:** none
- **baseline:** `npm test` green on pre-change tree
- **rollback:** revert feature commits
- **state-after:** working
- **notes:** Floor remains 1336+ tests; count may rise.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| DC1 mismatch write blocked | T1 + T2 verify |
| DC2 matching write ok | T1 + T2 verify |
| DC3 YOLO records grants | T2 notes + tests |
| DC4 Claude plan fs/terminal gate | T3 verify |
| DC5 synthetic label | T5 verify |
| DC6 grok-only CLI update | T4 verify |
| DC7 async install docs (+ optional cancel) | T6 verify |
| DC8 suite green | T7 `npm test` |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 4 | T2 unbound writes; T3 quirk split; T4 dispose scope; T6 stale install docs |
| LEAVE | 3 | pendingPermissions persist shape; content-hash; every-write-requires-grant |
| COEXIST | 0 | — |
| DEPRECATE | 0 | — |

Net lines: additive pure module + glue; small doc deletions.

## Open assumptions

See `assumptions.md` (A1–A7). Product-critical: A3–A5.

## Approval

- [x] Human approved — date: 2026-08-01
- [x] Proceed to baseline capture (`grokbit-test` baseline) then `grokbit-implement`
