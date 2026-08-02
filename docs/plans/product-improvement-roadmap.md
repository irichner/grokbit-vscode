# Product improvement roadmap — Grokbit

**Status:** Phases A–E implemented in working tree (2026-08-01) — uncommitted until user requests commit  
**Phase A plan:** `.grokbit/plans/phase-a-trust-host-stability/plan.md`  


**Source:** Improvement discussion; known limits in `CLAUDE.md`; existing plans under `docs/plans/`  
**Rule:** Each phase still needs its own grounded `plan.md` (or `.grokbit/plans/<slug>/`) with verify commands before `/implement`. This document only sequences and scopes.

---

## North star

Make Grokbit **harder for the agent to surprise the user**, **easier to aim**, and **cleaner at multi-tab / multi-backend scale** — without turning the welcome canvas into more chrome, and without reintroducing a live per-user token meter (ADR 0003).

---

## Explicit non-goals (whole roadmap)

- Live per-user / lifetime token meter on the launcher (rejected; see `docs/adr/0003-development-token-ledger.md`)
- Flipping `retainContextWhenHidden: true` without redesigning ready/replay
- React rewrite of the webview
- Chat virtualization before measured stalls (launcher first if anything)
- Marketing subagents or MCP browsing before the wire supports them honestly
- Business Studio stretch (React Flow, media gallery, E5 workflows) until Phases A–C are solid

---

## Phase overview

| Phase | Theme | Outcome | Depends on |
|-------|--------|---------|------------|
| **A** | Trust & host stability | Bound approvals; safer plan path; non-blocking Claude install; scoped CLI update | — |
| **B** | Aim & discoverability | `@` → chips; Actions “my skills”; local-override visibility | A preferred for Auto-accept users; B can start in parallel if A is staffed |
| **C** | Multi-session scale | Launcher incremental render; attention list | Soft on A |
| **D** | Power-user + quality floor | Worktree sessions; `@vscode/test-electron` lifecycle tests | **A required** before worktrees (amplifies write risk) |
| **E** | Depth when wire allows | Nested subagent inspector; honest MCP/plugin surfacing | CLI/wire evidence; not calendar-driven |

---

## Phase A — Trust and safety

### Goals

1. **Bind permission approval to the write/command it previewed**  
   - Correlate approved `toolCallId` with later `fs/write_text_file` / `terminal/create`.  
   - On mismatch (path, content hash, or command text): reject and surface a clear error.  
   - Applies to both backends; especially load-bearing for Claude where diffs are synthesized from `rawInput`.

2. **Claude plan-mode client backstop (optional but preferred)**  
   - Either enable a `clientPlanGate`-style mirror for Claude when session mode is plan, or fail closed with an explicit product decision documented in an ADR.  
   - Today: `BackendQuirks.clientPlanGate === false` for Claude (`src/backends.ts`); Grok has the real client gate.

3. **Honest permission previews**  
   - When the diff is synthesized (Claude pre-approval): label “Preview from agent input” in the card.  
   - Prefer real server hunks when they exist before approval.

4. **Async Claude adapter install**  
   - Finish non-blocking install path (~120 MB); cancellable progress; never freeze the extension host.

5. **`updateGrokCliOnDemand` pool scope**  
   - Tear down / restart **grok** sessions only when updating the grok binary; leave Claude tabs alive (or mark `pendingStart` without dispose when safe).

### Done criteria (phase)

- [x] Approved edit/command cannot apply a different path or body without a visible rejection
- [x] Plan-mode write/command policy for Claude is either client-gated or ADR-documented as intentional risk
- [x] Claude permission cards label synthetic previews
- [x] Adapter install does not block the extension host event loop
- [x] Grok CLI update does not dispose Claude panels
- [x] Targeted + regression tests green; security-sensitive paths covered (permission bind, plan gate)

### Primary touch areas (expected)

- `src/acp.ts`, `src/plan-gate.ts`, `src/sidebar.ts`, `src/claude-locator.ts`, `media/chat.js` / `webview-helpers.js`
- Tests: permission, plan-gate, Claude install, CLI update pool filter

### Risks

- False rejects if correlation is too strict (toolCallId reuse, multi-file batches)
- Claude wire shapes may lack stable ids — survey real `request_permission` + write sequences first

---

## Phase B — Discoverability and composer aim

### Goals

1. **`@` mention autocomplete → file chip**  
   - Host file-search message + popover.  
   - Picked path becomes a **chip**, never a literal `@path` in the prompt (`prompt-builder` already sends plain paths).

2. **Actions: workflow default + optional full skills**  
   - Keep Grokbit Actions tiles as default (`CAPABILITY_VISIBLE_KINDS`).  
   - Setting or second surface: **My skills / commands** (`workflow | all | custom`).  
   - Surface workspace forks of suite skills as **local override** (or under Skills with source badge) — not silent invisibility.

3. **Skill refresh UX**  
   - Soft refresh when agent writes under capability roots, and/or improve discoverability of Refresh (no mandatory always-on FS watcher unless measured need).

4. **Context clarity**  
   - Make attached vs “currently open” context obvious in the UI (prompt envelope already splits them).

