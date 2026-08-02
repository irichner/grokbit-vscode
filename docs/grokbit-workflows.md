# Grokbit workflows — how they work

Full technical reference for the five bundled **Grokbit Actions** workflows. Short tile blurbs live in each skill's frontmatter; **this document** (and each skill's `references/how-it-works.md`) carry roles, loops, caps, artifacts, and gates.

Agent procedures remain each skill's `SKILL.md`. This guide is the product-facing layer.

## Pipeline overview

```
  grokbit-explore (optional)
           │
           ▼
  grokbit-plan  ──▶  human approval  ──▶  grokbit-test (baseline)
                                                  │
                                                  ▼
       verdict  ◀──  grokbit-test (verify)  ◀──  grokbit-implement
```

| Skill | Slash | Role |
|---|---|---|
| Explore | `/grokbit-explore` | Read-only orientation in chat |
| Plan | `/grokbit-plan` | Grounded plan + approval gate |
| Implement | `/grokbit-implement` | Task-by-task verify-or-revert |
| Test | `/grokbit-test` | Baseline + verify + SHIP verdict |
| Document | `/grokbit-document` | Derived docs with executable checks |

In the extension, open **Grokbit Actions**, pick a workflow tile, and click **Details** for the same content in-panel.

---

## Explore (`grokbit-explore`)

Source: `resources/skills/grokbit-explore/references/how-it-works.md`

## Purpose
**Explore** orients you on a part of the codebase **before** you plan a change. It is read-only on files **and** machine state: no edits, no installs, no tests that rewrite snapshots, no plan artifacts under `.grokbit/plans/`. Output is a **chat map** with `path:line` citations — not a substitute for Plan Survey.

Use when you need “what matters here?” and do not yet want a change plan. Skip when you already know the area and are ready for `/grokbit-plan`.

## Pipeline

```
  Scope ──▶ Map (read-only) ──▶ Cite-check ──▶ Present map in chat
  (Scope)     (Cartographer)     (Checker)      (end turn)
```

1. **Scope** — charter: what to find, what is out of bounds, at most one clarifying question.
2. **Map** — open files, cite entities, note connections and unknowns; sample large trees.
3. **Cite-check** — re-open key citations; drop unconfirmed claims.
4. **Present** — structured chat map; invite `/grokbit-plan` if a change is next.

## Roles

| Role | Job |
|---|---|
| **Scope Setter** | Charter only; no exploration yet |
| **Cartographer** | Read-only mapping with citations |
| **Citation Checker** | Spot-check citations; shorten to truth |

## Loops and caps

| Loop | Cap | Exit |
|---|---|---|
| **E1** Scope clarification | 1 question | Charter or stated assumption |
| **E2** Mapping breadth | 3 map passes | Enough for files + contracts + unknowns, or cap with gaps listed |
| **E3** Cite-check | 2 rounds | Every kept claim re-confirmed or moved to unknowns |

Bounding: ~50 caller matches per symbol; sample directories; disclose shortcuts.

## Cap behavior
Hitting a cap means **disclose and present**, not invent more detail. Incomplete honest maps beat sprawling confident ones.

## Artifacts
- **Writes:** none required. No `.grokbit/plans/**`, no digests required for success.
- **Reads:** repo files, greps, lists; optional prior chat.
- **Chat shape:** map template sections (relevant areas, how it fits, contracts, unknowns).

## Human gates
None mandatory. You may steer scope with one answer if asked. Explore never asks you to approve a plan.

## Next step
When you want a change: **`/grokbit-plan <brief>`**. Plan Survey will re-open files and write `02-survey.md`; the chat map is orientation only.

## Provenance
Derived from `resources/skills/grokbit-explore/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**


---

## Plan (`grokbit-plan`)

Source: `resources/skills/grokbit-plan/references/how-it-works.md`

## Purpose
**Plan** turns a request into a grounded, reviewable plan **before any product code is written**. Every claim about the repo must be read from disk (`path:line`) or marked `UNVERIFIED`. Every task must have a runnable `verify:` command. Writes during Plan are limited to `.grokbit/plans/<slug>/`.

Use for non-trivial work (behavior, multi-file, schema, auth). Trivial typos/docs may use a **short plan** still ending in human approval.

## Pipeline

```
  Intake ──▶ Survey ──▶ Design ◀──┐  ──▶ Decompose ◀──┐  ──▶ Approval Gate
  (BA)       (SA)      (Architect)│      (Architect)  │      (human)
                          │       │           │       │
                          └─ Loop 3 ─┘        └─ Loop 4 ─┘
                          Reviewer         Verifiability
