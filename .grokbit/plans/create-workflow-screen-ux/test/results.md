# Results — create-workflow-screen-ux (verify mode)

## Loop T6

Baseline exists (`test/baseline.md`). Regression comparisons use it.

## Regression (suite)

| Check | Result |
|---|---|
| Preflight targeted suite | 272 green before edit |
| Full `npm test` after implement | **1705 passed**, 0 failed |
| New vs pre-existing failures | none |

### Behavioral diffs vs baseline (classified)

| Change | Class | Citation |
|---|---|---|
| Name required; Goal second; no Constraints; canvas under Goal | INTENDED | `03-design.md` Option B layout |
| Scope = switch next to Name | INTENDED | same |
| Craft stays open, posts `send`, working banner | INTENDED | `03-design.md` Craft session |
| After craft result, draft/canvas updated | INTENDED | same |
| Compact chrome during craft | INTENDED | same (permission safety) |

No REGRESSION / UNKNOWN found in suite.

## Done-criteria coverage

| Criterion | Result | Evidence |
|---|---|---|
| Name first, larger, required | PASS | DOM tests + CSS `.wf-builder-name-input` |
| Goal under Name | PASS | `compareDocumentPosition` in capabilities.dom |
| Scope toggle next to Name | PASS | `.wf-builder-scope-toggle` + switch |
| Constraints removed | PASS | DOM absence + brief unit test |
| Canvas under Goal | PASS | column CSS + DOM structure |
| Craft stay open + auto-send + notification | PASS | DOM test auto-send + `wf-crafting` status text |
| Proposed workflow editable after complete | PASS | workflowCraftResult apply DOM test |
| npm test green | PASS | 1705 |

## Visual

UNVERIFIED — no headless browser (Loop T5). DOM tests cover structure/behavior only.

## Maintenance

No orphan files from abandoned attempts. Constraints UI removed as planned.
