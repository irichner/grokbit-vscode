# Implement handoff — workflow-descriptions-plain-language

Input contract for `grokbit-test` verify mode.

## Completed
- T1 (uncommitted) — rewrote five suite frontmatter descriptions to plain language ≤87 chars each
- T2 (uncommitted) — replaced production-coupled trim fixture with synthetic multi-sentence string; `npm test` green

## Blocked
- none

## Surface changed
Files:
- `resources/skills/grokbit-explore/SKILL.md`
- `resources/skills/grokbit-plan/SKILL.md`
- `resources/skills/grokbit-implement/SKILL.md`
- `resources/skills/grokbit-test/SKILL.md`
- `resources/skills/grokbit-document/SKILL.md`
- `test/webview-helpers.test.ts`

Endpoints added/changed: none  
Schema changes: none  
UI views affected: Grokbit Actions tiles (description text only; no layout/code change)  
Dependencies added: none

## Final description strings (for visual check)
| Skill | Description |
|---|---|
| grokbit-explore | Look around your project and explain what matters — without changing any files. |
| grokbit-plan | Work out a clear step-by-step plan you can approve before any code is changed. |
| grokbit-implement | Build the approved plan one step at a time, checking each step works before moving on. |
| grokbit-test | Check that the change works and nothing else broke — so you know if it is safe to ship. |
| grokbit-document | Write clear project docs (like a README or guide) from your code and plans. |

## Look here hard
- After rebuild/re-provision, Actions welcome panel + popover should show the new strings without truncation (all well under 260).
- Home copies under `~/.grok/skills` / `~/.claude/skills` stay stale until suite re-provision (extension activation / version inequality).
- Stash `pre-implement snapshot workflow-descriptions-plain-language` holds prior dirty work on `media/webview-helpers.js` + `test/webview-helpers.test.ts` — restore carefully.

## Deviations
See `deviations.md` — 0 plan deviations (policy notes only).

## Baseline reference
NOT CAPTURED — all tasks declared `baseline: none` (copy-only change).
