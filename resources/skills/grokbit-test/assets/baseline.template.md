# Baseline — <slug>

Captured BEFORE implementation at commit `<sha>` on <date>.

Records what the system does TODAY. Not what it should do. If current behavior
looks wrong, it is still recorded exactly as observed — this is an instrument
for detecting change, not for judging correctness.

## Captured behaviors

### B1 — <behavior> (task T2 baseline field)
Path exercised: <how it was invoked>
Input: `<actual input>`
Observed output: `<actual output>`
Characterization test: `tests/baseline/b1.spec.ts`

### B2 — <...>

## Visual captures
Paths are relative to this file's own directory (`.grokbit/plans/<slug>/test/`).

| View | Width | File |
|---|---|---|
| /settings | 1440 | `captures/settings-desktop-before.png` |
| /settings | 390 | `captures/settings-mobile-before.png` |

## NOT CAPTURED
These cannot be regression-checked. The verify run must say so explicitly
rather than letting silence imply safety.

- <behavior> — reason: <no way to invoke without live payment provider>
