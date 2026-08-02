# Scope audit log — remove-about-after-prompt

Append-only, one section per task. Never overwrite a previous task's entry.

## T1 — Honor `[hidden]` on the welcome canvas
Reviewed: working-tree vs task-start snapshots under `implement/snapshots/` (tree dirty vs HEAD; scope = this task's edits only)

- `IN_SCOPE` `media/chat.css` — added `.welcome[hidden] { display: none; }` + comment next to `.welcome` flex rule
- `IN_SCOPE` `test/welcome-canvas.dom.test.ts` — CSS source assertion for `.welcome[hidden]`; DOM case that first `userMessage` sets `#welcome.hidden === true` and About/title remain under `#welcome`
- `OUT_OF_SCOPE` — none introduced by this task
- `INCIDENTAL` — none

Note: `git diff HEAD -- media/chat.css` also shows unrelated WIP (turn containers, launcher-attention, etc.) already present when implement started; those hunks are **not** claimed as T1 and were not authored in this task. Revert-to-clean for T1 would restore only from `implement/snapshots/*.bak`, not from HEAD.

### Outcome — T1
Rounds used: 1 of 2
Unresolved at cap: none
Clean. Every T1 hunk is `IN_SCOPE`.

## T2 — skipped (optional; not opted in)
No audit.