5. **Send to Grokbit** (optional in B if small)  
   - Editor / explorer context menu → seed composer with path chip.

### Done criteria (phase)

- [x] User can `@` a workspace file and send it as a chip without forcing a full binary read
- [x] Setting restores non-`grokbit` kinds (or a dedicated “My skills” mount) without drowning the workflow tiles by default
- [x] Workspace `grokbit-*` fork is visible somewhere with non-Grokbit branding
- [x] Tests for chip path, allowlist filter, and view-model badges

### Primary touch areas

- `src/sidebar.ts` (search), `media/chat.js`, `media/webview-helpers.js`, `src/capabilities.ts` / skill-suite policy, `package.json` contributes

### Related existing plans

- `docs/plans/capability-surfacing-and-history-ux.md`
- `docs/plans/grokbit-actions-and-bundled-skill-suite.md`
- `docs/plans/session-tab-ux-overhaul.md`

---

## Phase C — Multi-session scale

### Goals

1. **Launcher incremental render**  
   - Stop full clear-and-rebuild of up to 500 rows on every `sessions` push; diff/patch rows when possible.

2. **Attention list**  
   - Launcher (or compact surface) lists sessions that need the user (permission / question / plan), complementing the status-bar bell.

3. **Sticky multi-page behavior**  
   - Preserve existing sticky-window / sticky-search invariants while patching (regression-test heavy).

### Done criteria (phase)

- [x] Measured or instrumented: no full 500-row rebuild on unrelated session events when list is large
- [x] User can see which background tabs need attention from the launcher
- [x] History pagination tests still pass (`nextOffset` disk cursor rules unchanged)

### Primary touch areas

- `media/launcher.js`, `src/sidebar.ts` (`broadcastSessionsList`, dots), optionally `src/session-pool.ts` / status-bar

---

## Phase D — Power-user + quality floor

### Goals

1. **Worktree sessions**  
   - `Grok: New Worktree Session` (or equivalent): isolate agent cwd/worktree without polluting main tree.  
   - **Hard dependency on Phase A** — worktrees amplify unsupervised write risk.

2. **`@vscode/test-electron` integration suite**  
   - Panel lifecycle, serializer restore, dual-backend open, permission card smoke — things unit/DOM cannot cover.  
   - Keep `npm test` grok-free; electron suite may be `npm run test:electron` (CI optional or gated).

3. **Claude smoke in pre-release thinking**  
   - Document or add a minimal Claude path check so dual-backend does not rot (may stay manual if auth-bound).

### Done criteria (phase)

- [x] User can open a session bound to a git worktree cwd
- [x] At least one electron integration test proves tab restore + ready/replay path
- [x] Worktree + permission bind interact safely (writes stay inside intended root)

### Related

- `TESTS.md` § v0.2 notes electron suite as next
- CLAUDE.md “What’s next” items 1 and 4

---

## Phase E — Depth when the wire allows

### Goals

1. **Subagent nested inspector**  
   - Only when CLI/adapter exposes stable delegation as ACP tool calls (not poll-only).  
   - Nested child tools under parent card; classifier in `webview-helpers.js` already partial.

2. **MCP / plugins / personas honesty**  
   - Read-only surfacing (“N MCP servers configured”) beats empty silence.  
   - Full browse deferred until formats are parseable (grok TOML / Claude layouts differ).

### Done criteria (phase)

- [x] Feature ships only with a live probe or fixture proving wire shape
- [x] UI never claims nesting or MCP control it does not have

### Non-goals for E

- Implementing a TOML config editor
- Faking nested subagents from `get_command_or_subagent_output` alone

---

## Priority principles (for every phase plan)

1. **Correctness / security before chrome**  
2. **Pure policy modules + grok-free tests** (existing architecture)  
3. **No silent COEXIST** — supersede or document duplicates  
4. **UI changes** meet `.grok/docs/ui-design-standards.md`  
5. **Never invent token counts**; commit metrics only via prepare scripts  

---

## Suggested execution order

```text
A (trust) ──┬──▶ B (aim) ──▶ C (scale) ──▶ D (worktree + electron)
            │         │
            │         └── B∥C allowed if staffed
            │
            └── D worktrees blocked until A permission bind lands

E on evidence, not on calendar
```

**Recommended first implementation plan:** Phase A only — single ADR + task list with verify commands, then `/implement`.

---

## Open product decisions (resolve at phase plan time)

| # | Decision | Default recommendation |
|---|----------|------------------------|
| 1 | Claude plan: client gate vs ADR-accepted risk | Prefer client gate for parity |
| 2 | Skills UI: setting vs second top-bar entry | Setting + “Browse my skills” in Add menu |
| 3 | Worktree: extension-managed vs user-created path only | User-created path first (YAGNI on git worktree create UI) |
| 4 | Electron suite in CI | Start local/opt-in; promote to CI when stable on Windows + Ubuntu |

---

## Approval

- [ ] Roadmap accepted as sequencing SoT  
- [ ] Phase to implement first: ________ (recommend **A**)  
- [ ] After phase pick: run full grounded plan (`docs/plans/` or `.grokbit/plans/<slug>/`) before any code  

**Do not implement from this roadmap alone.** It has no per-task verify commands.
