# grokbit-skills

Five portable skills for **Claude Code** and **Grok Build**. One skill format, one artifact directory, both CLIs.

```
grokbit-explore    Scope Setter · Cartographer · Citation Checker
grokbit-plan       Business Analyst · Systems Analyst · Solutions Architect · Plan Reviewer
grokbit-implement  Build Engineer · Software Engineer · Supply Chain Security Analyst · Code Reviewer
grokbit-test       QA Automation · Frontend QA · AppSec · Release Engineer · Maintenance
grokbit-document   Information Architect · Documentation Engineer · Technical Writer · Docs QA
```

## Install

These skills ship inside the **Grokbit VS Code extension**, not as a standalone
install. On activation the extension provisions all five into the home tier
of both CLIs — a plain file copy, re-copied whenever the extension updates:

```
~/.grok/skills/grokbit-{explore,plan,implement,test,document}/
~/.claude/skills/grokbit-{explore,plan,implement,test,document}/
```

There is no symlink and nothing to keep in sync by hand. `grok.skills.provision`
(`auto` | `off`, default `auto`) turns this off if you want to manage the
skills yourself. Because provisioning is home-tier, these skills are
available in **every** session on the machine — any project, any terminal,
started from the extension or not — not only sessions opened from inside it.

If you want to fork one of these skills for a specific project, drop your own
copy at `.grok/skills/<name>/` or `.claude/skills/<name>/`. Project tier wins
over the provisioned home-tier copy by the normal workspace-first precedence,
so your fork shadows it without you editing the shared copy in place.

## The pipeline

```
  grokbit-explore (optional orientation)
           │
           ▼
  grokbit-plan  ──▶  human approval  ──▶  grokbit-test (baseline)
                                                  │
                                                  ▼
       verdict  ◀──  grokbit-test (verify)  ◀──  grokbit-implement
                            │                         ▲
                            └── regression / CRITICAL ─┘
                                        │
                         3 deviations ──┴──▶ back to grokbit-plan
```

**Explore** maps relevant code in chat (read-only, cited) before you commit to a plan. It does not write plan artifacts; Plan Survey still opens files when you run `/grokbit-plan`.

**Testing runs twice, and the first run is the important one.** Baseline mode executes before implementation to record how the system behaves today. Without it, "the cart total is $0" after a change is just a number — you have nothing to compare it against. A baseline captured after the fact agrees with the change perfectly and detects nothing.

## Documentation

`grokbit-document` is registry-driven: document types are **data**, not prose. Each lives in `types/<id>.md` with frontmatter declaring its audience, sections, derivation sources, and verification rules. Adding a type is adding a file — no skill rewrite, no extension code change.

Twelve types seeded: `readme` `adr` `changelog` `api-reference` `user-guide` `contributing` `test-plan` `security-posture` `runbook` `sdd` `pdd` `brd`.

Most of these are already written. `01-intent.md`, `03-design.md`, `results.md`, and `security.md` are most of a spec, a test plan, and a security posture — in process format rather than reader format. So the skill derives first, asks only for the gaps, and reports coverage *before* generating:

```
PDD — password-reset
  6 of 9 sections draftable from your artifacts
  3 need input: exception handling, process owner, volume estimates
```

Below ~30% coverage it recommends against generating. That preview is the honest replacement for the necessity gate, which a Documentation button otherwise removes.

**Verification is the point.** Wrong code fails loudly; a wrong document sits there being confidently wrong, and it is worse than no document because people act on it. Two checks with no code equivalent:

