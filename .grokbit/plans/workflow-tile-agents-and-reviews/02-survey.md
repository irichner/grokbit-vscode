# Survey — ground truth read from disk

Every claim below was read from the file cited. Nothing here is inferred from memory of the codebase.

## Where the tiles are produced

| Stage | File:line | What it does |
|---|---|---|
| Disk scan | `src/capabilities.ts` `scanCapabilityRoots` | Yields `CapabilityItem[]` with `kind: "skill"` for home-tier suite dirs |
| Suite re-key | `src/skill-suite.ts:148` `applySuiteKind` | Re-keys name-matched **and** path-contained items to `kind: "grokbit"`, `source: "Grokbit"` |
| Detail stamp | `src/skill-suite.ts:207` `attachSuiteHowItWorks` | Sets `hasDetail`/`detailPath` when `resources/skills/<n>/references/how-it-works.md` exists |
| Grouping | `src/sidebar.ts:3482` `buildCapabilityGroups` | Ordered `CapabilityGroup[]`, `grokbit` first |
| Host call site | `src/sidebar.ts:3466-3482` | `applySuiteKind` → `attachSuiteHowItWorks` → `buildCapabilityGroups`, in that order |
| View-model | `media/webview-helpers.js:1210` `capabilityGroupsView` | Maps raw items to render-ready items; whitelists fields explicitly (see below) |
| Renderer | `media/chat.js:804` `buildCapabilityRow` | Builds the DOM tile |

**The view-model is an explicit whitelist, not a spread.** `capabilityGroupsView` returns an object literal listing every field (`media/webview-helpers.js:1241-1259`); a new host field that is not added there is silently dropped before it reaches the renderer. That is the single most likely way this change fails silently.

## What a tile renders today (`media/chat.js:804-958`)

In order: `.capability-row-head` (`.capability-row-name` + optional `.capability-row-cmd`), optional `.capability-row-source` badge, optional `.capability-row-desc`, optional `.capability-row-hint`, and — when `item.hasDetail` — `.capability-row-detail-wrap` holding the **Details** button, an optional **Open in editor** button, and a lazily-filled `.capability-row-detail-body`.

Two established contracts confirmed by reading the code:

- **No kind-string branching.** `buildCapabilityRow` opens with `if (item.control === "switch")` and the comment at `media/chat.js:805-807` states the rule: branch on control/data, never on kind, so a new kind ships without touching the function. `hasDetail` follows the same rule (`media/chat.js:857-858`).
- **One propagation boundary.** `detailWrap.addEventListener("click", (e) => e.stopPropagation())` at `media/chat.js:871` exists because a click on detail content otherwise reaches the row's invoke handler and replaces the composer. Anything new added inside the detail area inherits that boundary; anything added **outside** it does not.

## Existing detail path (already shipped)

`getCapabilityDetail` → host reads the guide bounded at `HOW_IT_WORKS_MAX_BYTES = 64 * 1024` (`src/skill-suite.ts:168`) → `postTo` (unbuffered) → `state.pendingCapabilityDetail` fills the body node (`media/chat.js:894-907`). Path resolution is allowlisted through `resolveSuiteHowItWorksPath` (`src/skill-suite.ts:227`), which refuses any name outside `SUITE_SKILL_NAMES`.

**So the facts this change wants already ship inside the vsix** — they are simply one click and one round-trip away.

## The ground truth for agents + reviews

Read from `resources/skills/<name>/references/how-it-works.md`, `## Roles` and `## Loops and caps`.

| Skill | Roles (verbatim from the guide) | Review-shaped loops |
|---|---|---|
| `grokbit-explore` | Scope Setter, Cartographer, Citation Checker | **E3** Cite-check — 2 rounds (E1 1 question, E2 3 map passes) |
| `grokbit-plan` | Business Analyst, Systems Analyst, Solutions Architect, Plan Reviewer | **3** adversarial review rounds (Loop 3) **+ 1–2** plan-level passes (Loop 4) |
| `grokbit-implement` | Build Engineer, Software Engineer, Supply Chain Security Analyst, Code Reviewer, Orchestrator | **I3** scope audit — 2 rounds (plus I2 3 attempts/task, I4 2 rejections) |
| `grokbit-test` | QA Automation Engineer, Frontend QA, Application Security, Maintenance Engineer, Release Engineer | **7** bounded loops T1–T7; **T4 security has no escape for CRITICAL** |
| `grokbit-document` | Information Architect, Documentation Engineer, Technical Writer, Docs QA | **D1** executable verify — 3 (blocks); **D2** fresh-reader — 2 |
| `grokbit-ship` | *None of its own* — the guide states verbatim: "Ship has none of its own. Each phase runs its own roster…" | Inherits every phase's loops unchanged; ~5 major delegated phases |

`grokbit-ship` is the case that breaks any naive "list the roles" design: it genuinely has no roster, and the guide says so explicitly. A blank line there, or a synthesized roster copied from the phases, would both be wrong.

## Layout facts that constrain the design

- `.capability-group-items` (`media/chat.css:2053`) is an intrinsic `auto-fit` grid with a `min(100%, …)` track floor — tiles collapse to one column below the min track and flow into more columns as the tab widens.
- **No `@media` queries anywhere in `chat.css`** — confirmed by the standing rule in `CLAUDE.md` § Chat surfaces and by the absence of any `@media` rule in the capability block. `body` carries `zoom: var(--chat-zoom)`, so a breakpoint would evaluate the unzoomed viewport and be wrong at every non-default `grok.chatFontScale`.
- `.capability-row-desc` (`media/chat.css:2492`) is deliberately `white-space: normal; overflow: visible` with **no** line clamp — the comment records that a clamp re-truncated at ~180 of the intended 260 characters.
- `.capability-row-hint` (`media/chat.css:2503`) is the opposite: `nowrap` + ellipsis. Two adjacent precedents, so a new meta line must pick one deliberately.
- `.capability-row-source` (`media/chat.css:2516`) is the established small-chip idiom — VS Code `--vscode-badge-*` tokens, `align-self: flex-start`, no hardcoded colors.

## Description caps

`CAPABILITY_ROW_DESCRIPTION_MAX = 260` in the webview (`media/webview-helpers.js:694`), host-side cap 280. Both apply to `description` and `hint` via `truncateCapabilityDescription`. A new field is **not** covered by either unless it is routed through the same helper.

## Anti-drift precedent that already exists in this repo

`test/hook-parity.test.ts` reads the vendored Python hooks from `resources/hooks/grok/*.py` and asserts the TypeScript mirror in `src/grok-hooks-policy.ts` still matches their patterns, labels, bounds and user-facing strings. `CLAUDE.md` names this the "`LAUNCHER_PAGE_SIZE` source-text parity idiom". This is the established answer in this codebase to "the same fact now lives in two places".

## Test surfaces that will need to stay green

- `test/skill-suite.test.ts` — suite membership, re-key ordering, `attachSuiteHowItWorks`
- `test/capabilities.test.ts` — host scan/merge/group
- `test/capabilities.dom.test.ts` — tile rendering, including the "welcome-canvas panel renders no switch" guard
- `test/webview-helpers.test.ts` — `capabilityGroupsView`, `partitionFeatured`

## Unknowns carried into design

- `UNRESOLVED` The exact rendered wording is a copy decision, not a discoverable fact. Design proposes strings; the gate is where they get accepted or rewritten.
