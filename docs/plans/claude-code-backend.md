# Claude Code as a second agent backend (per-tab Grok ⇄ Claude toggle)

| Field | Value |
|-------|--------|
| **Status** | Implemented (2026-07-28) — WP1–WP7 shipped; `npm test` 1029 green, `tsc` clean, `test:perf` 4/4. Not committed, not released. `npm run test:live` for the Claude backend is still outstanding |
| **Owner** | Lead (Grokbit) |
| **Date** | 2026-07-27 |
| **Decision (transport)** | ACP adapter — `@zed-industries/claude-code-acp` over the official Claude Agent SDK |
| **Decision (scope)** | Full parity with Grok tabs (history, resume, rename/delete, dots, restore) |
| **Decision (toggle)** | Per tab; flipping tears down the current agent and starts a fresh session of the other backend in the same tab |
| **Decision (default)** | Grok Build remains the default backend for every new tab |
| **Decision (tab title)** | Settings-prefix — `Sonnet·hi — Fix login bug` (survives tab truncation) |
| **Decision (settings UI)** | Setup card on the new-tab welcome screen + the same controls behind the composer chip |

## Goal

A Grokbit session tab can be driven by **either** xAI's Grok Build CLI **or** Anthropic's Claude Code, chosen per tab. Everything the chat surface already does — streaming, tool rows, permission cards with inline diffs, plan review, slash autocomplete, model + mode pickers, history/resume, status dots, the status-bar HUD — works identically for both.

**Success looks like:** the user clicks *New Claude session* in the launcher, gets a normal Grokbit tab that runs real Claude Code (its skills, subagents, hooks, MCP servers, memory, and *genuinely enforced* plan mode), sees permission cards for edits, closes the tab, reopens it from history with full replay — and a Grok tab open beside it is unaffected.

## Why the ACP adapter (verified, not assumed)

`@zed-industries/claude-code-acp` v0.16.2 (Apache-2.0, Zed-maintained, wraps `@anthropic-ai/claude-agent-sdk`) speaks the **same wire methods `src/acp.ts` already sends**. Verified by reading the published `dist/`:

| Surface | Adapter behaviour | What it means for us |
|---|---|---|
| `initialize` | Reads `clientCapabilities`; offers an `authMethod` ("Run `claude /login`") | Our handshake works as-is; auth maps to the existing signed-out launcher state |
| `session/new`, `session/load` | `loadSession` finds `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` and **replays history** as session updates | Resume + replay work like grok's |
| `session/prompt`, `session/cancel` | Standard | Unchanged |
| `session/set_mode` | `default` / `acceptEdits` / `plan` / `dontAsk` / `bypassPermissions` | Maps onto the existing picker |
| `session/set_model` | `unstable_setSessionModel` → `query.setModel`; model list returned from `session/new` | Model picker works |
| `session/request_permission` | Emitted for tool calls; exit-plan-mode is a permission request with *Yes/keep planning* options | Permission cards + inline diffs work |
| `fs/read_text_file`, `fs/write_text_file` | Routed to **the client** when we advertise `fs.readTextFile`/`fs.writeTextFile` (we do) | Read/Write/Edit go through our fs handlers |
| `terminal/*` | Routed to **the client** when we advertise `terminal: true` (we do) | Bash goes through our `TerminalManager` |
| `available_commands_update` | Sent after session start and after replay | Slash autocomplete works |
| `sessionUpdate: "plan"` | TODO/plan entries | Plan surface works |

The alternative — driving `claude -p --input-format stream-json` directly — was rejected because **`--permission-prompt-tool` no longer exists in Claude Code 2.1.220**; per-tool approval is only reachable through the Agent SDK's `canUseTool` control channel, which is undocumented on the wire. Going native would mean either reverse-engineering that channel or shipping Claude tabs with no permission cards.

## Non-goals

- **Not** replacing Grok. Grok stays the default backend; every existing Grok behaviour is untouched.
- **Not** porting grok-only surfaces to Claude: the hidden plan-mode primer, the client-side plan gate, the Windows `agent stdio` version pin (#22), the empty-primer-session sweep (#24), `x.ai/ask_user_question`, `x.ai/exit_plan_mode`, and `/imagine` media generation are **grok-specific and must be gated off** for Claude sessions.
- **Not** carrying conversation history across a backend flip (different agents, different session stores).
- **Not** a unified model list — each backend shows its own models.
- **Not** Claude-specific chat chrome (thinking-budget UI, cost display, `/cost`).
- **Not** shipping our own Claude auth — we use the user's existing Claude Code login.
- **Not** a Marketplace version bump or release (user-initiated).

## Assumptions — probe results (2026-07-27)

The two make-or-break assumptions were probed **before** planning the work in detail. Both passed against real Claude Code (adapter 0.16.2, Claude Code 2.1.220, VS Code Electron on Windows 11).

| # | Assumption | Result |
|---|---|---|
| P1 | The adapter runs from the extension host with **no system Node** — `process.execPath` (Electron) + `ELECTRON_RUN_AS_NODE=1` on `dist/index.js`, and its grandchild `claude` process survives | ✅ **PASS.** Full turn end-to-end under `Code.exe`: `initialize` → `session/new` → streamed `agent_message_chunk` → `stopReason: end_turn` in ~7 s. Identical result under plain node |
| P2 | Our `protocolVersion: 1` handshake is accepted | ✅ **PASS.** Adapter replies `protocolVersion: 1`, `loadSession: true`, `sessionCapabilities: {fork, list, resume}` |
| P3 | Write/Edit arrive as `fs/write_text_file` **on the client** | ✅ **PASS.** Both Write and Edit round-tripped through the client handler; file landed on disk with our writer |
| P4 | Bash arrives as `terminal/create` **on the client** | ✅ **PASS.** Command routed to the client, output returned through `terminal/output` |
| P5 | `session/load` replay reconstructs the transcript | ✅ **PASS.** `claude-acp-resume-probe.cjs`: all 4 user/assistant turns replay verbatim, all 5 tool calls replay with `kind` intact (`edit`/`read`/`execute`) + completed results/diffs; no weaker than grok's replay. No token/usage meta on the wire (matches grok), but a real on-disk `message.usage` per-turn source exists in the `.jsonl` — see research/claude-code-backend.md § Resume |
| P6 | Claude session titles derivable from the `.jsonl` without a full read | ⏳ Probe in WP4 |
| P7 | `CLAUDE_CODE_EXECUTABLE` can point the SDK at a **native** `claude` install | ⏳ Probe in WP1. Non-blocking — opt-in setting only |

### Verified wire findings (drive the implementation)

- **Modes:** `default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions`.
- **Models:** `default`, `sonnet`, `haiku`, `opus[1m]` — returned from `session/new`, so the existing picker works. Note `opus[1m]` contains brackets; the model-label helpers must not assume `[a-z-]` ids.
- **Slash commands:** `available_commands_update` fires ~1 ms after `session/new` (13 commands).
- **Tool kinds:** `edit`, `read`, `execute` — exactly the ACP kinds `categorize` / `summarizeTools` / `toolIconFor` already handle. No webview changes needed for tool rows.
- **Permission options:** `allow_always:allow_always`, `allow:allow_once`, `reject:reject_once` — the option *kinds* match what the permission card already renders, but the **`optionId`s differ from grok's**. The card must key off `kind`, not `optionId` (verify current code does).
- **⚠ `toolCall.kind` is absent on `session/request_permission`.** The preceding `tool_call` update carries `kind: "edit"`, but the permission payload has only `{toolCallId, title, rawInput}`. The extension decides whether to render the inline diff from `toolCall.kind === "edit"`, so for Claude it must instead **correlate by `toolCallId`** with the already-seen `tool_call` (or infer from `rawInput` keys: `file_path`+`content` = Write, `file_path`+`old_string`+`new_string` = Edit). This is the single most likely source of a "no diff shown" bug.
- **Diffs are real:** the completed `tool_call_update` carries structured diff hunks (`{oldStart, oldLines, newStart, newLines, lines:["-hello","+goodbye"]}`), so inline diffs and the changed-files strip get genuine data.
- **⚠ `CLAUDECODE` must be unset when spawning.** Claude Code refuses to launch inside another Claude Code session (*"Nested sessions share runtime resources and will crash all active sessions"*). The extension must strip `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, and `CLAUDE_CODE_SSE_PORT` from the spawn env — otherwise Grokbit fails for anyone who launched VS Code from a Claude Code terminal. Caught only because the probe hit it.

### Authentication — subscription, same as Grok (✅ verified)

**Requirement:** users sign in with their Claude subscription, exactly as Grok tabs use the user's `grok` CLI login. No API key, no separate billing.

**This already works with zero extra code.** The P1–P4 probes ran real Claude turns with **no `ANTHROPIC_*` env vars set at all** (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_BASE_URL` all unset). Auth came from the user's existing Claude Code OAuth login in `~/.claude/.credentials.json` (`claudeAiOauth`: `subscriptionType: "max"`, `rateLimitTier: "default_claude_max_5x"`, scopes incl. `user:inference` + `user:sessions:claude_code`).