```

1. **Intake** → `01-intent.md` (done-criteria, non-goals; ≤3 questions once).
2. **Survey** → `02-survey.md` (entities cited, reuse, supersession, conventions).
3. **Design** → `03-design.md` (≥2 options, disposition table) + adversarial `04-review.md`.
4. **Decompose** → `plan.md` (tasks with verify/baseline/removes/rollback).
5. **Approval gate** — stop; wait for human verdict. **Do not implement in Plan.**

## Roles

| Role | Job |
|---|---|
| **Business Analyst** | Testable intent; max 3 questions |
| **Systems Analyst** | Ground truth with citations |
| **Solutions Architect** | Options, dispositions, task breakdown |
| **Plan Reviewer** | Adversarial design review + one plan-level pass |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **1** Intake clarification | 1 round, 3 questions | Record assumptions; continue |
| **2** Grounding | 3 passes | `UNRESOLVED — Loop 2` in assumptions |
| **3** Adversarial review | 3 rounds | Surviving BLOCKER/MAJOR → assumptions |
| **4** Verifiability | 3 rewrite passes + 1–2 plan review passes | Unfixable tasks split or recorded |

Marker vocabulary: `UNVERIFIED` (assumed fact) vs `UNRESOLVED — <loop>` (loop gave up).

## Cap behavior
In Plan, hitting a cap means **record and continue**. Open questions in `assumptions.md` are visible; a plan with honest unknowns is still useful.

## Artifacts
Under `.grokbit/plans/<slug>/`:

| File | Role |
|---|---|
| `01-intent.md` | Done-criteria, non-goals |
| `02-survey.md` | Cited ground truth |
| `03-design.md` | Options + dispositions |
| `04-review.md` | Append-only findings |
| `plan.md` | Tasks + approval checkbox |
| `assumptions.md` | Open items ledger |

Dispositions for superseded code: `REPLACE` | `DEPRECATE` | `COEXIST` | `LEAVE` (silence is not allowed).

## Human gates
- **Approval** on `plan.md` before Implement (`approved` / `[Plan approved]`).
- Rejected → stay in Plan and revise; cancelled → leave Plan without implementing.
- User edits to `plan.md` are authoritative (offer re-verify if `verify:` changes).

## Next step
After approval: **baseline** via `/grokbit-test` (baseline mode) when any task has non-`none` `baseline:`, then **`/grokbit-implement`**.

## Provenance
Derived from `resources/skills/grokbit-plan/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**


---

## Implement (`grokbit-implement`)

Source: `resources/skills/grokbit-implement/references/how-it-works.md`

## Purpose
**Implement** builds an **approved** plan one task at a time. Each task either passes its `verify:` command or is **reverted to clean** — no half-finished debris. The plan is the scope; undeclared files and opportunistic cleanup are deviations.

## Pipeline

```
 Preflight ──▶ ┌─ per task ──────────────────────────────┐ ──▶ Handoff
 (Build Eng)   │  Write ──▶ Verify ◀─┐   ──▶ Scope audit │      to testing
               │  (SWE)     (I2 ×3)  │       (Reviewer)  │
               │     └── Dep gate ───┘       (I3 ×2)     │
               └──────────────────────────────────────────┘
    deviations ≥ 3 ──▶ back to grokbit-plan (max 2 replans)
```

1. **Preflight** — git, deps, env, suite state; dirty-tree snapshot if needed.
2. **Per task** — write → verify (retry ≤3) → scope audit → commit (when host allows).
3. **Dependency gate** — new packages require approval/rejection loop.
4. **Deviation count** — three counting deviations → re-plan from Survey.
5. **Handoff** → `implement/handoff.md` + invoke Test verify mode.
6. **Hand-back intake** — on Test `DO NOT SHIP` for REGRESSION/CRITICAL, append fix tasks (max 2 cycles).

## Roles

