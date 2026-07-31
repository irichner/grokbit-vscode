---
name: grokbit-implement
description: Execute an approved plan one task at a time with environment preflight, bounded retry, revert-on-failure, and a scope audit of every diff. Use this skill whenever the user says go/approved/start/ship it after planning, asks to implement or build out a plan, resumes work on an existing plan, or asks to work through a task list. Use it even when a plan already exists and the user just says "continue" or "next task". Do NOT use it for exploratory one-off edits with no plan behind them — run grokbit-plan first, or make the edit directly if it is genuinely trivial.
---

# Grokbit — Implement

Planning failed if the model invented facts. Implementation fails differently: **the model writes something plausible, it doesn't work, and each repair attempt leaves debris behind**. Four attempts later the repo contains three abandoned approaches tangled together and nobody can tell which lines belong to which idea.

So this phase is organized around one discipline: **every task either passes its verify command or gets reverted to clean.** There is no partial state.

## Entry conditions

Refuse to start unless all four hold. If any fails, say which and stop.

1. `.grokbit/plans/<slug>/plan.md` exists and its approval checkbox is ticked.
2. The working tree is clean, or the user has explicitly said to proceed dirty — in which case snapshot the tree (`git stash push -u` or a WIP commit) before the first task's Write step runs; see Step 1. Revert-to-clean checks a task's files back to a start-of-task point, and without a snapshot that checkout would clobber whatever of the user's own uncommitted work happened to live in the same files.
3. Preflight passes (Step 1).
4. If any task in `plan.md` declares a `baseline:` other than `none`, `test/baseline.md` exists. If it does not, run `grokbit-test` in baseline mode before continuing — a baseline captured after the first edit lands proves nothing, and grokbit-test's baseline mode exists to run at exactly this point. If the user explicitly declines a baseline, record the waiver in `implement/deviations.md` (it does not count toward the 3-deviation cap — it is a recorded risk, not a contradiction) and proceed anyway.

Resuming is normal — read `implement/progress.md` and continue from the first task not marked `done`. If every task is already `done` and this session was invoked because `grokbit-test` sent back a `DO NOT SHIP` verdict, there is no unfinished task to resume — see § Step 7 — Hand-back intake, which is what creates one.

## Hard rules

1. **Verify or revert.** After the retry cap, revert to clean and mark the task `blocked`. "Revert to clean" is defined precisely once, in `references/loops.md` § Loop I2 — it covers every file the task *created*, not just the ones `git checkout` restores, because a new file is the most common shape of a task's work and `git checkout` doesn't touch it. Do not carry a half-finished task forward. The debris is worse than the missing feature.
2. **Commit per task.** Every passing task gets its own commit before the next begins. This is what makes rollback real rather than aspirational, and it is what lets a vibe coder abandon a session at task 4 of 9 without losing anything.
3. **The plan is the scope.** If a task needs to touch a file the plan did not list, that is a deviation — record it, don't quietly widen the diff. This cuts both ways: don't delete things the plan didn't schedule for deletion, however dead they look. Note it as a deviation and let Plan decide.
4. **No new dependency without a gate.** See Loop I4.
5. **Never edit `plan.md` tasks to match what you built.** Reality diverging from the plan is information; erasing the evidence destroys it. Appending a new task — a promoted out-of-scope hunk (Loop I3) or a hand-back fix from `grokbit-test` (Step 7) — is a different, sanctioned action in both cases: it adds a new task, it does not rewrite an existing one, and each defines how its task is marked and re-approved.

## Pipeline

```
 Preflight ──▶ ┌─ per task ──────────────────────────────┐ ──▶ Handoff
 (Build Eng)   │  Write ──▶ Verify ◀─┐   ──▶ Scope audit │      to testing
               │  (SWE)     (I2 ×3)  │       (Reviewer)  │
               │     └── Dep gate ───┘       (I3 ×2)     │
               └──────────────────────────────────────────┘
                              │
    deviations ≥ 3 (Orchestrator, Loop I5) ──▶ back to grokbit-plan
```

A `DO NOT SHIP` verdict from `grokbit-test` re-enters this pipeline too, as a new task appended to `plan.md` (§ Step 7 — Hand-back intake) — not drawn above, since it is the exception path, not the steady state.

Read `references/roles.md` for the role prompts, `references/loops.md` for exit criteria and caps.

## Step 1 — Preflight (Build Engineer) → `implement/preflight.md`

Runs once, before the first line of code. Enter **Loop I1**.

Check git itself first: installed, this directory is a repository, `user.name`/`user.email` are configured. Every discipline this phase depends on — the clean-tree entry condition, commit-per-task, revert-to-clean, `git revert` rollback — is unimplementable without it, and vibe coders often have none of it. If it's missing, offer to run `git init` plus an initial commit (ask first — unlike a lockfile sync, this changes the user's repository structure, so it needs consent, not just a fix). If the user declines, stop here and say plainly that this phase's core guarantee — verify or revert — cannot hold without version control; do not proceed as if it can.