Crucially the probe used the **SDK-bundled** Claude Code (`CLAUDE_CODE_EXECUTABLE` was never set), which proves the bundled copy reads the *same* credential store as the user's native install — so a single `claude auth login` covers both, and provisioning the adapter never asks the user to log in again.

| Concern | Resolution |
|---|---|
| Sign-in | `claude auth login` (interactive) — run in a VS Code terminal, mirroring the existing grok login affordance |
| Sign-out | `claude auth logout` — mirrors `grok logout` in the existing `logout()` flow; must tear down Claude sessions the same way |
| Signed-in detection | `claude auth status --json` → `{loggedIn, authMethod, apiProvider, email, orgName, subscriptionType}`. Cleaner than grok's inferred state; feeds the launcher's signed-out card and can show the active account + plan |
| Token expiry | `refreshToken` is present and the SDK refreshes automatically — no work for us |
| Adapter's own auth error | `session/new` throws `RequestError.authRequired()` when the credential store is missing; map that to the signed-out state rather than a generic failure |

**Two things the implementation must not do:**

1. **Never pass `--bare`.** Per the CLI's own help, `--bare` makes Anthropic auth "strictly `ANTHROPIC_API_KEY` or `apiKeyHelper`" and **OAuth and keychain are never read** — it would break subscription auth outright.
2. **Never inject `ANTHROPIC_API_KEY` into the spawn env.** If a user happens to have one exported, Claude Code may use it and bill **API credits instead of their subscription**. Since `claude auth status --json` reports `authMethod` / `apiProvider`, the setup card should surface which credential is actually in use so an unexpected API-key charge is never silent. (Decide in WP1 whether to strip an inherited `ANTHROPIC_API_KEY` by default — leaning yes, with a setting to opt back in for API-key users.)

**Known encoding gotcha.** Claude encodes the project dir as `<cwd with every non-alphanumeric → '-'>`, preserving the original case: `C:\Users\israe\Projects\Grokbit.ai` → `c--Users-israe-Projects-Grokbit-ai`. Observed on this machine: the same user has both `C--Users-israe` and `c--Users-israe-...` directories, i.e. **drive-letter case follows whatever string the cwd was given as**. Directory matching must be case-insensitive on Windows or history silently comes back empty.

## Architecture

One new pure module plus one new store interface; the rest is gating.

### 1. `src/backends.ts` (new, pure)

A descriptor per backend — the single place that knows how the two agents differ.

```ts
export type BackendId = "grok" | "claude";

export interface BackendSpec {
  id: BackendId;
  label: string;              // "Grok Build" | "Claude Code"
  /** Mode ids this agent uses for the three picker entries. */
  modes: { agent: string; plan: string };   // grok: default/plan · claude: default/plan
  quirks: {
    planPrimer: boolean;        // grok only — src/grok-primer.ts
    clientPlanGate: boolean;    // grok only — src/plan-gate.ts (Claude enforces plan mode for real)
    windowsVersionPin: boolean; // grok only — #22
    emptyPrimerSweep: boolean;  // grok only — #24
    mediaGen: boolean;          // grok only — /imagine
    xaiRequests: boolean;       // grok only — x.ai/ask_user_question, x.ai/exit_plan_mode
  };
}
```

