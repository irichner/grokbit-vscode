# Claude Code as an ACP backend — verified wire findings (WP1)

Probed against real Claude Code **2.1.220** driven through
**`@zed-industries/claude-code-acp` 0.16.2** (Apache-2.0, Zed-maintained, wraps
`@anthropic-ai/claude-agent-sdk`), on Windows 11 under VS Code's Electron. Probes:
[`claude-acp-spawn-probe.cjs`](claude-acp-spawn-probe.cjs) (P1/P2 — spawn host +
handshake) and [`claude-acp-fs-terminal-probe.cjs`](claude-acp-fs-terminal-probe.cjs)
(P3/P4 — fs/terminal routing + permission shape). Both PASS. See
[`docs/plans/claude-code-backend.md`](../docs/plans/claude-code-backend.md) for the
full plan this backs; this doc is the reusable reference for the wire shapes it
depends on, in the style of [`ask-user-question.md`](ask-user-question.md) and
[`image-generation.md`](image-generation.md).

## Summary

The adapter speaks the **same ACP wire methods** `src/acp.ts` already sends to
grok — `initialize`, `session/new`, `session/load`, `session/prompt`,
`session/cancel`, `session/set_mode`, `session/set_model`,
`session/request_permission`, `fs/read_text_file`, `fs/write_text_file`,
`terminal/*`, `available_commands_update`. Driving Claude Code needs **no protocol
changes** — only spawn plumbing (this WP, `src/claude-locator.ts`) and, in later
work packages, gating the grok-only surfaces off for Claude sessions (the plan
mode primer, the client-side plan gate, `x.ai/*` requests, `/imagine` media gen,
the Windows version pin, the empty-primer sweep — none of those apply to Claude).

## Spawn: no system Node required

