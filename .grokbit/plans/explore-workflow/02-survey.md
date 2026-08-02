# Survey — Explore workflow in Grokbit Actions

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Suite skill name list (pipeline order) | EXISTS | `src/skill-suite.ts:47-52` — four names: plan, implement, test, document |
| Suite provision loop (copies each name) | EXISTS | `src/extension.ts:52-69` — iterates `SUITE_SKILL_NAMES`, `cp` into home tier |
| Suite re-key to `kind: "grokbit"` | EXISTS | `src/skill-suite.ts:145-162` — name ∈ list **and** path under managed dir |
| Bundled skills root | EXISTS | `resources/skills/` — four skill dirs + README; **no** `grokbit-explore` |
| `grokbit-explore` skill package | DOES NOT EXIST | listed `resources/skills/`; only plan/implement/test/document present |
| Featured list for Actions sort | EXISTS | `media/webview-helpers.js:669-670` — `CAPABILITY_FEATURED.grokbit` four names |
| Local-override suite name set (webview) | EXISTS | `media/webview-helpers.js:689-691` — `SUITE_SKILL_NAMES_LC` four names |
| Actions visibility allowlist | EXISTS | `media/webview-helpers.js:687` — `CAPABILITY_VISIBLE_KINDS = ["grokbit"]` |
| Built-in agent featured names `explore`/`explorer` | EXISTS | `media/webview-helpers.js:675` — **agents** group, not suite; different surface |
| Suite README pipeline diagram | EXISTS | `resources/skills/README.md:5-9`, `:34-45` — four skills; plan→… pipeline |
| Product “four skills” copy | EXISTS | `README.md:129-136`; `CHANGELOG.md:7,18`; `CLAUDE.md:111,119` |
| Architecture suite description | EXISTS | `docs/architecture.md:235`, `:331` (four skills) |
| DOM tests: four-step Actions order | EXISTS | `test/capabilities.dom.test.ts:106-111`, `:814-828` |
| Unit tests: featured order | EXISTS | `test/webview-helpers.test.ts:1206-1224` |
| Suite unit tests (manifest-driven) | EXISTS | `test/skill-suite.test.ts:122-125` — maps over `SUITE_SKILL_NAMES` |
| Explore phase in legacy workflow docs | EXISTS | `docs/WORKFLOW.md:27-34` — explore before plan; chat map; exit criteria |
| `.grokbit/context/` digests (document skill) | EXISTS | `resources/skills/grokbit-document/SKILL.md:124-136` — **document** phase digests, not explore |
| Plan Survey step (grounded citations) | EXISTS | `resources/skills/grokbit-plan/SKILL.md:56-66` — writes `02-survey.md` under plan slug |
| Cross-session handoff | EXISTS | `.grokbit/handoff.md` — unrelated prior phase-a work; no explore content |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- **`SUITE_SKILL_NAMES` + `applySuiteKind` + `provisionSkillSuite`** — adding a fifth name to the array is the entire extension plumbing path for membership, re-key, and home-tier copy (`src/skill-suite.ts:47-52`, `src/extension.ts:52-69`). No new TypeScript API required if the skill directory name matches the array entry.
- **`CAPABILITY_FEATURED.grokbit` + `partitionFeatured`** — ordering of Actions tiles comes only from this array staying in lockstep with `SUITE_SKILL_NAMES` (`media/webview-helpers.js:656-662`, `:669-670`).
- **`SUITE_SKILL_NAMES_LC` + `markLocalSuiteOverrides`** — workspace forks of suite basenames get a local-override badge when not `kind: "grokbit"` (`media/webview-helpers.js:689-733`).
- **Sibling skill shape** — each suite skill is `SKILL.md` + `references/{roles,loops,host-adapters}.md` + optional `assets/` (e.g. `resources/skills/grokbit-plan/` layout observed this session).
- **Skill frontmatter pattern** — YAML `name` + long `description` (when-to-use / when-not) at top of each `SKILL.md` (e.g. `resources/skills/grokbit-plan/SKILL.md:1-4`).
- **Explore product language** — `docs/WORKFLOW.md:27-34` already defines explore exit criteria (name files you’ll touch; contracts you must not break) suitable to steal for skill exit criteria.
- **Tests that already iterate the manifest** — `test/skill-suite.test.ts:122-125` will auto-cover a new name once the dir is provisioned in fixtures via `suitePath(n)`.

