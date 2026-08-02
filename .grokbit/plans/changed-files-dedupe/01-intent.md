# Intent — Changed-files strip: one chip per file

## Problem
During a turn, the "files changed" strip above the composer shows the same file name more than once when that file is edited multiple times. The strip should list each distinct file once, with line-change metrics that reflect all applied edits to that file in the current turn.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] In one agent turn, two or more successful edits to the **same path** produce **exactly one** chip for that path (not one chip per edit).
- [ ] That single chip's `+N` / `−M` counts include **all** successful applied edits to that path in the turn (metrics update when a later edit lands, rather than adding a second chip).
- [ ] Two **different** paths still produce two chips; the label says "2 files changed".
- [ ] A failed / plan-blocked write still removes **only that edit's** contribution; if other successful edits remain for the same path, the chip stays with updated metrics; if none remain, the chip disappears.
- [ ] Existing strip behavior still holds: hidden when empty; cleared on next user message; not populated from history replay; chip click still opens the file.
- [ ] Automated tests cover the same-path multi-edit case and stay green under `npm test`.

## Non-goals
- Redesigning the strip layout, CSS, or placement.
- Changing how inline tool-row diffs are shown (each edit still has its own diff in the transcript).
- Host/ACP changes, session persistence of the strip, or cross-turn history of changed files.
- Computing a "true net" diff from first oldText to last newText (optional future polish; not required for this fix).
- Path-alias / case-normalization across OS variants beyond a minimal consistent key if already cheap.
- Restoring Skills/Commands browser or other unrelated UI work.

## Constraints
- Stack: webview-only pure/DOM logic in `media/chat.js` (+ DOM tests); no new dependencies.
- Must not break: plan-gate failure removal, replay skip, turn-clear, multi-file distinct paths, open-file on chip click.
- Verify with the existing grok-free suite (`npm test`); extend `test/changed-files-strip.dom.test.ts`.
- Single-package repo; Windows + POSIX paths may appear as agent-supplied path strings.

## Assumptions
- `UNVERIFIED` Users report "same file name repeatedly" primarily because the **same path** is edited multiple times in one turn (not only two different directories sharing a basename). Basename-only display of distinct paths is a separate pre-existing quirk and is out of scope unless trivial to leave unchanged.
- `UNVERIFIED` Summing per-edit add/del line counts for a path is the desired "metrics updated" semantics (honest turn churn), not replacing the chip with only the latest edit's counts.
- No product questions asked — request is specific and the existing strip contract is well documented in tests.

## Questions asked
None (0 of 3). Answers fully inferable from request + existing tests/docs.
