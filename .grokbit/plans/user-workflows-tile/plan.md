# Plan — User Workflows for Grok and Claude

Slug: `user-workflows-tile` · Approach: shared `kind: "workflow"` + backend-native roots/parsers (Rhai on Grok, JS on Claude) + dual-mount empty UX · Blast radius: ~9–11 files, 0 deps, no schema

Single-package repo — `cwd:` is `none`. Verifies for **PowerShell on Windows** (no `&&`).

## Tasks

### T1 — Pure parsers + workflow item builders (Grok Rhai + Claude JS)

- **intent:** extract safe name/description and build `kind: "workflow"` items for both native formats, without wiring scan roots yet
- **files:** `src/capabilities.ts`, `test/capabilities.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/capabilities.test.ts`
- **removes:** none
- **baseline:** none
- **rollback:** `git checkout -- src/capabilities.ts test/capabilities.test.ts`
- **state-after:** working
- **notes:**
  - **Grok:** `parseRhaiWorkflowMeta` on `let meta = #{ … };` → invoke `"/workflow <name> "` when name matches `CAPABILITY_NAME_PATTERN`.
  - **Claude:** `parseClaudeWorkflowMeta` on `export const meta = { … }` (single/double quotes, trailing commas tolerated as much as a small pure parser can; do not execute JS). Fixture shape from real file: `name`, `description`, optional `whenToUse`/`phases`. Prefer `description`; may fall back to `whenToUse` if description empty.
  - Skip / null when no safe name. Cap description at `CAPABILITY_DESCRIPTION_MAX_CHARS`.
  - Shared helper for item assembly (kind, path, source, origin disk) to avoid two divergent security paths.

### T2 — Kind, dual roots, scan layouts, env gate (Grok)

- **intent:** backend-scoped discovery posts a **User Workflows** group when items exist
- **files:** `src/capabilities.ts` (`CapabilityKind`, roots, layouts, `scanCapabilityRoots`), `test/capabilities.test.ts` (incl. order assert formerly `["grokbit","skill","agent","command"]`)
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/capabilities.test.ts`
- **removes:** none
- **baseline:** no workflow groups; kind order without `workflow`
- **rollback:** `git checkout -- src/capabilities.ts test/capabilities.test.ts`
- **state-after:** working
- **notes:**
  - Order: `["grokbit", "workflow", "skill", "agent", "command"]`; label **User Workflows**.
  - Grok roots: project then home `.grok/workflows`, layout rhai-only, `disabledByEnv: "GROK_WORKFLOWS"`.
  - Claude roots: project then home `.claude/workflows`, layout js (and `.ts` only if T1/T2 tests + brief note say yes).
  - **Cross-pollution tests:** grok scan ignores `.js` even if present under a grok workflow dir fixture; claude scan ignores `.rhai`.
  - Project wins same `meta.name` over home via existing dedupe.

### T3 — Visible kinds + empty UX (both backends) + mount short-circuit

- **intent:** default Actions scope shows suite + User Workflows; empty copy is backend-specific and never “Claude can’t do workflows”; both mounts stay consistent
- **files:** `media/webview-helpers.js`, `media/chat.js`, optional `media/chat.css`, `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T2
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **removes:** none
- **baseline:** only grokbit visible; generic empty when no suite; no User Workflows section
- **rollback:** `git checkout -- media/webview-helpers.js media/chat.js media/chat.css test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:**
  - `CAPABILITY_VISIBLE_KINDS = ["grokbit", "workflow"]`; mirror host label in webview labels map.
  - Pure `userWorkflowsPanelState({ backend, hasWorkflowItems })` → `{ showEmpty, title, message }` with **different** messages for grok vs claude.
  - DOM: (1) grok + rhai tiles seed `/workflow …`; (2) claude + js tiles seed chosen invoke; (3) grok empty + suite; (4) claude empty + suite; (5) no foreign-format tiles in fixtures.
  - Short-circuit: `viewGroups.length || emptyState` before full-panel empty.

### T4 — Docs + setting blurbs

- **intent:** document dual-backend native User Workflows; retire “workflows deferred forever” live claims
- **files:** `CLAUDE.md`, `package.json` (actionsScope / showCapabilities text), `README.md` if still suite-only
- **cwd:** none
- **depends:** T3
- **verify:** `powershell -NoProfile -Command "Select-String -Path CLAUDE.md,package.json,README.md -Pattern 'User Workflows|\.rhai|\.claude/workflows|workflows deferred' | Select-Object -First 40"`
- **removes:** live “workflows deferred / not a CLI concept” claims from project map
- **baseline:** Known limits still say workflows deferred
- **rollback:** `git checkout -- CLAUDE.md package.json README.md`
- **state-after:** working
- **notes:** State clearly: **formats are not interchangeable**; Grok Rhai vs Claude JS. Historical Decision 1 in old plan docs may stay with optional supersession note.

### T5 — Claude invoke string confirmation (spike-in-test, then lock)

- **intent:** lock Claude seed string to something the CLI accepts (avoid decorative seeds)
- **files:** `src/capabilities.ts` and/or webview only if invoke differs from Grok; `test/capabilities.test.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/capabilities.test.ts` (assert final invoke format)
- **removes:** none
- **baseline:** none if T1 already picked a default
- **rollback:** revert invoke constant
- **state-after:** working
- **notes:** Prefer evidence: ACP `available_commands` patterns, Claude docs, or a one-line note in assumptions if only `/name` is reliable. Can merge into T1 if already known; keep separate only if implement must probe. If T1 already uses a justified default and tests lock it, mark T5 done-as-part-of-T1 in progress.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Grok rhai tiles / empty | T2 + T3 |
| Claude js tiles / empty | T2 + T3 |
| Backend-appropriate seed | T1/T5 + T3 DOM |
| No cross-backend listing | T2 pollution tests |
| Non-workflow files ignored | T2 |
| Suite / scope intact | T3 + `npm test` |
| Docs honest | T4 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 | T2 comments, T3 allowlist, T4 docs; prior Grok-only empty plan |
| COEXIST | 1 | flat-md + create-workflow skill featured names |
| LEAVE | 3 | host empty groups; template md; no cross-format transpiler |

## Open assumptions

See `assumptions.md` (Claude invoke, `.ts` extension, home path / `CLAUDE_CONFIG_DIR`).

## Approval

- [x] Human approved — 2026-08-02