- `verify_doc.py` — runs every documented command, resolves every path, follows every link. A doc whose commands fail is blocked, not shipped with a caveat. (`--execute` runs shell from a text file: containers only. Default is list-don't-run.)
- **Fresh-reader test** — a reviewer gets *only the document* and attempts the task. Catches the defect proofreading never catches: the author knew something and did not notice they knew it.

**Staleness** is tracked via `derived_from: <path>@<commit>` frontmatter. `check_drift.py` flags the specific sections citing a changed source, not the whole file — stale-marking a forty-page guide because one signature moved trains people to ignore the marker. Deterministic git work, so it is a script rather than model work: faster, cheaper, more reliable.

Derived types emit at phase boundaries (`emit_at: plan-approval`, `implement-handoff`, `test-verdict`). A changelog written at handoff is accurate; the same entry three weeks later is archaeology.

### Extension contract

Read the registry to populate the picker, compute coverage, invoke the skill. Nothing else. Section-assembly logic in TypeScript means the CLI and the extension produce different documents from identical inputs — the exact `COEXIST` trap `grokbit-plan` exists to prevent.

## Shared state

Everything is plain markdown under `.grokbit/plans/<slug>/`, committed to the repo, editable by hand. Each phase reads the previous phase's files and writes its own.

```
01-intent.md · 02-survey.md · 03-design.md · 04-review.md
plan.md · assumptions.md
implement/  preflight.md · progress.md · 05-review.md · deviations.md · handoff.md
test/       baseline.md · results.md · security.md · release-readiness.md

docs/                        human-facing documents, paths per type
.grokbit/context/            compact digests for the next Systems Analyst survey
.grokbit/docs-manifest.json  type → path → provenance → last verified
```

`plan.md` is the contract. Implement reads its tasks, Test reads its `baseline:` fields and the intent's done-criteria, and your extension can render all three phases from the same directory.

## Loops at a glance

| Phase | Loop | Exit criterion | Cap | On cap |
|---|---|---|---|---|
| Plan | Intake | Every criterion observable | 1 round, 3 questions | Record as assumption |
| Plan | Grounding | Zero unresolved entities | 3 passes | Record as assumption |
| Plan | Adversarial review | Zero BLOCKER/MAJOR | 3 rounds | Record as assumption |
| Plan | Verifiability | Every task has a verify command | 3 passes | Record as assumption |
| Implement | Preflight | Environment green | 2 per check | **Stop — don't code in a broken env** |
| Implement | Task execution | Verify passes honestly | 3 attempts | **Revert to clean, mark blocked** |
| Implement | Scope audit | No out-of-scope hunks | 2 rounds | Revert contested hunks |
| Implement | Dependency gate | Approved or avoided | 2 rejections | Ask the human |
| Implement | Deviation | Plan completes | **3 deviations** | **Stop, re-plan from Survey** |
| Test | Baseline | Every behavior captured | 3 passes | Mark NOT CAPTURED |
| Test | Reduced-mode entry | Stated explicitly before regression runs | 1 | Declare and proceed — never silently |
| Test | Criteria coverage | Every criterion checked | 3 passes | Mark UNVERIFIED |
| Test | Failure triage | Repro + hypotheses exist | 3 hypotheses | Mark UNDIAGNOSED |
| Test | Security | Zero CRITICAL | **none for CRITICAL** | **Blocks release** |
| Test | Visual | Every view captured | 2 per view | Report unrenderable (or UNVERIFIED with no browser) |
| Test | Baseline retirement | Every INTENDED finding's test retired/regenerated | 2 per finding | Mark NOT RETIRED — named, not silent |
| Document | Executable verify | Commands run, paths and links resolve | 3 | **Block — don't ship a broken quickstart** |
| Document | Fresh-reader | Zero BLOCKER findings | 2 | Record gaps in the doc |

## Why the cap behavior differs by phase

This is the design decision worth understanding before you modify anything.

In **Plan**, hitting a cap means *record it and continue*. The artifact is a document, an open question is visible, and a plan with three honest unknowns is useful.

In **Implement**, hitting a cap means *revert to clean*. The artifact is running software, so a recorded-and-continued failure leaves broken code behind. By attempt three the model reliably stops trying to make the code correct and starts trying to make the error stop — deleting the assertion, widening the type, swallowing the exception. **Reverting is the successful outcome of that loop**, because a blocked task is visible in `progress.md` and a hollow green check is invisible until production.

In **Test**, hitting a cap means *report the gap*, except for security. `CRITICAL` findings have no escape hatch at all. Every other loop here trades thoroughness for termination, which is right when the failure mode is a delayed answer and wrong when it is a leaked credential.

## Mature codebases: supersession

The suite assumes the repo has history. That makes one question a **design input** rather than a cleanup step: *what does this change replace?*

- **Systems Analyst** surveys supersession alongside reuse — what this change replaces, duplicates, or makes dead, with caller counts. Same pass, opposite directions: reuse stops you adding a duplicate, supersession stops you leaving one behind.
- **Solutions Architect** assigns every superseded item exactly one disposition — `REPLACE`, `DEPRECATE`, `COEXIST`, or `LEAVE` — each with a reason. Silence is not a fifth option.
- **Plan Reviewer** treats an unmentioned superseded item as `MAJOR`, and scrutinises every `COEXIST` for deferral wearing better wording.
- **Removal tasks are first-class**, with a `removes:` field, ordered after the replacement is proven, and a verify command that proves an *absence*: no remaining references, suite green, dependent behavior still working.
- **Code Reviewer** audits deletions in both directions — a declared removal is in scope, an undeclared one is not, and a task that declares `removes:` but deletes nothing has left a duplicate behind.

Mature codebases don't decay because people forget to delete things. They decay because nobody ever decides, and every undecided duplicate becomes a permanent fixture the next survey faithfully reports as an existing convention. Forcing the decision at design time is the whole mechanism.

The Maintenance Engineer in Test is now scoped to debris *this session created*. Pre-existing dead code is deliberately not its job — a cleanup list handed over at the moment the user believes they're finished is a to-do nobody actions.

## The five rules that carry the most weight

1. **Verify or revert.** No partial task state, ever.
2. **Three deviations and you re-plan.** The threshold an agent is least inclined to respect, and the one that prevents the most damage. Three contradictions means the survey misread the codebase's shape, and every remaining task rests on the same bad ground.
3. **Never edit a test to make it pass.** Doing so converts a regression into a silent one. The one narrow exception — retiring or regenerating an already-cited baseline test, and only after the change has shipped — happens in the open, recorded in `test/results.md`, and never to silence an UNKNOWN or REGRESSION finding.
4. **Every superseded thing gets a disposition.** Undecided duplication is how a codebase with history rots.
5. **Never write a claim you cannot source.** A gap is a visible `TODO`, never plausible prose. Confident invention is the one documentation defect that reads well enough to survive review.

## Portability

Grok Build reads the Anthropic skill format natively, so the skill bodies are byte-identical across hosts. Only dispatch differs, and each skill detects host capability at the start and degrades gracefully — no subagents, no parallelism, and no per-agent model selection still produces correct artifacts.

One exception: a missing headless browser means visual checks did not happen, and that gets reported as `UNVERIFIED` rather than silently skipped. See `references/host-adapters.md` in any skill.

You can plan in Grok, implement in Claude, and test in either. Both hosts read the same folders and write the same artifacts.

## Verify before shipping

Both CLIs move fast and Grok Build is in early beta. Worth confirming:

- Grok Build's skill directory precedence, and whether it honors nested `references/` progressive disclosure the way Claude Code does
- Whether its plan-mode TUI parses the `plan.md` task blocks or wants its own sub-task graph format
- That install commands stay interceptable under your permission settings — the dependency gate depends on it, so don't enable always-approve for Implement
- Whether concurrent subagents in worktrees preserve commit-per-task, or need each worktree to commit separately and merge after its own scope audit
