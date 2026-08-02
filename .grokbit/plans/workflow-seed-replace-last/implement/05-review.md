# Scope audit log — workflow-seed-replace-last

Append-only, one section per task.

## T1 — Replace mode for workflow/capability composer seed
Reviewed: uncommitted working tree hunks for this task

- `IN_SCOPE` `media/webview-helpers.js` — `applyComposerSeed` optional `opts.mode === "replace"`
- `IN_SCOPE` `media/chat.js` — fallback helper, `insertComposerPrompt` opts, capability onclick replace
- `IN_SCOPE` `test/studio-3.0.test.ts` — unit cases for replace / default append
- `IN_SCOPE` `test/capabilities.dom.test.ts` — two-click replace regression
- Note: `media/chat.js` and `test/capabilities.dom.test.ts` also contain **pre-existing** unrelated WIP from `actions-survive-agent-switch` (backendChanged keep-capabilities). That hunk is **not** part of T1 and was not introduced by this task.

### Round 2
not needed

## Outcome — T1
Rounds used: 1 of 2  
Unresolved at cap: none  
Clean for T1 intent. Commit deferred per repo convention.
