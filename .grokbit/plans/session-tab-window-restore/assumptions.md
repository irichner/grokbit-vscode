# Assumptions — Session tabs survive VS Code reload / restart

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions`.

- `UNVERIFIED` “Old tabs don’t reload properly” primarily means **conversation identity / history** is wrong or missing after reload, not only scroll position (scroll has a separate plan that excluded full-window reload).
- `UNVERIFIED` **Developer: Reload Window** is the primary repro; full quit/reopen should follow the same serializer path when VS Code restores the workspace’s editor tabs.
- `UNVERIFIED` Users expect restored tabs to **resume** via `session/load`, not start a new ACP session that only shares a title.
- `UNVERIFIED` Duplicate-tab while connecting is in scope because it is caused by the same identity gap during restore startup.

## From grounding (Loop 2)
- none — all entities resolved

## From adversarial review (Loop 3)
- none outstanding — BLOCKER (await startSession in serializer) and MAJORs resolved in revised design

## From verifiability (Loop 4)
- `UNVERIFIED` End-to-end Reload Window cannot be automated in this repo yet (no `@vscode/test-electron`); T5 manual checklist is required for history/backend done-criteria.

## Resolution
- Identity/history assumption: proceed; if user reports only CLI “Failed to start” with history intact, narrow to spawn/auth (out of this plan’s REPLACE list).
- Manual E2E: required at gate / after implement; not a substitute for T1–T4 unit/DOM proofs.
- **Implement 2026-08-02:** automated T1–T5 green (1439 tests). Manual Reload Window checklist still open (see `implement/handoff.md`).
