# Loops — Test

Cap behavior differs by loop here, and the difference is deliberate. Most loops record and continue, because an unverified criterion is a known unknown and the human can act on it. The security loop does not, because an unreported exploitable finding is not a known unknown to anyone.

---

## Loop T1 — Baseline capture

| | |
|---|---|
| **Trigger** | Baseline mode, before implementation |
| **Runs** | QA Automation Engineer |
| **Cap** | 3 passes |

**Body:**
1. List behaviors to characterize: every non-`none` `baseline:` field in `plan.md`, plus every done-criterion touching functionality that already exists.
2. Exercise each real code path and capture actual observed values.
3. Write characterization tests asserting exactly what was observed.
4. Behaviors captured often reveal adjacent ones worth capturing. Add them and repeat.

**Exit:** every listed behavior has a committed characterization test.

**Cap behavior:** record uncaptured behaviors in `test/baseline.md` under `NOT CAPTURED` with the reason. Those areas cannot be regression-checked later, and the verify run must say so rather than implying silence means safety.

**Timing is the whole thing.** This loop must complete before the first task lands. A baseline captured afterward agrees with the change perfectly and detects nothing — it is not a weak baseline, it is an instrument calibrated against the thing it is supposed to measure.

---

## Loop T2 — Done-criteria coverage

| | |
|---|---|
| **Trigger** | Verify mode |
| **Runs** | QA Automation Engineer |
| **Cap** | 3 passes |

**Body:** For each criterion in `01-intent.md`, find or construct a check, run it, record the observed output. Criteria that resist checking often do so because they were written vaguely — note that, since it is feedback the Plan phase needs.

**Exit:** every criterion has an executed check with a captured result.

**Cap behavior:** mark the remainder `UNVERIFIED` with the reason and surface them prominently in the verdict. A criterion nobody checked is the single most useful thing to tell the user, and the easiest to quietly omit.

---

## Loop T3 — Failure triage

| | |
|---|---|
| **Trigger** | Any `REGRESSION` or failing criterion check |
| **Runs** | QA Automation Engineer |
| **Cap** | 3 hypotheses per failure |

**Body:**
1. Reduce to a minimal reproduction — the smallest input and shortest path that still fails.
2. Capture runtime state at the failure: variable values, not just a stack trace. The variable values are what make the hypothesis checkable.
3. Rank up to 3 causes, each with the specific evidence supporting it and the specific check that would confirm or eliminate it.
4. Hand the package to `grokbit-implement`.

**Exit:** a minimal repro and a ranked hypothesis list exist for every failure.

**Cap behavior:** report the failure with whatever evidence was gathered and mark the cause `UNDIAGNOSED`. An undiagnosed failure is still a valid, useful result.

**Do not fix anything in this loop.** Triage produces evidence and hands it back. Repair happens in Implement, under Implement's retry cap and scope audit. A verification phase that repairs its own findings can no longer report on them honestly, and the retry that fixes it here would bypass the scope audit entirely.

---

## Loop T4 — Security findings

| | |
|---|---|
| **Trigger** | Verify mode |
| **Runs** | Application Security Engineer |
| **Cap** | **CRITICAL: none. HIGH and below: 2 rescan rounds.** |

**Body:** Scan, classify by severity, hand findings to Implement for repair, rescan after fixes land.

**Exit:** zero `CRITICAL` findings outstanding. `HIGH` and below may ship with explicit written acknowledgment from the human.

**Cap behavior:** a `CRITICAL` finding blocks the release unconditionally. There is no iteration count, no time pressure, and no "record it and continue" path. If it cannot be fixed, the verdict is `DO NOT SHIP` and it stays that way until a human overrides it deliberately and in writing.

Every other loop in this suite trades thoroughness for termination, and that trade is right when the failure mode is a delayed answer. It is wrong here. A leaked key is not recoverable by trying again tomorrow, so this is the one place the suite refuses to make the trade.

---

## Loop T5 — Visual verification

| | |
|---|---|
| **Trigger** | Verify mode, change touched UI |
| **Runs** | Frontend QA Engineer |
| **Cap** | 2 passes per view |

