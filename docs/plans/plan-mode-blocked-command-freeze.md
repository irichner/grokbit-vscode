# Plan: Unstick Plan-first freeze on blocked inspection commands

**Slug:** `plan-mode-blocked-command-freeze`  
**Status:** user-approved 2026-08-21 (Plan first verdict). Durable path is this file. Pass-1 review: `docs/plans/plan-mode-blocked-command-freeze.review.md` (Request Changes). This revision addresses RC 1–4.

## Goal

A `/grokbit-plan` turn in **Plan first** must not look frozen when the client gate refuses a shell command. After a block, the session stays obviously *working* (or ends cleanly), harmless Windows inspection commands are not treated as mutations, and grokbit-plan can write its markdown artifacts.

### Acceptance criteria (falsifiable)

1. `isReadOnlyCommand('Write-output "plan path check"; Test-path')` is **true**.
2. `isReadOnlyCommand('if (Test-Path x) { Get-Content x }')` stays **false** (`{ }` still unsafe).
3. `isReadOnlyCommand('Test-Path a; Remove-Item b')` stays **false** (mutating second stage).
4. Webview: open a real turn (`userMessage` or `agentStart`), `setBusy` true (unlocked), then `planBlocked` → **both** `.plan-notice` and `.grokking` (or another live progress affordance) are present. Idle (`setBusy` false) + `planBlocked` → notice, **no** Grokking.
5. Duplicate `planBlocked` with the same `kind+target` **in one turn** adds **one** notice, not N. A later turn with the same command still gets a new notice. Duplicate hits must **not** call `finalizeActivity` / `hideGrokking` (live carousel stays).
6. `shouldBlockWrite('<ws>/.grokbit/plans/foo/01-intent.md', planActive)` is **false**; `shouldBlockWrite('<ws>/src/acp.ts', planActive)` stays **true**. `isPlanFileWrite` stays **false** for those workspace artifacts (snoop helper is not expanded — otherwise `acp.ts` would feed grokbit-plan markdown into the plan-review card).
7. Same recursive carve-out for `<ws>/docs/plans/**/*.md` (not one-level `*.md`). Non-`.md` under those dirs, `.grokbit/handoff.md`, and `.grokbit/hooks/**` stay blocked. `../` escape still blocked.
8. Existing mutating cases (`npm install`, `sed -i`, `git commit`, `{ Remove-Item }`) still blocked.
9. `npm test` green. Coverage: `npm run test:coverage` ≥ 80% changed lines (ladder in `.grok/docs/coverage-policy.md`).

## Non-goals

- Allowing PowerShell `{ }` script blocks / `ForEach-Object` / `Where-Object` / `iex`.
- Replacing JSON-RPC `PLAN_BLOCKED` with a fake terminal (follow-up only if live grok still hangs after 1–3).
- Killing unbounded `Get-ChildItem -Recurse` (allowed today; separate issue).
- Changing grokbit-plan skill prose (optional later).
- Relaxing `.grokbit/hooks/**` or arbitrary `.grokbit/**` writes.

## Risk / blast radius

| Surface | Change |
|---|---|
| `src/plan-gate.ts` | Classifier + write carve-out — security-sensitive |
| `media/chat.js` (+ maybe `media/chat.css`) | Dead-frame + notice coalesce; long-command wrap |
| Tests | `test/plan-gate.test.ts`, `test/plan-card.dom.test.ts` (busy case), maybe `test/acp-integration.test.ts` |
| User | Plan first sessions; grokbit-plan in Plan first |
| Data | None. Carve-out is markdown under two plan dirs only |

Shared-lib: none. Auth/payments: none. Worst failure: too-wide allowlist (`;` + evil second stage, or write carve-out escaping into `src/`). Tests below are the backstop.

## Approach (chosen)

**A (chosen): keep JSON-RPC block, fix classifier + dead frame + artifact carve-out.** Small, matches current architecture (`research/understanding-plan-mode.md`: agent is supposed to continue on the JSON-RPC error). Screenshot freeze is explained by `addPlanNotice` wiping Grokking without `ensureActivityIndicator`.

**B (rejected for v1):** complete blocked `terminal/create` as a dummy exited terminal. Helps only if grok ignores JSON-RPC errors; changes ACP contract tests. Revisit if live hang remains.

**C (rejected):** tell users to leave Plan first before `/grokbit-plan`. Conflicts with `resources/skills/grokbit-plan/references/host-adapters.md` (“run grokbit-plan inside plan mode”).

## Ordered steps

### T1 — Read-only `;` stages + `Write-Output`/`Write-Host`