If entry condition 2 was satisfied dirty, snapshot the tree now, before returning control for the first task: `git stash push -u -m "pre-implement snapshot <slug>"` or a WIP commit, and record which one. Skipping this is what lets task 1's revert-to-clean silently discard the user's own uncommitted work.

Check runtime versions against the repo's declared requirements, dependency install state (lockfile drift, stale `node_modules` after a branch switch), required env vars, ports the dev server needs, external services the tests need, and whether the existing test suite passes *right now*. If this is a monorepo — more than one runtime, lockfile, or test suite — record each package's state separately; a single row assuming one package hides drift in the others, and a task's `cwd:` field (if the plan sets one) tells you which package it's checking.

That last one matters most. **If the suite is already red before you start, record which tests were already failing.** Otherwise you will spend three tasks chasing a break you did not cause — and worse, you may "fix" pre-existing behavior that someone depends on. **If there is no test suite at all, record that explicitly** — "no suite configured" is a different, worse state than "suite green," and it means every task whose `verify:` assumes a runner will fail for that reason, not a code reason. Setting up a test framework here is a design decision, not a preflight fix — grokbit-plan's Loop 4 already turns a missing test runner into its own task when the plan is written; if that task hasn't landed yet, record the absence and move on.

Use `assets/preflight.template.md`.

## Step 2 — Task loop (Software Engineer) → `implement/progress.md`

For each task in `plan.md`, in dependency order:

1. Read the task's `intent`, `files`, `cwd` (when it names one other than `none`), `verify`, and the survey citations in its notes. Also check `assumptions.md` — if an open item there bears on this task, resolve it as part of doing the task and say how, or note in your `progress.md` entry that it's still open and why this task didn't close it.
2. Write the change. Follow the conventions recorded in `02-survey.md` — the repo's actual error handling, test structure, and naming, not your defaults.
3. Run the task's `verify:` command, from its `cwd` when it names one other than `none`.
4. On failure, enter **Loop I2** (cap 3 attempts total, including the first). Each attempt starts by diagnosing from actual output — the error text, the failing assertion, the runtime values — not by guessing at a different approach. Attempt 3 failing means the task is wrong, not that you need a fourth idea. A command that cannot even execute — not found, wrong shell, wrong `cwd` — is a different failure: that's a plan-specification deviation (record it, fix the command, then retry), and it does not consume one of the three attempts.
5. On cap: revert to clean (§ Loop I2), mark `blocked`, record the last error and all three attempted diagnoses. Continue to the next task whose dependencies are still satisfied.

Update `progress.md` after every task. It is the session's memory — if the process dies at task 6, `progress.md` is the only thing that knows. Use `assets/progress.template.md`.

## Step 3 — Dependency gate (Supply Chain Security Analyst)

Any `npm install`, `pip install`, `cargo add` triggers **Loop I4** before the command runs.

Confirm the package actually exists on the registry — models hallucinate plausible package names, and typosquatters deliberately camp those names, which makes a hallucinated install a live supply-chain risk rather than just an error. Then check last publish date, weekly downloads, license compatibility, install size, and whether the survey already found something in the tree that does this job.

Reject, and the Software Engineer either uses the existing option or writes it directly. Two rejections means take it to the human.

## Step 4 — Scope audit (Code Reviewer) → `implement/05-review.md`

After a task's verify passes, before its commit. Enter **Loop I3** (cap 2).