Auto-accept ("YOLO") stays **client-side** for both — it is already a local auto-answer of permission requests (`session.autoApprove`), not an ACP mode, so it needs no per-backend mapping. (Mapping it to Claude's `acceptEdits` would save a round-trip; deliberately not doing that in v1 to keep one code path.)

### 2. `src/session-store.ts` (new) + `src/sessions.ts` refactor

`sessions.ts` is hardcoded to grok's layout (`~/.grok/sessions/<urlencoded-cwd>/<id>/summary.json`, a directory per session). Claude uses a **flat file** per session. Extract the layout-dependent parts behind:

```ts
export interface SessionStore {
  backend: BackendId;
  index(cwd): SessionIndexEntry[];              // cheap stat-only, newest-first by mtime
  readEntries(ids): SessionListEntry[];         // parse only the visible page
  remove(id): void;
  readTokenUsage(id): number | undefined;
}
```

- `GrokSessionStore` — today's code, moved, behaviour-identical.
- `ClaudeSessionStore` — `~/.claude/projects/<encoded-cwd>/*.jsonl`; mtime for ordering (same proxy trick, same reason: the uuid is not a timestamp we can trust for *last activity*); title from the jsonl's `summary` record or first user message (P6).

The existing mtime-keyed read cache, pagination (`SESSION_PAGE_SIZE`), and server-side search in `buildSessionsMessage` operate over the **merged** result of both stores, sorted by mtime. Each row carries `backend` so the launcher and history popover can badge it and so opening a row starts the right agent.

### 3. `src/acp.ts` — spawn parameterisation only

`AcpClient` gains `argv: string[]` / `command: string` in its options instead of building grok's args internally, and its two grok-specific behaviours become opt-in flags: the plan gate (`planActive` checks) and the media-gen tracking. **No protocol changes** — that is the whole point of choosing the adapter.

### 4. `src/sidebar.ts` — `startSession` branches once

`startSession` is the single choke point (line ~1701). It reads `session.backend`, resolves the right binary/argv, and gates the grok-only steps (`maybePinBrokenCli`, `ensurePrimed`, `sweepEmptyPrimerSessions`, plan-gate arming) on `spec.quirks`.

## UI: per-tab settings

Three connected pieces. Grok stays the default backend for every new tab.

### ⚠ Prerequisite: effort is global today, and must become per-session

`setEffort` (sidebar.ts ~2360) writes `grok.defaultEffort` with `ConfigurationTarget.Global` and restarts. So **effort is a global setting, not a per-tab one** — changing it in one tab changes it for every future tab. `computeStatusBar` reads the same global config, and CLAUDE.md documents it as authoritative. Per-tab model+effort in the tab title is therefore *not* a display change; it requires making effort real per-session state:

- `Session.effort`, seeded from `grok.defaultEffort` (which becomes the **default for new tabs**, not the live value).
- `buildGrokAgentArgs` reads `session.effort` instead of the config at spawn.
- `computeStatusBar` takes effort as a parameter rather than reading config.
- The gear/setup control writes `session.effort` and restarts *that* session only; a separate "remember as default" affordance updates the global.

**Effort means different things per backend, but behaves identically.** Grok takes `--reasoning-effort <none|minimal|low|medium|high|xhigh>` as a spawn flag. The Claude adapter has **no effort concept at all** — verified: its only thinking knob is `MAX_THINKING_TOKENS`, read from env at spawn. So the same effort dots map to a per-backend spawn input (grok: CLI flag; Claude: token budget), and in both cases changing it restarts the session — which is already the existing UX. The dot *count* and labels come from the backend descriptor, since grok has no `max` and Claude has no `none`/`minimal`.

### Tab titles — settings prefix

Chosen format: `Sonnet·hi — Fix login bug`. VS Code truncates tab titles from the end, so a prefix keeps the settings readable at any tab width; the session name is what degrades.

- New pure helper alongside `tabTitleFor` in `sessions.ts`: takes `{name, model, effort, maxLen}` and returns the composed title. Unnamed sessions render `Grok·med — New`.
- Needs pure `shortModelName` (`grok-build` → `Grok`, `opus[1m]` → `Opus`, `sonnet` → `Sonnet`) and a shared `shortEffort` — the latter already exists in `chat.js` but must move to `webview-helpers.js` so host and webview share one implementation rather than drifting.
- Refresh points: the four existing `tabTitleFor` call sites (sidebar.ts 379, 403, 494, 3624) **plus** `modelChanged` and the new per-session effort change — today neither touches the title.
- Full model name + effort go in the tab tooltip.

### New-tab setup card

A `Session setup` card on the welcome screen: **Agent** (segmented Grok / Claude), **Model** (dropdown), **Thinking** (the existing `.effort-dots` idiom), **Mode** (segmented Agent / Plan / Auto-accept). It sits above `welcome-starters` and disappears with the rest of the welcome screen on first send (`clearWelcome`).

This placement is deliberate: model/effort changes normally force a session restart, but a new tab has no history, so the existing transparent-restart path (`discardRestartedEmptySession` + `carrySessionName`) applies and the change is **free and invisible**. The card's footer says so.

### Composer chip → quick-settings popover

`#model-label` currently opens the gear's model/effort section. It becomes a compact popover with the *same four controls*, rendered by the **same builder** as the setup card so there is one implementation and one set of tests. Mid-session changes keep today's semantics (restart, with the summarize-vs-restart prompt when there's history).

**Visual language:** follow `.grok/docs/ui-design-standards.md` and VS Code theme tokens throughout — no hardcoded colors, so light/dark/high-contrast all work. Reuse `.effort-dots`, `.popover-*`, and `.welcome-*` styles rather than inventing parallel ones.

## Work packages

Sized so each is one implementation dispatch and ends green.

### WP1 — Adapter provisioning + spawn plumbing
P1–P4 probes are **done and passing** (see above); land them as `research/claude-acp-*.cjs`.

**Packaging decision (measured, not estimated).** The registry's `unpackedSize` badly understates the real install: `npm i @zed-industries/claude-code-acp` pulls **120 MB** — 61 MB of vendored ripgrep (six platform builds), 11 MB `cli.js`, 19 MB platform `sharp`. Pruning to one platform still leaves ~70 MB. Bundling that in the vsix would inflate every Grok-only user's install by two orders of magnitude, so **do not bundle**.

Instead, treat the adapter exactly like the grok CLI already is — an external prerequisite the extension locates and offers to install:

- `src/claude-locator.ts` resolves the adapter entry in order: configured path → extension-managed install under `context.globalStorageUri` → globally installed npm package → `PATH`.
- Missing ⇒ reuse the existing `missing-cli` onboarding pattern with a Claude-flavoured card and a one-click **Install** that runs `npm i --prefix <globalStorage> @zed-industries/claude-code-acp@<pinned>`. Downloaded once, per machine, never in the vsix.
- Spawn host: `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (P1-verified), so no system Node is needed to *run* it. (npm is needed once, to *install* it.)
- **Strip `CLAUDECODE` / `CLAUDE_CODE_ENTRYPOINT` / `CLAUDE_CODE_SSE_PORT`** from the spawn env — see the nested-session finding above.
- Optional `grok.claude.executablePath` setting → `CLAUDE_CODE_EXECUTABLE` for users who want their own Claude Code install driven instead of the SDK's bundled copy (P7).

**Auth wiring (subscription, verified above).** Env builder strips `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT`/`CLAUDE_CODE_SSE_PORT`, never passes `--bare`, and never injects `ANTHROPIC_API_KEY`. Signed-in state comes from `claude auth status --json`; the signed-out card offers **Sign in** (`claude auth login` in a terminal), and the existing `logout()` gains a Claude branch (`claude auth logout`). Surface the active account + plan (`email`, `subscriptionType`) so it's clear the subscription — not API credits — is being billed.

**Done when:** the extension spawns the adapter through the locator and completes a real turn **on subscription auth with no API key**; a signed-out user is offered sign-in and recovers without restarting VS Code; vsix size is unchanged.

### WP2 — `src/backends.ts` + `AcpClient` parameterisation
**Status:** Shipped (2026-07-27).

Add the descriptor; move argv construction out of `AcpClient`; put the grok-only client behaviours behind flags. Grok path stays byte-identical.
**Done when:** `npm test` green with zero behaviour change; unit tests cover the descriptor and argv building for both backends.

- [x] `src/backends.ts` (new, pure): `BackendId`, `BackendSpec`, `BackendQuirks`, the `GROK_BACKEND`/`CLAUDE_BACKEND` descriptors (grok's six quirks all `true`, Claude's all `false`), a `BACKENDS` lookup + `backendSpec(id)`, and per-backend `effortLevels` (`GROK_EFFORT_LEVELS` — the six CLI-accepted values — vs. an empty `CLAUDE_EFFORT_LEVELS`, since Claude has no `--reasoning-effort`-shaped flag at all).
- [x] `buildGrokAgentArgs` moved into `src/backends.ts`; `src/acp.ts` re-exports it (and the `EffortLevel` type) unchanged for existing importers (`session.ts`, `sidebar.ts`, `test/acp.test.ts`).
- [x] `AcpClientOptions` takes `command`/`args` from the caller instead of `cliPath`/`effort` and building argv internally; the win32 `.cmd`/`.bat` `shell:true` check (CVE-2024-27980) now keys off `command`, so it doesn't misfire for the Claude adapter's plain Node/Electron command.
- [x] The plan gate (`shouldBlockWrite`/`shouldBlockTerminal` in the `fs/write_text_file`/`terminal/create` handlers, plus the `resolveGrokHome` lookup) and the media-gen tracking (`mediaGenCallIds`/`isMediaGenToolCall`/`extractGeneratedMediaPaths` in `emitToolMedia`) are gated behind `opts.quirks.clientPlanGate` / `opts.quirks.mediaGen`, both structurally inert when their flag is off regardless of `planActive`.
- [x] `sidebar.ts`'s single `new AcpClient({…})` construction site (in `startSession`) updated to build args via `buildGrokAgentArgs(session.effort)` and pass `GROK_BACKEND.quirks`; grok behaviour unchanged (still the only backend wired up — branching on `session.backend` is WP3).
- [x] Tests: `test/backends.test.ts` (new — descriptor quirks for both backends, effort level sets, `buildGrokAgentArgs` placement/values); `test/acp.test.ts` extended with an `emitToolMedia` gating suite proving the media-gen path is inert when `quirks.mediaGen` is `false`; `test/acp-integration.test.ts` extended with a real-subprocess case proving the plan gate never blocks a workspace write or a mutating command when `quirks.clientPlanGate` is `false`, even with `planActive` forced `true` — and its existing construction sites adapted to the new options shape (no assertion changed meaning). `npm test`: 893 tests / 47 files, up from the 877-test baseline.

### WP3 — `startSession` branch + per-tab toggle UI
**Status:** Shipped (2026-07-27).

`Session.backend`; branch in `startSession`; gate the grok-only steps. UI: a backend chip in the composer toolbar beside the existing model chip; launcher *New* becomes a split (New Grok / New Claude); `grok.defaultBackend` setting. Flipping the chip restarts the tab's session on the other backend, with a modal confirm when the tab has real history. Status-bar HUD (`computeStatusBar`) shows the backend.
**Done when:** both backends run in separate tabs simultaneously; DOM tests cover the chip and the confirm; `computeStatusBar` tests cover the new field.

- [x] `Session.backend: BackendId` (`src/session.ts`), defaulting to `"grok"` — grok stays the default for every new tab.
- [x] `startSession` branches spawn resolution on `session.backend`: grok keeps `locateGrokCli`/`buildGrokAgentArgs`/`this.buildEnv`; Claude resolves through `locateClaudeAdapter` (search roots: configured `grok.claude.adapterPath` → the extension-managed install dir under `context.globalStorageUri` → `defaultClaudeAdapterSearchRoots()`), spawns `process.execPath` + `buildClaudeAdapterArgv(entry)`, and builds its env via `buildClaudeAdapterEnv({baseEnv: this.buildEnv(cwd), claudeExecutablePath, allowInheritedApiKey})`. `AcpClient` is constructed once, after the branch, with `quirks: backendSpec(session.backend).quirks`.
- [x] Every grok-only quirk gated: `windowsVersionPin` — `maybePinBrokenCli`/the reactive-downgrade retry only run inside the grok branch (`spec.quirks.windowsVersionPin`); `planPrimer` — `ensurePrimed` itself no-ops (marks `primed=true` and resolves immediately) when `!backendSpec(session.backend).quirks.planPrimer`, covering every call site (`startSession`, `restartSession`, `executeUserSend`, `handleExitPlan`'s afterTurn — the last of which is grok-only reachable anyway since it's only wired off grok's `x.ai/exit_plan_mode`) in one place instead of scattering the check; `clientPlanGate` — the plan-mode pre-emptive permission decline in the `permissionRequest` handler is gated on `spec.quirks.clientPlanGate` (the fs/terminal blocking itself was already gated in `acp.ts` by WP2); `emptyPrimerSweep` — the `sweepEmptyPrimerSessions()` call site and `onPanelClosed`'s `emptyPrimerOnly` recycle-on-close condition are both gated on `spec.quirks.emptyPrimerSweep`; `mediaGen`/`xaiRequests` — already gated in `acp.ts` (WP2) / naturally inert for Claude (the wire methods are grok-specific extensions Claude's adapter never sends).
- [x] Missing-adapter (`onboarding` state `"missing-claude-adapter"`) and signed-out (`"claude-auth-required"`) onboarding cards, mirroring the existing missing-CLI/auth-required pattern in both the chat panel (`media/chat.js`) and the launcher (`media/launcher.js`); a one-click **Install** (`installClaudeAdapterOnDemand` → `vscode.window.withProgress` + the pinned `installClaudeAdapter`, whose honest downside is documented in-UI: it's a synchronous ~120 MB npm install, so VS Code is briefly unresponsive — `installClaudeAdapter` is off-limits to change, so this can't be backgrounded without a larger refactor) and **Sign in** (`claude auth login` in a VS Code terminal, mirroring `runGrokLogin`). Both onboarding messages carry `backend` so **Re-check connection** reopens on the SAME backend that failed (`recheckConnection`/`newSession` now take an optional `backend`); grok's cards omit it and fall back to `grok.defaultBackend`. Once a Claude session starts, `refreshClaudeAccount` best-effort runs `claude auth status --json` and surfaces the signed-in email + plan in the composer chip's tooltip (and the Output channel) so it's evident the subscription — not an inherited API key — is billed.
- [x] Composer backend chip (`#backend-label`, beside `#model-label`) opens a small popover offering the other backend; picking it posts `switchBackend`, which `GrokSidebar.switchBackend` handles: a tab with real history gets a modal `vscode.window.showWarningMessage` confirm (mirrors `pickRestartMode`'s existing precedent — host-native, not webview-rendered, so it isn't itself unit-testable, consistent with how the effort/model restart confirms already aren't), an empty/primer-only tab restarts transparently and its abandoned pre-flip session is discarded from its OWN backend's store (`discardAbandonedBackendSession`, a backend-aware sibling of the existing `discardRestartedEmptySession`). Launcher **New** is a split button (`#launcher-new` primary + `#launcher-new-caret` → `#launcher-new-menu`): the primary click keeps today's one-click UX (host resolves `grok.defaultBackend`), the caret always offers both backends explicitly regardless of the default.
- [x] `grok.defaultBackend` (enum `grok`/`claude`, default `grok`), `grok.claude.executablePath`, `grok.claude.adapterPath`, `grok.claude.allowInheritedApiKey` declared in `package.json` `contributes.configuration`.
- [x] `computeStatusBar` takes `backend?: BackendId` (`src/status-bar.ts`, still pure — `backends.ts` has no `vscode` import either): grok stays the quiet default (undefined behaves exactly like grok, so every existing call site/test is unaffected); Claude gets an explicit `"Claude"` segment + a `Backend: Claude Code` tooltip line, and the whole `Effort:` tooltip line (not just the text segment) is omitted for Claude rather than showing a meaningless "Effort: CLI default".
- [x] Effort is grok-only end to end: `CLAUDE_EFFORT_LEVELS` was already empty (WP2); the composer chip already omitted the segment by construction (`state.effort` is always `""` for Claude); the gear popover's effort-dots row is now conditionally rendered (`state.backend !== "claude"`) instead of always rendering; `setEffort`'s webview handler no-ops for a backend with `effortLevels.length === 0` as a defensive backstop.
- [x] Permission-diff correlation fix (`media/webview-helpers.js`, pure): `inferPermissionKind(explicitKind, seenKind, rawInput)` resolves the missing `toolCall.kind` on Claude's `session/request_permission` payload — the payload's own kind (grok) → a kind already seen for this toolCallId (`item.dataset.toolKind`, newly stamped by `addToToolGroup` alongside the existing `toolCategory`) → inferred from `rawInput` shape as a last resort. `permissionDiffFromRawInput(rawInput, kind)` synthesizes a preview diff when no structured ACP diff content has arrived yet for this toolCallId (Claude's real diff hunks land on the COMPLETED `tool_call_update`, which is AFTER approval) — Edit's `old_string`/`new_string` is a genuine before/after rendered through the same `computeLineDiff`; Write previews as an all-added file (no "before" available client-side). Verified the option-`kind` keying (`permissionButtonLabel`, the primary/danger button classes, `collapsePermissionCard`) was already correct — Claude's differing `optionId`s (`allow_always`/`allow`/`reject`) never mattered because nothing keyed off `optionId` for anything but the wire reply.
- [x] Tests: `test/webview-helpers.test.ts` (+12 — `inferPermissionKind`, `permissionDiffFromRawInput`); `test/permission-card.dom.test.ts` (+3 — Claude-shaped payload with a preceding `tool_call`, with no preceding call at all (rawInput-only inference), and Claude's differing optionIds); `test/status-bar.test.ts` (+6 — backend field, incl. the omitted-effort-line case); `test/backend-chip.dom.test.ts` (new, 8 — chip render/hidden, account tooltip, popover flip + `switchBackend`, busy-lock, gear effort-dots omitted for Claude); `test/launcher.dom.test.ts` (+8 — split-New primary/caret/menu, both Claude onboarding cards with backend-tagged recheck); `test/webview-ui.dom.test.ts` (+3 — the same two Claude onboarding cards in the chat panel). `npm test`: 975 tests / 49 files, up from the 938-test baseline at dispatch; `npm run test:perf` still 4/4.

**Deviation from this description / left out:** `sidebar.ts`'s impure orchestration (the quirk-gated branches inside `startSession`/`ensurePrimed`/`onPanelClosed` themselves) has no direct unit-test harness — consistent with the rest of this codebase, where `sidebar.ts` is never unit-tested against a `vscode` mock (no such mock exists in this suite) and impure orchestration is verified by type-check + code review + the mandatory pre-release `npm run test:live` gate, not `npm test`. The quirk *values* themselves are locked by `backends.test.ts` (WP2, unchanged here). `Session.claudeAccount` and the `backendChanged` webview message are a small addition beyond the plan's literal architecture section, added to satisfy the "surface the active account and plan" requirement from § Authentication without inventing a new card. `logout()` was intentionally left grok-only (no `claude auth logout` branch) — the plan's WP1 description mentions it, but WP3's own deliverable list only asked for Claude **sign-in** onboarding, and grok's existing "Log out" gear item now sits inside a Claude tab's gear menu too (unchanged wording) — flagged here as a known small UX inconsistency, not fixed in this package. `defaultClaudeAdapterSearchRoots()` (which spawns `npm root -g`) runs on every Claude session start rather than only when the managed-install fast path misses, since `locateClaudeAdapter`'s internal resolution order isn't separately queryable without duplicating its private path-joining constants (`claude-locator.ts` is off-limits) — a minor, not correctness-affecting, spawn-per-start cost. Claude resume/restore (WP5) and the setup card/quick-settings popover (WP7) are untouched, as scoped.

### WP4 — `SessionStore` extraction + `ClaudeSessionStore`
**Status:** Shipped (2026-07-27).

Extract the interface, move grok's implementation, add Claude's. Merge both in `buildSessionsMessage` (pagination, mtime cache, search, dots, rename/delete overrides, `clearAllSessions` `exceptIds`). Badge rows by backend in launcher + history popover.
**Done when:** history lists both backends interleaved by recency, search spans both, delete/rename/clear-all work per backend, `npm run test:perf` still passes its op-count assertions.

- [x] `src/session-store.ts` (new): the `SessionStore` interface (`backend`, `index(cwd)`, `readEntries(cwd, ids, overrides)`, `remove(cwd, id)`, `removeAll(cwd, exceptIds)`, `readTokenUsage(cwd, id)` — `cwd` explicit on every call, matching `sessions.ts`'s existing convention rather than the plan sketch's shorthand); `GrokSessionStore`, a behaviour-preserving wrapper around the unchanged `sessions.ts` primitives; `ClaudeSessionStore`, new (flat-file-per-session layout, case-insensitive project-dir resolution, head/tail-bounded title derivation — see CLAUDE.md § History pagination for the P6 findings); `buildMergedSessionsPage`, the pure cross-backend merge/paginate/search core.
- [x] `sidebar.ts`'s `buildSessionsMessage`/`readEntriesCached`/`liveSessionEntry`/`deleteSession`/`clearAllSessions` rewired onto the two stores + the merge function; the mtime-keyed `sessionCache` is now shared across backends (ids don't collide, each entry carries its own `backend`); grok-only regions (`sweepEmptyPrimerSessions`, tab-title helpers, resume/restore, project-lifetime token estimate) intentionally untouched — out of this package's scope.
- [x] Backend badges: pure `backendBadgeLabel` in `webview-helpers.js` (quiet for grok, labels Claude rows only), rendered by both `media/launcher.js` and the chat history popover (`media/chat.js`) via a shared `.history-row-title`/`.history-row-backend` structure (VS Code `--vscode-badge-*` tokens, no hardcoded colors).
- [x] `deleteSession` now takes the row's `backend` (sent by the webview) and routes to the matching store; `renameSession` needed no change (globalState overrides are backend-agnostic).
- [x] Tests: `test/session-store.test.ts` (new, 36 tests — path encoding incl. the Windows case-insensitivity gotcha and a `.` in the folder name, index ordering, all four title-derivation tiers against `test/fixtures/claude-sessions/*.jsonl`, malformed/truncated jsonl, empty/missing project dir, `GrokSessionStore` delegation, merged ordering/pagination/search across both backends); `test/webview-helpers.test.ts` (+3, `backendBadgeLabel`); `test/launcher.dom.test.ts` + `test/webview-ui.dom.test.ts` (+3 each, badge rendering + backend-tagged delete). All existing grok-path tests (`sessions.test.ts`, `test/sessions.perf.ts`) pass unchanged — the refactor is behaviour-preserving. `npm test`: 938 tests / 48 files, up from the 893-test baseline at dispatch.

**Deviation from this description / left out:** `resumeSession` was intentionally NOT gated or branched per backend — clicking a Claude-backed history row still opens a grok tab against that id (and fails) until WP5 wires `session/load` for Claude and branches `startSession`; this package's scope was the merged, legible **list** (delete/rename/search/clear-all all work per backend today), not opening one. `ClaudeSessionStore.readTokenUsage` always returns `undefined` (no verified on-disk equivalent to grok's `signals.json` — flagged as an open question in this plan, not investigated here). `ClaudeSessionStore` entries always report `numMessages: 0` (an exact count needs a full-file parse, which the "never read a whole multi-MB session" constraint rules out) and `createdAt === updatedAt` (no cheap on-disk "created" timestamp distinct from mtime). `remove()`/`removeAll()` delete only the session's `.jsonl`; a same-named sibling directory some Claude sessions have on disk (subagent/snapshot data) is left behind — it never resurfaces in `index()` (which only scans `*.jsonl`), so history stays correct, but disk isn't fully reclaimed.

### WP5 — Resume, restore, and tab lifecycle
**Status:** Shipped (2026-07-28).

`session/load` for Claude (P5); serializer restore records the backend so a reloaded tab respawns the right agent; `pendingStart` lazy spawn; `onPanelClosed` semantics (Claude has no empty-primer problem — that cleanup is grok-only).
**Done when:** close/reopen and window-reload restore a Claude tab with full replay.

- [x] `research/claude-acp-resume-probe.cjs` (P5, new): spawn adapter A, run 4 turns (plain text, Write+Edit, Bash, Read — one per ACP tool `kind`), kill it, spawn a **fresh** adapter B, `session/load` the same id, and log/classify every replayed `session/update`. Strips `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT`/`CLAUDE_CODE_SSE_PORT` itself so it also runs from inside a Claude Code terminal (how it was actually run here). **Result: ✅ PASS** — replay reconstructs every user/assistant turn verbatim and every tool call with `kind` intact (`edit`/`read`/`execute`) plus its completed result/diff; no weaker than grok's own replay. No token/usage meta on the wire (matches grok), but a real per-turn `message.usage` field exists in the `.jsonl` (candidate analog to `signals.json` — not wired, see below). Findings + transcript in `research/claude-code-backend.md` § Resume; P5 row updated above. `AcpClient.loadSession()` needed **no change** — the gap was routing, not the protocol.
- [x] Backend-aware resume: `resumeSession` (webview → `deleteSession`'s existing `if (s.backend) msg.backend = ...` pattern, mirrored) carries the clicked row's `backend` through `openTabForId(id, backend)`/the panel-dropdown and launcher call sites; `session.backend` is set on the fresh `Session` before `startSession` runs, so `startSession`'s existing backend branch (WP3) resolves the right binary/argv/quirks and `client.loadSession()` hits the right agent. `displayNameForId(id, backend)` reads the matching store (falls back to grok when `backend` is omitted, same precedent as `deleteSession`).
- [x] Serializer restore: `restorePanel(panel, id, backend)` sets `session.backend` immediately (host-side, before any webview code runs) from the persisted `{id, backend}` webview state; `extension.ts`'s `deserializeWebviewPanel` passes both through. The webview stashes `backend` via `vscode.setState` in the `case "session"` handler, sourced from the event's OWN `backend` field (stamped by `sidebar.ts` from `session.backend` at emit time) rather than read back from `state.backend` — a mid-flip `session` event can arrive before its own `backendChanged`, so trusting `state.backend` there risked persisting the stale backend.
- [x] `pendingStart` lazy spawn: unchanged structurally — `session.backend` rides along on the same in-memory `Session` object across the deferred spawn (set once at `restorePanel` time, read again whichever `ready` eventually consumes `pendingStart`), so N restored tabs still only mark `pendingStart` and each respawns its OWN backend on first reveal, not N eager spawns. Not independently unit-testable (sidebar.ts orchestration, no `vscode` mock in this suite — same constraint WP3 documented); verified by code reading and unchanged by this package.
- [x] `onPanelClosed` close semantics: verified the WP3 gating (`emptyPrimerSweep` quirk) already fully covers this — extracted the inline boolean into a new pure `shouldRecycleEmptySession` (`src/session-pool.ts`, mirroring `computeDot`) so the POLICY (not just the quirk value) is unit-tested directly: a Claude tab (`emptyPrimerSweep: false`) is never recycled regardless of how "recyclable" every other flag looks.
- [x] Token usage on resume: confirmed no on-disk equivalent to grok's `signals.json` is **wired** for Claude (`ClaudeSessionStore.readTokenUsage` — `session-store.ts`, off-limits for this package — still returns `undefined`), but the P5 probe found a REAL candidate source (`message.usage` on every `type:"assistant"` `.jsonl` record). The resume path now routes token-usage reads through the correct store (`session.backend === "claude" ? claudeSessionStore().readTokenUsage(...) : readSessionTokenUsage(...)`) instead of unconditionally calling grok's function — so a Claude resume degrades gracefully (no `tokenUsage` emit, donut shows nothing) rather than reading a wrong/empty grok-layout path. Wiring the real source is a follow-up (would require editing the off-limits `session-store.ts`).
- [x] `logout()` fixed per WP3's flag: `logout(backend)` fronts new `logoutGrok()`/`logoutClaude()` (`claude auth logout`, mirroring `checkClaudeAuthStatus`'s invocation shape in `claude-locator.ts`), each tearing down/closing only its own backend's sessions/tabs (`disposePool(backend)` gained an optional backend filter) and posting the signed-out onboarding state to the launcher only (not a fan-out `broadcast`, so a still-open tab on the OTHER backend never shows the wrong signed-out card). The gear-menu label now reads "Log out of Grok"/"Log out of Claude" from the tab's own backend.
- [x] Bonus correctness fix found while implementing resume: the grok-only plan-gate-restoration override on resume (`decideRestoreState`/forcing `client.setMode` back to act mode) is now gated on `spec.quirks.clientPlanGate` — it exists solely to correct for grok's unreliable `exit_plan_mode`, so running it unconditionally against a resumed Claude session risked silently forcing a genuinely-plan-mode Claude session back to act mode on every resume (Claude's own replayed `current_mode_update`, handled by the existing `modeChanged` handler, is trustworthy and must not be overridden for it).
- [x] Tests (grok-free, claude-free): `test/session-pool.test.ts` (+6 — `shouldRecycleEmptySession`, incl. "a Claude tab is never recycled even when empty"); `test/backend-chip.dom.test.ts` (+3 — the `case "session"` handler persists `{id, backend}` from the event's own field, a grok session, and a mid-flip backend change); `test/launcher.dom.test.ts` + `test/webview-ui.dom.test.ts` (+2 each — resume posts the row's backend, a legacy/no-backend row posts none); `test/webview-harness.ts` extended to capture `setState` calls (`states` array) for the serializer-persistence assertions. `npm test`: 988 tests / 49 files, up from the 975-test baseline at dispatch; `npm run test:perf` still 4/4.

**Deviation from this description / left out:** `updateGrokCliOnDemand` still tears down the WHOLE pool (both backends) to free the locked grok binary even though only grok's binary is being updated — out of this package's explicit scope (not one of the 6 deliverables), flagged in CLAUDE.md § Known limits as a known minor over-tear-down (harmless: every panel still respawns on its own correct backend afterward) rather than silently left undocumented. `session-store.ts`/`sessions.ts`/`acp.ts`/`backends.ts`/`claude-locator.ts`/`status-bar.ts` were not modified, per the work package's explicit constraint — the real on-disk Claude token-usage source the probe found is reported, not wired, for exactly that reason. `pendingStart`'s "N-tab spawn storm" prevention is unchanged by this package and — like the rest of `sidebar.ts`'s impure orchestration — has no direct unit-test harness (verified by code reading + `npm run test:live`, consistent with WP3's own precedent).

