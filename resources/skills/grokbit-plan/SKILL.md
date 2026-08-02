---
name: grokbit-plan
description: Work out a clear step-by-step plan you can approve before any code is changed.
---

# Grokbit — Plan

Planning exists to solve one problem: **the model will confidently invent things about this codebase that are not true**, and every downstream implementation error compounds from there. This skill's job is not to produce a nice document. It is to produce a plan where every factual claim has been read from disk and every task has a command that proves it worked.

## Hard rules

These are not stylistic preferences. Violating them defeats the purpose of the phase.

1. **Write no source code.** During Plan, the only files you may create or modify are under `.grokbit/plans/`. If you find yourself writing an implementation, stop — you have skipped ahead.
2. **Cite or flag.** Every statement about the existing codebase carries a `path:line` citation, or it is written under `## Assumptions` and marked `UNVERIFIED`. There is no third category. "The auth middleware probably validates the JWT" is not a plan input; it is a guess wearing a plan's clothes. (`UNVERIFIED` is one of two markers with distinct meanings — see `references/loops.md` for the full vocabulary and how `01-intent.md`'s Assumptions section relates to `assumptions.md`.)
3. **No unverifiable tasks.** Every task in the final plan has a command a human or agent can run to prove the task is done. A task you cannot check is a task you cannot finish.
4. **Loops terminate.** Every loop below has an iteration cap. On hitting the cap, write the unresolved item to `assumptions.md` and move on. A planner that spins is worse than one that ships a plan with three honest open questions.

## Pipeline

```
  Intake ──▶ Survey ──▶ Design ◀──┐  ──▶ Decompose ◀──┐  ──▶ Approval Gate
  (BA)       (SA)      (Architect)│      (Architect)  │      (human)
                          │       │           │       │
                          └─ Loop 3 ─┘        └─ Loop 4 ─┘
                          Reviewer         Verifiability
                                          + one Reviewer pass
```

Read `references/roles.md` for the full role prompts. Read `references/loops.md` for the exit criteria and cap of each loop. Read `references/host-adapters.md` for how to dispatch roles on Claude Code vs Grok Build.

## Step 0 — Set up

Derive a kebab-case slug from the request. Create `.grokbit/plans/<slug>/`. If `.grokbit/handoff.md` exists, read it — a previous session may already have answered half of what you are about to ask.

If the conversation just ran **`grokbit-explore`**, treat its chat map as a **hint list of paths to open**, not as Survey. You must still open files and write `02-survey.md` with fresh `path:line` citations. Explore never writes plan artifacts.

If `.grokbit/plans/<slug>/02-survey.md` already exists, this slug is not new — `grokbit-implement` handed it back after hitting its 3-deviation cap (Loop I5) and you are re-running from Survey on corrected ground. Reuse the same slug directory; do not mint a new one, or the paper trail of what is already committed gets orphaned. Before Survey overwrites anything, archive the current `02-survey.md` and `03-design.md` into `replan-1/` (increment the number on a second replan) — see `grokbit-implement/references/loops.md` § Loop I5 for the full replan contract, including why `plan.md`'s completed task IDs must survive unchanged.

**Replan inputs (mandatory when this path fires).** Before Survey/Design run again, every role that rebuilds ground truth must read:

- `implement/deviations.md` — what contradicted the old survey (the reason you are here)
- `implement/progress.md` — which task IDs are already `done` / `blocked` (completed work must stay valid)
- the current `plan.md` — preserve completed task IDs and ordering of done work; rebuild only the unfinished tail and any design that those deviations invalidate
- the archived prior survey/design under `replan-N/` — so the new survey does not re-assert the same wrong claims

Do not treat “an existing `02-survey.md`” alone as proof of Loop I5; if `implement/deviations.md` has no cap-hit boundary and there is no hand-back context, ask once whether this is a replan or a fresh plan on a reused slug name.

Then detect host capability, because it changes how you run every subsequent step:

- **Subagents available** (Claude Code `Task`, Grok Build subagent dispatch) → run each role in its own subagent with a fresh context window. This is strongly preferred: the Reviewer's value depends on it not having watched the Architect write the design.
- **No subagents** → run roles sequentially in one context. Between roles, write the artifact to disk, then **re-read it from disk** before adopting the next role. This is a weaker form of context isolation but it does meaningfully reduce the model's tendency to defend its own earlier reasoning.

## Step 1 — Intake (Business Analyst) → `01-intent.md`

Convert the request into testable done-criteria.

