# Baseline — workflow-how-they-work

Captured before implement tasks that touch Actions UI (T4).

## Existing Actions row behavior (T4 may disturb)

| Behavior | How characterized | Observed |
|---|---|---|
| Invocable suite row click seeds composer with `/grokbit-* ` and does not auto-send | `test/capabilities.dom.test.ts` invoke cases | Green at preflight (1410) |
| Non-invocable with path posts `openFile` | same suite | Green |
| No Details control / no `getCapabilityDetail` | absence in chat.js / payload | No `hasDetail` field today |
| Short description only on row (≤260 display) | webview-helpers truncate | Green |

## Non-UI baselines
T1–T3, T5 are additive content/host fields or docs; no product behavior contract beyond discovery.

## Waiver
None — this file records characterization via existing tests rather than new e2e captures.