The adapter is a plain Node script (`dist/index.js`), not a native binary. It runs
under **`process.execPath` (the Electron binary that hosts the VS Code extension)
with `ELECTRON_RUN_AS_NODE=1`** — exactly the trick VS Code extensions already use
to run Node tooling with no separate Node install. The adapter's own child — the
Agent SDK's bundled `claude` `cli.js`, which it spawns with `executable:
process.execPath` — **inherits** that env var and runs fine as the grandchild.
Verified end-to-end: `initialize` → `session/new` → streamed
`agent_message_chunk`s → `stopReason: "end_turn"` in ~7s, identical whether the
host is Electron (`ELECTRON_RUN_AS_NODE=1`) or plain `node` (control run).

`npm` is needed exactly once, to *install* the adapter (see "Packaging decision"
below) — never at spawn time.

## `initialize`

Request:

```json
{ "protocolVersion": 1, "clientCapabilities": { "fs": { "readTextFile": true, "writeTextFile": true }, "terminal": true } }
```

`protocolVersion: 1` — the same version our existing `initialize` call already
sends to grok — is accepted. Response includes `loadSession: true` and
`sessionCapabilities: { fork, list, resume }`. The adapter also offers an
`authMethod` ("Run `claude /login`") in its `initialize` response; our handshake
works as-is and auth maps onto the existing signed-out launcher state (see
"Authentication" below).

## `session/new` — modes and models

```json
{ "cwd": "<absolute path>", "mcpServers": [] }
```

Response carries the modes and models the picker needs:

- **Modes** (`modes.availableModes[].id`): `default`, `acceptEdits`, `plan`,
  `dontAsk`, `bypassPermissions`.
- **Models** (`models.availableModels[].modelId`): `default`, `sonnet`, `haiku`,
  `opus[1m]`. **`opus[1m]` contains brackets** — any model-label helper that
  assumes an `[a-z-]`-only id (slug-style, like grok's `grok-build-0.1`) will
  mishandle it. `models.currentModelId` gives the active pick.

Auto-accept ("YOLO") in Grokbit stays client-side for both backends — it's already
a local auto-answer of permission requests, not an ACP mode — so `acceptEdits`
isn't mapped to anything in v1 (see the plan's open questions).

`available_commands_update` fires **~1ms after `session/new`** (13 commands in the
probed session) — slash autocomplete needs no extra wait/poll.

## Tool calls — kinds and diffs

`tool_call` / `tool_call_update` use exactly the ACP kinds Grokbit's
`categorize`/`summarizeTools`/`toolIconFor` (`media/chat.js`,
`media/webview-helpers.js`) already handle: **`edit`**, **`read`**, **`execute`**.
No webview changes are needed for tool rows.

The completed `tool_call_update` for an edit carries **real structured diff
hunks**, not just a before/after blob:

```json
{ "oldStart": 1, "oldLines": 1, "newStart": 1, "newLines": 1, "lines": ["-hello", "+goodbye"] }
```

So the existing inline-diff renderer (`computeLineDiff`/`renderInlineDiff`) and
the changed-files strip get genuine data once wired to Claude's shape.

## `fs/*` and `terminal/*` route to the client

With `clientCapabilities.fs.{readTextFile,writeTextFile}` and
`clientCapabilities.terminal` advertised (exactly what Grokbit already sends),
**Write and Edit both arrive as `fs/write_text_file` on the client**, and **Bash
arrives as `terminal/create`** — verified round-trip: the probe's `fs/write`
handler wrote real bytes to disk and `terminal/create` returned real stdout
(`"from-shell"`) through `terminal/output`. This is what makes Grokbit's existing
permission cards, inline diffs, plan gate, changed-files strip, and
`TerminalManager` work for Claude sessions with no new protocol code — only
gating the grok-only *client behaviours* (plan primer, `x.ai/*` handling) off.

## `session/request_permission` — the shape, and the missing `kind`

```json
{
  "sessionId": "…",
  "toolCall": { "toolCallId": "…", "title": "…", "rawInput": { "…": "…" } },
  "options": [
    { "optionId": "allow_always", "kind": "allow_always", "name": "…" },
    { "optionId": "allow", "kind": "allow_once", "name": "…" },
    { "optionId": "reject", "kind": "reject_once", "name": "…" }
  ]
}
```

Two things to get right when wiring this in a later work package:

1. **Option *kinds* match** what the permission card already renders
   (`allow_always` / `allow_once` / `reject_once`), but the **`optionId`s differ
   from grok's** (grok uses `allow_always`/`allow`/`reject` too, coincidentally
   close here, but must not be assumed — code must key off `kind`, never
   `optionId`, exactly like the existing grok handling already should).
2. **⚠ `toolCall.kind` is absent on this payload** — only `{toolCallId, title,
   rawInput}`. The *preceding* `tool_call` update (the one that opened the tool
   row) carries `kind: "edit"`, but the permission request that follows it does
   not repeat that field. Grokbit's card currently decides whether to render the
   inline diff from `toolCall.kind === "edit"` — for Claude that check must
   instead **correlate by `toolCallId`** with the already-seen `tool_call`, or
   fall back to inferring the kind from `rawInput` keys:
   - `file_path` + `content` → Write
   - `file_path` + `old_string` + `new_string` → Edit

   This is called out in the plan as the single most likely source of a
   "permission card renders but no diff shows" bug for Claude sessions — cover it
   with an integration test asserting a diff renders for a Claude-shaped
   permission payload (no `kind`) once that wiring lands.

`exit_plan_mode` for Claude is **not** a separate `x.ai/*`-style extension method
the way grok's is — it's just another `session/request_permission` with
*Yes/keep planning*-shaped options, so no bespoke handler is needed there either
(unlike grok, where `x.ai/exit_plan_mode` is unreliable and Grokbit enforces plan
mode client-side instead — see the plan's Non-goals: that whole primer/gate
mechanism is grok-only and must stay off for Claude, since Claude's plan mode is
*genuinely* enforced server-side).

## `CLAUDECODE` must be unset when spawning

Claude Code refuses to launch inside another Claude Code session:

> Nested sessions share runtime resources and will crash all active sessions

This was only caught because the probe happened to run *from* a Claude Code
terminal. The extension must strip `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, and
`CLAUDE_CODE_SSE_PORT` from the spawn env — otherwise Grokbit fails for anyone who
launched VS Code from a Claude Code terminal (or from a Claude Code-managed shell
session more generally). Implemented in `buildClaudeAdapterEnv`
(`src/claude-locator.ts`); unit-tested in `test/claude-locator.test.ts`.

## Session storage — `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`

Unlike grok (a directory per session, `~/.grok/sessions/<urlencoded-cwd>/<id>/`),
Claude Code stores each session as a **single flat `.jsonl` file**:

```
~/.claude/projects/<encoded-cwd>/<uuid>.jsonl
```

`loadSession` (`session/load`) finds these and **replays history** as session
updates — the resume/replay story works the same shape as grok's, just against a
different on-disk layout (a later work package, `SessionStore`/
`ClaudeSessionStore`, extracts the layout-dependent parts of `sessions.ts` behind
a shared interface so both can coexist).

**Encoding gotcha, verified on this machine:** Claude encodes the project
directory as *every non-alphanumeric character replaced with `-`*, **preserving
the original case** of the path string it was given:

```
C:\Users\israe\Projects\Grokbit.ai  →  c--Users-israe-Projects-Grokbit-ai
```

Observed in practice: the *same user* ends up with both a `C--Users-israe-…` and a
`c--Users-israe-…` directory under `~/.claude/projects/`, because the drive-letter
case in the encoded name follows whatever exact string the `cwd` was passed as at
session-creation time (VS Code, a terminal, and other tools don't all normalize
drive-letter case the same way). **Any directory match against the current
workspace `cwd` must be case-insensitive on Windows**, or history for a session
created under a differently-cased `cwd` silently comes back empty.

## Resume — `session/load` replay (P5, verified)

Probed with [`claude-acp-resume-probe.cjs`](claude-acp-resume-probe.cjs) (WP5):
spawn adapter A, run four turns (plain text, Write+Edit, Bash, Read — one per ACP
tool `kind`), kill adapter A, spawn a **fresh** adapter B, `session/load` the same
session id + cwd, and log every `session/update` B emits. **Must run with
`CLAUDECODE` unset** (the probe strips `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT`/
`CLAUDE_CODE_SSE_PORT` itself, mirroring `buildClaudeAdapterEnv`, since it was
authored and run from inside a Claude Code terminal). Result: **✅ PASS — replay
is complete and no weaker than grok's.**

- **User messages**: all 4 replay as `user_message_chunk` with the real prompt text.
- **Assistant text**: all 4 replay as `agent_message_chunk`(s) with the real reply text.
- **Tool calls**: every one of the 5 real tool invocations (Write, an
  adapter-inserted Read-before-Edit, Edit, Bash, Read) replays as one `tool_call`
  **+** one `tool_call_update{status:"completed"}`, and **`tool_call.kind`
  survives intact** — `edit`/`read`/`execute`, exactly the live-turn values. The
  completed update's `rawOutput` carries the real tool result text (file content,
  command stdout, the unified diff), and the Edit's structured diff hunks
  (`{oldStart, oldLines, newStart, newLines, lines}`) are present on replay too,
  not just live.
- **Token/usage meta**: **NO** — neither the `session/load` response (only
  `{modes, models}`) nor any `session/update` during replay carries a usage/token
  field. (Every tool_call/tool_call_update *does* carry a `_meta.claudeCode`
  object, but it's just `{toolName: "mcp__acp__Write"}` — which MCP tool fired,
  not token counts. A naive "does `_meta` exist" check false-positives on this;
  the probe checks for a nested `usage`/`tokenUsage` shape instead.) This matches
  grok, which also carries no token meta on `session/load` — see § Token usage
  below for the on-disk alternative this probe found.

**Conclusion for WP5:** `AcpClient.loadSession()` (unchanged, generic — see
`src/acp.ts`) already drives this correctly for either backend; the sidebar-level
gap WP4 flagged was routing (a resumed tab not knowing which backend/store the
id belongs to), not the wire protocol. No `acp.ts` change was needed.

### Token usage — on-disk source found and wired

WP4 originally shipped `ClaudeSessionStore.readTokenUsage` returning `undefined`
unconditionally (no verified on-disk equivalent to grok's `signals.json` at the time).
The WP5 resume probe found one, and it is now wired: every `type:"assistant"` record
in the `.jsonl` carries a real `message.usage` object from the underlying Anthropic
API response, e.g.:

```json
{"input_tokens":3,"cache_creation_input_tokens":25,"cache_read_input_tokens":66748,
 "cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":25},
 "output_tokens":73,"service_tier":"standard","inference_geo":"not_available"}
```

The **last** `assistant` record's usage is a reasonable proxy for "context tokens
used so far" (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens
+ output_tokens` approximates the full context sent to the API for that turn, the
same shape grok's own `_meta.totalTokens` aggregates into one number).

**Now implemented** in `ClaudeSessionStore.readTokenUsage` via `readClaudeUsageFromTail`:
scan a bounded 256KB tail, walk records backwards, take the first `assistant` record
carrying a `usage` object, and sum those four fields. Including the two cache fields is
essential — they dominate a long session, and omitting them understates context usage by
orders of magnitude.

The tail bound was validated empirically against the 12 largest real sessions on this
machine (up to 3.1MB): **all 12 hit, worst case 17KB from EOF** — roughly 15× headroom
against the 256KB window. No usage record inside the window yields `undefined`, never a
misleading `0`, matching how a resumed grok tab with no `signals.json` behaves.

## Authentication — subscription, same as Grok (verified)

**Requirement:** users sign in with their existing Claude subscription — no API
key, no separate billing, mirroring how Grok tabs use the user's `grok` CLI login.

**This already works with zero extra code.** The P1–P4 probes ran real Claude
turns with **no `ANTHROPIC_*` env vars set at all**
(`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_OAUTH_TOKEN`/
`ANTHROPIC_BASE_URL` all unset). Auth came from the user's existing Claude Code
OAuth login in `~/.claude/.credentials.json`:

```json
{ "claudeAiOauth": { "subscriptionType": "max", "rateLimitTier": "default_claude_max_5x", "scopes": ["user:inference", "user:sessions:claude_code", "…"] } }
```

Crucially the probe used the **SDK-bundled** Claude Code (`CLAUDE_CODE_EXECUTABLE`
was never set) and it still read that credential store — proving a single `claude
auth login` covers both the bundled and native copies, so provisioning the adapter
never has to ask the user to log in again.

| Concern | Resolution |
|---|---|
| Sign-in | `claude auth login` (interactive, run in a VS Code terminal) — mirrors the existing grok login affordance |
| Sign-out | `claude auth logout` — mirrors `grok logout` |
| Signed-in detection | `claude auth status --json` → `{loggedIn, authMethod, apiProvider, email, orgName, subscriptionType}`. Parsed by the pure `parseClaudeAuthStatus` (`src/claude-locator.ts`) |
| Token expiry | `refreshToken` present; the SDK refreshes automatically — no extension work needed |
| Adapter's own auth error | `session/new` throws `RequestError.authRequired()` when the credential store is missing — map to the signed-out state, not a generic failure (later work package) |

**Two things the implementation must not do** (both enforced structurally by
`buildClaudeAdapterEnv` in `src/claude-locator.ts`):

1. **Never pass `--bare`.** Per the CLI's own help, `--bare` restricts Anthropic
   auth to "strictly `ANTHROPIC_API_KEY` or `apiKeyHelper`" — OAuth and keychain
   are never read — which would break subscription auth outright.
2. **Never inject `ANTHROPIC_API_KEY`.** If a user happens to have one exported
   for some other tool, Claude Code may prefer it and silently bill **API
   credits instead of their subscription**. `buildClaudeAdapterEnv` also strips
   an **inherited** key by default (`allowInheritedApiKey` opts back in) for
   exactly this reason. Since `claude auth status --json` reports
   `authMethod`/`apiProvider`, a later work package's setup card should surface
   which credential is actually in use so an unexpected API-key charge is never
   silent.

## Packaging decision — provisioned on demand, not bundled

`npm i @zed-industries/claude-code-acp` measures **120MB unpacked** — 61MB of
vendored ripgrep (six platform builds), 11MB `cli.js`, 19MB platform `sharp`.
Pruning to one platform still leaves ~70MB. Bundling that in the vsix would
inflate every Grok-only user's install by two orders of magnitude. So the
adapter is treated like the grok CLI already is: an external prerequisite the
extension **locates** (`src/claude-locator.ts` — configured path → extension-
managed install dir → globally installed npm package → PATH) and offers to
**install on demand** into `context.globalStorageUri` (once per machine, never in
the vsix), pinned to the exact verified version
(`CLAUDE_ACP_ADAPTER_VERSION = "0.16.2"`).

## Implementation

- `src/claude-locator.ts` — adapter entrypoint resolution (`locateClaudeAdapter`,
  pure), the spawn env builder (`buildClaudeAdapterEnv`, pure — strips
  `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT`/`CLAUDE_CODE_SSE_PORT`, sets
  `ELECTRON_RUN_AS_NODE=1`, never injects `ANTHROPIC_API_KEY`), argv construction
  (`buildClaudeAdapterArgv`, pure), and the `claude auth status --json` parser
  (`parseClaudeAuthStatus`, pure) + its thin impure runner
  (`checkClaudeAuthStatus`). The impure install/search-root helpers
  (`installClaudeAdapter`, `defaultClaudeAdapterSearchRoots`) back the pure
  resolution logic but aren't wired into the extension yet — that's a later work
  package (`docs/plans/claude-code-backend.md` WP2+).
- `test/claude-locator.test.ts` — unit coverage for all of the above.

Tests are grok-free **and** claude-free — they never spawn either binary; the
probes above are the manual, real-CLI verification.