**Proportionality.** Not every request needs the full six-artifact ceremony. If the change is clearly a typo, one-liner, comment, or pure docs tweak with no behavior risk, say so in `01-intent.md`, produce a **short plan** (intent + 1–2 tasks in `plan.md`, survey/design may be a few cited bullets rather than full multi-option design), and still get human approval before implement. If the blast radius is non-trivial (behavior, schema, auth, multi-file), run the full pipeline. When unsure, use the full pipeline.

Ask **at most three questions, in one batch, once.** This cap is load-bearing. The audience is vibe coders; an interrogation loop is the fastest way to get the skill disabled. Ask only questions where a different answer produces a materially different plan. If you can infer it from the repo, infer it — an inferred answer written down as an assumption is better than a question asked.

**Subagent mode and questions.** If Intake runs in a subagent, it cannot talk to the user directly. The session Orchestrator (the skill host) must relay the question batch to the user, collect answers, write them into the plan directory (e.g. a short `intake-answers.md` or into `01-intent.md` Assumptions), and only then continue Survey. Never invent answers to skip the relay.

Bad question: "What styling approach would you like?" (inferable from the repo)
Good question: "When a payment fails mid-checkout, should the cart be preserved or cleared?" (changes the data model, unknowable from the repo)

`01-intent.md` records: the problem in one paragraph, done-criteria as a checklist a human could verify by hand, explicit non-goals, and constraints. **Non-goals matter as much as goals** — they are what the Reviewer uses later to catch scope inflation.

Use `assets/intent.template.md`.

## Step 2 — Survey (Systems Analyst) → `02-survey.md`

Establish ground truth. Read actual files. This is the step that prevents the model from reimplementing a helper that already exists three directories over.

Enter **Loop 2 (Grounding)** — see `references/loops.md`. In short: list every entity the intent implies (models, endpoints, components, services, config). For each, either cite where it lives or record `DOES NOT EXIST`. Iterate until no entity is unresolved. Cap 3 passes.

Record conventions as observed facts, not preferences: how errors are actually handled here, how tests are actually structured, what the file layout actually is. Also record what is *missing* — no test runner, no migration tool, no CI — since absences drive plan tasks.

Then record **supersession**: what this change will replace, duplicate, or make dead, with a caller count for each. Reuse and supersession are the same survey pass looking in two directions — one prevents adding a duplicate, the other prevents leaving one behind. In a codebase with history, most changes make something obsolete, and the obsolete thing is rarely in the file being edited.

Use `assets/survey.template.md`.

## Step 3 — Design (Solutions Architect ⇄ Plan Reviewer) → `03-design.md`, `04-review.md`

Produce at least two viable approaches with an honest trade-off, then choose one and justify it against the intent's constraints. A design with one option is a design that was never actually considered.

Then assign every item in the survey's supersession section exactly one disposition — `REPLACE`, `DEPRECATE`, `COEXIST`, or `LEAVE` — each with a reason. Silence is not a fifth option, and the Reviewer treats an unmentioned item as a `MAJOR` finding. See `references/roles.md` for what each disposition obligates you to.

Then enter **Loop 3 (Adversarial Review)**. The Reviewer attacks the design and emits findings at `BLOCKER` / `MAJOR` / `MINOR`. The Architect revises. Exit when zero BLOCKER and zero MAJOR remain, or at 3 rounds — at which point surviving findings go to `assumptions.md` and get surfaced to the human at the gate.

Append every round to `04-review.md` rather than overwriting. The findings log is often more useful to the human than the design itself, because it shows what was considered and rejected.

## Step 4 — Decompose (Solutions Architect) → `plan.md`

Break the design into tasks. Then enter **Loop 4 (Verifiability)**: every task must have an ID, a stated intent, the files it will touch, an explicit `verify:` command that actually runs in the user's shell and OS (and from the right `cwd:` if this is a monorepo), a `baseline:` and a `removes:` field (or `none`), and a rollback. Any task that cannot state a verify command is too big or too vague — split it and re-check.

Once every task passes that checklist, the Plan Reviewer takes one more pass — over `plan.md` itself, not the design again (see `references/roles.md`). The design already survived adversarial review; nobody has yet checked that the task list faithfully carries it out.

Order tasks so the repo is in a working state after each one where possible. Vibe coders abandon sessions mid-plan; a plan that only works if all twelve steps land is a plan that leaves the repo broken.

**Removal is a task, not a footnote.** Every `REPLACE` disposition becomes its own task with a `removes:` field, ordered *after* the replacement's verify passes. Its verify command proves the absence: no remaining references, suite still green, the behavior that used it still works. A removal without a verify command is a deletion nobody checked, and those are how a cleanup pass breaks production.

Use `assets/plan.template.md`.

## Working in a mature codebase

