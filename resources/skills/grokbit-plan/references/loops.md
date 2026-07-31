# Loops

Four loops. Each has a trigger, a body, an exit criterion, and a cap. The cap exists because an agent that cannot exit a loop is worse than one that ships an imperfect plan with the open items written down where a human can see them.

**Marker vocabulary.** Two markers, two different meanings, never used interchangeably:

- `UNVERIFIED` — a fact someone assumed rather than confirmed. This is what the Business Analyst writes under `01-intent.md`'s `## Assumptions` when it infers or decides something instead of asking (hard rule 2), and what any other role writes if it must assume a fact `02-survey.md` doesn't settle. It records *how the fact was obtained*, not that a loop failed.
- `UNRESOLVED — <loop>` — an item a loop could not close within its cap: an unanswered clarification, an unresolved entity, an unaddressed review finding, an unfixable task. It records *that a loop gave up*, not how the underlying fact was obtained.

Both kinds land in `assumptions.md` — that file is the one rolled-up ledger the human reads at the gate. Every `UNVERIFIED` written elsewhere (chiefly `01-intent.md`) gets copied there alongside every `UNRESOLVED` a loop produced directly, using `assets/assumptions.template.md`'s sections. `plan.md`'s own `## Open assumptions` section points at that ledger; it is not a second copy of it.

**When any loop hits its cap:** write the unresolved items to `assumptions.md`, mark them `UNRESOLVED — <loop>` (e.g. `UNRESOLVED — Loop 2`), and continue to the next phase. Surface them at the approval gate. Never silently drop them, and never keep going.

---

## Loop 1 — Intake clarification

| | |
|---|---|
| **Trigger** | Done-criteria contain terms not checkable by observation |
| **Runs** | Business Analyst |
| **Cap** | **1 round, 3 questions.** Non-negotiable. |

**Body:** Identify criteria that cannot be verified by a human performing an observable action. For each, first try to resolve it by reading the repo or by making a defensible assumption. Only what survives that filter becomes a question.

**Exit:** every done-criterion is observable, or the unresolved ones are recorded as assumptions.

The tight cap is intentional. Elaborate requirements-gathering is the correct engineering practice and the wrong product behavior here — the user came to this tool to avoid ceremony. One sharp batch of questions reads as competence; a second batch reads as a form.

---

## Loop 2 — Grounding

| | |
|---|---|
| **Trigger** | Any entity implied by the intent is unresolved |
| **Runs** | Systems Analyst |
| **Cap** | 3 passes |

**Body:**
1. List every entity the intent implies (models, endpoints, components, services, config keys, jobs, permissions).
2. For each unresolved entity, search the repo and **open the candidate file**.
3. Record `path:line` on confirmation, or `DOES NOT EXIST` with the search terms you tried.
4. Newly-read files often reveal entities you did not know to look for. Add them to the list and repeat.

**Exit:** zero entities in the unresolved state.

Pass 3 usually finds nothing new; if it does, that is a signal the change is larger than the intent describes, and it is worth raising at the gate.

**Bounding for large repos.** The cap above is on passes, not on how much a single pass reads — a repo with thousands of files can exhaust the real budget inside pass 1 while still reporting "pass 1 of 3." So: cap caller-counting for any one supersession candidate at the first 50 matches from a single search and report `≥50 (capped)` rather than enumerating every one; if the entity list the intent implies exceeds ~20 items, group near-duplicates and spot-check a representative sample instead of opening every file individually. Either shortcut is fine as long as `02-survey.md` says plainly that it was taken — an undisclosed cap reads as a precise count and isn't one, and that is a worse failure than an honestly incomplete survey.

---

## Loop 3 — Adversarial review

| | |
|---|---|
| **Trigger** | A design exists |
| **Runs** | Plan Reviewer, then Solutions Architect |
| **Cap** | 3 rounds |

**Body:**
1. Reviewer reads intent, survey, and design — **not** the architect's reasoning — and appends findings to `04-review.md`.
2. Architect addresses every BLOCKER and MAJOR: revise the design, or write an explicit rebuttal in the log.
3. Reviewer re-runs against the revised design.

