# Product surface inventory — Grokbit whole-product review

**Freeze:** 2026-08-02 · HEAD `26bae09` · branch `main...origin/main`  
**Dirty overlay:** yes (media chat/helpers/css, tests, docs, metrics, screenshots, plan dirs, package.json, `$null`)  
**src module count:** **40** (`Get-ChildItem src\*.ts`)

Risk tiers: **critical** (trust/fail-open) · **high** (lifecycle/spawn) · **medium** · **low**

## Layers ↔ modules

### L1 Trust / security — critical

| Path | Role | Risk |
|---|---|---|
| `src/plan-gate.ts` | Client plan-mode write/terminal block | critical |
| `src/permission-bind.ts` | Path/command/content grants after allow | critical |
| `src/terminal-manager.ts` | Headless shell `shell:true` | critical |
| `src/env-filter.ts` | Env scrubbing for spawns | high |
| `src/capabilities.ts` | Disk scan, symlink containment, name validation | critical |
| `src/voice.ts` | STT helpers / API key resolution | high |
| `src/voice-recorder.ts` | ffmpeg batch + STT POST | high |
| `src/voice-streamer.ts` | Live PCM WebSocket STT | high |
| `src/telemetry.ts` | Anonymous Aptabase POST | medium |

### L2 ACP + backends — high

| Path | Role | Risk |
|---|---|---|
| `src/acp.ts` | ACP client spawn + handlers | critical |
| `src/acp-dispatch.ts` | Pure protocol helpers | high |
| `src/backends.ts` | Backend specs / quirks | high |
| `src/cli-locator.ts` | grok binary + Windows pin | high |
| `src/claude-locator.ts` | Claude ACP adapter locate/install | high |

### L3 Session / host lifecycle — high

| Path | Role | Risk |
|---|---|---|
| `src/extension.ts` | activate, suite provision | high |
| `src/sidebar.ts` | Host orchestration (large) | critical |
| `src/session.ts` | Session state bag | medium |
| `src/sessions.ts` | Disk list/delete/titles/primer empty | high |
| `src/session-pool.ts` | Dot policy / empty recycle helpers | medium |
| `src/session-store.ts` | Merged grok+Claude history pagination | high |
| `src/session-cwd.ts` | cwd encoding helpers | low |
| `src/session-scroll.ts` | Scroll restore policy | low |
| `src/panel-router.ts` | ready/buffer/replay/broadcast | high |
| `src/panel-restore.ts` | Panel serializer restore | medium |
| `src/status-bar.ts` | Status bar HUD pure | low |

### L4 Plan mode — high

| Path | Role | Risk |
|---|---|---|
| `src/grok-primer.ts` | Hidden plan primer v4 | high |
| `src/plan-restore.ts` | Persist + restore decision | high |
| `src/plan-review.ts` | Plan snapshot filename | low |
| `src/mode-prefs.ts` | Remembered non-plan mode | medium |

### L5 Capabilities / skills — medium–high

| Path | Role | Risk |
|---|---|---|
| `src/skill-suite.ts` | Suite provision policy | medium |
| `src/mcp-config.ts` | MCP config read (if any) | medium |
| `src/slash-filter.ts` | Slash autocomplete filter | low |
| `src/capabilities.ts` | (also L1) discovery merge | critical |

### L6 Webview UI — high (+ WIP elevated)

| Path | Role | Risk |
|---|---|---|
| `media/chat.js` | Session webview | critical |
| `media/chat.css` | Chat styles | medium |
| `media/webview-helpers.js` | Pure helpers shared with tests | high |
| `media/launcher.js` | Activity-bar launcher | high |

### L7 Peripheral + generated — medium–low

| Path | Role | Risk |
|---|---|---|
| `src/chips.ts` | File chips pure | medium |
| `src/prompt-builder.ts` | Chip → prompt envelope | high |
| `src/file-ref.ts` | path#L refs + large-file guard | medium |
| `src/pending-images.ts` | Paste image pending state | medium |
| `src/agent-handoff.ts` | Agent switch handoff | medium |
| `src/workspace-docs.ts` | Docs browser listing | medium |
| `src/workspace-file-search.ts` | @-file search host | medium |
| `src/token-metrics.ts` | Generated dev-token constants | low (integrity) |

## Ownership check — all 40 src modules

acp-dispatch, acp, agent-handoff, backends, capabilities, chips, claude-locator, cli-locator, env-filter, extension, file-ref, grok-primer, mcp-config, mode-prefs, panel-restore, panel-router, pending-images, permission-bind, plan-gate, plan-restore, plan-review, prompt-builder, session-cwd, session-pool, session-scroll, session-store, session, sessions, sidebar, skill-suite, slash-filter, status-bar, telemetry, terminal-manager, token-metrics, voice-recorder, voice-streamer, voice, workspace-docs, workspace-file-search.

**Unowned: none.**

## Test / CI floor

| Path | Role | Layer |
|---|---|---|
| `package.json` scripts `test` / `compile` | vitest + tsc | L7 |
| `.github/workflows/ci.yml` | npm ci, compile, test, package | L7 |
| `test/**/*.ts` (70+) | pure + DOM + fake-ACP | L7 |
| `test/fixtures/fake-grok-acp.cjs` | ACP integration without real CLI | L7 |
| `scripts/live-tests.cjs` | real grok (out of CI) | L7 optional |

## Dirty-tree overlay (elevated)

| Path | Map |
|---|---|
| `media/chat.js`, `chat.css`, `webview-helpers.js` | L6 WIP (collapse + workflow builder) |
| `test/user-prompt-collapse.dom.test.ts`, capabilities/helpers tests | L6/L7 |
| `docs/adr/0004-*.md`, README/CLAUDE, business studio plan | docs honesty |
| `docs/metrics/*`, `src/token-metrics.ts` | L7 generated |
| screenshots D/?? | residual |
| `package.json` | version |
| `$null` | noise |
| `.grokbit/plans/*` | plan artifacts (not product runtime) |

## Media product assets (non-src)

| Path | Layer |
|---|---|
| `media/chat.js` | L6 |
| `media/chat.css` | L6 |
| `media/webview-helpers.js` | L6 |
| `media/launcher.js` | L6 |
| `resources/skills/**` (bundled suite) | L5 provision source |

## Exceptions

None — inventory claims full `src/*.ts` ownership (40/40).
