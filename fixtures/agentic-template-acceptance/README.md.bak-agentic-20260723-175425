# Acceptance fixtures (v1.7)

## A — Bad plan (mandatory for bootstrap complete)

1. Copy `bad-plan.md` → `docs/plans/acceptance-bad-plan.md`
2. `/plan-review-loop` (default). Optional `/cold-review` only if listed in `grok inspect`.
3. **Pass:** Request Changes / Major Concerns; must cite plan-quality hard gates (acceptance criteria, observable verification, testing strategy / edge cases, blast radius). Weak plans must not Approve.

## B — Seeded bug (post-install; needs product code)

1. Plant bug per `seeded-bug-notes.md` on a throwaway branch (value-breaking `clamp` upper bound)
2. Run `python -m pytest tests/test_util.py -q` then targeted tests + `/review`
3. **Pass (planted):** tests FAIL (at least `test_clamp_above_hi`) and/or `/review` files a bug — never both green
4. Unplant → suite green again

## C — Coverage hole (post-install; needs product code + coverage tool)

1. New untested branch in code
2. Targeted loop with coverage
3. **Pass:** NO-GO or gate fail without waiver  
   Note: vacuous “no lines in this diff” is **UNMEASURED**, not a free pass at 100%.  
   **`NO COVERAGE TOOL`** alone is not merge-grade done without a durable waiver under `docs/waivers/`.  
   Product file diffs + empty diff-cover → diagnose path/compare-branch mismatch before treating as vacuous GO.

## D — Test accuracy (optional harness check)

1. Introduce a circular test (mock call-order only on SUT) or happy-path-only auth path
2. Run `/targeted-unit-test-loop` with gf-qa
3. **Pass:** accuracy NO-GO / gap even if pytest exit 0

## E — Seeded design defect (sample UI included)

1. Use `sample-ui/` (or a real frontend) and seed one defect per `seeded-design-defect-notes.md` on a throwaway branch
2. `/post-change-accuracy-protocol` — UI changed, so the UI verification step is required; judge must read `.grok/docs/ui-design-standards.md` and emit a **UI Verification Report** (see post-change skill)
3. **Pass:** design blocker filed as **gap** / NO-GO — never “done” with the defect in place and no waiver
