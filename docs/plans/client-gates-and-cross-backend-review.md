# Client-side gates + cross-backend review (agentic-team hardening)

| Field | Value |
|-------|--------|
| **Status** | Proposed (2026-08-03) — not started. Supersedes the roadmap in `.grokbit/plans/workflow-compare-ultimate-template/plan.md` (that package's survey + Option D framing stand; its task order does not) |
| **Owner** | Lead (Grokbit) |
| **Decision (layer)** | Enforcement lives at the extension's own ACP choke points, not in provisioned files inside the user's repo |
| **Decision (differentiator)** | Cross-backend orchestration is the capability neither source template can have; it leads the roadmap instead of trailing it |
| **Decision (hooks)** | CLI hook provisioning is **conditional on a probe** (WP0) and scoped to the one thing a client cannot do — block a turn from ending |
| **Decision (trust)** | The extension never grants folder trust on the user's behalf, under any setting |

## Goal

Close the enforcement gap the three-way comparison found, **without** turning a thin client into a file-provisioning harness — and ship the one workflow that only Grokbit can offer: draft with one agent, review with the other, each at its own model and reasoning effort.

**Success looks like:** in Auto-accept mode a write to `.env` is refused by the extension on both backends; a turn that leaves the test suite red does not silently end; opening a second agent to review the first one's plan is one click, at a model and effort you choose; and no second copy of a Stop gate is installed on top of the one this workspace already runs.

## Why not the reviewed plan's shape

The reviewed package proposed vendoring GrokForge's Python hooks into `resources/hooks/` and provisioning them into user workspaces (its T2–T5), with dogfood enable (T4) ahead of collision documentation (T7). Three findings from verification against this repo and `grok 0.2.118` reshape that:

1. **This workspace already runs a deterministic Stop gate.** `.claude/hooks/verify-on-stop.sh` is wired via `.claude/settings.json` (`Stop`, `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`), alongside `.claude/agents/` (9), `.claude/skills/` (7) and `.claude/commands/` (9, incl. `ship.md`). The gap is Grok-side only.
2. **The dual-hook hazard is live, not hypothetical.** Per `~/.grok/docs/user-guide/10-hooks.md` § Hook Locations, grok reads `<project>/.claude/settings.json` as a hook source under folder trust — and `C:\Users\israe\Projects\Grokbit.ai` is already `trusted = true` in `~/.grok/trusted_folders.toml`. Installing `.grok/hooks/` here would very likely give every Grok turn two Stop gates, two change markers, two protected-path guards, and `npm test` twice.
3. **Provisioned hooks are the weaker mechanism for this product.** Every `fs/write_text_file` and `terminal/create` from *either* backend already passes through `src/acp.ts:628`. A guard there is one implementation for both backends, needs no folder trust, no Python, writes nothing into the user's repo, and is covered by the grok-free `npm test`. Folder trust is also a footgun the plan under-weighted: `--trust` / `/hooks-trust` grants **MCP + LSP + hooks together and cascades to subdirectories** (10-hooks.md:80), so an extension that auto-trusts to make its hooks fire has enabled arbitrary repo-local MCP servers.

The real gap client-side enforcement leaves is exactly one thing: `permission-bind.ts:182` allows any write when no scoped grants are outstanding (by design), so **Auto-accept has no protected-path floor at all**. That is WP1, and it is ~40 lines of pure policy, not a vendored tree plus a provisioner plus a trust UX.

## Non-goals

- **Not** reimplementing the accuracy protocol, plan-quality gates, or coverage ladder in TypeScript — those stay in skills.
- **Not** rewriting either template repo, or installing Ultimate/GrokForge wholesale.
- **Not** auto-provisioning anything into a user workspace on activation. WP5, if it ships at all, is an explicit command.
- **Not** granting folder trust programmatically, ever — not behind a setting, not with a confirm.
- **Not** a workflow *engine*. WP2 is two tabs and a seeded brief; a general multi-step executor is deliberately deferred (see Open questions).
- **Not** touching `record_session_tokens.py`'s territory — the development-token ledger is dev-time only and already settled (ADR 0003).

## Assumptions to probe before committing (WP0)

The reviewed plan assumed provisioned hooks would fire for extension sessions. That is unverified for this transport, and GrokForge's own ADR 0001 is the precedent that these docs can be wrong about exactly this (documented `${VAR}` expansion that never fires). Under ACP **the extension is the filesystem provider** — grok calls `fs/write_text_file` on the client — so it is genuinely unknown whether a `PreToolUse` matcher on `write|search_replace` ever sees a client-routed write.

| # | Question | Consequence if false |
|---|---|---|
| A | Do project hooks load at all under `grok agent stdio`? (`15-agent-mode.md:9` says "Deny rules and hooks still apply") | WP5 dies entirely |
| B | Does `PreToolUse` fire for a write routed to the client, and with what `toolName` / `toolInput.file_path`? | `protect_paths.py` is dead on arrival in extension sessions; WP1 is the only protection |
| C | Does `{"decision":"deny"}` actually block that write, and what does the ACP client observe? | Same as B |
| D | Does `Stop` fire at ACP turn end, and does `{"decision":"block"}` make the agent continue? | WP5 drops to nothing; WP3 is the only completion gate |
| E | Does grok load this repo's `.claude/settings.json` hooks (compat layer, trusted folder)? | Confirms or retires the double-fire risk that reorders T4/T7 |

## Architecture

| Module | New? | Role |
|---|---|---|
| `src/path-norm.ts` | new (pure) | `canonicalTarget` / `isInsideWorkspace` extracted from `plan-gate.ts`, which re-exports them unchanged. One normalizer for containment checks instead of a third private copy |
| `src/write-guard.ts` | new (pure) | Protected-path policy: `isProtectedPath`, `DEFAULT_PROTECTED_PATTERNS`, `matchProtectedPattern` |
| `src/cross-review.ts` | new (pure) | `buildReviewBrief`, `latestPlanDir` (injected `FsLike`, mirroring `sessions.ts`) |
| `src/verify-gate.ts` | new (pure) | `detectVerifyCommand`, `shouldVerify`, `buildVerifyFollowUp`, `nextVerifyState` |
| `src/hook-scan.ts` | new (pure) | `scanHookStacks`, `detectDoubleGate` — which hook stacks a workspace would actually activate, and where they collide |
| `src/hook-suite.ts` | new (pure, WP5 only) | `HOOK_SUITE_FILES`, `shouldProvisionHooks`, `hookTargets` — mirrors `skill-suite.ts` |
| `src/acp.ts` | edit | Wire WP1 at `fs/write_text_file`; emit `fileWritten` for WP3 |
| `src/sidebar.ts` | edit | WP2 tab + seed plumbing, WP3 turn-end orchestration, WP4 warning line |
| `src/session.ts` | edit | `pendingSeed`, `turnChangedFiles`, `verifyState` |
| `media/chat.js`, `media/webview-helpers.js` | edit | WP2 "Review with…" popover, WP3 verify banner/card |

Pure-module discipline is unchanged: no `vscode`, no top-level `node:fs`, no spawning, in any of the five new pure modules.

## Work packages

### WP0 — Probe the hook contract over ACP (gates WP5, informs WP1/WP4)

**Deliverable:** `research/grok-hooks-acp-probe.cjs` + `research/grok-hooks-acp.md`, in the existing manual-probe idiom (`research/*.cjs`; never in `npm test` or CI).

The probe spawns `grok agent stdio` against a scratch workspace, registers `.grok/hooks/probe.json` handlers that append their full stdin envelope to a log, drives a real `session/new` → `session/prompt` that (a) writes a file and (b) leaves a red test, and dumps every `session/update` the client received alongside the hook log. Answers A–E above, each with a log excerpt.

Run it twice: once in a trusted folder, once in a fresh untrusted temp dir (question E's control).

**Also in this WP (doc drift the survey tripped over):** `CLAUDE.md` states a 1336-test floor while `.grokbit/handoff.md` records 1538 green, and `src/agent-handoff.ts` is absent from § Module map. Fix both — the reviewed plan cited `CLAUDE.md` as the authority on extension capability and consequently under-counted what already ships.

**Verify:** `research/grok-hooks-acp.md` answers A–E with evidence; `node research/grok-hooks-acp-probe.cjs` reproducible; `npm test` untouched.

**Decision rule (write it into the doc):** B/C false → WP5 sheds `protect_paths` entirely. D false → WP5 is cancelled and WP3 is the only completion gate.

---

### WP1 — Protected-path write guard at the ACP choke point

**Why:** the one real hole. `consumeWriteGrant` allows any write when no scoped grants exist (`permission-bind.ts:182`), so Auto-accept / `yolo` has no floor. Applies to **both** backends, no quirk flag — this is client safety policy, not a grok compat hack.

1. Extract `canonicalTarget` / `isInsideWorkspace` from `plan-gate.ts` into `src/path-norm.ts`; `plan-gate.ts` re-exports them so no existing importer changes. **Leave `permission-bind.ts`'s `normalizeGrantPath` alone** — it is grant *matching*, not containment, and unifying it is a separate risk (Open questions).
2. `src/write-guard.ts` (pure): `DEFAULT_PROTECTED_PATTERNS` = `.env`, `.env.*` (**excluding** `*.example` / `*.sample` / `*.template`), `*.pem`, `*.key`, `id_rsa*`, `**/secrets/**`, `.git/**`, `.ssh/**`, plus the self-protection set — `.grok/hooks/**`, `.claude/hooks/**`, `.claude/settings.json`, `.claude/settings.local.json`. An agent editing its own gate is the classic bypass and both templates guard it.
3. Wire in `src/acp.ts` `fs/write_text_file`, **after** the plan gate and **before** the permission bind: on match, `emit("mutationBlocked", {kind:"protected", target})` and `respondError(id, PROTECT_BLOCKED_CODE /* -32012 */, msg)`. Writes outside the workspace (grok's own `plan.md`) are unaffected — the guard only matches relative-to-workspace patterns.
4. Setting `grok.protectedPaths: string[]`, defaulting to the pattern list; `[]` disables. One key, no second enable flag.
5. Scope honestly: **writes only**. Command inspection for "does this shell line write a protected path" is not reliable, is not attempted, and says so in the setting description and § Known limits.

**Files:** `src/path-norm.ts`, `src/write-guard.ts`, `src/acp.ts`, `src/plan-gate.ts` (re-export only), `package.json`, `CLAUDE.md` (§ ACP surfaces + § Known limits), `test/write-guard.test.ts`, `test/path-norm.test.ts`, a case in `test/acp-integration.test.ts`.

**Verify:** `npm test` green over the current floor + new cases (`.env` blocked, `.env.example` allowed, `~/.grok/**/plan.md` allowed, `.grokbit/plans/**` allowed, Windows/POSIX separators, case-insensitive on drive paths); integration case asserts the blocked write returns `-32012` **and leaves no file on disk**; `npx tsc -p . --noEmit` clean.

**Rollback:** revert; `grok.protectedPaths: []` is the runtime escape hatch.

---

### WP2 — Cross-backend review: draft with one agent, review with the other

**Why:** the only capability in the whole comparison neither template can have. Ultimate's ADR 0004 removed multi-runtime; GrokForge's ADR 0002 treats dual-stack as a hazard to contain. Grokbit is the only one holding both agents at once — and a **native** workflow can never do this, because grok executes `.rhai` and Claude executes `.js`, each inside one runtime. Cross-backend orchestration must live in the extension.

**Shape: a second tab, not a restarted one.** `switchBackend` tears the current agent down; that is wrong here — you want the planner alive to answer the review.

1. `src/cross-review.ts` (pure): `latestPlanDir({fs, workspaceRoot})` finds the newest `.grokbit/plans/<slug>/`; `buildReviewBrief({fromBackend, toBackend, planPath?, transcript?})` composes the seed. **Prefer a path handoff** — a reviewer should read the plan, not the planner's reasoning — and fall back to the existing `buildAgentHandoffText(session.buffer)` + `agentHandoffEnvelope` (`src/agent-handoff.ts`, already shipped, 48k cap) only when no artifact exists.
2. Host: message `{type:"reviewWithOtherBackend", backend, modelId?, effort?}` → `newTab(backend)` with `session.effort` and the model set **before** spawn (`seedSessionEffort` already no-ops on an already-set `effort`, `sidebar.ts:504`; the model goes through the existing pre-primer application path, so `resolveModelId`'s versioned-id handling is inherited).
3. **The seed must be deferred like `pendingStart`.** `seedComposer` is a `postTo` — dropped when the panel isn't ready — so the brief is stored as `Session.pendingSeed` and posted from the `ready` handler after `replayInto`. Firing it eagerly at `newTab` time silently loses it. This is the one non-obvious correctness detail in the WP.
4. UI: a "Review with…" entry in the Actions popover and on the plan card, opening a small popover built from the **existing** pure `sessionSetupModel({backend, modelId, availableModels, effort, effortLevels, …})`. Reusing it gets the Claude constraint right for free: `CLAUDE_EFFORT_LEVELS` is empty, so the Thinking row is omitted rather than rendered as a lie. Claude's only reasoning knob is `MAX_THINKING_TOKENS`, read from env **at spawn** — which the fresh-tab design satisfies by construction.
5. Never auto-send. The new tab opens with the brief in the composer, same contract as every other capability seed.

**Files:** `src/cross-review.ts`, `src/sidebar.ts`, `src/session.ts`, `media/chat.js`, `media/webview-helpers.js`, `test/cross-review.test.ts`, `test/cross-review.dom.test.ts`, a `pendingSeed` case alongside `test/panel-restore.test.ts`.

**Verify:** `npm test` green incl. — brief prefers plan path over transcript; falls back when absent; popover omits the Thinking row for Claude and shows it for Grok; a seed queued before `ready` is delivered after replay, exactly once, and is not in `Session.buffer` (it must not replay a second time on reveal).

**Rollback:** revert; feature is purely additive (a new action + a new tab).

---

### WP3 — "Verify before done": the client-side completion gate

**Why:** the client cannot block a turn at the protocol layer — but it can *observe* the turn end, run the project's checks, and inject a follow-up, which is what the Stop hook does. Backend-agnostic, trust-free, visible, cancellable. The pieces already exist: the host sees every write, and the plan primer already proves a follow-up turn can be injected (`[Plan approved]`).

1. `src/acp.ts` emits `fileWritten {path}` after a successful `fs/write_text_file`; `sidebar.ts` records into `Session.turnChangedFiles`, cleared at each real send.
2. `src/verify-gate.ts` (pure): `detectVerifyCommand(packageJsonText)` (port the bash hook's logic — `test` script unless it is npm's `no test specified` placeholder; respect `pnpm-lock.yaml`/`yarn.lock`), `shouldVerify({enabled, changedFiles, priming, suppressed})`, `buildVerifyFollowUp({command, exitCode, outputTail, attempt, max})`, `nextVerifyState(state, result)` with `MAX_VERIFY_BLOCKS = 3`.
3. On `promptComplete`, when enabled **and** the turn changed files **and** the turn was not the hidden primer/summary: run the command with a bounded timeout; on non-zero exit inject the follow-up with the output tail; after `MAX_VERIFY_BLOCKS` release with an explicit *"still failing — not done"* card, never a silent pass.
4. Settings: `grok.verifyOnTurnEnd` (**default false**, opt-in — it spends tokens on the user's behalf) and `grok.verifyCommand` (`""` = auto-detect).
5. UI: a verify row in the activity carousel while running, a distinct card when it blocks (so it is obvious *why* the agent kept working), and a Cancel that both kills the child and releases the gate.

**Files:** `src/verify-gate.ts`, `src/acp.ts`, `src/sidebar.ts`, `src/session.ts`, `media/chat.js`, `package.json`, `test/verify-gate.test.ts`, `test/verify-gate.dom.test.ts`.

**Verify:** `npm test` green incl. — no changed files ⇒ no run; primer turn ⇒ no run; red ⇒ follow-up carries the command + tail; third block ⇒ release with the not-done message and reset; `detectVerifyCommand` rejects the npm placeholder. Behavioural check by hand (document, don't automate): seed a failing test, confirm the turn is extended exactly once per attempt and the child is killed on Cancel.

**Rollback:** default-off setting; revert.

---

### WP4 — Hook-stack collision detection + policy docs (**before** anything installs a hook)

**Why:** ordering. The reviewed plan documented this after the task that creates it. Detection has to exist before WP5 can refuse to make things worse.

1. `src/hook-scan.ts` (pure, injected fs): `scanHookStacks({fs, workspaceRoot, homeDir})` reports each source grok would actually merge — `.grok/hooks/*.json`, `<project>/.claude/settings.json` **and** `settings.local.json`, `<project>/.cursor/hooks.json`, plus the always-trusted global tiers — with which events each registers. `detectDoubleGate(stacks)` flags two sources registering `Stop`, or two registering write-matched `PreToolUse`.
2. Surface: one Output-channel line on session start when a collision is detected (not a modal), and a status line in the WP5 install command's confirm.
3. Docs — the load-bearing facts, stated plainly in `CLAUDE.md § Known limits`: `<project>/.claude/settings.json` **is a grok hook source** under folder trust; `/hooks-trust` / `--trust` grants MCP + LSP + hooks together and cascades to subdirectories; the extension never grants it.

**Files:** `src/hook-scan.ts`, `src/sidebar.ts`, `CLAUDE.md`, `test/hook-scan.test.ts` (+ `test/fixtures/hook-stacks/`).

**Verify:** `npm test` green; fixture with both `.grok/hooks/settings.json` and `.claude/settings.json` registering `Stop` ⇒ `detectDoubleGate` reports it; single-stack fixture ⇒ silent.

---

### WP5 — Grok Stop-gate provisioning (**conditional on WP0-D**)

Ships only if the probe proves `Stop` fires and blocks under `grok agent stdio`. Scope is deliberately narrower than the reviewed plan's T2/T3:

- **In:** `verify_on_stop.py`, `mark_changed.py`, `_common.py`, `settings.json` — vendored from `C:\Users\israe\Projects\grokbuild-dev-team-template\.grok\hooks\` into `resources/hooks/grok/**`, version-stamped.
- **Out:** `protect_paths.py` (WP1 does it better, on both backends), `record_session_tokens.py` (ADR 0003 territory, dev-time only), `session_start.py` (its context injection does not work on this CLI per ADR 0001; its only effect is counter reset, which `verify_on_stop.py` can do itself).
- `src/hook-suite.ts` (pure) mirrors `skill-suite.ts`; the recursive copy lives in `extension.ts`, exactly as `provisionSkillSuite` does.
- **Command only** — `Grokbit: Install workspace harness hooks`, never on activation. Setting `grok.hooks.provision: "off" | "command"` defaults to `"off"`.
- **Refuses to install** when `detectDoubleGate` (WP4) finds an active `.claude` Stop hook in the same workspace, unless the user confirms an explicit override. This is the T4 defect, fixed structurally.
- **Never auto-trusts.** The command states that hooks are inert until `/hooks-trust` and what trust also enables. A best-effort read of `~/.grok/trusted_folders.toml` (string match — there is no TOML parser and none is being added) drives a *status* line only.
- Backup-on-overwrite, `--force`-style, per the template installer's pattern.

**Files:** `resources/hooks/grok/**`, `src/hook-suite.ts`, `src/extension.ts`, `package.json`, `test/hook-suite.test.ts`, `CHANGELOG.md`.

**Verify:** `npm test` green (pure policy only — the suite stays grok-free and Python-free); `python -m py_compile resources/hooks/grok/*.py`; `npx @vscode/vsce ls | grep resources/hooks` shows the assets ship; install into a scratch workspace with a live `.claude` Stop hook ⇒ refused with the collision reason.

---

### WP6 — Dogfood + Ship seed (lowest priority)

- **Dogfood, behaviourally.** `.gitignore:17-18` ignores `.claude/` and `.grok/`, so copied files are untracked local state — the durable path is running WP5's command, which is also what exercises the product path. Acceptance is behavioural, not `Test-Path`: disable one of the two stacks first, seed a deliberately failing test, confirm the turn is blocked **once** and `npm test` runs **once**, then revert. `AGENTS.md`'s Project Test Commands here are Unit `npm test`, Lint `NONE`, Coverage `NONE` — so the gate is a ~3s `npm test`, which is cheap enough to be honest about.
- **Ship seed.** A thin `grokbit-ship` suite skill that seeds the pipeline and *pauses after plan*, coexisting with the phase tiles. Note this is repackaging, not importing: `.claude/commands/ship.md` is already installed in this workspace. Lowest value in the plan; do it last or drop it.

## Test plan

All new logic lands in pure modules with vitest coverage; the suite stays grok-free and claude-free.

| Layer | Covers |
|---|---|
| `npm test` (current floor + new) | `write-guard`, `path-norm`, `cross-review`, `verify-gate`, `hook-scan`, `hook-suite`; DOM tests for the review popover and the verify card; one fake-CLI integration case for the blocked write |
| `npm run test:live` | Add cases: protected-path write refused end-to-end on a real grok session; verify-gate follow-up fires on a real red suite |
| `research/*.cjs` (manual) | WP0's hook-contract probe |

`npx tsc -p . --noEmit` clean is part of every WP's verify.

## Risks

| Risk | Mitigation |
|---|---|
| WP0 comes back negative and WP5 dies | That is the point of sequencing it first — WP1–WP4 are independent of the answer and carry the value |
| `path-norm.ts` extraction regresses the shipped plan gate | `plan-gate.ts` re-exports; its existing tests are untouched and must stay green unmodified |
| WP1 blocks a legitimate write (`.env.example`, a fixture named `id_rsa`) | Explicit `*.example`/`*.sample`/`*.template` exclusions with tests; `grok.protectedPaths: []` is the escape hatch; blocked writes surface visibly via the existing `mutationBlocked` path |
| WP3 burns tokens or loops | Off by default, bounded to 3 attempts, gated on changed-files, cancellable, and the release message is explicit that the work is not done |
| WP3 is slow on a big repo | Runs only when the turn wrote files; command is user-overridable; bounded timeout |
| WP2 seeds a huge transcript | Path handoff preferred; transcript fallback already capped at 48k by `AGENT_HANDOFF_MAX_CHARS` |
| WP5 makes the double-gate worse | WP4 ships first and WP5 refuses on collision |

## Open questions (non-blocking)

1. Should `grok.verifyOnTurnEnd` default to on for a workspace that already has a Stop hook (i.e. the extension defers) or stay globally off? Proposed: globally off; revisit after dogfood.
2. Should "Review with…" also offer the *same* backend at a different model (Grok plan → Grok reviewer at higher effort)? It costs nothing structurally — the popover already builds from `sessionSetupModel` — but it widens the feature's story. Proposed: ship cross-backend first, add same-backend if asked.
3. Unify `permission-bind.ts`'s `normalizeGrantPath` with `path-norm.ts`? They differ deliberately (`nodePath.normalize` vs `posix.normalize`) and serve different semantics. Proposed: leave alone, revisit only if a third containment consumer appears.
4. Does WP2 want to write a machine-readable review verdict back into `.grokbit/plans/<slug>/` (e.g. `05-cross-review.md`) so the loop closes on disk? Attractive, but it makes the extension a writer of suite artifacts — a boundary worth deciding deliberately, not by accident.
