# Survey — Plain-language Grokbit workflow descriptions

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Suite skill names (pipeline order) | EXISTS | `src/skill-suite.ts:47-52` (`grokbit-explore` … `grokbit-document`) |
| Bundled skill sources | EXISTS | `resources/skills/grokbit-*/SKILL.md` (five directories under `resources/skills/`) |
| Explore description (frontmatter) | EXISTS | `resources/skills/grokbit-explore/SKILL.md:3` — **346 chars** |
| Plan description (frontmatter) | EXISTS | `resources/skills/grokbit-plan/SKILL.md:3` — **679 chars** |
| Implement description (frontmatter) | EXISTS | `resources/skills/grokbit-implement/SKILL.md:3` — **566 chars** |
| Test description (frontmatter) | EXISTS | `resources/skills/grokbit-test/SKILL.md:3` — **691 chars** |
| Document description (frontmatter) | EXISTS | `resources/skills/grokbit-document/SKILL.md:3` — **710 chars** |
| Host description cap | EXISTS | `src/capabilities.ts:168-171` — `CAPABILITY_DESCRIPTION_MAX_CHARS = 280` |
| Description parse + truncate on disk skill load | EXISTS | `src/capabilities.ts:371-407` (`capabilityFromSkillFile` → `truncateDescription`) |
| Webview display cap + sentence-aware trim | EXISTS | `media/webview-helpers.js:623-642` — `CAPABILITY_ROW_DESCRIPTION_MAX = 260` |
| Actions only shows `grokbit` kind | EXISTS | CLAUDE.md Grokbit Actions section; `CAPABILITY_VISIBLE_KINDS` pattern in webview helpers (suite group) |
| Provisioning copy of suite to home tier | EXISTS | `resources/skills/README.md:15-22`; skill-suite provision policy in `src/skill-suite.ts` |
| Test pinning real long plan description | EXISTS | `test/webview-helpers.test.ts:1009-1038` (hardcoded current plan frontmatter; expects sentence cut at `.grokbit/plans/.`) |
| Fixture descriptions in DOM tests | EXISTS | `test/capabilities.dom.test.ts:82-86` — short placeholders (`"Map first."` etc.), not live frontmatter |
| Suite README high-level pipeline copy | EXISTS | `resources/skills/README.md:51-53` (separate from tile frontmatter) |

## Current description content (source of truth for tiles)

Measured via Node read of frontmatter `description:` lines (this session):

| Skill | Chars | First user-visible idea (before / after “Use when”) |
|---|---|---|
| grokbit-explore | 346 | “Map relevant code… cited orientation… paths, contracts, unknowns” + Use/Do NOT |
| grokbit-plan | 679 | “verified, grounded implementation plan… four-role pipeline… durable artifacts…” + Use/Do NOT |
| grokbit-implement | 566 | “approved plan… preflight, bounded retry, revert-on-failure, scope audit…” + Use/Do NOT |
| grokbit-test | 691 | “behavioral regression… baseline… production-parity build…” + Use/Do NOT |
| grokbit-document | 710 | “README, ADR… SDD, PDD, BRD… derive_from artifacts…” + Use/Do NOT |

All five **exceed 260**, so the Actions UI never shows the full string today. Sentence-aware trim keeps complete sentences when possible (`media/webview-helpers.js:631-642`). The plan-specific unit test asserts the *current* long string truncates to the first three technical sentences (`test/webview-helpers.test.ts:1034-1038`).

## Reusable code
- **Frontmatter → CapabilityItem.description** — already implemented; changing YAML is enough for discovery if we stay under caps. `capabilityFromSkillFile` at `src/capabilities.ts:371-407`.
- **Sentence-aware display trim** — keep; new copy should avoid needing mid-description cuts by staying ≤260. `truncateCapabilityDescription` at `media/webview-helpers.js:631-642`.
- **Suite provision inequality re-copy** — new SKILL.md content ships with extension version bump / rebuild; no separate install path. See suite README install section `resources/skills/README.md:15-28`.
- **No existing plain-language display override map** for suite skills — `DOES NOT EXIST` as a dedicated API; tiles use disk description only.

## Supersession
What this change replaces, duplicates, or makes dead.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Current five `description:` strings (agent-jargon / Use-when walls) | `resources/skills/*/SKILL.md:3` | Discovery UI (tiles), agent skill-selection context, one hardcoded test | Replaced by plain-language copy under display cap |
| Hardcoded long plan description fixture | `test/webview-helpers.test.ts:1011-1038` | 1 test | Must track new wording or switch to a synthetic long string that still exercises sentence-aware trim |

No dead code paths: description field and trim logic remain.

## Prior attempts
- Actions UX work already raised host description cap and multi-line tile rendering (CLAUDE.md § Chat surfaces / Grokbit Actions) — that fixed *layout*, not *wording*.
- DOM tests use deliberately short fake descriptions (`"Map first."`, etc.) — not a prior rewrite of production copy.

## Conventions
- **Skill format:** YAML frontmatter `name` + `description` then body — Anthropic-compatible skill files under `resources/skills/<name>/SKILL.md`.
- **Tests:** Vitest; pure description trim tested without spawning CLI (`test/webview-helpers.test.ts`).
- **UI copy tone (product intent):** CLAUDE.md frames Actions for non-technical users (“Click anything to drop it into the message box…”); workflow tiles should match that register.
- **Caps relationship:** host 280 ≥ webview 260 (`src/capabilities.ts:168-170` comment).

## Absences
- No separate human-facing vs agent-facing description fields in frontmatter schema today.
- No snapshot test that reads live `resources/skills/**/SKILL.md` into the webview (only a hand-copied plan string in one test).

## Danger zones
- `test/webview-helpers.test.ts:1009-1038` — will fail if plan description changes without updating the test.
- Skill `description` is also agent-routing metadata for Claude/Grok skill selection — shortening “Use when / Do NOT” can reduce auto-invocation quality if users never click tiles / type slash commands (`UNVERIFIED` magnitude; skill bodies still carry full rules).
- Provisioned home copies under `~/.grok/skills` / `~/.claude/skills` lag until re-provision; local-only SKILL.md edits in `resources/` do not update home until rebuild/activation.
