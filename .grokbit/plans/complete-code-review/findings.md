# Whole-product code review — findings

**Slug:** `complete-code-review`  
**Product:** Grokbit VS Code extension (`grokbit.grokbit`)  
**Tree freeze:** HEAD `26bae09` + dirty WIP overlay (see `inventory.md`)  
**Date:** 2026-08-02  
**Rubric:** `.claude/skills/code-review-rubric/SKILL.md`  
**Layers:** L1–L7 complete (notes in `findings-L*.md`)

## Evidence

| Check | Result |
|---|---|
| `npm run compile` | **PASS** (exit 0) |
| `npm test` | **PASS** — 74 files, **1529** tests, ~3.9s |
| Live `npm run test:live` | **Not run** (optional; out of default plan) |

## Verdict

**Request changes** → **Remediated (M1–M4)** — 2026-08-02 via `product-review-remediation`

| ID | Status |
|---|---|
| M1 | **Fixed** — `isSafeHref` + markdown link gate |
| M2 | **Fixed** — `XAI_` prefix + Grok credential exacts in `filterDotEnv` |
| M3 | **Fixed** — Escape, `aria-modal`, Tab trap on Workflow Builder |
| M4 | **Fixed** — `Claude.md` Known limits + What's next |

Original top priorities (historical):

Top priority: **Sanitize markdown / file-ref link schemes in the webview** (`javascript:` and non-http(s) hrefs) so agent/transcript content cannot inject active URL schemes into the chat DOM.

Secondary before ship of WIP: **Workflow Builder keyboard/dialog a11y (Escape + focus)** and **refresh `Claude.md` Known limits** so workflow kind is not described as “deferred.”

---

## Critical

*None confirmed in this pass.* (No fail-open plan gate; grant/plan integration is wired; suite green.)

---

## Major

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | **Markdown links allow dangerous URL schemes** | `media/chat.js:2025-2027` (file-ref `:2019-2021`) | Allowlist `https?` / `vscode` / known file-ref pattern; reject `javascript:`, `data:`, etc.; add regression test |
| M2 | **Workspace `.env` can set XAI/Grok API key names** | `src/env-filter.ts:27-43` vs `claude-locator.ts:314` XAI secrets | Deny `XAI_*` / grok credential env names from `.env` layer; tests |
| M3 | **Workflow Builder dialog lacks Escape / focus trap** | `media/chat.js` builder (~971+); no Escape handler | Keyboard + focus restore; UI standards |
| M4 | **Known limits docs claim workflows deferred / no `workflow` kind** | `Claude.md:222` vs `src/capabilities.ts:43` | Update Known limits + What’s next for shipped workflows + ADR 0004 |

---

## Minor

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| m1 | `openFile` absolute paths not workspace-bound | `sidebar.ts:2976-3009` | Optional allowlist |
| m2 | Permission bind fail-open with no grants (Agent mode) | `permission-bind.ts:10-18` | Documented; UX copy only |
| m3 | Builder full re-render drops focus on phase ops | `renderWorkflowBuilder` | Targeted updates / focus restore |
| m4 | Dirty close uses `window.confirm` | builder close | Accept or VS Code modal |
| m5 | Windows grok pin may lag latest stable | `cli-locator.ts:56` | Re-verify + bump when ready |
| m6 | Plan restore only re-raises gate on `rejected` | `plan-restore.ts:45-49` | Product choice; keep tests |
| m7 | No capability FS watcher | Known limits | Accept |
| m8 | Soft live session bound | Known limits | Accept |
| m9 | No coverage/lint in CI | `ci.yml` | Optional tooling |
| m10 | What’s next E6 wording vs ADR 0004 | `Claude.md:240` | Clarify scopes |

---

## Nits

- Dirty `$null` path in git status — delete noise.
- Dense but useful comments in backends/plan-gate — keep.

---

## Layer coverage (DC4)

| Layer | Status | Critical/Major |
|---|---|---|
| L1 Trust/security | Reviewed | M1 (sink), M2 |
| L2 ACP/backends | Reviewed | none Major (pin maintenance Minor) |
| L3 Session/host | Reviewed | none Major |
| L4 Plan mode | Reviewed | none Major |
| L5 Capabilities | Reviewed | M4 |
| L6 Webview | Reviewed | M1, M3 (+ WIP solid for craft/collapse) |
| L7 Peripheral/tests | Reviewed | suite green; docs nits |

## Trust deep-dive summary (DC5)

| Control | Assessment |
|---|---|
| Plan-gate writes/terminals | Solid; integrated in `acp.ts` for both backends with `clientPlanGate` |
| Permission path/command bind | Solid when grants exist; content digest on allow-once Write |
| Terminal shell | By design + gates |
| Capability symlink scan | Solid realpath containment + name pattern |
| Env filter | **Incomplete for XAI/Grok secrets (M2)** |
| Telemetry | Content-free props; dual gate |
| Webview markdown | **Scheme issue (M1)** |

## Known-limits honesty (DC7)

| Claim | Status |
|---|---|
| Workflows deferred / no kind | **FALSE today — M4** |
| Permission bind scope | True |
| Claude plan permission reject off | True |
| Soft process bound | True |
| No capability watcher | True |
| Launcher full re-render cost | True (not re-benchmarked) |
| Token ledger limits | True; `token-metrics.ts` remains data-only |

## Sampling disclosure (DC9)

| File | Lines (approx) | Deep | Sampled |
|---|---|---|---|
| `src/sidebar.ts` | ~5442 | logout, permission, openFile, env merge, media | other message cases via tests/docs |
| `src/acp.ts` | ~778 | fs/terminal gates + grants | streaming lifecycle via tests |
| `media/chat.js` | ~6947 | markdown, builder, collapse, capabilities | tool carousel/permission via DOM tests |
| Pure modules | various | plan-gate, permission-bind, env-filter, primer, restore, backends, skill-suite, capabilities containment | full where short |

## WIP overlay (elevated, not sole scope)

| Feature | Assessment |
|---|---|
| Collapsible user prompts | Solid tests; CSS one-line clamp; no Critical |
| User Workflows + Builder | Functional + tests; **M3 a11y**; Craft seed-only OK |
| Uncommitted mix | Blocks clean commit split until reviewed fixes land |

## Remediation backlog (Critical/Major only)

1. **M1** — Link scheme allowlist in `renderMarkdown` / file-ref + tests.  
2. **M2** — Expand `filterDotEnv` denylist for XAI/Grok credentials + tests.  
3. **M3** — Workflow Builder Escape + focus trap.  
4. **M4** — Fix `Claude.md` Known limits (and related README if needed).

Suggested next plan slug: `product-review-remediation` (or implement fixes under user direction).

## What is strong (product-level)

- Grok-free **1529**-test floor matching CI shape.
- Pure policy modules for plan-gate, permission-bind, panel-router, backends, capabilities.
- Dual-backend quirks model is coherent.
- Primer v4 + client plan gate address known CLI `exit_plan_mode` unreliability without trusting the tool result.
- Telemetry privacy posture is disciplined.
- Generated token metrics module stays free of runtime metering logic.

---

*Layer detail files: `findings-L1.md` … `findings-L7.md`. Inventory: `inventory.md`.*
