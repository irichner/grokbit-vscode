# Plan — Enhance Grokbit extension from three workflow systems

Slug: `workflow-compare-ultimate-template` · Approach: Option D layered waves · Blast radius: extension host + resources + optional workspace `.grok/hooks/`; 0 schema; 0 npm deps preferred

> Comparison sources: Grokbit suite + dogfood · Ultimate · GrokForge template.  
> Goal: **extension capabilities**, not picking a single winner.

## Tasks

### T1 — Freeze comparison artifact (this package)
- **intent:** Durable three-way survey + design for human gate and implement handoff
- **files:** `.grokbit/plans/workflow-compare-ultimate-template/*`
- **cwd:** none
- **depends:** none
- **verify:** PowerShell: all of `01-intent.md`,`02-survey.md`,`03-design.md`,`04-review.md`,`plan.md`,`assumptions.md` exist under slug; `Select-String -Path .grokbit/plans/workflow-compare-ultimate-template/02-survey.md -Pattern 'DOES NOT EXIST'` finds hooks absence row
- **removes:** none
- **baseline:** none
- **rollback:** delete slug dir
- **state-after:** working
- **notes:** Done in plan phase when human approves.

### T2 — Vendor GrokForge hook scripts into the extension package tree
- **intent:** Extension owns a version-stamped copy of Python Grok hooks (Stop Lint+Unit, protect_paths, mark_changed, session_start, record_session_tokens, settings.json, README) for provision — not “hope user has the template repo”
- **files:** `resources/hooks/grok/**` (new), optionally `resources/hooks/README.md`, bump notes in `CHANGELOG.md` when shipping
- **cwd:** none
- **depends:** T1
- **verify:** `Test-Path resources/hooks/grok/verify_on_stop.py,resources/hooks/grok/protect_paths.py,resources/hooks/grok/settings.json`; pure helpers importable or syntax-check: `python -m py_compile resources/hooks/grok/verify_on_stop.py resources/hooks/grok/protect_paths.py resources/hooks/grok/mark_changed.py resources/hooks/grok/_common.py`
- **removes:** none
- **baseline:** none (new assets)
- **rollback:** delete `resources/hooks/`
- **state-after:** working
- **notes:** Source of truth to copy from: `C:\Users\israe\Projects\grokbuild-dev-team-template\.grok\hooks\` (ADR 0001). Adapt paths for workspace-relative commands only. Do not invent token counts in record_session_tokens.

### T3 — Extension provisioner + setting for workspace hooks (product)
- **intent:** Users/maintainers can install hooks into the **open workspace** `.grok/hooks/` the way skills are provisioned to home — default **off**; command or setting `grok.hooks.provision` / `Grok: Install workspace harness hooks`
- **files:** `src/extension.ts` or dedicated `src/hook-suite.ts` (mirror `skill-suite.ts` purity where possible), `package.json` contributes, tests under `test/`
- **cwd:** none
- **depends:** T2
- **verify:** `npm test` green including new unit tests for pure provision policy (`shouldProvisionHooks`, copy targets, refuse overwrite without force/backup); `npx tsc -p . --noEmit` clean
- **removes:** none
- **baseline:** activation currently does not create `.grok/hooks` (absence)
- **rollback:** revert provisioner commits
- **state-after:** working
- **notes:** Workspace-first per review. Backup on overwrite (installer `--force` pattern). Never require hooks for Claude-only workspaces. Disclose `/hooks-trust` requirement in setting description.

### T4 — Dogfood: enable hooks in Grokbit.ai workspace
- **intent:** This monorepo runs under the same Stop backstop as GrokForge template
- **files:** `.grok/hooks/**` (generated/copied), maybe `AGENTS.md` note that hooks are backstop only
- **cwd:** none
- **depends:** T3
- **verify:** `Test-Path .grok/hooks/verify_on_stop.py,.grok/hooks/settings.json`; Project Test Commands in `AGENTS.md` are parseable for Lint/Unit (even if Lint is NONE — gate fail-open with note is OK); `npm test` still green
- **removes:** none (adds hooks)
- **baseline:** sessions finish without Stop lint/unit gate
- **rollback:** remove `.grok/hooks/`
- **state-after:** working
- **notes:** Fulfills REPLACE disposition on soft-only dogfood. Prefer running provisioner command over hand-copy so product path is exercised.

### T5 — Unit tests for hook decision pure functions (CI-safe)
- **intent:** Port or reimplement pure allow/block decisions from template tests so CI proves gate logic without real `grok`
- **files:** `test/grok-hooks*.test.ts` and/or `scripts/tests` if Python tests preferred; keep `npm test` grok-free
- **cwd:** none
- **depends:** T2
- **verify:** `npm test` includes hook decision cases (block on red unit cmd, allow when no change marker, protect `.env`)
- **removes:** none
- **baseline:** none
- **rollback:** delete tests
- **state-after:** working
- **notes:** Can land with T2/T3. Mirror `tests/test_grok_hooks.py` intent from template.

### T6 — Ship / Run pipeline Action (orchestration UX from Ultimate)
- **intent:** One Actions entry that seeds a full pipeline brief with **human checkpoint after plan** (Ultimate `/ship` steps 1–2), without rewriting accuracy into TypeScript
- **files:** `resources/skills/` (optional thin `grokbit-ship` or extend suite docs), `media/webview-helpers.js` featured list if needed, `src/skill-suite.ts` if suite membership changes, tests for view-model
- **cwd:** none
- **depends:** T1
- **verify:** `npm test` green; capability/suite tests assert Ship tile or skill name present when provisioned; skill body contains explicit pause-after-plan language
- **removes:** none
- **baseline:** Actions shows explore→document tiles only for suite
- **rollback:** remove skill + featured entry
- **state-after:** working
- **notes:** COEXIST with phase tiles. Agent budget note from Ultimate (~5) optional in skill text.

### T7 — Dual-stack / dual-backend collision documentation + soft warning
- **intent:** Productize GrokForge ADR 0002 insight: name collisions and double hooks are real when both stacks load
- **files:** `Claude.md` Known limits (or `docs/`), optional pure scanner, optional Output channel warning when both `.grok/hooks` and `.claude/hooks` exist
- **cwd:** none
- **depends:** T1
- **verify:** docs mention dual-hook risk; if scanner added, unit test detects fixture paths; `npm test` green
- **removes:** none
- **baseline:** Known limits may omit dual-hook collision
- **rollback:** revert doc/scanner
- **state-after:** working
- **notes:** No forced rename of user Claude agents from extension.

### T8 — Thin plan/SHIP artifact affordance
- **intent:** Let users open latest `.grokbit/plans/<slug>/` or `test/release-readiness.md` from UI without leaving chat
- **files:** `media/chat.js` / host message handler; pure path helpers; tests
- **cwd:** none
- **depends:** T1
- **verify:** unit/DOM test for “open plan dir” message shape; `npm test` green
- **removes:** none
- **baseline:** users open plans only via filesystem
- **rollback:** revert UI
- **state-after:** working
- **notes:** Read-only; no second source of truth. Wave 4 — can ship after T3 if capacity.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Three systems surveyed with citations | T1 + `02-survey.md` |
| Grokbit hooks absence + skill parity | T1 survey rows |
| Design maps ideas → extension surfaces | T1 `03-design.md` Wave 1–4 |
| Extension enhancement tasks with verify | T2–T8 |
| Prioritized roadmap | task order T2→T5 hooks first; T6 Ship; T7 policy; T8 surfaces |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 1 (soft-only dogfood) | T4 after T3 |
| DEPRECATE | 0 | — |
| COEXIST | 2 (phase tiles + Ship; suite plan vs project plan) | T6 + docs |
| LEAVE | 2 (install whole Ultimate; bash hooks for Grok) | — |

Net: extension-focused additive; dogfood gains hooks.

## Open assumptions

See `assumptions.md` — home-tier hooks deferred; provision default **off** for foreign workspaces.

## Approval

- [ ] Human approved — <date>

### Gate summary

**Three systems, one product goal: stronger Grokbit extension.**

| System | What it wins | What we take into the extension |
|---|---|---|
| **GrokForge template** | Grok Python Stop + protect_paths; dual-stack ADR; installer opt-in | **Wave 1:** vendor + provision workspace hooks; dogfood enable; pure tests |
| **Ultimate** | `/ship`, checkpoint, Claude hard gates | **Wave 2:** Ship/Run pipeline Action (seed/orchestrate, pause after plan) |
| **Grokbit suite** | Baseline, supersession, portable skills, SHIP evidence | **Keep** as default Actions pipeline; **Wave 4:** thin open-artifact UX |
| **Grokbit dogfood today** | Same plan/implement as template | Skills already aligned; **hooks are the gap** |

**Primary order if you approve:** T2 → T3 → T5 → T4 (hooks product + dogfood) → T6 (Ship) → T7 → T8.

**Not in scope unless you ask:** rewriting Ultimate/template repos; home-tier hooks by default; full suite rewrite.

### Verdict commands

- `[Plan approved]` — proceed to implement (baseline `grokbit-test` only if tasks have non-none baselines; T3+ have baselines noted)
- `[Plan rejected] …` — reorder waves, drop Ship, force home hooks, etc.
- `[Plan cancelled]`
