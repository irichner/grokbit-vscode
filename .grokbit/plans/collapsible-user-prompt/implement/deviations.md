# Deviations — collapsible-user-prompt

## Waivers / non-counting

- **Dirty tree — proceed without stash** — 2026-08-02 — user invoked `/grokbit-implement this plan` with substantial uncommitted WIP overlapping `media/chat.js`, `media/chat.css`, `media/webview-helpers.js`. Full `git stash -u` would force restore conflicts on those paths. Risk accepted: implement layers on dirty tree. `counts: no`.
- **Baseline** — plan-local `test/baseline.md` from suite green + code characterization (not a separate grokbit-test baseline mode run). Risk low for pure webview UI. `counts: no`.
- **Commit-per-task deferred** — 2026-08-02 — same mixed dirty tree; auto-committing would bake unrelated WIP into history. Feature is verify-green; user commits when ready. `counts: no`.

## Counted deviations

(none)

---

Count (counts: yes only): 0 of 3
