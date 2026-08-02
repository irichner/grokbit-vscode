# Deviations — workflow-descriptions-plain-language

None against survey/plan ground truth.

## Notes (not counted as plan deviations)

1. **Commit-per-task deferred** — repo `CLAUDE.md` forbids automatic commits; user did not request a commit. Task rollbacks remain file-level `git checkout` of listed paths. This is a host/policy note, not a survey contradiction.
2. **Dirty tree on entry** — unrelated edits to `media/webview-helpers.js` and `test/webview-helpers.test.ts` were stashed as `pre-implement snapshot workflow-descriptions-plain-language` before T1. Restore carefully after review (`git stash list`); may conflict with T2 edits to the same test file.
