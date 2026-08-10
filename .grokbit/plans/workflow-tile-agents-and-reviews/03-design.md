# Design — Agents + reviews on the Grokbit workflow tiles

## Decision 1 — Where the data comes from

| Option | How | Disposition |
|---|---|---|
| **A. Runtime parse of `how-it-works.md`** | On every `listCapabilities`, read all six guides and parse the `## Roles` / `## Loops and caps` markdown tables | **Rejected.** Six file reads + markdown-table parsing on every panel render, every reveal of a torn-down hidden panel, and every `Refresh` click — to produce a string that only changes when a new vsix ships. It also makes a *display* line depend on markdown table formatting surviving an editorial pass, which is exactly the kind of brittle coupling that fails silently. The existing Details flow is lazy for precisely this reason. |
| **B. New frontmatter keys in each `SKILL.md`** | `agents: [...]`, `reviews: "…"` parsed by `parseFrontmatter` | **Rejected.** `parseFrontmatter` handles a small YAML subset — `frontmatterBool` exists because even booleans arrive as strings (`src/capabilities.ts`). Lists are not supported, so this needs a parser extension for one display field. It also puts product-UI copy into a file whose primary consumer is the CLI's own skill loader. |
| **C. Committed pure manifest in `src/skill-suite.ts` + parity test** | `SUITE_TILE_META: Record<name, {agents, reviews}>`, stamped onto items alongside `hasDetail` | **Chosen.** Zero I/O on the render path, pure and unit-testable, and it matches the codebase's own "framework-free data, not policy" precedent (`src/token-metrics.ts`, `CAPABILITY_FEATURED` in `webview-helpers.js`). Its one real cost — a third place the facts live — is paid off by the parity test below, which is the mechanism this repo already uses for exactly this problem (`test/hook-parity.test.ts`). |

### The anti-drift mechanism is load-bearing, not a nicety

A new test reads all six `resources/skills/*/references/how-it-works.md` files, extracts the bolded role names from the `## Roles` table and the numeric caps from `## Loops and caps`, and asserts:

1. every role name in the manifest appears in that skill's guide, and the counts match;
2. every numeral quoted in the manifest's `reviews` string appears in that skill's `## Loops and caps` section;
3. `grokbit-ship` has an empty `agents` array **and** its guide still contains the "Ship has none of its own" sentence.

Without (3) the Ship special case silently becomes wrong the moment someone gives Ship a roster. This test is the reason Option C is acceptable at all — remove it and the manifest is just stale data waiting to happen.

## Decision 2 — What "number of reviews" means

The caps genuinely differ in kind: Plan runs 3 adversarial rounds *plus* 1–2 plan-level passes; Test runs 7 bounded loops one of which has **no escape**; Explore runs 2 cite-check rounds. Collapsing these to one integer per tile would require inventing a comparison the guides do not make, and would be the first outright false claim on the canvas.

**So `reviews` is a short honest phrase, authored per skill, with its numerals traceable to the guide** (enforced by parity assertion 2 above):

| Skill | `agents` | `reviews` |
|---|---|---|
| explore | Scope Setter · Cartographer · Citation Checker | `2 cite-check rounds` |
| plan | Business Analyst · Systems Analyst · Solutions Architect · Plan Reviewer | `3 adversarial rounds + 1–2 plan passes` |
| implement | Build Engineer · Software Engineer · Supply Chain Security Analyst · Code Reviewer · Orchestrator | `2 scope-audit rounds; 3 attempts per task` |
| test | QA Automation · Frontend QA · Application Security · Maintenance · Release Engineer | `7 bounded loops; security has no escape` |
| document | Information Architect · Documentation Engineer · Technical Writer · Docs QA | `3 verify passes + 2 fresh-reader rounds` |
| ship | *(empty — see below)* | `inherits every phase's reviews; ~5 delegated phases` |

**Ship renders `Runs each phase's own roster` in the agents slot**, driven by an explicit `agentsNote` field rather than by the renderer noticing an empty array and guessing. An empty array with a renderer-side fallback string would put product copy in `chat.js`, where it is neither testable nor visible to whoever next edits the manifest.

