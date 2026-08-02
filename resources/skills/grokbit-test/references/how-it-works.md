# How Test works

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
