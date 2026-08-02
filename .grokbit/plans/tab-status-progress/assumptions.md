# Assumptions — Session tab status + progress

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` “Needs questions answered” means host `needs-you` (permission / question / plan review).
- `UNVERIFIED` “Done” means finished-while-away (unread + done/error), not a permanent badge on a focused idle tab.
- `UNVERIFIED` “Progress bar during implementation” is best-effort tab chrome (step count / proportional text), not a native OS tab widget.
- `UNVERIFIED` Status is a leading prefix (VS Code truncates titles from the end).
- `UNVERIFIED` No new user setting; on by default.

## From grounding (Loop 2)
- none — all intent-implied entities resolved (SessionStatus, composeTabTitle, setStatus, toolCall handlers, dots, status bar).

## From adversarial review (Loop 3)
- none outstanding (two MAJORs resolved in design revision; Loop 3 exit clean).

## From verifiability (Loop 4)
- none — each task has a runnable `verify:` on Windows (`npm test -- <file>`); T2 also notes manual two-tab smoke for host chrome that unit tests cannot fully own.

## Resolution
- Product taste on exact glyphs (`…` `?` `*` `!`) may change during implement if Windows tab fonts mis-render; update pure tests in the same change.
- T3 is explicitly optional; human may waive at gate or after T2 smoke.