Diff the task against its declared `files` and `intent`. Classify every hunk `IN_SCOPE`, `OUT_OF_SCOPE`, or `INCIDENTAL` (see `references/roles.md` for what each means and how it's disposed of). For an `OUT_OF_SCOPE` hunk: revert it, or promote it to a new task appended to `plan.md` — see `references/loops.md` § Loop I3 for exactly how a promoted task is marked and re-approved before it runs.

This is the phase's second-most-valuable check after verify-or-revert. The single most common way an agentic session destroys working software is a change that succeeded at its stated goal while quietly rewriting something else.

Deletions are audited in both directions. A deletion in the task's `removes:` field is in scope and should not be flagged. A deletion the task never declared is out of scope even when the code is genuinely dead — planned removal is reviewed and verified, opportunistic removal is not. And a task that declares `removes:` but deletes nothing has left a duplicate behind, which is equally a finding.

## Step 5 — Deviation escalation

Record in `implement/deviations.md` whenever reality contradicts the plan: a survey claim contradicted by the actual file (wrong export, wrong signature, or simply not there), a verify command that could not even execute in this environment, a task blocked at cap, an out-of-scope change promoted to a new task, a dependency rejected, or a task requiring undeclared files. Any role that hits one of these records it — this is not only the Software Engineer's job. The Orchestrator (`references/roles.md`) does not author these entries; it counts every one recorded across the whole session and enforces the cap below — the one thing no per-task, fresh-context role is positioned to do.

**At three deviations, stop and re-plan.** Do not push through. Three contradictions means the survey was wrong about the shape of the codebase, and every remaining task rests on the same bad ground. Hand `deviations.md` back to `grokbit-plan` and rerun from Survey.

That threshold is the most important number in this skill. Agents are strongly inclined to keep going, and a plan that has been wrong three times will be wrong again. Use `assets/deviations.template.md`.

## Step 6 — Handoff

Write `implement/handoff.md`: tasks done, tasks blocked and why, files touched, dependencies added, deviations, and anything a test should look at hard. Then invoke `grokbit-test` in verify mode.

Also overwrite the top-level `.grokbit/handoff.md` — a different file with a similar name, not a duplicate. `implement/handoff.md` above is the input contract to `grokbit-test` for THIS slug; `.grokbit/handoff.md` is the cross-session summary a FUTURE `grokbit-plan` invocation reads before it asks its own questions (see `grokbit-plan/SKILL.md` § Step 0). Write it fresh each time — slug, phase reached, open items from `assumptions.md`, and blocked tasks. It reflects only the most recent session, not a running log; a stale one pointing at an old slug is worse than none.

Use `assets/handoff.template.md` for `implement/handoff.md`.

## Step 7 — Hand-back intake (Software Engineer)

Triggered when `grokbit-test`'s Step 6 verdict is `DO NOT SHIP` on a `REGRESSION` or an outstanding `CRITICAL`, and it hands the triage package back here (its `SKILL.md` § Step 6; `references/loops.md` § Loop T3 for the regression case, § Loop T4 for the security case). What arrives is a minimal reproduction, the runtime state captured at the failure, and up to three ranked hypotheses (or `UNDIAGNOSED`, if none survived) per finding — never a fix, since the role that verifies must not also repair. By this point every task in `plan.md` is already `done`, so Step 2's "first task not marked `done`" has nothing left to iterate. This step is what gives it something to do again.

For each distinct triage package, append one new task to `plan.md` — the same mechanism Loop I3 uses to promote an out-of-scope hunk, extended to this trigger: title suffixed `(fix from grokbit-test hand-back)`, `intent` restating the finding, `files` from the hypothesis's own citations, a `verify:` that reproduces the failure and would catch its recurrence, `baseline:`/`removes:` filled the same as any task. Insert it after the last existing task — every prior task is already done, so it can only be ordered last. Like a promoted task, it did not exist when the human ticked `plan.md`'s approval box, so it needs its own one-line yes before its Write step runs: the same small, additive approval Loop I3 defines, not a reopening of the whole plan's approval.

Once approved, it runs through Step 2 (Loop I2: write, verify, retry-or-revert) and then Step 4 (Loop I3: scope audit) — no separate rules; a hand-back fix is a task like any other once it is on the plan. This is also what keeps hard rule 3 intact: the fix is scoped by its own task block, not by whatever the triage package happened to mention. On completion, redo Step 6 — rewrite `implement/handoff.md` and re-invoke `grokbit-test` in verify mode for a fresh pass.

**Does receiving a hand-back count toward the 3-deviation cap (Step 5)?** No — stated explicitly, because leaving this unstated is what left the whole intake undefined in the first place. The cap in Loop I5 measures whether the *survey* misread the codebase; a finding from `grokbit-test` is evidence about the implementation, surfaced by the phase built to surface it, not a contradiction of the ground truth the survey established. Counting it would make an ordinary verify-then-fix cycle look identical to a broken plan. What still counts, unchanged, is any already-enumerated deviation type the fix task itself triggers while it runs — blocked at the retry cap, an undeclared file needed, a verify command that cannot execute. The hand-back is a new entry point into the pipeline, not an exemption from the rules once inside it.

## Output contract

```
.grokbit/plans/<slug>/implement/
├── preflight.md      environment state, pre-existing test failures
├── progress.md       task ledger — the session's memory
├── 05-review.md      scope audit findings per task
├── deviations.md     where reality diverged from the plan
└── handoff.md        input contract for grokbit-test
```

Use `assets/05-review.template.md` for `05-review.md`. `.grokbit/handoff.md` (Step 6) lives one level up, outside any slug directory — it's shared across every plan in this repo, not scoped to one. If Loop I5 sends this plan back for a replan, `grokbit-plan` archives the superseded `02-survey.md`/`03-design.md` under `.grokbit/plans/<slug>/replan-1/` before rebuilding them; nothing under `implement/` is archived, since `progress.md` and `deviations.md` must stay valid across the replan (see `references/loops.md` § Loop I5).

## Failure modes to watch for

- **Attempt-3 desperation.** By the third try the model starts deleting assertions, loosening types, adding `any`, or wrapping things in try/catch to make the error stop. Reverting is the correct outcome; a green verify bought by weakening the check is worse than a blocked task, because it is silent.
- **Scope creep disguised as tidiness.** "I also cleaned up the imports" is a diff nobody reviewed.
- **Plan editing.** Changing a task's `verify` to match what you built is the most damaging single action available in this phase.
- **Pushing past three deviations.** Always feels faster. Never is.
- **Charging an environmental failure against the retry cap.** `bash: rg: command not found` is not evidence the code is wrong. Burning all three Loop I2 attempts on it, then reverting code that never ran against a real check, destroys working software over an unrelated shell mismatch.
- **Proceeding without version control.** "Verify or revert" needs a `git checkout` to revert to. An environment with no repository can't provide this phase's core guarantee, no matter how carefully everything else is followed.