**Exit:** zero BLOCKER and zero MAJOR findings outstanding.

**Context isolation is the whole mechanism.** With subagents, spawn the Reviewer fresh with only the three files. Without subagents, write the design to disk, re-read it, and adopt the Reviewer role explicitly and adversarially. A reviewer that watched the design get written will rationalize it, and you will get a clean review that means nothing.

**Cap behavior:** surviving findings go to `assumptions.md` marked `UNRESOLVED — Loop 3`. Three failed rounds on the same finding usually means the disagreement is about product intent rather than engineering, which is exactly the kind of thing the human at the gate should decide.

---

## Loop 4 — Verifiability

| | |
|---|---|
| **Trigger** | A task list exists |
| **Runs** | Solutions Architect, then Plan Reviewer for one pass once the checklist below is clean |
| **Cap** | 3 passes (the Architect's checklist); the Reviewer's plan-level pass is a single round, not a capped loop of its own |

**Body:** For each task, check every item below:

- [ ] Has a `verify:` command that is actually runnable in this repo — in the user's actual shell and OS, and (in a monorepo) from the `cwd:` it declares. Do not assume POSIX; check `02-survey.md`'s conventions section and any CI config for what this repo actually runs on.
- [ ] `cwd:` names the package/dir the `verify:` command must run from, or is omitted/states `none` for a single-package repo — a task whose `verify:` needs a subdirectory but leaves `cwd:` unset fails downstream for a reason that has nothing to do with the code
- [ ] Names the specific files it will touch
- [ ] `depends:` names every task it genuinely needs to run after, and only those
- [ ] `baseline:` names the existing behavior this task might disturb, or states `none` — `grokbit-test` iterates this exact field in baseline mode, so a task that disturbs behavior and leaves it blank is invisible to the one check built to catch that
- [ ] `removes:` names what this task deletes, or states `none` — the Code Reviewer and the Maintenance Engineer both audit the tree against this field later; a task that leaves it blank leaves them nothing to check
- [ ] Is small enough to review in one sitting (rough guide: under ~200 changed lines)
- [ ] Has a rollback
- [ ] `state-after:` is `working`, or the task is explicitly left `breaks-build` and that is stated plainly at the gate

Any task failing a check gets split or rewritten, then re-checked. Once every task clears the list above, also check the plan as a whole: does the Verification matrix map every done-criterion in `01-intent.md` to at least one task's `verify:`? A done-criterion with no row is a claim the plan will never actually prove.

Then send `plan.md` to the Plan Reviewer for its one plan-level pass (see `references/roles.md`): does every task's `verify:` actually prove its stated `intent`? Does the plan's Disposition summary match every disposition `03-design.md` assigned, with none silently dropped? A `BLOCKER` here sends the Architect back into this same loop; it does not count against Loop 3's separate cap, because this is checking the translation into tasks, not the design decision again.

**Exit:** every task passes every check above, the Verification matrix is complete, and the Reviewer's plan-level pass raised no `BLOCKER`.

Watch for the degenerate fix, where a task with no real verification gets `verify: npm run build` bolted on. That proves the code compiles, not that the task is done. The verify command must exercise the behavior the task was for. If the repo genuinely has no way to check something — no test runner, no way to hit the endpoint — that absence is itself a task, and it belongs earlier in the plan.

---

## Loop budget

Worst case is 1 + 3 + 3 + 3 = 10 role invocations, plus Loop 4's own plan-level Reviewer pass (1 in the common case, up to 3 if it keeps finding a `BLOCKER` and sending the Architect back through the same loop). On a cheap-tier survey and expensive-tier design that is a real but bounded cost, and it is far cheaper than one wrong implementation discovered at deploy.

If the host exposes a session budget, charge Plan against it and report the spend at the approval gate. Vibe coders are price-sensitive, and a plan that cost $0.40 and saved an hour is a much easier sell when they can see both numbers.