Everything above assumes the repo has history, because most do. Three consequences worth naming:

**Net-additive plans are a smell.** If every task in a plan adds and none removes, in a codebase that already implements something adjacent, the plan has probably chosen `COEXIST` by default without saying so. Check the disposition table before the gate. A plan can be legitimately net-additive — new features exist — but it should be a conclusion, not an accident.

**Removal needs the same rigor as addition.** Deleting code with callers changes behavior. It gets a task, a verify command, a rollback, and a baseline, exactly like any other change. The instinct to treat cleanup as low-risk housekeeping is what makes cleanup dangerous.

**Scope discipline and cleanup are not in tension when cleanup is planned.** Implement's scope audit flags out-of-scope hunks, so opportunistic tidying mid-task gets reverted — correctly. The resolution is that removal belongs in the plan, where it is reviewed and verified, rather than in a moment of enthusiasm halfway through task 4. Planned deletion is in scope; noticed-in-passing deletion is scope creep. Both rules survive intact.

## Step 5 — Approval gate

Present to the human: the chosen approach in three sentences, the task list with verify commands, every open assumption, and the estimated blast radius (files touched, new dependencies, schema changes).

State the disposition table explicitly at the gate — what gets replaced, deprecated, kept in parallel, or left alone. This is the part a human is best placed to overrule, because it depends on plans and obligations that are nowhere in the repo.

**Stop here.** Do not begin implementing. Wait for the human’s verdict in the next message (or plan-review UI):

- **Approved** (“go”, “approved”, “start”, or `[Plan approved]`) → hand off to baseline/`grokbit-implement` as the pipeline describes. Do not start coding inside Plan.
- **Rejected / changes requested** (`[Plan rejected]` or prose that asks for revisions) → stay in Plan; revise `03-design.md` / `plan.md` (and re-enter Loop 3/4 as needed) using their comment as the brief. Do not implement.
- **Cancelled** (`[Plan cancelled]`) → leave Plan without implementing; answer any follow-up comment normally.

If the human edits `plan.md` directly, re-read it before any next step; their edit is authoritative. **Edits they make are not automatically re-validated** — call out that fact once, offer a quick Loop 4 pass over the edited tasks, and run it if they accept (or if the edit touches `verify:` / files / done-criteria).

## Output contract

```
.grokbit/plans/<slug>/
├── 01-intent.md      done-criteria, non-goals, constraints
├── 02-survey.md      grounded repo facts, all cited
├── 03-design.md      options, decision, rationale
├── 04-review.md      append-only findings log
├── plan.md           the deliverable — tasks with verify commands
└── assumptions.md    open questions and unresolved findings
```

Plain markdown, committed to the repo, human-editable. The Grokbit extension and the Implement phase both read `plan.md` as their input contract, so keep the task block format exactly as specified in `assets/plan.template.md`.

Use `assets/assumptions.template.md` for `assumptions.md`. If Loop I5 sends a plan back for a replan, the superseded `02-survey.md`/`03-design.md` land in `replan-1/` (see Step 0) rather than being overwritten in place.

**Downstream handoff.** After approval, `grokbit-test` runs in baseline mode before `grokbit-implement` starts — it needs to record how existing behavior works *before* anything changes, since a baseline captured afterward proves nothing. That is why every task carries a `baseline:` field naming the existing behavior it might disturb, or `none`. Fill it honestly: an omitted baseline is a regression nobody will be able to detect later. `grokbit-implement` enforces this as an entry condition — it will not start a task with a non-`none` baseline until either `test/baseline.md` exists or the user has explicitly waived it.

## Failure modes to watch for

- **Fabricated grounding.** The Systems Analyst writes `src/lib/auth.ts:42` for a file it never opened. If a citation was not produced by an actual read in this session, it does not count. Spot-check your own citations before Step 3.
- **Reviewer capture.** A Reviewer sharing context with the Architect approves everything. If you have no subagents, force the re-read from disk and adopt the Reviewer role adversarially and explicitly.
- **Plan inflation.** Twelve tasks for a two-task request. Check the plan against the intent's non-goals before the gate.
- **Silent COEXIST.** The design never mentions the thing it duplicates, so no decision is recorded and the duplicate becomes permanent. This is the single largest contributor to decay in a mature codebase, and it never looks like a mistake at the time.
- **Question creep.** Four questions is a violation, not a judgment call.
- **Unbounded survey.** A large repo can burn Loop 2's whole budget on breadth inside a single pass, not on needing more passes. Sample, cap caller counts, and say so in `02-survey.md` — a survey that disclosed a shortcut is useful; one that quietly ran out of budget mid-list is not.
