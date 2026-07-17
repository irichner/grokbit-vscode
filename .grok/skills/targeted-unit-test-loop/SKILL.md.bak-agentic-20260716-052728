---
name: targeted-unit-test-loop
description: >
  Fast unit tests on changed code with coverage delta, lint/typecheck gate,
  test-accuracy checks, and fix→re-test loop (max 3 full suite runs).
  Use after implementation or /targeted-unit-test-loop.
disable-model-invocation: true
---

# Skill: Targeted Unit Test Loop

## Spawn rules

- Orchestrated by **Lead** (not nested under another subagent).
- Spawn with `capability_mode: execute` or `all` (shell required) — set explicitly.
- Prepend full `.grok/personas/instructions/gf-qa.md`; `description`: `[gf-qa] targeted tests`.

## Prerequisites

- Prefer git for changed-file list. If no git: require user-supplied path list or fail with NO-GO (cannot define “changed”).
- QA must `read_file` `.grok/docs/test-accuracy-standards.md` before accuracy GO/NO-GO.

## Steps

1. Read AGENTS.md Project Test Commands. If Unit is TODO/NONE without waiver → **NO-GO**. Resolve **Lint** command too (part of GO when real).  
2. List changed files (`git status` / `git diff --name-only` when git exists).  
3. Map to tests (in order): plan Testing Strategy paths → colocated tests → smallest module suite that covers changed packages. Record selection rule used.  
4. Enter **fix → re-test loop** (below).  
5. Emit QA Test Report (`Mode: targeted`) with cycle count and coverage.

## Fix → re-test loop (mandatory)

One full suite run per cycle. Max **3** runs. No double-run within a cycle.
Aligned with `gf-qa` and `/regression-test-loop`.

```
cycle = 0
MAX = 3
while True:
  cycle += 1
  run unit command once (selected paths when supported; else full unit suite with scope note)
  run Lint command when real; capture exit code
  if Coverage command is real: measure per the coverage ladder below; never invent numbers
  accuracy pass per test-accuracy-standards.md
  if tests exit 0 AND lint exit 0 (when real) AND accuracy pass
     AND (coverage gate met OR durable waiver OR NO COVERAGE TOOL OR UNMEASURED/no-changed-lines noted):
    Recommendation: GO
    break
  if cycle >= MAX:
    triage notes for escalate (product vs test vs flake vs env)
    Recommendation: NO-GO; escalate with QA report + failing commands
    break   # no 4th run; no further fix commitment
  triage failures:
  - product bug → hand back to implementer/Lead with failing command (QA does not self-fix product code)
  - inaccurate test → QA may fix the test without weakening assertions; disclose under Self-applied fixes
  # do not re-run here — next iteration is the next full suite run
```

### Coverage gate

- **≥ 80%** when tool exists and **changed lines were measured**.  
- Measurement ladder — record which rung was used:  
  1. changed-line % (diff-cover or equivalent) — preferred  
  2. changed-file % proxy  
  3. whole-package % — weakest; only with explicit limitation note  
- **Vacuous diff:** if diff-cover says “No lines with coverage information in this diff” (or 0 relevant lines) → record **`UNMEASURED / no changed lines`**. Do **not** report 100% or “gate met at 100%.” See `.grok/docs/coverage-policy.md`.  
- Compare-branch ladder: `origin/main` → `main` → `master` → UNMEASURED + missing-ref note.  
- Else `NO COVERAGE TOOL` / `UNMEASURED` — record explicitly; merge needs durable waiver if Coverage was expected and not vacuous-empty.

### Accuracy blockers (NO-GO regardless of green exit)

- Circular / SUT mock call-order-only tests  
- Happy-path-only for non-trivial auth/error/data-loss behavior  
- Missing edge/negative for non-trivial new branches  

## Exit criteria

| Result | Condition |
|--------|-----------|
| **GO** | Tests exit 0; lint exit 0 (when command real); accuracy pass; coverage gate met **or** durable waiver **or** NO COVERAGE TOOL **or** UNMEASURED/no-changed-lines recorded |
| **NO-GO** | Failures after 3 full suite runs, lint failures, accuracy blockers, or missing unit command without waiver |

Max **3** full suite runs (AGENTS.md). Do not claim targeted PASS without a real run this session.