### WP6 — Per-session effort + tab titles
**Status:** Shipped (2026-07-27).

Move effort off global config onto `Session.effort` (see prerequisite above): seed from `grok.defaultEffort`, thread through `buildGrokAgentArgs`, `setEffort`, and `computeStatusBar`. Add pure `shortModelName` + move `shortEffort` into `webview-helpers.js`; add the composed tab-title helper; wire the refresh points including `modelChanged` and effort changes.
**Done when:** two tabs can hold different effort levels simultaneously, each tab's title shows its own `Model·eff — Name`, and the status bar matches the focused tab. Unit tests cover the title composer (truncation, unnamed, long model names) and per-session effort isolation.

- [x] `Session.effort` (`src/session.ts`), seeded from `grok.defaultEffort` in `startSession` the first time a session spawns (undefined = "not yet chosen," so a same-tab restart keeps its own value instead of reverting to config).
- [x] `startSession` builds `AcpClient` with `effort: session.effort` (not the config read).
- [x] `setEffort` sets `session.effort` and restarts only that session; no longer writes `ConfigurationTarget.Global`. Existing empty-session-vs-history restart semantics (`discardRestartedEmptySession` / `carrySessionName` / summarize-vs-restart prompt) preserved unchanged.
- [x] `computeStatusBar`'s caller (`updateStatusBar` in `sidebar.ts`) passes `active?.effort` instead of reading config; the now-dead `grok.defaultEffort` config-watcher call to `updateStatusBar()` was removed (the HUD no longer reads config, so it had nothing to refresh).
- [x] Pure `shortModelName` + `composeTabTitle({name, model, effort, maxLen})` added to `src/sessions.ts` (kept `tabTitleFor` unchanged for bare-name callers).
- [x] Wired all 6 refresh points: the four existing `tabTitleFor` call sites (now `composeTabTitle`) plus the `modelChanged` client handler and the post-restart end of `setEffort`.
- [x] Tab tooltip: skipped — `vscode.WebviewPanel` has no tooltip property (confirmed against `@types/vscode`), so full model name + effort have no host-side surface to render into.

