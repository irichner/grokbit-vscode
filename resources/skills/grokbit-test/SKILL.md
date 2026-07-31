---
name: grokbit-test
description: Verify a change actually works — behavioral regression against a pre-change baseline, done-criteria coverage, visual checks, security scanning, and production-parity build. Runs in two modes: baseline (capture behavior BEFORE implementing) and verify (check the change afterward). Use this skill whenever the user asks to test, verify, check, QA, or validate a change, asks "did that work" or "is this safe to ship", or finishes implementing anything. Use it proactively after grokbit-implement completes, and use baseline mode before implementation starts whenever a plan task declares a baseline. Do NOT use it to write a single unit test the user asked for by name — just write that test.
---

# Grokbit — Test

Two facts shape this entire phase.

**A regression harness that only runs after the change cannot detect regressions.** If you have nothing recorded about how the cart total behaved before the edit, "the cart total is $0" is just a number. This is why the skill has a baseline mode that runs *before* implementation.

**Vibe coders cannot tell whether the model succeeded.** That is the actual gap this product fills. So the output here is not a pass/fail line — it is evidence a non-expert can read: this is what it did before, this is what it does now, this is which of your stated criteria are proven and which are not.

## Modes

| Mode | Runs | Reads | Writes |
|---|---|---|---|
| `baseline` | Before implementation | `plan.md` task `baseline:` fields, `01-intent.md` | `test/baseline.md`, generated characterization tests |
| `verify` | After implementation | `test/baseline.md`, `implement/handoff.md`, `implement/preflight.md`, `plan.md`, `01-intent.md`, `03-design.md` | `test/results.md`, `test/security.md`, `test/release-readiness.md` |

If asked to verify with no baseline on record, say so explicitly and proceed in reduced mode. You can still check done-criteria, security, and the build; you cannot make trustworthy claims about regressions. Do not paper over the gap — a confident "no regressions found" from a run that could not have found them is worse than an honest limitation. Enter **Loop T6** before Step 1 so this is on record in the artifact itself, not just in your own reasoning.

## Hard rules

1. **Never change a test to make it pass.** If a test fails, either the code is wrong or the test encoded a behavior the plan deliberately changed. The second case requires the plan to say so, in writing, in `03-design.md`. Any other edit to a failing test is falsifying the result. **The one narrow, cited exception:** Step 7. A baseline characterization test behind a finding already classified `INTENDED` in Step 1 — same citation, no new one — may be retired or regenerated, and only after the verdict ships. It is never edited to *reach* a verdict, only afterward to reflect one already reached.
2. **Compare against the recorded baseline, not against expectations.** Preflight recorded which tests were already failing. Those are not your regressions.
3. **Report what you could not check.** An unverifiable done-criterion is a finding, not an omission.
4. **CRITICAL security findings have no cap escape.** Every other loop here records and continues. This one blocks the release outright.

## Pipeline

```
 baseline mode:  Capture ──▶ test/baseline.md        (before Implement)

 verify mode:    Regression ─▶ Criteria ─▶ Visual ─▶ Security ─▶ Maintenance ─▶ Release + Verdict ─▶ Retirement
                 (QA Auto)     (QA Auto)  (FE QA)   (AppSec)    (Maint Eng)     (Rel Eng)            (QA Auto)
                     │            │                    │                             │                  │
                     └─ T3 triage ┘                 T4 (no escape)          DO NOT SHIP / REGRESSION      │
                            │                                                        │                    │
                     back to grokbit-implement ◀───────────────────────────────────────┘         SHIP / SHIP WITH CAVEATS
                                                                                                    only ──▶ done
```

Read `references/roles.md` for role prompts, `references/loops.md` for caps and exit criteria.

## Baseline mode

Runs before the first task lands. Enter **Loop T1**.

For each task in `plan.md` with a non-`none` `baseline:` field, and for each behavior the intent's done-criteria imply already exists, capture what the system does *now*: actual inputs and outputs, actual rendered output, actual response shapes. Write characterization tests that assert current behavior — including behavior that looks wrong. **A characterization test records reality, not correctness.** If the discount calculation is off by a cent today, the baseline records the cent, because your job is detecting change, not judging it.

Commit the baseline before implementation begins. A baseline captured after the first edit is not a baseline.

Use `assets/baseline.template.md`.

## Verify mode

### Step 1 — Regression (QA Automation Engineer) → `test/results.md`

Replay the baseline. Every difference is a finding classified as:

