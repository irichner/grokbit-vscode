# Loops — Implement

The cap-escape rule from Plan does not carry over unchanged. In Plan, hitting a cap means "write it down and continue" because the artifact is a document and an open question is visible. In Implement the artifact is running software, so hitting a cap means **revert to clean and mark blocked**. A recorded-and-continued failure here leaves broken code in the repo.

---

## Loop I1 — Preflight repair

| | |
|---|---|
| **Trigger** | Any preflight check fails |
| **Runs** | Build Engineer |
| **Cap** | 2 attempts per check |

**Body:** For each failing check, attempt the safe reversible fix — install dependencies, start a required service, sync the lockfile, initialize git and take an initial commit (ask first — this one changes the user's repository structure, unlike the others in this list, which need no consent to reverse). Re-run the check.

**Exit:** all checks green, or the remaining failures are recorded and escalated to the human.

**Cap behavior:** stop. Do not start coding in a broken environment. Report which checks failed and what each needs. A missing git repository has no fix short of the user's consent to `git init` — if declined, this is not a 2-attempt repair problem, it is a hard stop: say plainly that "verify or revert" cannot hold without version control.

Never resolve a preflight failure by disabling the thing that failed. A skipped test suite passes preflight and destroys every downstream verify command's meaning.

**Pre-existing failures are not preflight failures.** Record them by name and proceed. They become the baseline that Testing compares against.

---

## Loop I2 — Task execution

| | |
|---|---|
| **Trigger** | A task's `verify` command runs and fails |
| **Runs** | Software Engineer |
| **Cap** | **3 attempts total, including the first** |

**Body:**
1. Read the actual failure output — error text, failing assertion, runtime values. Not the code you just wrote.
2. State the diagnosis explicitly before editing. An attempt that begins by trying something different rather than by explaining the failure does not count as a diagnosis and burns the same budget.
3. Make the minimal change the diagnosis implies.
4. Re-run verify.

**Exit:** verify passes with no assertion weakened, no test skipped, no type loosened, and no change to the verify command itself.

**If the verify command cannot even execute** — command not found, wrong shell, wrong `cwd` — this loop was never triggered in the first place: that is not a failed attempt, it's a plan-specification deviation. Record it in `implement/deviations.md` with the exact execution error, fix the *command* (not the code), and only then does running it and getting a real pass/fail result count as attempt 1. A retry cap that burns on `bash: rg: command not found` reverts code that never ran against a real check.

**Cap behavior — revert to clean:** delete every file this task created (per its `progress.md` entry's `Created:` list) and `git checkout` every tracked file this task modified back to its state at the start of the task. Mark the task `blocked`. Record all three diagnoses. Continue with tasks whose dependencies remain satisfied.

**"Revert to clean" is defined here, precisely, and every other reference to it in this skill** — Hard rule 1, Loop I3's cap behavior, the dirty-tree snapshot in the entry conditions — means exactly this procedure, not just the `git checkout` half of it. `git checkout` alone only restores tracked files; a task's most common shape of work is a *new* file — a component, a test, a migration — and `git checkout` doesn't touch it. Skipping the delete step leaves exactly the debris this phase exists to prevent.

Attempt 3 is where the damage happens. Under pressure the model starts making the error stop rather than making the code correct — deleting the assertion, widening the type, swallowing the exception. **Reverting is the successful outcome of this loop**, not its failure. A blocked task is visible in `progress.md`; a hollow green check is invisible until production.

---

## Loop I3 — Scope audit

| | |
|---|---|
| **Trigger** | A task's verify passes, before commit |
| **Runs** | Code Reviewer, then Software Engineer |
| **Cap** | 2 rounds |

**Body:** Reviewer classifies every hunk `IN_SCOPE` / `OUT_OF_SCOPE` / `INCIDENTAL`. For each `OUT_OF_SCOPE` hunk the engineer either **reverts it from the current task's working tree before commit** or **promotes** it to a new task.

**Promote means:** (1) the hunk is **reverted from this task's diff** so the current commit contains only `IN_SCOPE`/`INCIDENTAL` work; (2) a new task is appended (see below) that will re-apply that change under its own intent/files/verify; (3) the promoted task does **not** leave the out-of-scope hunk sitting in the current commit. Promote-without-revert would break the audit's guarantee either way (commit is dirty, or the new task has nothing left to do).

After every revert of an `OUT_OF_SCOPE` hunk, **re-run the current task's `verify:`** before commit. A scope fix can break the task's own verify; shipping a green-but-stale verify is a hollow pass.

**Promoting a hunk appends a task, and that changes what the approval checkbox means.** `plan.md`'s `## Approval` checkbox was ticked against the tasks that existed at that moment; a task appended afterward was never in front of the human who ticked it. So a promoted task: gets a title suffixed `(promoted from T<n>)`, so it reads as new-since-approval at a glance; is inserted immediately after the task that produced it, not appended to the end, so dependency order stays sane; and does **not** inherit the plan's existing approval — it needs its own one-line yes from the human before its Write step runs. This does not reopen `plan.md`'s approval on the whole plan; it is a small, additive approval scoped to the one new task, in the same spirit as the original gate at a fraction of the size. It is also not the "editing `plan.md` tasks" hard rule 5 forbids — that rule is about rewriting an existing task to match what got built; this appends a new one.

**Exit:** zero unresolved `OUT_OF_SCOPE` hunks in the current task's tree, every promoted task has its one-line approval, and the current task's verify still passes after any reverts.

**Cap behavior:** revert everything still contested and commit only the in-scope remainder (after re-verify).

Run the reviewer with fresh context wherever the host allows it. An engineer auditing its own diff will find the out-of-scope hunk reasonable, because it was reasonable when it wrote it.

---

## Loop I4 — Dependency gate

| | |
|---|---|
| **Trigger** | Any install command, before it runs |
| **Runs** | Supply Chain Security Analyst |
| **Cap** | 2 rejections, then escalate |

**Body:** Analyst verifies registry existence first, then health, license, size, and redundancy against the survey. On rejection, the engineer uses the suggested alternative or implements directly.

**Exit:** `APPROVE`, or the need is met without a new dependency.

**Cap behavior:** stop and ask the human. Two rejections usually means the task needs a capability the project genuinely lacks, which is a decision, not a lookup.

---

## Loop I5 — Deviation escalation

| | |
|---|---|
| **Trigger** | Any recorded deviation |
| **Runs** | Whichever role hit the trigger appends the entry; Orchestrator (see `references/roles.md` — this is the session itself holding the pipeline together, not a per-task dispatched role) counts it against the cap and enforces the stop, which is why counting across the whole session falls to it and no one else |
| **Cap** | **3 deviations** |

**Count toward the cap (survey/shape contradictions):** a survey claim contradicted by the actual file; a task blocked at the I2 retry cap; a task requiring undeclared files; an out-of-scope change promoted to a new task (scope was wrong). These mean the plan/survey misread the codebase.

**Record but do not count toward the replan cap:** a dependency rejected by I4 (supply-chain gate doing its job); a verify command that could not execute because of environment/shell mismatch once the command text is fixed (plan-spec noise, not survey shape — still record it); a baseline waiver the user consented to; receiving a hand-back from `grokbit-test` (Step 7). Mark each entry `counts: yes` or `counts: no` in `deviations.md` so the Orchestrator does not have to re-interpret prose.

**Body:** The role that hit the trigger appends to `implement/deviations.md` with the task ID, what the plan expected, what was actually found, the citation, and `counts: yes|no`. The Orchestrator counts only `counts: yes` entries since the last replan (or since the start) against the cap.

**Exit:** the plan runs to completion with fewer than 3.

**Cap behavior:** **stop implementing.** Hand `deviations.md` back to `grokbit-plan` and rerun from Survey, in the SAME slug directory — this corrects the same effort, and a new slug would orphan the paper trail of what is already committed.

The replan contract, specified once here because Implement is what triggers it:

- **Same slug, archived history.** Before Survey overwrites anything, `grokbit-plan` moves the current `02-survey.md` and `03-design.md` into `replan-1/` (increment on a second replan). `04-review.md` and `assumptions.md` keep accreting as already designed; survey and design are point-in-time documents, not logs, so archiving is what gives them the same protection — without it, the record Implement was actually built against is destroyed the moment Survey re-runs.
- **`plan.md` is rebuilt, not restarted.** Every completed task keeps its original ID and its original content. `progress.md`'s ledger keys against those IDs, and renumbering `T1` would silently orphan every row that already refers to it. New or revised tasks continue numbering from where the old plan stopped — if the old plan had 6 tasks, the rebuilt remainder starts at `T7`, even where it replaces what used to be `T4`.
- **`progress.md` is not archived.** It is the session's memory across the whole slug, replan included, and every completed row must stay valid against the rebuilt `plan.md`'s preserved IDs.
- **The deviation counter resets to zero, but the numbering in `deviations.md` does not.** The three that triggered this replan stay in the file as `D1`–`D3`; the next one recorded after the replan is `D4`. What resets is the cap — 3 more before the next stop, not 3 total for the whole slug. Mark the boundary in the file (see `assets/deviations.template.md`) so a later reader can tell `D1`–`D3` were the old survey's problem and `D4` onward are being measured against the corrected one.
- **Replan depth cap: 2.** After the second Loop I5 replan for this slug (`replan-2/`), do **not** auto-replan again. Stop and hand the human: the deviations log, progress ledger, and a plain-language summary. Further planning needs explicit human direction (new slug, scope cut, or abandon). Unbounded replan loops burn sessions without converging.

Completed tasks stay committed; the remaining plan is rebuilt on corrected ground.

This is the most important threshold in the suite, and the one an agent is least inclined to respect — pushing on always looks cheaper than replanning. It isn't. Three contradictions is strong evidence the survey misread the codebase's shape, and every unstarted task rests on that same misreading. Each one you execute anyway is a task you will later have to find and undo.

---

## Loop budget

Per task: 1 write + up to 2 retries + up to 2 scope rounds ≈ 5 invocations worst case, most of them expensive-tier. A 10-task plan can reach 50. Charge it against the session budget, report per-task spend in `progress.md`, and surface the running total — a vibe coder who can see that task 7 cost $2.10 in retries has learned something useful about task 7.
