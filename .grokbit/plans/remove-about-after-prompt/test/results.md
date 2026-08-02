# Test results — remove-about-after-prompt (verify mode)

## Loop T6 — baseline limitation
`test/baseline.md` exists but targets `chat-turn-containers`. No pre-change screenshot of post-send About visibility. Regression claims for paint are limited to automated wiring + suite green; human visual still recommended.

## Regression (suite)
| Suite | Result |
|---|---|
| `test/welcome-canvas.dom.test.ts` | 8 passed |
| `test/session-setup.dom.test.ts` | 13 passed |
| `test/primer-only-restore.dom.test.ts` | 2 passed |
| `test/capabilities.dom.test.ts` | 64 passed |
| **Total** | **87 passed** |

INTENDED vs baseline (chat-turn): none conflicting. Primer-only welcome must-not-regress still green.

## Done-criteria coverage (`01-intent.md`)

| Criterion | Result | Evidence |
|---|---|---|
| Empty session can show welcome chrome | PASS | welcome-canvas empty tests; About still mounted |
| After first prompt, About not visible | PASS (wiring + CSS rule) | `hidden` true after `userMessage`; CSS `.welcome[hidden]{display:none}` source-checked; **paint in Chromium needs human** |
| After first prompt, Grokbit heading not visible | PASS (same) | whole `#welcome` hidden |
| Session Setup / Actions gone after send | PASS | session-setup + capabilities tests |
| New/reset empty shows welcome again | PASS (indirect) | primer-only restore keeps welcome when appropriate; no T1 change to re-show paths |
| Onboarding still displays | PASS | welcome-canvas onboarding test |
| Gear → Version & about still works | UNVERIFIED (no gear DOM test in this run) | no production change to gear path |
| `npm test` green (targeted) | PASS | 87/87 on related files |

## Visual
UNVERIFIED — no headless browser load of VS Code webview. Recommend one send in installed extension after rebuild.

## Maintenance
No orphans from this session. `removes: none` satisfied.

## Baseline retirement
N/A — no INTENDED baseline characterization tests for this slug.