| Role | Job |
|---|---|
| **Build Engineer** | Preflight environment |
| **Software Engineer** | Task write/verify/revert |
| **Supply Chain Security Analyst** | Dependency gate |
| **Code Reviewer** | Scope audit (in/out of scope hunks) |
| **Orchestrator** | Counts deviations; enforces re-plan cap |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **I1** Preflight repair | 2 per check | Stop — do not code in broken env |
| **I2** Task execution | 3 attempts | Revert to clean; mark `blocked` |
| **I3** Scope audit | 2 rounds | Revert contested hunks or promote task |
| **I4** Dependency gate | 2 rejections | Ask human |
| **I5** Deviation escalation | 3 counting deviations | Stop; re-plan (max 2 replans per slug) |

**Revert to clean** = restore modified tracked files **and** delete files the task created (git checkout alone is not enough).

## Cap behavior
Unlike Plan, hitting implement caps means **revert**, not “record and leave broken code.” A blocked task in `progress.md` is better than a silent hollow green.

## Artifacts
Under `.grokbit/plans/<slug>/implement/`:

| File | Role |
|---|---|
| `preflight.md` | Env + pre-existing failures |
| `progress.md` | Task ledger (session memory) |
| `05-review.md` | Scope audit |
| `deviations.md` | Plan vs reality |
| `handoff.md` | Contract for Test |

Also updates top-level `.grokbit/handoff.md` for the next Plan session.

## Human gates
- Plan must already be approved.
- Dependency installs may need human choice after two rejections.
- Promoted out-of-scope tasks and Test hand-back tasks need a one-line yes.
- Dirty-tree proceed and baseline waiver are explicit user choices when used.

## Next step
**`/grokbit-test`** in verify mode (after baseline exists or reduced mode is stated). On `DO NOT SHIP`, Implement may take hand-back fix tasks.

## Provenance
Derived from `resources/skills/grokbit-implement/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**


---

## Test (`grokbit-test`)

Source: `resources/skills/grokbit-test/references/how-it-works.md`

## Purpose
**Test** produces evidence a non-expert can act on: what the system did **before**, what it does **after**, which done-criteria are proven, and whether it is safe to ship. It never edits product tests to force green (except a narrow post-SHIP baseline-retirement path).

## Pipeline

```
 baseline mode:  Capture ──▶ test/baseline.md        (before Implement)

 verify mode:    Regression ─▶ Criteria ─▶ Visual ─▶ Security ─▶ Maintenance ─▶ Release + Verdict ─▶ Retirement
                 (QA Auto)     (QA Auto)  (FE QA)   (AppSec)    (Maint Eng)     (Rel Eng)            (QA Auto)
```

### Modes

| Mode | When | Writes |
|---|---|---|
| **baseline** | Before implementation | `test/baseline.md` (+ characterization tests as needed) |
| **verify** | After implementation | `results.md`, `security.md`, `release-readiness.md` |

No baseline → reduced mode: still check criteria/security/build; **do not** claim “no regressions.”

## Roles

| Role | Job |
|---|---|
| **QA Automation Engineer** | Baseline, regression, criteria, retirement |
| **Frontend QA** | Visual / headless when UI changed |
| **Application Security** | Secrets, authz, injection, deps |
| **Maintenance Engineer** | Session debris list (does not auto-delete) |
| **Release Engineer** | Build/env/migration + SHIP verdict |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **T1** Baseline capture | 3 passes | Mark NOT CAPTURED |
| **T2** Criteria coverage | 3 passes | Mark UNVERIFIED |
| **T3** Failure triage | 3 hypotheses | UNDIAGNOSED; hand back on REGRESSION |
| **T4** Security | **no escape for CRITICAL** | Blocks release; hand back |
| **T5** Visual | 2 per view | UNVERIFIED if no browser |
| **T6** Reduced-mode entry | 1 explicit statement | Declare before regression claims |
| **T7** Baseline retirement | 2 per INTENDED finding | Only after SHIP / SHIP WITH CAVEATS |

## Cap behavior
Most loops **report the gap**. **CRITICAL** security has no cap that allows ship. Never edit a failing test to reach a verdict.

### Verdict map (verify)

| Finding | Effect |
|---|---|
| REGRESSION | `DO NOT SHIP` → hand back to Implement |
| CRITICAL security | `DO NOT SHIP` → hand back |
| UNKNOWN residuals | At best `SHIP WITH CAVEATS` |
| Failed done-criteria | Caveats or DO NOT SHIP if required |
| Clean + INTENDED only | `SHIP` possible |

## Artifacts
Under `.grokbit/plans/<slug>/test/`:

| File | Role |
|---|---|
| `baseline.md` | Pre-change behavior |
| `results.md` | Regressions, criteria, visual, maintenance, retirement |
| `security.md` | Findings by severity |
| `release-readiness.md` | Build/env + verdict |

## Human gates
- Reclassify `UNKNOWN` if asked (else caveats remain).
- Visual ambiguity may present screenshots for human taste.
- Verdict is evidence for the human; SHIP is not auto-deploy.

## Next step
On **SHIP** / **SHIP WITH CAVEATS**: optional **`/grokbit-document`** for reader-facing docs. On **DO NOT SHIP**: back to Implement hand-back (bounded cycles).

## Provenance
Derived from `resources/skills/grokbit-test/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**


