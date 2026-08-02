# Intent — Phase A: Trust & host stability

## Problem

Users approve a permission card that previews one file or command, but nothing binds that approval to the later `fs/write_text_file` or `terminal/create` call — so a compromised or buggy agent can show path A and mutate path B. Claude sessions also lack the client-side plan-mode write/terminal backstop Grok has. Grok CLI updates tear down every backend’s live tabs. Synthetic Claude permission diffs look like real diffs. (Adapter install is already async; docs still claim otherwise.)

## Done criteria

Each item must be checkable by a human performing an observable action.

- [ ] **DC1** After allowing a permission that previews file `A`, a subsequent host write to a different path `B` is refused and the user sees a clear block notice (not a silent success).
- [ ] **DC2** After allowing a permission that previews file `A`, a write to `A` still succeeds (happy path unchanged).
- [ ] **DC3** In Auto-accept (YOLO), the same path-binding rules apply to auto-allowed permissions that carry an extractable path.
- [ ] **DC4** When a session is in plan mode on **Claude**, workspace writes and non-readonly terminals are blocked client-side (parity with Grok’s fs/terminal gate), without breaking Claude’s legitimate plan-mode permission prompts for read-only or non-mutating work.
- [ ] **DC5** Permission cards that use a **synthesized** preview (from `rawInput`, not a structured ACP diff) show an explicit “Preview from agent input” label.
- [ ] **DC6** Updating the Grok CLI stops only **Grok** sessions; an open Claude tab stays live with its process intact.
- [ ] **DC7** Claude adapter install remains non-blocking for the extension host; `CLAUDE.md` known-limits no longer claim a synchronous install; install UI is cancellable if feasible without new deps.
- [ ] **DC8** `npm test` green; new pure unit tests cover grant extract / match / mismatch; no new Marketplace secrets or network in unit tests.

## Non-goals

- Content-hash bait-and-switch on the **same** path (path binding only in v1; optional digest is deferred).
- Binding MCP tool results or subagent children.
- React rewrite, worktree sessions, `@` mentions, launcher virtualization (Phases B–D).
- Re-enabling a live per-user token meter (ADR 0003).
- Full TOML MCP browser, subagent inspector (Phase E).
- Making Claude’s plan mode depend on the grok primer or `x.ai/exit_plan_mode`.
- Forcing every write to go through a permission card (Agent mode may still write without asking when the CLI does not request permission).

## Constraints

- Stack: existing VS Code extension, pure modules testable without vscode where possible, grok-free `npm test`.
- Must not break: permission card replay/collapse, plan-gate for Grok, per-backend logout (`disposePool(backend)`), dual-backend panels.
- Sequencing: Phase A before worktree sessions (roadmap Phase D).
- No invented token counts; no commit unless user asks.

## Assumptions

- `UNVERIFIED` — `fs/write_text_file` / `terminal/create` params never include `toolCallId` on the wire for either backend (inferred from current handlers taking `path`/`content` and `command` only). Binding must use path/command extracted at approval time, not toolCallId on the write.
- `UNVERIFIED` — Enabling full `clientPlanGate` (including pre-emptive permission reject) for Claude may block legitimate Claude plan-mode UX; split “fs/terminal gate” from “permission pre-reject” is preferred.
- Claude adapter install path is already async (`execFileAsync`) — residual work is docs + optional cancel, not a from-scratch async rewrite.
- User accepted whole roadmap; Phase A is the first implement slice.

## Questions asked

1. Q: Which phase first? → A: Phase A — Trust & host stability (Recommended).
