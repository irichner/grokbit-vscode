# Review log — Explore workflow in Grokbit Actions

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[MAJOR]` Survey missed **package.json** setting copy that hardcodes the four-step workflow — evidence: `package.json:237` (`plan → implement → test → document`), `package.json:247` (`plan, implement, test, document`). Leaving these unupdated ships Settings UI that contradicts Actions. Resolves by: add to supersession + REPLACE disposition + a plan task.
- `[MAJOR]` DOM test that clicks the **first** Actions row expects `/grokbit-plan ` — evidence: `test/capabilities.dom.test.ts:114-119`. With explore-first, first row becomes explore; unupdated test fails or, worse, fixtures stay plan-first and hide the bug. Resolves by: explicit fixture order explore-first + expect `/grokbit-explore `.
- `[MAJOR]` Skill vs Plan Survey **silent COEXIST** risk is acknowledged but not operationalized — if Explore’s Cartographer produces the same artifact shape and claims as Plan Survey, agents will skip one or both poorly. Resolves by: hard rule + failure mode in skill: Explore never writes `02-survey.md` / `plan.md`; Plan never treats chat map as authoritative without re-opening files; skill exit criteria stay “orientation,” not “entity resolution complete.”
- `[MINOR]` `assets/map.template.md` marked optional — leave as include (cheap, teaches format) or drop; decide in plan so implement doesn’t thrash.
- `[MINOR]` Sibling enumerations in `resources/skills/grokbit-test/references/host-adapters.md:44` list three other siblings without explore — update when suite README is touched.
- `[MINOR]` No automated test that the skill directory exists on disk — acceptable LEAVE; provision silent-skip is the failure mode if implement ships manifest without dir (already called out in design unhappy paths).

### Architect response — Round 1
- `[MAJOR]` package.json copy → **REVISED**: added to supersession disposition table and plan tasks (Settings strings).
- `[MAJOR]` first-row DOM seed → **REVISED**: plan task requires `SUITE_GROUP` fixtures explore-first and seed assertion `/grokbit-explore `.
- `[MAJOR]` silent COEXIST with Plan Survey → **REVISED**: skill hard rules + plan notes require explicit differentiation; light Plan Step 0 note remains optional but recommended.
- `[MINOR]` map.template → **REVISED**: **include** `assets/map.template.md` (chat structure only).
- `[MINOR]` host-adapters sibling lists → **REVISED**: in suite docs task.
- `[MINOR]` no disk-exists test → **REBUTTED / LEAVE**: matching existing suite practice; unhappy-path note sufficient.

## Round 2
Reviewed revised design obligations (this log + plan decomposition). Spot-check: `src/skill-suite.ts:47-52` still four names; design citations match. Intent done-criteria all mappable. Non-goals intact (no durable digests, no new kind, agents leave).

- `[MINOR]` Description frontmatter length — Actions trims ~260 chars sentence-aware; skill `description:` must lead with a complete first sentence that stands alone as the tile blurb.

### Architect response — Round 2
- `[MINOR]` → **ACCEPTED**: plan notes for SKILL.md frontmatter lead sentence.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none (MINORs accepted into plan notes)

## Plan review (Loop 4)
One pass, after Decompose — checks the task list against the design, not the design decision again.  
Reviewed: `plan.md`

- `[MAJOR]` Verification matrix must cover “read-only / no durable files required” — cannot fully automate agent behavior in `npm test`; resolves by: matrix rows that distinguish **extension wiring** (automated) vs **skill procedure** (manual/smoke checklist + content review of SKILL.md hard rules present).
- `[MINOR]` Skill body is large — keep one task for skill package so verify can be “files exist + frontmatter name + hard-rule strings present,” not “run explore against real repo.”

### Architect response
- `[MAJOR]` → **REVISED**: verification matrix splits automated vs manual criteria; T2 verify greps hard rules in SKILL.md.
- `[MINOR]` → **REVISED**: single T2 skill-content task with grep-based verify.

Outcome: clean after revision