**Files:** `src/plan-gate.ts`, `test/plan-gate.test.ts`

- Treat `;` like `|`: split the command on `[|;]` (trim, drop empty stages) and require every stage `isReadOnlyStage`.
- Remove `;` from `UNSAFE_SHELL` (keep `` ` ``, `{ }`, `||`, `$(`, `&`, newlines, redirects). `&&` is already blocked because `&` is in the class.
- Add `write-output`, `write-host` to `READONLY_HEADS` (echo aliases).
- Keep `{ }` blocked.

**Verify:** `npx vitest run test/plan-gate.test.ts`  
Include the screenshot command, `Test-Path a; Remove-Item b` (negative), script-block still false, `Write-Output x | Out-File y` still false, existing pipe tests still pass.

### T2 — Plan-artifact write carve-out

**Files:** `src/plan-gate.ts`, `test/plan-gate.test.ts`

New helper (next to `isPlanFileWrite`): path canonicalizes inside workspace AND matches:

- `<ws>/.grokbit/plans/**/*.md`
- `<ws>/docs/plans/**/*.md`

Use existing `canonical` / `isInsideWorkspace` so `..` cannot escape. Do **not** allow `.grokbit/hooks`, `.grokbit/handoff.md`, or non-markdown.

Carve-out is **`shouldBlockWrite` / `fs/write_text_file` only**. Shell `Set-Content` / `Out-File` / `New-Item` stay blocked by T1 heads. Do **not** fold this into `isPlanFileWrite`.

**Verify:** `npx vitest run test/plan-gate.test.ts`
- allow: `.grokbit/plans/foo/01-intent.md`, `docs/plans/nested/x.md`, relative and `\\?\` Windows forms matching existing `shouldBlockWrite` style
- deny: `src/acp.ts`, `.grokbit/handoff.md`, `.grokbit/hooks/settings.json`, `docs/plans/foo.ps1`, `.grokbit/plans/foo/../../src/x.ts`
- `isPlanFileWrite` false for every allowed workspace artifact

### T3 — Restore live progress after a block notice

**Files:** `media/chat.js`, `media/chat.css`, `test/plan-card.dom.test.ts`, plus a CSS source-text assert (same `ruleBlock` idiom as `test/chat-layout.dom.test.ts` / `test/chat-turn-containers.dom.test.ts` — happy-dom does **not** load `chat.css` in `plan-card.dom.test.ts`)

`addPlanNotice(text)` order is load-bearing:

1. Scope: last `.plan-notice` under `state.activeTurnEl` (fallback `#messages`). Key on stored notice text (`data-plan-notice` or equivalent), not concatenated `textContent` with the icon.
2. **Coalesce hit (same text, same turn):** do **not** call `finalizeActivity()` or `hideGrokking()`. Call `ensureActivityIndicator()` and return. This is AC 5 — a duplicate block must not tear down a live carousel.
3. **Insert path (new text or new turn):** `finalizeActivity()` → `hideGrokking()` → append notice → `ensureActivityIndicator()`.
4. `ensureActivityIndicator` is invoked from `addPlanNotice` itself (`planBlocked`/`planNotice` are not in `TURN_PROGRESS_MSGS`). It already no-ops when `!busy || busyLocked || replaying`.

CSS (existing tokens only):

```css
.plan-notice { align-items: flex-start; } /* icon stays top-aligned when the command wraps */
.plan-notice span { min-width: 0; overflow-wrap: anywhere; }
.plan-notice svg { flex-shrink: 0; } /* already present; keep */
```

`min-width: 0` is mandatory: parent is `display: flex`; without it `overflow-wrap` is a no-op.

**Verify:**
- `npx vitest run test/plan-card.dom.test.ts`
  - Busy+blocked: `userMessage` or `agentStart`, then `{ type: "setBusy", value: true }`, then `planBlocked` → **both** `.plan-notice` and `.grokking`.
  - Idle+blocked: default ready (busy false) + `planBlocked` → notice, no `.grokking`.
  - Two identical `planBlocked` in one turn → one notice; a running `.activity-carousel` / `.tool-group` (if present before the second event) is **not** removed by the duplicate.
  - Different targets → two notices. Existing three-notice fixture stays valid (distinct texts).
  - New turn + same command → a second notice (coalesce is per-turn).
- CSS source-text (layout test or a small case next to other `ruleBlock` tests): `.plan-notice span` contains `min-width: 0` and `overflow-wrap: anywhere`; `.plan-notice svg` still `flex-shrink: 0`.

**UI states:** busy+blocked (notice + Grokking); idle+blocked (notice, no Grokking); duplicate block (one notice, live activity preserved); long command (wraps, icon top-aligned). Pattern: existing `.plan-notice` + `.grokking`. a11y: Grokking already has `aria-label="Grok is working"`; notices remain text.

### T4 — Regression suite

**Verify:** `npx tsc -p . --noEmit`; `npm test`; `npm run test:coverage` on changed files (rung: changed-line if tool emits it, else changed-file proxy). Record rung.

## Testing strategy

| Behavior | Test | Edge/negative |
|---|---|---|
| Screenshot command allowed | `plan-gate.test.ts` | `Test-Path a; Remove-Item b` still blocked |
| `{ }` still blocked | existing + keep | script-block smuggling; `Write-Output x \| Out-File y` still false |
| Artifact `**/*.md` allowed | new | `src/`, `.ps1`, `../` deny; `handoff.md` / hooks deny; `isPlanFileWrite` false |
| Dead frame | DOM: real turn + setBusy true | idle+blocked → no Grokking |
| Coalesce | DOM: same text, one turn | different target → two; new turn → new notice; duplicate does not finalize |
| Wrap CSS | `ruleBlock` source-text | `min-width: 0` present (flex child) |

Coverage expectation: ≥80% new/changed executable lines (`npm run test:coverage`). Waiver path: `docs/waivers/` only if tool cannot measure.

## Failure modes

- **`;` split too naive inside quotes:** `echo "a;b"` may split and block a safe command (fail-closed). Accept.
- **Carve-out escape:** must use `isInsideWorkspace` after canonicalize; test `..`.
- **Notice coalesce keyed wrong:** different commands collapsed — key on stored notice text (`data-plan-notice`), scoped to the active turn.
- **Coalesce after finalize:** a duplicate would destroy the live carousel — prevented by checking **before** `finalizeActivity`.
- **ensureActivityIndicator during priming:** already no-ops on `busyLocked`/`replaying`.
- **isPlanFileWrite expanded by mistake:** workspace plan markdown would snoop into the review card — unit-tested false.
- **Rollback:** revert the three files + tests; gate returns to current conservative behavior.

## Observable verification

- Unit: commands and paths above.
- DOM: real-turn + busy + `planBlocked` shows notice **and** Grokking; composer still “Enter queues” is OK — progress must be visible.
- CSS: source-text `ruleBlock` for wrap + `min-width: 0` (not computed layout; happy-dom does not apply `chat.css` in the plan-card harness).
- Manual (post-implement, Plan first): `/grokbit-plan` with a short prompt. `Write-output …; Test-path` must **not** freeze the canvas. If grok still never emits `agentEnd` after a *still-blocked* command, file a follow-up for approach B (dummy terminal) — do not silently expand T1.

## UI/UX design

Required (T3 touches chat). Design reference: `.plan-notice` (`media/chat.css`) + `.grokking` continuous-indicator (`CLAUDE.md` § Chat surfaces). No new colors; VS Code tokens + existing `--neon-cyan-ink` border.

State inventory:

| State | Expected |
|---|---|
| empty | no notice (N/A — notices only appear on block) |
| loading / pending (busy + block) | `.plan-notice` + `.grokking` (`aria-label="Grok is working"`) |
| error / failure | the notice *is* the failure signal; Grokking if still busy |
| disabled | N/A (not a control) |
| overflow | long command wraps via `overflow-wrap: anywhere` + `min-width: 0`; icon `flex-start` / `flex-shrink: 0` |
| focus | N/A (notice is not interactive); Grokking is not a tab stop |

## Assumptions

- Screenshot OCR of `Enter queues` means webview still paints; this is a **dead busy frame**, not a full extension-host hang. If VS Code chrome itself is frozen after T3, that is a separate host-loop bug (UNVERIFIED).
- Real grok continues after JSON-RPC `PLAN_BLOCKED` (`research/understanding-plan-mode.md`). Fake-CLI already ends the prompt after the error (`test/fixtures/fake-grok-acp.cjs` `SCENARIO_MUTATING_TERMINAL`).
- Durable `docs/plans/` + `gf-plan-reviewer` run **after** this Plan-first approve, because workspace writes were gated until then.

## Disposition

| Existing | Disposition |
|---|---|
| `UNSAFE_SHELL` including `;` | **REPLACE** with pipe-like staging |
| `isPlanFileWrite` grok-home carve-out | **COEXIST** — add workspace plan-dir helper, do not fold into grok `plan.md` regex |
| `addPlanNotice` finalize+hideGrokking | **REPLACE** tail with restore indicator + coalesce |
| JSON-RPC `respondError` on block | **LEAVE** |