**Deviation from this description:** kept `shortEffort` as an intentional small duplicate in `src/sessions.ts` rather than moving `media/chat.js`'s copy into `webview-helpers.js` — the host is TypeScript, the webview copy is 5 lines with its own DOM tests, and sharing one implementation across that boundary wasn't worth the coupling for this package (per explicit direction on this work package). Both copies must be kept in sync if the mapping ever changes.

### WP7 — Setup card + quick-settings popover
**Status:** Shipped (2026-07-28).

Pure view-model builder in `webview-helpers.js` (agent/model/effort/mode + locked state + per-backend effort levels), rendered in two places: the welcome-screen setup card and the composer-chip popover. Segmented controls + dropdown styled from existing tokens.
**Done when:** a new tab lets you pick all four settings before sending with no visible restart; the same controls are one click away mid-session; DOM tests cover both mounts and the locked state.

- [x] `sessionSetupModel({backend, modelId, availableModels, effort, effortLevels, mode, locked})` (new, pure, `media/webview-helpers.js`): returns `{backend, rows}`, one row per applicable control (`agent`/`model`/`thinking`/`mode`), each `{id, kind, label, locked, selectedId, options:[{id,label,selected}]}` (+`selectedIndex` for the `thinking` dots row). The `thinking` row is OMITTED entirely (not disabled/empty) whenever `effortLevels` is empty (Claude — `CLAUDE_EFFORT_LEVELS`), so `rows.length` doubles as "which rows apply." Agent options are the two backends; Mode options use short segmented labels ("Agent"/"Plan"/"Auto accept" — deliberately shorter than the full mode-popover's "Plan first" wording, which has room a segmented control doesn't).
- [x] `media/chat.js`: one shared DOM renderer (`buildSessionSettingsRow`/`buildSessionSettingsRows`) consumed by BOTH mounts — `renderSessionSetupCard()` (new-tab welcome screen, above `#welcome-starters`) and `renderSessionSettingsPopover()`/`openSessionSettingsPopover()` (opened from the `#model-label` composer chip, replacing its old "open the gear's model/effort section" behaviour). Segmented rows (Agent/Mode) render as a new `.segmented`/`.segmented-btn` control; Model renders as a native `<select class="session-settings-select">`; Thinking reuses the existing `.effort-dots`/`.effort-dot` idiom verbatim. A pick posts the SAME existing message types the gear/backend-popover/mode-popover already use (`switchBackend`/`setModel`/`setEffort`/`setMode`) — no new host message types were needed; `src/sidebar.ts`'s only change is the two new HTML containers (`#session-setup-card`, `#session-settings-popover`) in `getHtml()`.
- [x] Locked state: `locked: state.busy` flows into every row; each control gets the exact `disabled` state + "Available once the session is ready" tooltip `renderGearMain` already uses for its own model/effort row. Both mounts re-render on every relevant host message (`setBusy`, `session`, `modelChanged`, `modeChanged`, `backendChanged`) so a mid-restart re-lock (e.g. picking a new model on an empty tab, which still restarts the session even though it's invisible/free) is reflected immediately, not just the initial priming window.
- [x] Card lifecycle: `renderSessionSetupCard()`/`hideSessionSetupCard()` mirror `renderWelcomeStarters()`/`hideWelcomeStarters()`'s guard and call sites exactly (onboarding, `startingPhase`, `clearWelcome`, `resetForNewSession`) — the card disappears with the rest of the welcome screen on first send and never lingers stale across a session switch or onboarding card.
- [x] Visual: `.segmented`/`.segmented-btn`/`.session-settings-*` CSS added to `media/chat.css`, entirely `--vscode-*` tokens (no hardcoded colors), reusing `.effort-dots`/`.popover-*`/`.welcome-*` conventions elsewhere; hover/focus-visible/disabled states on every new control; the Model `<select>` ellipsizes a long name instead of overflowing its row.
- [x] Tests: `test/webview-helpers.test.ts` (+15 — the builder: both backends' row sets, Thinking omitted for Claude, selected-option resolution incl. an unknown/stale model id and a missing model id, locked propagation, defaults); `test/session-setup.dom.test.ts` (new, 13 — the welcome card: renders above the starters, per-backend rows, footer copy, each row posts its message, locked state, `clearWelcome`/onboarding/`startingPhase`/`resetForNewSession` lifecycle); `test/model-chip.dom.test.ts` (rewritten — the chip now opens the quick-settings popover instead of the gear popover; +11 new tests for the popover's four controls, the no-op same-backend click, staying open after a pick, locked state, and closing on an outside click). `npm test`: 1029 tests / 50 files, up from the 988-test baseline at dispatch; `npm run test:perf` still 4/4.

**Deviation from this description / left out:** the plan's UI section names `#model-label`/`#backend-label` together when introducing the consolidation; this package reads "the chip" in "Consolidate: the chip opens a compact popover" as `#model-label` specifically (the subject of the two preceding sentences) and leaves `#backend-label`'s own existing small single-purpose popover untouched — flipping `#model-label`'s behaviour was the one explicit, named contract change, and preserving `#backend-label`'s already-tested behaviour (`test/backend-chip.dom.test.ts`) avoided a second, unnecessary breaking change; the Agent row in the new popover/card is a second, equivalent way to flip backend, not a replacement for the chip. This DID require changing the meaning of one existing test (`test/model-chip.dom.test.ts`'s "opens the gear's model + effort controls on click"), which is the one deliberate, explicitly-commissioned exception to the "no existing test changes meaning" rule — flagged here per that rule rather than silently rewritten. The quick-settings popover does not close after a control pick (unlike every other single-purpose popover in this codebase) — a considered deviation from local convention, since closing after one of four independent settings would defeat the point of bundling them; documented in `CLAUDE.md` § Chat surfaces. `renderGearMain`'s own pre-existing model/effort row (reachable via the actual gear icon) is unchanged and still uses its own separate code path — consolidating it into the same builder was not asked for by this package's two named mounts (the setup card and the composer-chip popover) and was left alone to keep the diff scoped.

### WP8 — Docs, live gate, release
Update `CLAUDE.md` (§ Module map, § ACP surfaces, § Known limits, test floor), `README.md`, `docs/architecture.md`, `package.json` (description, new settings). Extend `scripts/live-tests.cjs` with a `--backend=claude` pass. Add `research/claude-code-backend.md` capturing wire shapes.
**Done when:** `npm test` green, `tsc --noEmit` clean, `npm run test:live` green for **both** backends.

## Test plan

- **Unit (grok-free, in `npm test`):** `backends.ts` descriptor + argv; `claude-locator` resolution across platforms; `ClaudeSessionStore` index/read/title-derivation/path-encoding (incl. the Windows case-insensitivity gotcha) against fixture directories; merged pagination + search ordering; `computeStatusBar` with a backend field.
- **DOM:** backend chip render + flip confirm; launcher split-New; history rows badged per backend; setup card and quick-settings popover render from one builder; effort dots reflect per-backend level sets; controls lock while busy.
- **Tab titles:** pure composer tested for truncation, unnamed sessions, long model names, and missing effort; per-session effort isolation asserted across two sessions.
- **Integration (fake CLI):** extend `test/fixtures/fake-grok-acp.cjs` into a backend-parameterised fake so the Claude spawn path is exercised without the real adapter.
- **Live (`npm run test:live`, mandatory pre-release):** a `--backend=claude` pass covering handshake, prompt round-trip, permission card, plan mode, and resume.

The 840-test floor rises; no existing test may change meaning.

## Risks

| Risk | Mitigation |
|---|---|
| ~~P1 fails — grandchild won't start under `ELECTRON_RUN_AS_NODE`~~ | **Retired — probed and passing.** Full turn completed under `Code.exe` |
| Adapter is third-party and pre-1.0 (`unstable_*` methods present) | Pin the exact version; the only `unstable_` surface we rely on is `set_model`, which degrades to "no model picker", not a crash |
| 120 MB dependency | **Not bundled** — provisioned on demand into `globalStorageUri` (WP1). Grok-only users download nothing; vsix size unchanged |
| Inline diffs silently stop rendering for Claude because `toolCall.kind` is absent on permission requests | Correlate by `toolCallId` with the preceding `tool_call`; cover with an integration test that asserts a diff renders for a Claude-shaped permission payload |
| Extension launched from a Claude Code terminal inherits `CLAUDECODE` and every Claude session fails to start | Strip the three `CLAUDE_CODE*` env vars at spawn (WP1); unit-test the env builder |
| Two live agent processes per user multiply the soft pool bound (8) | The bound is already advisory (a one-time warning); count both backends against it |
| `sessions.ts` refactor destabilises history for Grok users | WP4 is behaviour-preserving for grok by construction; `test/session-store.test.ts`'s `GrokSessionStore`/`buildMergedSessionsPage` coverage is the regression net — **not** `npm run test:perf`, which was inaccurate to claim here: `test/sessions.perf.ts` imports only `sessions.ts` primitives (`indexSessions`/`listSessions`/`readSessionEntries`) and never exercises `session-store.ts`/`buildMergedSessionsPage` at all (verified 2026-07-28 code review). Two known perf characteristics flagged, not fixed, by that same review: `resolveClaudeProjectDir` does a full `readdirSync` of `~/.claude/projects` whenever the exact-case dir is absent (the common case for grok-only users), and `buildSessionsMessage` now runs two index passes per call (one per backend's store) where it used to run one |
| Grok-only quirks leak into Claude sessions (primer sent to Claude, plan gate blocking Claude's real plan mode) | Every quirk is a named flag in one descriptor, asserted by unit test — not scattered `if (backend === …)` checks |

## Open questions (non-blocking)

1. Should a Claude tab default to Claude's `acceptEdits` mode instead of our client-side auto-approve? (Fewer round-trips; deferred to keep one code path.)
2. Do we surface Claude's cost/token accounting in the context donut, which currently reads `_meta.totalTokens`? The adapter may not populate it — check during WP1 and fall back to the existing "no meta" behaviour.
3. Should the launcher offer a per-workspace default backend rather than a global one?
