# Baseline — changed-files-dedupe

Captured BEFORE implementation on 2026-08-01 (working tree pre-T1; suite green 1408).

Records what the system does TODAY. Not what it should do.

## Captured behaviors

### B1 — Changed-files strip contracts (task T1 baseline field)
Path exercised: `npm test -- test/changed-files-strip.dom.test.ts` (happy-dom + real `media/chat.js`)

| Contract | Observed (pre-change) | Characterization |
|---|---|---|
| One applied edit → 1 chip + label | PASS — `1 file changed`, basename + add/del | existing test |
| Distinct paths → N chips | PASS — 2 chips, `2 files changed` | existing test |
| Failed tool removes entry by toolCallId | PASS — strip hides | existing test |
| Next user message clears strip | PASS | existing test |
| History replay does not populate | PASS | existing test |
| Chip click → `openFile` | PASS | existing test |
| **Same path, two toolCallIds** | **Not covered by suite.** Production code keys Map by `toolCallId` and renders one chip per Map value (`media/chat.js` `recordChangedFile` / `renderChangedFilesStrip`). Expected pre-fix behavior: **2 chips**, both `auth.ts`, label **`2 files changed`**, metrics **not summed** on one chip. | to be asserted as INTENDED change by design Option A |

Characterization tests for unchanged contracts: existing `test/changed-files-strip.dom.test.ts` (6 tests, all green pre-T1).

## Visual captures
None — DOM unit tests only; no headless screenshot tooling required for this strip fix.

## NOT CAPTURED
- Live multi-edit in a real Grok ACP session (unit DOM fixtures are the contract).
- Basename collision across different directories (pre-existing LEAVE).