- `INTENDED` — the plan's design explicitly said this behavior would change. Cite the line in `03-design.md`.
- `REGRESSION` — behavior changed and nothing in the plan said it should.
- `UNKNOWN` — changed, and the plan is ambiguous about it.

`UNKNOWN` is a real category and you should use it. Forcing an ambiguous difference into `INTENDED` is how a genuine break gets signed off.

Any `REGRESSION` finding here, or a failing done-criterion check in Step 2, enters **Loop T3** (failure triage).

Also run the project's own suite and diff against the pre-existing failures recorded in `implement/preflight.md`. **Exclude from that new-failure list any baseline characterization test that is red only because of a finding you just classified `INTENDED` above** (same `03-design.md` citation, no new one) — that test is not a regression, it is Step 7's input, and Step 7 is what retires it. This exclusion is narrow and does not widen elsewhere: it covers only baseline-mode characterization tests behind an already-`INTENDED` finding; a red baseline test behind a `REGRESSION` or `UNKNOWN` finding is still a regression, and every other newly-red test in the suite is still a regression too.

If there is no baseline on record for this change, this step does not run — see Loop T6 and skip straight to Step 2, with the reduced-mode statement already on record.

Use `assets/results.template.md`.

### Step 2 — Done-criteria coverage (QA Automation Engineer)

Enter **Loop T2**. Every done-criterion in `01-intent.md` gets an executed check and an observed result. Not "the code looks like it does this" — a command run, an output captured.

Coverage gaps are findings. A criterion you could not check is reported as `UNVERIFIED` with the reason.

### Step 3 — Visual (Frontend QA Engineer)

If the change touched UI, load the affected views headless and capture them. Check against intent, at desktop and mobile widths: does the element render, is it reachable, does it overlap anything, does the empty state work, does the error state work, is the interactive control actually clickable.

Screenshot diffs against baseline captures where available. Report ambiguous visual differences to the human with both images rather than adjudicating taste.

If no headless browser is available, do not attempt this step at all — enter **Loop T5**'s prerequisite path and report every affected view `UNVERIFIED — no headless browser` in `test/results.md`. A view that never got loaded is a different fact from a view that loaded and looked wrong; collapsing the two into a silent skip is exactly the omission this suite exists to prevent.

### Step 4 — Security (Application Security Engineer)

Enter **Loop T4**. Scan the full change for secrets in the diff or in files staged for commit, new endpoints without authentication or authorization checks, authorization decided client-side, injection paths from unvalidated input, permissive CORS, database row-level security disabled or absent on new tables, storage buckets or resources made public, and dependencies added this session with known advisories.

`CRITICAL` findings block the release. There is no iteration cap that lets a critical finding through — this is the one asymmetry in the whole suite, and it exists because the cost of a leaked key is not symmetric with the cost of a delayed ship.

Use `assets/security.template.md`.

### Step 5 — Maintenance sweep (Maintenance Engineer)

Low priority, never blocks, but runs here — before the verdict, not after — so a `SHIP` verdict is never written while debris from this same session is still unaccounted for. Scoped to debris **this session created**: "this session" means the commits listed under Completed in `implement/handoff.md`; diff from the parent of the first of those, not from some other notion of session boundary. Look for orphaned files from abandoned attempts, dead exports, dependencies added and then unused, `TODO` markers left today. Report as a list; delete nothing automatically.

Pre-existing dead code is explicitly *not* in scope here. Supersession is decided during planning, where each item gets a disposition, a task, and a verify command. A post-hoc cleanup list handed over at the moment the user thinks they are finished is a to-do nobody actions — which is exactly why the decision belongs upstream.

One exception, and it is a finding rather than a suggestion: cross-check every `removes:` field in `plan.md` against the tree. Code the plan scheduled for deletion that is still present means a replacement did not replace, and the repo now contains two implementations where the design called for one.

Debris matters more than it looks. Orphan code silently poisons the context window of every future session — the next Systems Analyst survey will read those dead files and cite them as if they were live.

### Step 6 — Release readiness and verdict (Release Engineer) → `test/release-readiness.md`

Runs last of the checks, after Security and Maintenance have both concluded — this is the one step that folds everything else in, so it cannot fire while any of the rest is still open.