**Prerequisite:** a headless browser. If none is available, do not run the rest of this loop — report every affected view `UNVERIFIED — no headless browser` in `test/results.md` and stop. That is a different fact from a view that loaded and rendered wrong, and collapsing the two into a silent skip is exactly the omission this suite exists to prevent.

**Body:** Render headless at desktop and mobile widths, screenshot, check rendering, reachability, overlap, and the empty/loading/error states. Diff against baseline captures where they exist.

**Exit:** every affected view captured and checked.

**Cap behavior:** report views that would not render, with the error. A view that cannot be loaded is itself a finding of the highest practical importance — it usually means the page is broken.

For differences you cannot classify, present both images to the human rather than deciding. Overlap and clipping are objective and yours to rule on; visual taste is not.

---

## Loop T6 — Reduced-mode entry

| | |
|---|---|
| **Trigger** | Verify mode starts and no `test/baseline.md` is on record |
| **Runs** | QA Automation Engineer |
| **Cap** | 1 — this is a declaration, not a search |

**Body:** Before Step 1 runs, write the reduced-mode statement into `test/results.md`'s `## Reduced mode` section: no baseline exists, so regressions cannot be detected — not "none found," "not measurable." Skip the Regression table entirely rather than filling it with blanks that could be misread as checked. Then proceed with done-criteria coverage, visual, security, and build as normal.

**Exit:** the statement is on record before any other verify-mode step runs.

**Cap behavior:** none available — the declaration is mechanical and cannot fail on its own terms. What this loop guards against is skipping it, not getting it wrong: a verify run that quietly proceeds without saying so produces a false "no regressions found" from a run that structurally could not have found any.

---

## Loop T7 — Baseline retirement

| | |
|---|---|
| **Trigger** | The Step 6 verdict is `SHIP` or `SHIP WITH CAVEATS`, and one or more Step 1 findings are classified `INTENDED` |
| **Runs** | QA Automation Engineer |
| **Cap** | 2 passes per finding |

**Body:**
1. For each `INTENDED` finding, re-open its `03-design.md` citation — same grounding discipline as everywhere else in this suite.
2. If the design says the old behavior is simply gone, **retire** the characterization test: delete it.
3. If the design says the behavior changed to a value that still exists, **regenerate** it: rewrite the assertion to the value already captured in `test/results.md`'s Regression table — never a freshly re-observed value, or this loop quietly becomes a second, unaccountable regression check.
4. Commit the retirement/regeneration as its own commit, separate from the implementation commits, so it is visible in history as what it is.
5. Record what happened to each test under `## Baseline retirement` in `test/results.md`.

**Exit:** every `INTENDED` finding's characterization test is retired or regenerated and recorded.

**Cap behavior:** leave the test red, and record it as `NOT RETIRED — <reason>` under `## Baseline retirement`. The next session's preflight will still see it as a pre-existing failure — but a named, explained one, not a silent one. That distinction is the entire point of this loop.

**Never touch a test behind a `REGRESSION` or `UNKNOWN` finding, here or anywhere else.** This loop's write grant is scoped exactly to findings already classified `INTENDED` with a citation, and only after a `SHIP`/`SHIP WITH CAVEATS` verdict exists. Nothing here loosens hard rule 1 — it operationalizes the one exception that rule already names.

---

## Loop budget

Verify mode runs roughly 8–15 invocations, and the roster itself is not cheap. QA Automation Engineer and Application Security Engineer are both **expensive** tier and carry the loops that run on every change — regression, criteria coverage, failure triage, and security — Frontend QA and Release Engineer are **standard**, and only Maintenance Engineer is **cheap**. One cheap role does not make a cheap phase. Budget accordingly, and do not reach for a cheaper model on the expensive-tier roles just because Plan's roster gets away with it — judgment-heavy verification is exactly where a cheap model produces a confident, wrong answer.

Baseline mode is 3–6 invocations, all QA Automation Engineer. Baseline retirement (Loop T7, when it fires at all) adds at most 2 per `INTENDED` finding on top of the verify-mode count above.

Baseline mode looks like pure overhead at the moment you run it, since nothing has broken yet. It is the cheapest step in the entire suite relative to what it prevents — without it, every regression claim afterward is an assertion rather than a measurement.
