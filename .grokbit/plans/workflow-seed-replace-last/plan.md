# Plan — Workflow click replaces prior seed in composer

Slug: `workflow-seed-replace-last` · Approach: replace-mode on capability invoke only; keep default append · Blast radius: 3–4 files, 0 deps, no schema

## Tasks

### T1 — Replace mode for workflow/capability composer seed
- **intent:** Clicking a Grokbit Actions workflow (or any invocable capability row) puts only that row’s slash seed in the composer; a second click replaces the first. Docs / host seeds still append when the box is non-empty. Never auto-send.
- **files:** `media/webview-helpers.js`, `media/chat.js`, `test/studio-3.0.test.ts` (or adjacent pure unit file if preferred), `test/capabilities.dom.test.ts`
- **cwd:** none (repo root)
- **depends:** none
- **verify:** `npm test -- test/studio-3.0.test.ts test/capabilities.dom.test.ts` (green), and the new/updated cases assert: (1) `applyComposerSeed` with replace mode returns only the new seed when current text is non-empty; (2) default mode still appends; (3) DOM: click suite row A then row B → composer equals B’s invoke only; (4) no `send` posted on those clicks. Optional full suite: `npm test`.
- **removes:** none
- **baseline:** First capability click still seeds composer and does not send (`test/capabilities.dom.test.ts` existing cases); `applyComposerSeed` append contract in `test/studio-3.0.test.ts`
- **rollback:** `git revert` the implementing commit
- **state-after:** working
- **notes:**
  - Extend pure `applyComposerSeed` with optional replace mode; **default remains append** (`media/webview-helpers.js:957-963`).
  - Thread mode through `insertComposerPrompt` (`media/chat.js:2711-2721`).
  - Capability onclick only: `insertComposerPrompt(item.invoke, { mode: "replace" })` at `media/chat.js:853-854`.
  - Do **not** pass replace from Docs Use (~1829) or `seedComposer` (~5391).
  - Both Actions mounts share `buildCapabilityRow` — one click-path fix covers panel + popover.
  - Free-text wipe on replace is an accepted gate assumption (`assumptions.md`).

## Verification matrix

| Done criterion | Proven by |
|---|---|
| First workflow click seeds only that command | T1 unit + existing DOM first-click tests |
| Second workflow click leaves only the last command | T1 new DOM two-click case |
| Works for welcome panel and Actions popover | Shared `buildCapabilityRow` path (one implementation); optional second mount smoke if easy |
| No auto-send | T1 DOM assert no `send` |
| Non-workflow seeds still append | T1 unit default-mode + existing `studio-3.0` append tests |
| Automated coverage | T1 verify command |

## Disposition summary
Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 1 | T1 — append-on-invoke for capability rows → replace mode |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 2 | default append for Docs/`seedComposer`; Option C smart merge |

Net lines: small (+tests). Not net-additive of features — behavior change only.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` Full composer replace on workflow click (including free text).
- `UNVERIFIED` Scope limited to invocable capability rows.

## Approval
- [x] Human approved — 2026-08-01