## Supersession
What this change replaces, duplicates, or make dead. Caller counts are required.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Four-name `SUITE_SKILL_NAMES` content | `src/skill-suite.ts:47-52` | provision loop 1 (`extension.ts:52`); re-key default; suite tests | Pipeline grows; order becomes explore-first |
| Four-name `CAPABILITY_FEATURED.grokbit` | `media/webview-helpers.js:670` | `partitionFeatured` / Actions mounts | Must list every suite member or last steps hide behind expand |
| Four-name `SUITE_SKILL_NAMES_LC` | `media/webview-helpers.js:689-691` | `markLocalSuiteOverrides` | Fork badge list must include `grokbit-explore` |
| Hardcoded four-step DOM expectations | `test/capabilities.dom.test.ts:106-111`, `:814` (`FEATURED_FOUR`) | ≥5 asserts in that file | Will fail when featured list gains explore |
| Hardcoded featured order unit test | `test/webview-helpers.test.ts:1207-1223` | 1 test | Same |
| “Four skills” / four-step product copy | `README.md:129-136`; `resources/skills/README.md:5-9,:34-45`; `CLAUDE.md:111,119`; `docs/architecture.md:331`; `CHANGELOG.md` (historical OK) | many docs | Stale teaching of the pipeline |
| Suite README pipeline diagram starting at plan | `resources/skills/README.md:37-44` | suite doc SoT | Must show explore before plan if explore is first step |

**Not superseded (adjacent, different job):**

| Item | Location | Callers | Note |
|---|---|---|---|
| Built-in agent featured `explore`/`explorer` | `media/webview-helpers.js:675` | agent group only; filtered out of default Actions | Different surface; keep |
| Plan Survey (`02-survey.md`) | `grokbit-plan` | every plan run | Chat-only Explore does not replace Plan Survey; Plan still grounds for a change |
| Document `.grokbit/context/` digests | `grokbit-document` | post-doc | Not explore output |

## Prior attempts
Earlier implementations of this same idea. Say which one live code actually uses.

- **Legacy agentic-team / WORKFLOW “explore” phase** — documented in `docs/WORKFLOW.md` and `docs/USER_GUIDE.md` as part of an older Claude template loop (`explore → plan → implement → …`). Not shipped as a Grokbit Actions suite skill today.
- **CLI built-in agent type `explore`** (and repo `explorer` agent name) — featured under Agents in capability data, but Grokbit Actions only renders `grokbit` kinds (`media/webview-helpers.js:687`), so users never see them in Actions. Live for slash/agent discovery only where those groups surface (currently filtered out of Actions).
- **No prior `grokbit-explore` package** in `resources/skills/`.

## Conventions
How this repo actually works, with an example of each.

- **Errors / degradation:** provisioning failures are non-fatal; suite group simply absent (`src/extension.ts:22-28`, `:72-75`).
- **Tests:** vitest, grok-free; suite policy in `test/skill-suite.test.ts`; webview pure helpers in `test/webview-helpers.test.ts`; DOM via happy-dom in `test/capabilities.dom.test.ts`. Command: `npm test` (project AGENTS.md).
- **State / pure modules:** skill-suite policy is pure; impure copy lives in `extension.ts` (`src/skill-suite.ts:1-8`).
- **Layout:** suite skills under `resources/skills/<name>/SKILL.md`; extension source under `src/`; webview under `media/`.
- **Ordering rule:** `SUITE_SKILL_NAMES` and `CAPABILITY_FEATURED.grokbit` must stay identical order (`src/skill-suite.ts:33-45`, `media/webview-helpers.js:656-662`).
- **Security rule for suite badge:** re-key requires path under managed dirs (`src/skill-suite.ts:127-134`).

## Absences
Missing infrastructure the plan may need to add.

- No `resources/skills/grokbit-explore/**` content.
- No shared TypeScript constant exported to the webview for suite names (webview duplicates the list as `SUITE_SKILL_NAMES_LC` / `CAPABILITY_FEATURED.grokbit`) — keep dual lists in sync by convention, same as today.
- Coverage tooling: NONE in project test commands (AGENTS.md) — coverage gate N/A.
- Explore does **not** need a new host message type or webview mount if it only adds a suite skill.

## Danger zones
- `media/webview-helpers.js` — dual sources of suite name truth; miss one → wrong order, expand link, or missing local-override badge.
- `src/skill-suite.ts` + `src/extension.ts` — name in manifest but missing on-disk dir → silent skip on provision (`extension.ts:54` `if (!fs.existsSync(from)) continue`).
- `test/capabilities.dom.test.ts` — brittle hardcoded four-name arrays; easy to leave half-updated.
- Skill body quality — a bundled skill is an implicit endorsement (`docs/plans/grokbit-actions-and-bundled-skill-suite.md` preamble); a hollow SKILL.md that duplicates Plan Survey poorly creates silent COEXIST of two “map the repo” procedures.

## Grounding loop notes
Loop 2 pass 1: all intent entities resolved. No unresolved entity remaining within cap.
