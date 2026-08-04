# Coverage baseline — raise-plan-implement-accuracy

Measurement only (plan T2). No `fail_under` / vitest thresholds applied.

| Field | Value |
|---|---|
| **Date** | 2026-08-03 |
| **Command** | `npm run test:coverage` (`vitest run --coverage`) |
| **Provider** | `@vitest/coverage-v8` v2.1.9 (v8) |
| **Include** | `src/**` |
| **Exclude** | `test/**`, `out/**` |
| **Suite** | 1703 tests passed (80 files) |
| **Overall lines %** | **32.29%** |
| **Overall statements %** | **32.29%** |
| **Overall branches %** | **85.11%** |
| **Overall functions %** | **87.05%** |
| **Ladder rung** | **whole-package %** (coverage-policy) |
| **changed-line** | **UNMEASURED / no tool** (no diff-cover or changed-line coverage tool in repo) |

## Notes

- Whole-package line coverage is **well below 80%**. Do **not** enable vitest `thresholds` / fail_under until a deliberate raise-coverage effort lands, or Stop/CI would brick.
- Many pure modules report high line coverage; low aggregate is dominated by large host/glue files (e.g. `sidebar.ts` / `extension.ts` paths) and any dual-entry listing in the text report.
- Residual risk until changed-line tooling exists: merge still relies on green unit tests + review, not measured changed-line %.

## Reproduction

```bash
npm run test:coverage
```
