# Design — Whole-product code review

## Options considered

### Option A — Single pass over entire repo

Approach: One agent reads all of `src/`, `media/`, and `test/` and dumps findings once.

Trade-off: Appears “complete”; in practice context window and attention fail on multi-kloc surfaces (`sidebar`, `acp`, `chat.js`). Undisclosed sampling becomes silent incompleteness — fails DC9.

### Option B — Fixed architectural layers + mandatory trust deep-dives + disclosed sampling

Approach: Partition the product using the module map into **seven review layers**. Each layer has required files, forced security/correctness checks, and a sampling rule for oversized glue. Dirty WIP is an **overlay** (higher scrutiny where present), not the boundary. Final synthesis produces one product verdict.

Trade-off: Longer task list; honest completeness; parallelizable with subagents; matches dual-backend thin-client architecture.

### Option C — Test-gap-only review (files with weak/no tests)

Approach: Rank modules by test absence and only review those.

Trade-off: Misses bugs in well-tested-but-wrong logic and integration seams; fails DC5 trust deep-dives if those modules have tests.

## Decision

**Chosen: B**

Rationale: Whole-product scope (user) + verifiable done-criteria + termination without fake completeness. Rejected A for silent undersampling; C for missing trust boundaries that already have unit tests.

What rejected options were better at:

- **A** — lower ceremony for tiny codebases.
- **C** — efficient if the only goal were coverage tooling debt.

## Shape of the change

Artifacts only under `.grokbit/plans/complete-code-review/`:

```
inventory.md   # DC1 product surface map + risk tiers + layer ownership
findings.md    # DC2–DC9 ranked findings, suite evidence, verdict, backlog, sampling notes
```

### Layers (every one appears in findings)

| Layer | Primary paths | Forced checks |
|---|---|---|
| **L1 Trust / security** | `plan-gate.ts`, `permission-bind.ts`, `terminal-manager.ts`, `env-filter.ts`, capability path containment in `capabilities.ts`, voice key handling, telemetry props | Injection, path traversal, grant bypass, plan-mode fail-open, secret leakage |
| **L2 ACP + backends** | `acp.ts`, `acp-dispatch.ts`, `backends.ts`, `cli-locator.ts`, `claude-locator.ts` | Spawn args/env, quirks gating, Windows pin, adapter install, protocol error paths |
| **L3 Session / host lifecycle** | `extension.ts`, `sidebar.ts`, `session*.ts`, `panel-router.ts`, `panel-restore.ts`, `status-bar.ts`, `session-store.ts` | Tab ready/replay, multi-tab pool, backend-aware resume, logout isolation, empty-primer recycle |
| **L4 Plan mode** | `grok-primer.ts`, `plan-restore.ts`, `plan-review.ts`, `mode-prefs.ts` + gate integration sites in acp/sidebar | Primer suppress, restore override, Approve/Reject follow-up contract |
| **L5 Capabilities / skills** | `capabilities.ts`, `skill-suite.ts`, `mcp-config.ts`, `slash-filter.ts` | Symlink containment, name validation, suite re-key order, provision safety |
| **L6 Webview UI** | `media/chat.js`, `chat.css`, `webview-helpers.js`, `launcher.js` | XSS, a11y blockers, permission/question/plan cards, Actions/workflows, collapse WIP, builder WIP, history/launcher |
| **L7 Peripheral + test floor** | chips, prompt-builder, file-ref, pending-images, agent-handoff, workspace-*, voice-*, telemetry, token-metrics; `test/` + `ci.yml` | Prompt envelope integrity, media limits, STT, anonymous telemetry, generated metrics purity; suite green + map major modules→tests |

### Method per layer

1. Open inventory row + required files (not only CLAUDE summaries).
2. Rubric order: correctness → security → design → tests → style.
3. UI layers: also `.grok/docs/ui-design-standards.md` blockers.
4. For files **> ~800 lines** of glue: deep-dive all security-sensitive functions; sample remaining by feature keywords; **write sample list into findings (DC9)**.
5. Cross-check Known limits claims that touch this layer (DC7).
6. Emit findings with severity + fix; or “Layer clean of Critical/Major” with brief evidence.

### Subagents

Prefer isolated reviewers per layer (code-reviewer / security-auditor for L1). Sequential re-read-from-disk if no subagents.

### Uncommitted WIP

Included under L6 (and tests) with extra attention; does not replace L1–L5.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| WIP-only plan (prior revision of this slug) | REPLACE | User required whole product | This design/plan supersedes; no product code deleted |
| Feature implement “Clean” as product Approve | REPLACE (process) | Scope audit ≠ product review | findings.md authoritative |
| suite-multi-dimensional-review verdict | LEAVE | Historical skill-suite work | May cite if re-verified; not auto-import |
| Ad-hoc / chat-only product review | REPLACE | Durable findings.md | All Critical/Major in findings.md |
| CLAUDE Known limits section | LEAVE (content) / review for honesty | Docs stay; DC7 may file drift findings | Update docs only in a later fix plan if drifted |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Suite or compile red | Verdict cannot Approve; Critical |
| Layer time-box pressure | Sample + disclose (DC9); never invent “all clean” |
| Finding needs live grok | Mark `UNVERIFIED without test:live`; do not claim false confidence |
| WIP changes mid-review | Note tree hash/diffstat at T1; major mid-flight changes → re-run affected layers |
| Disagreement with Known limits “accepted risk” | Finding Minor/Major only if code is worse than documented; else confirm limit |

## Migration

Schema: no · Reversible: yes · Dependencies: none

## New dependencies

None.
