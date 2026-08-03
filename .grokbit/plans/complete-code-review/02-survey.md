# Survey — Whole-product code review

Every claim below was confirmed by opening the cited file, listing directories, or running the cited command in this session (or the prior plan session for dirty-tree facts re-checked where noted).

**Scope revision:** User rejected WIP-only review; this survey targets the **entire product surface**.

## Entity resolution

### Product identity & entry

| Entity | Status | Location |
|---|---|---|
| Extension entry | EXISTS | `src/extension.ts:1+` — activates, provisions skill suite, wires `GrokSidebar` |
| Host orchestration | EXISTS | `src/sidebar.ts` (module map: panel lifecycle, messages, spawn — `Claude.md:18`) |
| Package identity | EXISTS | `package.json:1-6` — `grokbit`, publisher Grokbit, CalVer `version` |
| Project map / architecture prose | EXISTS | `Claude.md:1-11` module map starts `:13` |
| Known limits (product honesty) | EXISTS | `Claude.md` § Known limits (heading ~line 204) |
| CI | EXISTS | `.github/workflows/ci.yml:1-29` — `npm ci`, `compile`, `test`, `package` on Ubuntu |
| Unit test runner | EXISTS | `package.json` script `"test": "vitest run"` (~line 341) |

### Host modules (`src/`) — complete file list from disk

All listed via `src/*.ts` directory listing this session (40 modules):

| Area | Modules | Status |
|---|---|---|
| ACP | `acp.ts`, `acp-dispatch.ts` | EXISTS |
| Backends / CLI | `backends.ts`, `cli-locator.ts`, `claude-locator.ts` | EXISTS |
| Session/host | `session.ts`, `sessions.ts`, `session-pool.ts`, `session-store.ts`, `session-cwd.ts`, `session-scroll.ts`, `panel-router.ts`, `panel-restore.ts`, `status-bar.ts`, `sidebar.ts`, `extension.ts` | EXISTS |
| Plan mode | `plan-gate.ts`, `plan-restore.ts`, `plan-review.ts`, `grok-primer.ts`, `mode-prefs.ts` | EXISTS |
| Permissions | `permission-bind.ts` | EXISTS — exports `extractGrant`, `consumeWriteGrant`, `consumeTerminalGrant`, `pushGrant` (`src/permission-bind.ts:124+`) |
| Capabilities/skills | `capabilities.ts`, `skill-suite.ts`, `slash-filter.ts`, `mcp-config.ts` | EXISTS |
| Prompt/context | `chips.ts`, `prompt-builder.ts`, `file-ref.ts`, `pending-images.ts`, `agent-handoff.ts` | EXISTS |
| Terminal | `terminal-manager.ts` | EXISTS |
| Workspace | `workspace-docs.ts`, `workspace-file-search.ts` | EXISTS |
| Voice | `voice.ts`, `voice-recorder.ts`, `voice-streamer.ts` | EXISTS |
| Telemetry / env | `telemetry.ts`, `env-filter.ts` | EXISTS |
| Generated metrics | `token-metrics.ts` | EXISTS (generated data module per product docs) |

### Plan-gate pure API (trust)

| Entity | Status | Location |
|---|---|---|
| Workspace write containment | EXISTS | `shouldBlockWrite` `src/plan-gate.ts:242` |
| Terminal allowlist | EXISTS | `shouldBlockTerminal` / `isReadOnlyCommand` `src/plan-gate.ts:228-249` |
| Permission pre-reject | EXISTS | `shouldRejectPermission` `src/plan-gate.ts:254` |

### Webview product UI

| Entity | Status | Location |
|---|---|---|
| Chat webview logic | EXISTS | `media/chat.js` |
| Chat styles | EXISTS | `media/chat.css` |
| Pure helpers (shared tests) | EXISTS | `media/webview-helpers.js` |
| Activity-bar launcher | EXISTS | `media/launcher.js` |
| Workflow Builder (WIP in tree) | EXISTS | `media/chat.js` builder overlay; pure helpers in `webview-helpers.js:990+` |
| User prompt collapse (WIP) | EXISTS | `userPromptShouldCollapse` `media/webview-helpers.js:1532+`; wire `media/chat.js:3308+` |

### Tests

| Entity | Status | Location |
|---|---|---|
| Test tree | EXISTS | `test/` — 70+ `*.ts` files incl. pure + `*.dom.test.ts` + `acp-integration` + fixtures `test/fixtures/fake-grok-acp.cjs` |
| Perf tests (opt-in) | EXISTS | `test/sessions.perf.ts` (out of default suite per product docs) |
| Live real-grok suite | EXISTS | `npm run test:live` / `scripts/live-tests.cjs` (product docs; not CI) |

### Review infrastructure