---

## Document (`grokbit-document`)

Source: `resources/skills/grokbit-document/references/how-it-works.md`

## Purpose
**Document** writes human-facing project docs that stay **true**: derive from code and plan artifacts, ask only for gaps, then **verify** commands/paths/links. Wrong docs are worse than missing docs because people act on them.

Document types are **data** in `types/<id>.md` (registry-driven): readme, adr, changelog, api-reference, user-guide, contributing, test-plan, security-posture, runbook, sdd, pdd, brd — plus any types you add as files.

## Pipeline

```
 Necessity ──▶ Coverage ──▶ Gap fill ──▶ Draft ──▶ Executable verify ──▶ Fresh-reader ──▶ Emit + provenance
 (IA)          (Doc Eng)    (ask)       (Writer)   (Docs QA / D1)        (Docs QA / D2)    (manifest)
```

1. **Necessity** — who reads this, what changes for them? Refusal is valid.
2. **Coverage** — resolve `derive_from` against plans/source; report % before writing. Below ~30% → stop and say so.
3. **Gap fill** — batch questions up to type `ask_cap` (1–5).
4. **Draft** — sections per type; no invented claims (`TODO` or omit).
5. **Executable verify** — `scripts/verify_doc.py` (paths, links, commands listed; `--execute` only in containers/with explicit flag).
6. **Fresh-reader** — isolated reviewer attempts the task from the doc alone.
7. **Emit** — output path + `derived_from` / `content_hash` + `.grokbit/docs-manifest.json`.

### Plan-less (source-only) mode
Common for README/changelog without a plan slug: resolve only `src:` derivation sources; plan-only sections do not tank coverage.

## Roles

| Role | Job |
|---|---|
| **Information Architect** | Necessity / audience |
| **Documentation Engineer** | Coverage + structure |
| **Technical Writer** | Draft |
| **Docs QA** | verify_doc + fresh-reader |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **D1** Executable verify | 3 | **Block** — do not ship a doc whose commands fail |
| **D2** Fresh-reader | 2 | Record BLOCKER gaps in the doc |

Ask cap is per type (`ask_cap`), not Plan’s flat three — looser because the user chose documentation, still bounded.

## Cap behavior
Failed command verification **blocks** ship (doc equivalent of verify-or-revert). Fresh-reader blockers are recorded, not silently polished away.

## Artifacts

| Path | Role |
|---|---|
| `docs/…` (per type `output`) | Human-facing document |
| `.grokbit/context/<type>.md` | Compact digest for future surveys |
| `.grokbit/docs-manifest.json` | type → path → provenance → verified |
| `types/<id>.md` | Registry definition (data, not skill prose) |
| `scripts/verify_doc.py` / `check_drift.py` | Executable truth + staleness |

Staleness: `derived_from: path@commit`; drift flags **specific** claims from changed sources.

## Human gates
- Necessity / coverage refusal may stop without a document.
- Gap-fill answers from the user.
- Extension Docs UI is optional; slash/natural language is enough. **Section assembly stays in the skill**, not TypeScript.

## Next step
None required. Optionally re-run Document after Test SHIP, or run `check_drift.py` in CI when sources move. Pipeline position is usually **after** Plan/Implement/Test when derived from those artifacts.

## Provenance
Derived from `resources/skills/grokbit-document/SKILL.md`, `references/loops.md`, `roles.md`, `registry.md`, `provenance.md`. **Agent procedure remains `SKILL.md`.**


---

## Related

- Maintainer suite map: `resources/skills/README.md`
- Product Actions table: `README.md` (Grokbit Actions)
- Agentic Claude **template** loop (not this suite): `docs/WORKFLOW.md`