## Decision 3 — How it renders

Two muted lines appended after `.capability-row-desc`, before the detail wrap, each a labelled row:

```
Plan                                    /grokbit-plan
Work out a clear step-by-step plan you can approve before any code is changed.
Agents   Business Analyst · Systems Analyst · Solutions Architect · Plan Reviewer
Reviews  3 adversarial rounds + 1–2 plan passes
                                            [ Details ]  [ Open in editor ]
```

- New container `.capability-row-meta`, one `.capability-row-meta-line` per fact, each holding a `.capability-row-meta-label` (`Agents` / `Reviews`) and a `.capability-row-meta-value`.
- **Wraps, never ellipsizes** — the `.capability-row-desc` precedent, not the `.capability-row-hint` one. Four-to-five role names cannot fit one line in a narrow tile, and a `nowrap` line would show "Business Analyst · Systems Ana…" — which reads as a truncated list of *unknown length*, the worst of both options.
- No pixel floors, no new flex bases, so nothing to clamp with `min(100%, …)`; the lines inherit the tile's existing intrinsic width. **No `@media` queries** (the standing `chat.css` rule).
- Colors from `--vscode-descriptionForeground` only; the label gets `opacity`/weight differentiation, never a hardcoded color.
- Rendered **outside** `.capability-row-detail-wrap`, so it is inside the row's own click target — clicking the meta text seeds the command, exactly like clicking the description does. That is the intended behavior: the meta lines are part of the tile's face, not part of its detail area.

### The renderer stays data-driven

`buildCapabilityRow` gains one block guarded on `Array.isArray(item.meta) && item.meta.length` — a check on **data shape**, not on `item.kind === "grokbit"`. Non-suite rows carry no `meta`, so they render byte-identically to today. This preserves the rule stated at `media/chat.js:805-807` and means a future kind that wants meta lines needs no renderer change.

`capabilityGroupsView` normalizes `meta` into `[{label, value}]`, dropping entries with an empty value, and routes each value through `truncateCapabilityDescription` so the meta lines inherit the same 260-char cap as every other tile string rather than inventing a second cap.

## Decision 4 — Where the stamp happens

A new pure `attachSuiteTileMeta(items, {names?})` in `src/skill-suite.ts`, called in `src/sidebar.ts` immediately after `attachSuiteHowItWorks`. It stamps only `kind === "grokbit"` items whose name is a canonical suite member — the same two-condition guard `applySuiteKind` already uses, so a workspace fork of `grokbit-plan` (which deliberately stays `kind: "skill"`) never inherits Grokbit's roster claims.

Ordering is unchanged and still load-bearing: `applySuiteKind` → `attachSuiteHowItWorks` → `attachSuiteTileMeta` → `buildCapabilityGroups`. The new call sits inside the existing window (after re-key, before grouping), so the `dedupeByPriority` ordering hazard documented in `src/skill-suite.ts:139-143` is untouched.

`CapabilityItem` gains one optional field: `meta?: { label: string; value: string }[]`.

## Rejected alternatives, briefly

- **Putting the facts in the description string.** Blows the 260-char cap and destroys the plain-language benefit line that a prior plan deliberately established.
- **A count-only chip (`4 agents`).** The user asked to *describe* the agents; a bare count is the information already implied by the Details button.
- **Rendering inside the collapsible detail body.** That is where this content already lives. The whole point is to surface it without a click.

## Risks

| Risk | Mitigation |
|---|---|
| Manifest drifts from the guides | Parity test (Decision 1), which fails the build |
| Tiles get visually crowded at narrow widths | Wrapping lines, no pixel floors; verified at ~250px and at font scale 60% / 300% |
| `capabilityGroupsView`'s whitelist silently drops `meta` | Explicit unit test asserting `meta` survives the view-model, listed as its own verify step |
| Ship's empty roster renders as a gap | `agentsNote` + parity assertion 3 |
