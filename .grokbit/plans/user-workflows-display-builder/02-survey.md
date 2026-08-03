# Survey — User Workflows display + Workflow Builder

Every claim below was confirmed by opening the cited file in this session (or noted as external).

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Grokbit suite display label transform | EXISTS | `media/webview-helpers.js:980-982` — `kind === "grokbit"` + `grokbit-` prefix strip + first-letter capitalize |
| Workflow kind label transform | DOES NOT EXIST | falls through to raw `name` (`:982`) |
| Cyber green name color | EXISTS | `media/chat.css:17-18`, `:2125-2127` — **only** `[data-kind="grokbit"]` |
| Green for workflow kind | DOES NOT EXIST | no `data-kind="workflow"` color rule |
| `data-kind` on capability rows | EXISTS | `media/chat.js:811` |
| Synthetic Create tile | EXISTS | `media/webview-helpers.js:808-849` `withCreateWorkflowTile` — Grok; `name: "create-workflow"`, `invoke: "/create-workflow "` |
| User Workflows empty state | EXISTS | `media/webview-helpers.js:777-796` |
| Mount pipeline | EXISTS | `media/chat.js:1105-1114`, `:1185-1194` |
| Host workflow items | EXISTS | `src/capabilities.ts:569-585` `capabilityFromWorkflowFile` |
| Visible kinds | EXISTS | `media/webview-helpers.js:745` `["grokbit","workflow"]` |
| create-workflow skill (Grok) | EXISTS (CLI home) | `~/.grok/bundled/skills/create-workflow/SKILL.md` — conversational gather → author Rhai → smoke → save `.grok/workflows/` |
| Workflow Builder webview surface | DOES NOT EXIST | no builder panel/overlay in `media/chat.js` / `getHtml` |
| React / React Flow dependency | DOES NOT EXIST | `package.json` scripts are `tsc` + `vsce package` only (`:337-350`); webview is raw `media/*` |
| Webview bundler (esbuild for chat) | DOES NOT EXIST | esbuild appears as transitive lockfile only; no webview bundle script |
| Visual workflow canvas prior art | EXISTS (deferred) | `docs/plans/grokbit-business-studio-3.0.md:300-317` E6 React Flow — **Out of 3.0.0**, **ADR required** before design/implement |
| E6 gate requirements | EXISTS | same doc `:314-317` — ADR: dep cost, webview CSP, test strategy, thin-client coexistence; product approval to open epic |
| ADR location | EXISTS | `docs/adr/` (`0001`–`0003`); next free number **0004** for workflow builder canvas |
| Thin-client boundary | EXISTS | `docs/architecture.md:12-29` — CLI owns tools/runtime; extension owns webview UI state |
| Composer seed helpers | EXISTS | `media/webview-helpers.js` `applyComposerSeed`; `media/chat.js:918` `insertComposerPrompt(item.invoke)` |
| Full-canvas session layout | EXISTS | `docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md` (cited in CLAUDE.md) — no `@media`; builder must fit full tab |
| Prior display polish | EXISTS | suite green/labels already shipped; User Workflows not covered |
| Prior user-workflows-tile | EXISTS | discovery + synthetic create; no builder |
| DOM expects for `create-workflow` label | EXISTS | `test/capabilities.dom.test.ts` multiple asserts |

## Reusable code

- `capabilityGroupsView` / `withCreateWorkflowTile` / `--neon-green*` / `data-kind` — display parity path.
- Popover / overlay patterns in `media/chat.js` (capabilities, docs, session setup) — model for builder chrome (stopPropagation, closePopovers).
- `applyComposerSeed` / `insertComposerPrompt` — craft handoff to agent without auto-send unless product chooses send.
- Host capability refresh (`listCapabilities` / Refresh button) — re-list after save.
- create-workflow skill procedure — authority for what “AI crafts” means on Grok.

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Raw kebab workflow labels | `webview-helpers.js:982` | both mounts | Title Case product |
| Green CSS grokbit-only | `chat.css:2125-2127` | CSS | User Workflows green |
| Create = bare slash seed only | `withCreateWorkflowTile` + row click | Grok create path | Opens Builder instead (or Builder-first with optional advanced seed) |
| Business Studio E6 “out of 3.0 / post only” for this surface | `docs/plans/grokbit-business-studio-3.0.md:300-317` | roadmap text | Product now scopes form wizard + visual canvas into this plan; ADR still required |
| DOM expects display `create-workflow` | `test/capabilities.dom.test.ts` | suite | “Create Workflow” + builder open |

## Prior attempts

- **workflow-display-polish / workflow-title-and-color** — suite only; green + labels live for grokbit.
- **user-workflows-tile** — discovery; create is synthetic tile seed.
- **Business Studio E6** — deferred React Flow; ADR checklist still valid.
- No abandoned Workflow Builder component in repo.

## Conventions

- Pure view-models in `webview-helpers.js`; DOM in `chat.js`; host pure discovery in `capabilities.ts`.
- No React in webview today; adding React Flow is a **stack change**, not a CSS tweak.
- Tests: vitest + happy-dom for real `chat.js`.

## Absences

- Workflow Builder UI, draft graph model, craft-brief builder pure helpers.
- ADR for canvas technology.
- React webview bundle pipeline.
- Claude create-workflow equivalent skill (in extension).

## Danger zones

- Introducing React/React Flow without ADR + CSP/`localResourceRoots` review.
- Builder auto-writing `.rhai` without user confirmation (security / surprise writes).
- Dual mounts (welcome + popover) both need Create → Builder entry consistency.
- `media/chat.js` size/complexity — builder should be modular pure helpers + focused DOM, not one more 500-line inline block if avoidable.
