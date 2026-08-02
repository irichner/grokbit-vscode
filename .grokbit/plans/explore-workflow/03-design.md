# Design — Explore workflow in Grokbit Actions

## Options considered

### Option A — Extend the existing suite (fifth skill + manifest order)
Approach: Author `resources/skills/grokbit-explore/` as a full suite skill (SKILL.md + roles/loops/host-adapters + any assets). Prepend `"grokbit-explore"` to `SUITE_SKILL_NAMES`, `CAPABILITY_FEATURED.grokbit`, and `SUITE_SKILL_NAMES_LC`. Update suite README pipeline diagram and product copy (README/CLAUDE/architecture). Refresh tests that hardcode the four-step list. No new CapabilityKind, no new host APIs, no durable explore artifacts (chat map only per intent).

Trade-off (against the intent's constraints):
- **Pros:** Reuses proven provision/re-key/Actions path; identical on both backends by construction; smallest extension blast radius; matches “full suite skill” + “first step” + “chat map only.”
- **Cons:** Skill content quality is the real work (roles/loops must be distinct from Plan Survey or they teach two competing maps); dual name lists (TS + webview) must be updated in lockstep by convention.

### Option B — Host-only Actions stub + thin invoke
Approach: Special-case a fifth tile in the webview that seeds a hard-coded prompt or invokes the built-in `explore` agent type, without shipping `resources/skills/grokbit-explore`.

Trade-off:
- **Pros:** Fewer skill files; might feel “lighter.”
- **Cons:** Breaks “identical on both backends” (built-in explore is not a portable skill); fails “full suite skill” done-criterion; invents a second way to put rows in Actions outside `SUITE_SKILL_NAMES` (silent COEXIST with suite membership rules); no provision path for CLI sessions outside the extension.

## Decision
**Chosen: A**

Rationale against constraints: Intent requires a full suite skill, first pipeline position, chat-only map, and Actions parity. Option A is exactly the extension’s existing product contract for suite growth (`src/skill-suite.ts:40-45` comment: add skill under `resources/skills` **and** to the array in the same change). Option B fails portability and the full-skill criterion.

What the rejected option was better at: Option B is fewer markdown files if the only goal were a decorative fifth button—but that is not this intent.

## Shape of the change

### 1. Skill package (`resources/skills/grokbit-explore/`)
Full suite skill, chat-only product:

| File | Role |
|---|---|
| `SKILL.md` | When to use / hard rules / pipeline / output contract (chat) / failure modes |
| `references/roles.md` | Role prompts (see below) |
| `references/loops.md` | Caps and exit criteria |
| `references/host-adapters.md` | Same portability notes as siblings; install via extension provision |
| `assets/map.template.md` (optional) | Structure of the **chat** map (template text the agent fills in the reply—not a required on-disk artifact) |

**Hard rules (skill):**
1. **Read-only on product source** — no edits under app/src product trees; no implementation. (Writing under `.grokbit/plans/` is not Explore’s job either—user chose chat-only.)
2. **Cite or flag** — every claim about the repo is `path:line` or marked unknown.
3. **Terminate** — bounded map breadth (sample + cap, disclose caps).
4. **Do not invent a plan** — if the user wants a change, hand off to `/grokbit-plan`; do not produce `plan.md` tasks here.

**Pipeline (skill):**
```
  Scope ──▶ Map (read-only) ──▶ Cite-check ──▶ Present map in chat
  (BA-lite)   (Cartographer)     (Reviewer)     (end turn; invite plan if needed)
```

**Roles (full skill, lighter than plan):**
- **Scope Setter** (standard) — turn the user’s question into a map charter: what to find, what is out of bounds; ≤1 clarifying question only if the target is impossible to guess.
- **Cartographer** (cheap) — wide read-only survey of relevant code; produce entity list + citations + conventions + unknowns.
- **Citation Checker** (standard) — adversarial pass: open cited paths; drop or flag ungrounded claims.

**Chat map shape** (inspired by `docs/WORKFLOW.md:27-34` exit criteria):
- Question restated in one line
- Relevant areas (bullets with `path:line`)
- How they connect (short prose)
- Contracts / invariants not to break
- Open unknowns
- Suggested next step: `/grokbit-plan <…>` when the user wants a change; otherwise stop

**Relationship to Plan Survey:** Explore is **orientation before a change decision**; Plan Survey is **grounded entity resolution for a specific change**. They COEXIST deliberately with different outputs (chat vs `02-survey.md`). Explore is not a substitute for Plan Survey.

### 2. Extension plumbing (minimal)
- `src/skill-suite.ts` — `SUITE_SKILL_NAMES` becomes:
  ```ts
  ["grokbit-explore", "grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document"]
  ```
- `media/webview-helpers.js` — same order in `CAPABILITY_FEATURED.grokbit` and `SUITE_SKILL_NAMES_LC`.
- No change to `applySuiteKind` algorithm, `suiteTargets`, `shouldProvision`, or `provisionSkillSuite` control flow (they already iterate the array).

### 3. Docs & suite README
- `resources/skills/README.md` — five skills + pipeline diagram with explore first.
- `README.md` — Actions table gains Explore row; “four skills” → five; order explore-first.
- `CLAUDE.md` — Grokbit Actions paragraphs that hardcode four names/order.
- `docs/architecture.md` — “four skills” mentions.
- Sibling skill one-liners only where they claim “four” or start the pipeline at plan (e.g. host-adapters install lists that enumerate siblings)—update enumerations, not rewrite plan/implement procedures.
- `CHANGELOG.md` — **Added** bullet when shipping (implement phase / rebuild); not required before plan approval.

### 4. Tests
- `test/webview-helpers.test.ts` — featured list order includes explore first; reordering fixture includes explore.
- `test/capabilities.dom.test.ts` — suite fixtures and “all N steps / no expand” expectations use five names; `FEATURED_FOUR` → five suite names (and expand tests that add a sixth `alpha` still valid).
- `test/skill-suite.test.ts` — largely auto-follows `SUITE_SKILL_NAMES`; add explicit “explore is first” assertion if useful.
- Optional: assert `resources/skills/grokbit-explore/SKILL.md` exists (filesystem smoke) if the repo already has similar checks—if not, LEAVE (don’t invent new test infra).

### 5. Plan skill cross-link (light)
Optional one paragraph in `grokbit-plan/SKILL.md` Step 0: if the conversation just ran Explore, use that orientation but **still** run Survey with fresh citations (chat memory is not a substitute for opening files). No disk contract.

## Disposition of superseded code
Every item from the survey's supersession section. No item may be omitted.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Four-name `SUITE_SKILL_NAMES` | REPLACE | pipeline grows; explore first | update array content in place (same export) |
| Four-name `CAPABILITY_FEATURED.grokbit` | REPLACE | must stay lockstep with suite list | update array |
| Four-name `SUITE_SKILL_NAMES_LC` | REPLACE | local-override badges | update array |
| Hardcoded four-step DOM tests | REPLACE | would fail / teach wrong pipeline | update fixtures + expectations |
| Hardcoded featured order unit test | REPLACE | same | update expectations + fixtures |
| “Four skills” product copy (README, CLAUDE, architecture, suite README) | REPLACE | stale teaching | rewrite to five-step explore-first |
| Suite README pipeline diagram | REPLACE | starts at plan today | explore → plan → … |
| Built-in agent `explore`/`explorer` featured list | LEAVE | different surface; Actions still filters agents | — |
| Plan Survey procedure | LEAVE | different job; chat Explore does not replace it | document distinction in explore SKILL + light plan note |
| Document `.grokbit/context/` digests | LEAVE | not explore output | — |
| Historical CHANGELOG “four skills” entries | LEAVE | accurate historical record | new **Added** entry only when shipping |
| `package.json` setting strings (actions scope + skills.provision) | REPLACE | Settings UI still teaches four-step list (`package.json:237`, `:247`) | update to explore-first five-step wording |
| Sibling lists in suite skill `host-adapters.md` | REPLACE | incomplete sibling set after fifth skill | add `grokbit-explore` where siblings are enumerated |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Provisioning off / copy failed | Explore tile absent with rest of suite; honest empty Actions state unchanged |
| Skill dir missing but name in manifest | `extension.ts` skips missing dir; explore never provisioned; Actions missing one tile if others present — **implement must ship dir + manifest together** |
| User asks Explore to implement | Skill refuses; points to plan/implement |
| Huge monorepo | Cartographer caps breadth, discloses sampling; does not claim completeness |
| Concurrent edit of source during explore | Read-only; map may be stale—state “as of this pass” |
| Permission denied on a path | Record unknown; do not invent contents |
| User wants durable digests later | Out of scope this change; would be a follow-up plan |

## Migration
Schema change: no  
Reversible: yes — remove skill dir + revert three name lists + docs/tests  
Existing rows: N/A  
Mixed-version window: older extension without explore continues to show four tiles until rebuild/re-provision; after upgrade, version marker inequality re-copies suite (`shouldProvision`)

## New dependencies
None.