Production build from clean. Detect the deployment target from repo config, in this order: `vercel.json`/`.vercel/project.json` (Vercel), `netlify.toml` (Netlify), a Kubernetes manifest (`kind: Deployment`/`ConfigMap`/`Secret`, commonly under `k8s/`/`deploy/`, or a Helm chart), a `Dockerfile` plus `docker-compose.yml`/`compose.yaml`, or that platform's own file (Heroku `Procfile`, `render.yaml`, `fly.toml`, …). Enumerate the env vars the built code reads, then compare **names only, never values** against what that target's own tooling reports (`vercel env ls`, `netlify env:list`, `kubectl get configmap/secret`, or the compose file's own `environment:`/`env_file:` keys read directly — no daemon needed). This single check catches most of the "worked in dev, 500s in prod" class.

If no CLI is authenticated locally, mark every row `UNVERIFIED — <tool> not authenticated`, never blank — a blank cell reads as checked-and-clean, and it was not checked. If no deployment target exists at all — the common case for a first ship — say so plainly: the build/env/migration sections below describe the local production build only, and `SHIP` here means that build is sound, not that anything is live.

Start the real production command and hit a health endpoint. Report bundle or image size delta, migrations needing to run and their reversibility, and whether old and new code can run simultaneously during a rolling deploy — read this off the target's own rollout strategy where one exists (a Kubernetes Deployment's `strategy.type`, a documented PaaS deploy model); `UNVERIFIED`, for the same reason as above, where no target was detected.

Then render the overall verdict — `SHIP`, `SHIP WITH CAVEATS` (list them), or `DO NOT SHIP` (list blockers) — folding in done-criteria coverage and regressions from `test/results.md` and findings from `test/security.md` alongside this step's own build/env/migration results. Written so someone who does not read code can act on it.

On any `REGRESSION` or an outstanding `CRITICAL`, the verdict is `DO NOT SHIP` and hands back to `grokbit-implement` with the failing check and Loop T3's triage output. Do not attempt the fix here — the role that verifies must not also be the role that repairs, or the verification stops meaning anything.

Use `assets/release-readiness.template.md`.

### Step 7 — Baseline retirement (QA Automation Engineer)

Runs only after Step 6's verdict, and only when it is `SHIP` or `SHIP WITH CAVEATS`. Enter **Loop T7**.

Every `INTENDED` finding from Step 1 left its baseline characterization test red on purpose — that is the classification working, not a defect. Now that the change has actually shipped, go through every `INTENDED` finding and either **retire** the test (delete it, when the design says the old behavior is simply gone) or **regenerate** it (rewrite the assertion to the value already captured in Step 1's Regression table — never a freshly re-observed value, or this step quietly becomes a second, unaccountable regression check). Record what happened to each under `## Baseline retirement` in `test/results.md`, citing the same `03-design.md` line the classification already required.

Never touch a test behind a `REGRESSION` or `UNKNOWN` finding here — those stay red, unedited, and belong to Step 6's hand-back instead. On `DO NOT SHIP`, skip this step entirely: nothing shipped, so the baseline should keep describing the only reality that is actually live.

This step is the fix for a specific rot: without it, the next session's preflight records these tests as pre-existing failures, and every future session inherits a baseline that quietly disagrees with the code it is supposed to be measuring.

## Output contract

```
.grokbit/plans/<slug>/test/
├── baseline.md            pre-change behavior, captured before implementation
├── results.md             regression findings, criteria coverage, visual, maintenance sweep, baseline retirement
├── security.md            findings by severity
└── release-readiness.md   build, env parity, migrations, verdict
```

## Failure modes to watch for

- **Retroactive baselining.** Capturing "before" behavior after the change has landed produces a baseline that agrees with the change perfectly and proves nothing.
- **Test editing.** The single most damaging action available in this phase. A test edited to pass is a regression converted into a silent one. Step 7's baseline retirement is not this — it runs only after the verdict, only on tests already classified `INTENDED`, and is itself recorded in `test/results.md`. Retiring a test to *reach* a verdict, rather than to reflect one already reached, is exactly this failure mode wearing the carve-out's clothes.
- **`INTENDED` as a dumping ground.** Every `INTENDED` classification needs a citation into `03-design.md`. No citation means `UNKNOWN`.
- **Green-suite complacency.** The project's tests passing says nothing about criteria the project never had tests for. Coverage of done-criteria is the measure here, not suite status.
- **Fixing what you found.** Verification and repair must stay in different phases.
- **A confident "no regressions" from a reduced-mode run.** No baseline means no regression detection happened, full stop — that is a limitation to state, not a result to report.
