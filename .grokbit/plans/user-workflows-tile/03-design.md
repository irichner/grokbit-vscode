# Design — User Workflows for Grok and Claude

## Product principle

**One UI group (“User Workflows”), two native stores.**  
The extension does **not** invent a cross-CLI script format. It discovers and launches whatever **the active tab’s backend** already understands.

| Backend | Disk layout (project + user) | Meta extract | Default seed |
|---|---|---|---|
| Grok | `.grok/workflows/*.rhai` | `let meta = #{ name: "…", description: "…" };` | `/workflow <name> ` |
| Claude | `.claude/workflows/*.js` (default; `.ts` only with evidence) | `export const meta = { name: '…', description: '…', … }` | `/workflow <name> ` or `/<name> ` (confirm in T1/T5) |

Same tile chrome, same group title, same Refresh path — different roots + parsers selected by `session.backend` / `CAPABILITY_ROOTS[backend]`.

## Options

### Option A — Shared `kind: "workflow"` + backend-specific roots/parsers (chosen)

1. Add `"workflow"` to `CapabilityKind`, order **after** `grokbit`, label **"User Workflows"**.
2. Widen `CapabilityRootSpec.kind` with `"workflow"`.
3. Layouts (prefer explicit over one ambiguous multi-ext if clearer in code):
   - `flat-rhai` → only `*.rhai`
   - `flat-workflow-js` → only `*.js` (and `*.ts` if we accept it; implement verifies CLI loads `.ts`)
4. Roots:
   - **Grok:** workspace + home `.grok/workflows`, `flat-rhai`, optional `disabledByEnv: "GROK_WORKFLOWS"`.
   - **Claude:** workspace + home `.claude/workflows`, JS layout. Prefer project-before-home. Nested-dir note from Claude changelog (closest `.claude` wins for *saves*) — for discovery, scan **workspace cwd’s** `.claude/workflows` only (same as skill roots: workspace root, not every nested package). Document as known limit matching skills.
5. Pure parsers + `capabilityFromWorkflowFile({ backend, … })` or two builders sharing name-safety / description cap / invoke builder.
6. **Cross-backend isolation:** Grok roots never scan `.claude/workflows`; Claude roots never scan `.grok/workflows/*.rhai`. No dual-listing of foreign formats.
7. Webview: `CAPABILITY_VISIBLE_KINDS = ["grokbit", "workflow"]`.
8. Empty UX (both backends, both mounts) — pure `userWorkflowsPanelState({ backend, hasWorkflowItems })`:
   - Grok empty → point at `/create-workflow` and `.grok/workflows/*.rhai`
   - Claude empty → point at saving under `.claude/workflows/` / Claude’s workflow authoring (no “Grok only”)
   - Has items → normal tiles only
   - Fix short-circuit so suite-only or empty-suite still allows User Workflows empty block
9. Tests: parsers for both formats (use real meta shapes), scan per backend, no cross-pollution, DOM grok tiles / claude tiles / empties, order assertion update.
10. Docs: CLAUDE.md Known limits — workflows **supported, backend-native**; package.json actionsScope blurb.

**Trade-offs:** + Honest dual product; + reuses capability pipeline; − two parsers; − Claude invoke string needs one implement-time confirmation against ACP.

### Option B — Unified intermediate format in the extension

Author once, emit both Rhai and JS — **out of scope** (non-goal: no transpiler). Rejected for v1.

### Option C — Grok-only discovery + Claude dead-end message

Previous draft. **Rejected** by product direction.

## Decision

**Option A.**

## Disposition

| Item | Disposition | Reason |
|---|---|---|
| Decision 1 “no workflows kind” | **REPLACE** (live comments/docs) | Both CLIs have native saved workflows |
| Prior “Claude Grok-only empty forever” plan text | **REPLACE** | Dual-backend intent |
| `CAPABILITY_VISIBLE_KINDS` | **REPLACE** | include `workflow` |
| flat-md | **COEXIST** | still for agents/commands |
| Host empty-group omission | **LEAVE** | webview empty helper |
| Template `.md` under `.grok/workflows` | **LEAVE** | not Rhai |
| Single cross-CLI script format | **LEAVE** (non-goal) | formats differ by design |

## Unhappy paths

| Case | Behaviour |
|---|---|
| Missing dirs | skip root |
| Wrong extension on a root | ignored by layout filter |
| Foreign format in “wrong” tree (e.g. `.rhai` under `.claude/workflows`) | not scanned by that backend’s layout |
| Bad / missing meta | skip (no decorative invocable tile) |
| Unsafe name | no invoke (path open only if we list — prefer skip for consistency) |
| `GROK_WORKFLOWS=0` | Grok roots off; Claude unaffected |
| Symlink escape | existing containment |
| Nested monorepo `.claude/workflows` deeper than workspace root | not scanned (skills same limit) |

## Blast radius

`src/capabilities.ts`, `media/webview-helpers.js`, `media/chat.js`, tests ×3, light docs. 0 deps.
