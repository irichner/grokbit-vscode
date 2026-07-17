---
name: regression-test-loop
description: >
  Phased regression Quick (default) or Extended with triage and fix→re-test loop
  (max 3 full suite runs). Use before merge or /regression-test-loop.
disable-model-invocation: true
---

# Skill: Regression Test Loop

## Spawn

Lead-orchestrated; `capability_mode: execute` or `all`; prepend full `.grok/personas/instructions/gf-qa.md`;
`description`: `[gf-qa] regression`.

QA must `read_file` `.grok/docs/test-accuracy-standards.md` when judging new tests added in-session.

## Quick vs Extended

**Extended required when:** auth, payments, migrations, concurrency, shared libs, public API contracts, unclear prior fix, or user asks.  
Otherwise **Quick** (full unit / project regression command from AGENTS.md).

## Steps

1. Choose phase; resolve AGENTS.md commands (fail if NONE/TODO without waiver).  
2. Enter **fix → re-test loop** (below).  
3. QA Test Report (`regression-quick` | `regression-extended`) with cycle count.

## Fix → re-test loop (mandatory)

One full phase run per cycle. Max **3** runs. No double-run within a cycle.
Aligned with `gf-qa` and `/targeted-unit-test-loop`.

```
cycle = 0
MAX = 3
while True:
  cycle += 1
  run full chosen phase commands once; capture exit codes
  if phase exit 0:
    Recommendation: GO
    break
  if cycle >= MAX:
    triage notes for escalate (product bug vs flake vs env vs bad fixture)
    Recommendation: NO-GO; escalate with QA report + evidence
    break   # no 4th run; no further fix commitment
  triage failures
  flakes: re-run failed subset up to 2 times for isolation only;
          if still flaky → quarantine in report with command + reason (do not silently ignore);
          isolation re-runs do not count as full cycles
  if product bug: hand back to implementer/Lead with failing command (QA does not
                  self-fix product code; test-only fixes disclosed under Self-applied fixes)
  # do not re-run full phase here — next iteration is the next full phase run
```

## Exit criteria

| Result | Condition |
|--------|-----------|
| **GO** | Chosen phase exit 0 (flakes quarantined with reason only if non-blocking and reported) |
| **NO-GO** | Residual failures after 3 full phase runs without durable waiver |
| **Waived** | Durable `docs/waivers/<name>.md` for residual failures with references |

Max **3** full phase runs then escalate. Do not claim regression PASS without a real run this session.