| Entity | Status | Location |
|---|---|---|
| Code review rubric | EXISTS | `.claude/skills/code-review-rubric/SKILL.md` |
| UI design standards | EXISTS | `.grok/docs/ui-design-standards.md` |
| Accuracy gates | EXISTS | `Agents.md` / `.grok/rules/accuracy-coverage.md` |
| Prior suite multi-dim review | EXISTS | `.grokbit/plans/suite-multi-dimensional-review/` — skill-suite scope only |
| Prior WIP-only plan draft | EXISTS | this slug’s earlier intent/design (superseded by user clarification) |

### Dirty working tree (elevated risk overlay)

Re-confirmed `git status -sb` earlier in session: mixed uncommitted work on `media/*`, tests, docs, metrics, screenshots, plan dirs, `package.json`. **In scope**, not the only scope.

## Reusable code

- **Module map** — `Claude.md:13+` — authoritative product partition for inventory layers.
- **Known limits** — `Claude.md` § Known limits — checklist for DC7 honesty pass.
- **Pure modules with unit tests** — pattern: policy in `src/*` pure, glue in `sidebar.ts`/`acp.ts` — e.g. `plan-gate.ts`, `permission-bind.ts`, `panel-router.ts`, `backends.ts`.
- **Fake ACP fixture** — `test/fixtures/fake-grok-acp.cjs` — integration without real CLI.
- **DOM harness** — `test/webview-harness.ts` + happy-dom tests for webview.
- **Rubric + UI blockers** — as above.
- **Prior findings format** — `suite-multi-dimensional-review/findings.md` if present — format reference only; do not treat as current product verdict.

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| WIP-only complete-code-review intent/design | `.grokbit/plans/complete-code-review/*` (prior revision) | this plan | User: whole product |
| Feature implement “Clean” scope audits as product Approve | `*/implement/05-review.md` | many plan dirs | Scope ≠ product quality |
| suite-multi-dimensional-review as whole-product review | `.grokbit/plans/suite-multi-dimensional-review/` | 0 for full product | Skill-suite only |
| Ad-hoc chat review | none durable | 0 | Replaced by `findings.md` |

## Prior attempts

- WIP-only plan in this slug (rejected by user) — archive mentally; rewritten here.
- `suite-multi-dimensional-review` — skill suite waves; historical.
- Many feature-level implement reviews — not product-wide.

## Conventions

- **Thin client:** session state / MCP / subagents live in CLI — `Claude.md:1-3`.
- **Pure vs impure split:** pure modules unit-tested without `vscode`; host glue in `sidebar.ts` / `acp.ts` / locators.
- **Tests:** grok-free floor in CI (`ci.yml:27-29`); live suite separate.
- **Plan mode:** client-side gate because CLI `exit_plan_mode` unreliable — product docs + `plan-gate.ts`.
- **Dual backend:** `BackendId` / quirks in `backends.ts` (module map `Claude.md:20`).
- **Webview:** no React bundler for main chat; vanilla DOM (`ADR 0004` for builder canvas).

## Absences

- Coverage tool: NONE in project test commands (`Agents.md`).
- Lint tool: NONE.
- `@vscode/test-electron` integration suite: listed under What’s next, not floor.
- MCP server enumeration in capability browser: known limit (docs).
- Escape-to-close on Workflow Builder: still **DOES NOT EXIST** in grep of `media/chat.js` (WIP a11y gap).

## Danger zones (product-wide)

| Zone | Why |
|---|---|
| `src/sidebar.ts` | Central host; large blast radius; hard to unit-test fully |
| `src/acp.ts` | Process spawn, protocol, grants, fs/terminal choke points |
| `src/permission-bind.ts` + `plan-gate.ts` | Security: path/command grants, plan blocking |
| `src/terminal-manager.ts` | `shell:true` children — injection / allowlist reliance |
| `src/capabilities.ts` | Disk scan + symlink containment + attacker-controlled frontmatter names |
| `src/cli-locator.ts` / `claude-locator.ts` | Binary path resolution, Windows pin, npm install of adapter |
| `src/voice-*.ts` | Network STT, ffmpeg, API keys |
| `src/telemetry.ts` | Network POST; must stay content-free |
| `media/chat.js` | Multi-kloc UI; XSS/postMessage; permissions UX; builder WIP |
| `media/launcher.js` | Session delete/clear; full list rebuild perf limit |
| `src/token-metrics.ts` | Generated; must stay no-logic |
| Dirty tree mix | Uncommitted dual features on shared media files |

## Survey shortcuts / caps

- Did not re-read every line of `sidebar.ts` / `acp.ts` / full `chat.js` in Survey — layer tasks must deep-dive trust paths and sample glue with disclosure (DC9).
- Test file count is “70+” from directory listing, not a formal inventory of coverage % (no coverage tool).
- Module map roles cited from `Claude.md`; each module file existence confirmed via `src/` listing.
