# Capability surfacing + history UX

Status: **plan** (not implemented). Owner: implementation agents, one per work package.
Three design questions were resolved by Israel — see § Resolved decisions. The plan was then
hardened against a 15-defect review — see § Review findings addressed (end of document).
The one fork that review raised (the paging cursor) is resolved too: **Decision 4 — fix both
surfaces**. No open questions remain.

## Goal

Four user-requested changes, in one plan because they share two surfaces (the session
tab canvas and the history row):

1. **Surface what the selected backend CLI can actually do** — slash commands, skills,
   and subagents/agents — so a user opening a tab can see and launch them.
2. **Use the empty canvas of a new session tab** for that, instead of leaving it blank.
3. **Left-nav history shows the last 30 days**, vertically scrollable, replacing the
   hard 7-row cap entirely.
4. **Grok history rows get a "Grok" badge**, matching Claude rows — a deliberate
   reversal of the documented "quiet for grok" badge idiom, *for the history row only*.

## Non-goals (explicit)

- **Not** a plugin/marketplace browser. Both CLIs cache plugins on disk
  (`~/.grok/marketplace-cache/<hash>/…`, `~/.claude/plugins/{installed_plugins.json,cache/…}`)
  with nested `plugin.json` / `.mcp.json` / `hooks.json`. Enumerating those correctly
  means modelling two different marketplace layouts plus enable/disable state. Out.
- **Not** an MCP server/tool browser. grok's MCP servers live in `~/.grok/config.toml`
  under `[mcp_servers.<name>]` (verified in `~/.grok/docs/user-guide/07-mcp-servers.md`),
  which needs a TOML parser we don't have and don't want to add speculatively. Claude's
  MCP config is a different format entirely. Asymmetric, dependency-adding, out.
- **Not** a personas browser. Personas are a **grok-only** concept
  (`.grok/personas/*.toml` + `config.toml [subagents.personas]`; `~/.grok/docs/user-guide/16-subagents.md`
  states plainly that Claude has no equivalent).
- **Not** a workflows browser — **deferred to a later change** (Decision 1).
  `.grok/workflows/*.md` exists in *this* repo but it is the GrokForge project template's
  own convention, and that template's own `.grok/README.md` marks `.grok/workflows/*` as
  **"No — reference only"**, i.e. grok does not load or execute it. Claude Code has no
  workflows concept either (`~/.claude/projects/**/workflows/wf_*.json` are per-session
  runtime artifacts, not authored capabilities). Nothing in this plan's change surface,
  view-model, or tests may assume a workflows group exists — and equally, nothing may
  hardcode "exactly three groups" (see Approach § Three groups today, not three forever).
- **Not** honoring grok's `config.toml` compat opt-out for vendor skill dirs. The
  **env-var** forms (`GROK_CLAUDE_SKILLS_ENABLED` / `GROK_CURSOR_SKILLS_ENABLED` set to a
  falsey string) ARE honored because they are plain strings; the `[compat.claude] skills = false`
  TOML form is not, for the same no-TOML-parser reason as MCP. Goes in § Known limits.
- **Not** re-introducing decorative starter chrome. Commit `74e923a` deliberately removed
  the welcome "Try one of these" starters, Business-task chips, doc-type icons and the
  Templates gallery as "not useful chrome for a thin coding client". Everything this plan
  puts on the canvas is a **real, discovered, launchable** capability of the running CLI —
  never an invented prompt suggestion. If discovery finds nothing, the canvas stays as it
  is today.
- **Not** changing the status-bar HUD (Decision 2). Its quiet-for-grok segment stays.
- **Not** adding a search box to the launcher. Server-side search stays in the chat
  history popover (`buildMergedSessionsPage`'s `query` path is untouched).
- **Not** changing the chat history popover's paging *scope* — it keeps full, unwindowed
  history. (Its load-more **cursor** is corrected under Decision 4 option (b).)
- **Not** virtualizing the launcher list (see Approach § What bounds the list).
- **Not** preserving launcher scroll position across a host-pushed refresh. The sticky-window
  refresh (§ Thread 3) keeps the *rows*; the scroll offset may jump. Acceptable, noted.
- No commits, no pushes, no release. Local rebuild only if the user asks.

---

## What is actually enumerable (investigated, not assumed)

Verified against this machine and the CLI's own shipped user guide
(`~/.grok/docs/user-guide/`, which grok installs on disk).

| Capability | grok source | Claude Code source | Symmetric? |
|---|---|---|---|
| **Slash commands** (shell + pager builtins, custom commands, user-invocable skills) | ACP `available_commands_update` — already wired: `acp-dispatch.ts` routes it, `acp.ts` caches it on `AcpClient.availableCommands`, `sidebar.ts:2264` emits `commandsUpdate`, `chat.js` stores it in `state.commands` for slash autocomplete | Same ACP notification. `research/claude-code-backend.md` line 75: *"`available_commands_update` fires ~1ms after `session/new` (13 commands in the probed session)"* | **Yes** — identical wire event, already in the client, currently used for autocomplete only |
| **Skills** (incl. model-only ones the slash menu hides) | Disk. `~/.grok/docs/user-guide/08-skills.md` § Skill Locations gives the authoritative ordered search path: `./.grok/skills`, `./.grok/commands`, repo-root `.grok/…`, `~/.grok/…`, `./.claude/skills`, `./.claude/commands`, `~/.claude/…`, `./.cursor/skills`, `~/.cursor/skills`, plus `.agents/skills`/`.agents/commands` at each tier. Dedup by name, higher tier wins | Disk. `.claude/skills/*/SKILL.md`, `.claude/commands/*.md`, `~/.claude/…` | **Mostly** — grok's *skills* search path is a strict superset that includes Claude's dirs |
| **Agents / subagents** | Disk: **only** `.grok/agents/*.md` and `~/.grok/agents/*.md` (`16-subagents.md`: agent definitions are "`.md` files in `.grok/agents/` or `~/.grok/agents/`"), plus three documented built-in `spawn_subagent` types: `general-purpose`, `explore`, `plan` | Disk: `.claude/agents/*.md`, `~/.claude/agents/*.md` — same `.md` + YAML-frontmatter layout | **Yes** for disk agents; grok additionally has the three built-in types |
| MCP servers | `config.toml` (TOML) | different format | No — out of scope |
| Personas | `.grok/personas/*.toml` | none | No — out of scope |
| Plugins | `marketplace-cache/` | `plugins/installed_plugins.json` | No — out of scope |
| Workflows | not a CLI concept (`.grok/workflows` is reference-only template docs) | not a CLI concept | n/a — deferred (Decision 1) |

**The agents asymmetry is load-bearing.** `08-skills.md` extends only the *skills/commands*
search path into `.claude`/`.cursor`; `16-subagents.md` does **not** — grok resolves agents
from `.grok/agents` only. A root list that is not per-kind would list this repo's nine
`.claude/agents/*.md` files as grok subagents that grok cannot resolve. See § Root spec.

Real state on this machine, which is exactly the graceful-degradation matrix to build for:

- `~/.grok/skills/` — **5 skills present** (`code-review`, `create-skill`, `help`, `imagine`, `check-work`).
- `<repo>/.grok/skills/` — **9 present**; `<repo>/.grok/agents/` and `<repo>/.grok/commands/` — **absent**.
- `<repo>/.claude/skills/` — **7 present**; `.claude/agents/` — **9**; `.claude/commands/` — **8**.
- `~/.claude/skills|commands|agents/` — **all absent**. A missing root must be a silent skip, never an error.

Frontmatter is a small, consistent YAML subset across all of them — verified samples:

```yaml
# ~/.grok/skills/code-review/SKILL.md
name: code-review
description: Run an extremely strict maintainability review …
disable-model-invocation: true
```

```yaml
# .claude/agents/code-reviewer.md
name: code-reviewer
description: Use this agent immediately after a meaningful change …
tools: Read, Grep, Glob, Bash
model: opus
```

```yaml
# .grok/skills/plan/SKILL.md — folded scalar
description: >
  Author a durable plan under docs/plans/ …
```

`08-skills.md` § Optional Frontmatter Fields confirms `user-invocable` **defaults to `true`**.
So the ACP command list already covers nearly every user-invocable skill; the disk scan's
distinct value is (a) model-only skills (`user-invocable: false`), (b) agents, (c) the file
path so a row can open its source, (d) something to show **before** the session goes live
and `available_commands_update` arrives.

---

## Approach

### Thread 1+2 — capability discovery and where it lives

**Chosen:** one pure discovery module + one pure view-model, rendered into **two mounts**:
a `#capabilities-panel` on the new-tab welcome canvas, and a top-bar **Skills** popover
available at any time.

Two mounts from one pure builder is not a new pattern — it is exactly the
`sessionSetupModel` idiom CLAUDE.md § Chat surfaces already documents ("ONE pure builder …
into TWO mounts: a `#session-setup-card` … and the `#session-settings-popover`"), with one
implementation and one set of tests. The top-bar popover mirrors the existing **Docs**
popover (`#docs-popover` / `listWorkspaceDocs` / `selectWorkspaceDocs` in
`src/workspace-docs.ts`) beat for beat: webview asks, host scans, pure module selects/caps,
host posts, webview renders.

*Alternative considered — canvas only.* Rejected: the canvas is destroyed by
`clearWelcome()` on first send, so capabilities would become unreachable the moment you
start working, which is when "what skills do I have?" is actually asked.

*Alternative considered — a dedicated VS Code TreeView in the activity bar.* Rejected: a
new view container competes with the launcher for the same narrow strip, needs its own
host/webview lifecycle, and the user explicitly asked for this in **the tab**.

**Data flow** (mirrors Docs exactly):

```
webview  → { type: "listCapabilities" }        (per-panel; triggered by initialState, see below)
host     → scan roots for session.backend (impure, bounded)
         → buildCapabilityGroups(...)          (pure, src/capabilities.ts)
         → postTo(session, { type: "capabilities", ... })   (transient — the webview re-requests)
webview  → capabilityGroupsView(...)           (pure, media/webview-helpers.js)
         → render into #capabilities-panel and/or #capabilities-popover
```

`capabilities` goes out via `postTo`, **not** `emit` — it is derived, refreshable state,
not transcript content. It must never enter `Session.buffer` (a replayed stale capability
list would be wrong after the user adds a skill). CLAUDE.md § Native tabs lists the
transient `postTo` message types; `capabilities` joins that list.

**Request trigger is `initialState`, NOT `ready`.** `grok.showCapabilities` reaches the
webview inside `initialState`, which `postPanelConfig` posts *in response to* `ready`
(`src/sidebar.ts:2700-2707`) — so a gate evaluated in the `ready` path reads a value that
does not exist yet. The webview therefore requests `listCapabilities` from its
**`initialState` handler**, gated on the freshly-delivered `msg.showCapabilities`. Since
`initialState` is posted on *every* `ready` (including each reveal of a torn-down hidden
panel), this also refreshes the list on every reveal — the behaviour we want anyway.

**Panel visibility has four anchors, not one.** `renderSessionSetupCard`'s gate
(`media/chat.js:589-596`) is only half of how that card behaves; the other half is *where it
is called from*. The capabilities panel must copy **all** of it, or it renders exactly once,
during priming, while its own gate is shut:

| anchor | existing precedent | what the capabilities panel must do |
|---|---|---|
| `initialized` message | `hideSessionSetupCard()` — `media/chat.js:4554` | `hideCapabilitiesPanel()` (priming has begun; `startingPhase` is now true) |
| `setBusy` message | `refreshSessionSettingsMounts()` — `media/chat.js:4969` | `renderCapabilitiesPanel()` — the **only** thing that re-renders once `startingPhase` clears |
| `showOnboarding` (4 branches) | `hideSessionSetupCard()` — `media/chat.js:2072, 2088, 2104, 2117` | `hideCapabilitiesPanel()` in each branch |
| `clearWelcome` / `resetForNewSession` | `hideSessionSetupCard()` — `media/chat.js:2003, 2030` | `hideCapabilitiesPanel()` |

**Hiding must not discard.** `state.capabilities` holds the last payload; `hideCapabilitiesPanel()`
clears the DOM only. `renderCapabilitiesPanel()` renders *from state*, so when `setBusy:false`
clears `startingPhase` the panel appears with the data that arrived during priming — no
re-request needed. (Without this the panel is permanently empty on a fresh grok tab, since
the `capabilities` post and the `commandsUpdate` re-post both land *inside* the priming window.)

**Popover needs both click guards.** `media/chat.js:5091` installs one `document` click
listener ending in an unconditional `closePopovers()`. Every popover in the file is protected
by a matching pair — the opening button stops propagation (`docsBtn.onclick = (e) => { e.stopPropagation(); … }`,
`:5085`) and the popover swallows its own clicks (`docsPopover.addEventListener("click", (e) => e.stopPropagation())`,
`:5090`). Both are required for `#capabilities-btn` / `#capabilities-popover`; with either
missing, the opening click bubbles and immediately re-hides the popover.

**Three groups today, not three forever (Decision 1).** Workflows are deferred, so v1 ships
exactly three groups — Commands, Skills, Agents. Nothing may *assume* a fourth exists, and
nothing may make adding one painful:

- `CapabilityGroup[]` is an **array the producer builds and the consumer iterates**. No
  fixed-arity tuple, no `groups.commands/.skills/.agents` object, no `groups[0]`/`[1]`/`[2]`
  indexing, no `if/else if/else` chain over the three kinds in the renderer.
- Group ordering and display titles come from **one declared list** (`CAPABILITY_KIND_ORDER`
  / `CAPABILITY_KIND_LABELS` keyed by `CapabilityKind`), so a later kind is one entry in two
  places plus its discovery source — not a renderer rewrite.

Do **not** add a `workflow` member to `CapabilityKind`, a workflows root, an empty
placeholder group, or a test for a hypothetical fourth kind. Deferred means absent.

#### Root spec (per **kind**, not per backend only)

```ts
type RootLayout = "skill-dir" | "flat-md";   // <dir>/<name>/SKILL.md   |   <dir>/*.md

interface CapabilityRootSpec {
  kind: "skill" | "agent";   // never "command" — commands are ACP-only (see merge rule)
  base: "workspace" | "home";
  dir: string;               // relative to base, e.g. ".grok/skills"
  layout: RootLayout;
  source: string;            // display label, e.g. "Project (.grok)"
  /** Falsey value of this env var removes the root (grok's vendor compat opt-out). */
  disabledByEnv?: string;
}

const CAPABILITY_ROOTS: Record<BackendId, CapabilityRootSpec[]>;  // ordered, highest priority first
```

- **grok — skills** (`kind:"skill"`): workspace `.grok/skills`(skill-dir), `.grok/commands`(flat-md),
  `.agents/skills`, `.agents/commands`, `.claude/skills`, `.claude/commands`
  (`disabledByEnv: "GROK_CLAUDE_SKILLS_ENABLED"`), `.cursor/skills`
  (`disabledByEnv: "GROK_CURSOR_SKILLS_ENABLED"`); then the same set under home
  (`~/.grok/…`, `~/.claude/…`, `~/.cursor/skills`).
- **grok — agents** (`kind:"agent"`, flat-md): workspace `.grok/agents`, home `~/.grok/agents`.
  **No `.claude`/`.cursor` entry** — see the enumerability table.
- **claude — skills**: workspace `.claude/skills`(skill-dir), `.claude/commands`(flat-md);
  home `~/.claude/skills`, `~/.claude/commands`.
- **claude — agents**: workspace `.claude/agents`, home `~/.claude/agents`.

A `commands/*.md` file yields `kind: "skill"` because that is what it is in grok's model:
`08-skills.md` — *"Flat `*.md` files under a `commands/` directory become user-invocable
slash commands"*, i.e. an invocable skill authored in the legacy layout.

#### Merge rule — the disk kind is authoritative, ACP only enriches

The frozen rule, because "merges into one row" without naming the row's `kind` produces
either duplicate rows or a Skills group that visibly empties itself ~1ms after the session
goes live:

- **Skills** = every disk item from a `skill` root. If an ACP command has the same name,
  it *enriches* that row (confirms `invoke`, fills `description` only when the disk
  description is empty) and produces **no second row**. The row keeps `kind: "skill"`,
  `origin: "disk"`, and its `path`.
- **Commands** = ACP commands with **no** disk match — i.e. the CLI's own builtins
  (`/new`, `/compact`, `/resume`, …). `kind: "command"`, `origin: "acp"`, no `path`.
- **Agents** = disk agents + `GROK_BUILTIN_AGENTS` (grok only).

*Description precedence is disk-wins-when-non-empty, deliberately.* Both texts come from the
same frontmatter, so either is defensible — disk-wins is chosen because it keeps every row's
text **stable across the `commandsUpdate` transition**, so the panel the user is reading
never rewrites itself a moment after it appears.

Dedupe key is `` `${kind}|${name}` `` — never name alone, so a skill and an agent that share
a name (e.g. this repo's `plan` skill and grok's built-in `plan` agent type) both survive.

#### Frontmatter values are strings; booleans are coerced explicitly

`parseFrontmatter` returns `Record<string, string>` — raw text scalars only. `user-invocable: false`
therefore parses to the **string** `"false"`, which is truthy in JS, so a natural default-true
check (`fm["user-invocable"] !== false`, or `?? true`) inverts the rule and marks a model-only
skill invocable. A separate pure `frontmatterBool(raw, fallback)` does the coercion:
`"false"|"no"|"0"|"off"` → `false`; `"true"|"yes"|"1"|"on"` → `true`; anything else (incl.
`undefined`) → `fallback`. Case-insensitive, trimmed.

To make the fixture divergence structurally impossible, **item-construction tests take raw
file text and run the real parse**, never a hand-authored frontmatter object.

**Row actions**, reusing existing plumbing only:
- Invocable item (`invoke` present) → seed the composer with `/<name> ` via the existing
  `applyComposerSeed`/`insertComposerPrompt`. **Never auto-send.**
- Non-invocable item **with** a `path` (model-only skill, disk agent) → `{ type: "openFile", path }`.
- Non-invocable item **without** a `path` (grok's three built-in agent types) → **rendered
  non-interactive**: no click handler, no pointer cursor, informational only. Posting
  `openFile` with no path reaches `parseFileRef(undefined)` (`src/sidebar.ts:2747` →
  `src/file-ref.ts:21`, `raw.match(...)`), an unhandled `TypeError` in the extension host and
  a row that silently does nothing. The host additionally guards `openFile` against a
  missing/blank path (belt and braces, and correct regardless of this feature).

### Thread 3 — 30-day launcher history

**Chosen:** a `sinceMs` filter applied to the **already-merged, already-sorted index**
inside the pure `buildMergedSessionsPage`, plus real paging in the launcher. The 30-day
window **fully replaces** the 7-row cap, and the Recent section defaults to **expanded**
(Decision 3).

This is the cheap and correct place: `SessionStoreIndexEntry` already carries `mtimeMs`
from a stat-only pass, so windowing costs one `Array.filter` and **reduces** work — only
in-window ids reach `readEntriesCached`. No bypass or duplication of the existing
pagination/cache/search machinery; the chat popover passes no `sinceMs`.

*Alternative considered — filter in `launcher.js` after the host sends a page.* Rejected:
the host would have to over-fetch to guarantee a full window, `hasMore`/`total` would lie,
and the mtime-keyed read cache would be warmed for rows nobody sees.

Four details that are easy to get wrong and are therefore specified:

- **`index` stays unwindowed.** `buildSessionsMessage` uses `page.index` as the
  "is this id on disk at all" set for live-session synthesis. Windowing that set would make
  an out-of-window live session look absent and get synthesized as a **duplicate** row.
- **Two totals, with distinct jobs.** `total` = the *windowed* count (drives paging,
  `hasMore`, **and the ceiling notice**); `totalAll` = the *unwindowed* count (drives **only**
  the "Clear all" footer, because `clearAllSessions` deletes every session for the workspace,
  not just in-window ones). These must never be swapped: a footer keyed off `total` hides a
  destructive action that still works; a ceiling notice keyed off `totalAll` states a number
  the windowed list can never reach.
- **Live sessions are pinned, not merely synthesized.** `pinnedIds` (below) is the fix — the
  old "exempt by construction" claim was only true for a live session with *no file on disk*.
- **`0` days = no window** (`sinceMs` stays `undefined`); it must short-circuit before the
  `Date.now() - days*86400000` arithmetic, which would otherwise filter everything out.

**`pinnedIds` — a live session never falls out of the launcher.** `buildSessionsMessage`
synthesizes rows only for pool members *absent from disk* (`src/sidebar.ts:3106-3113`). A
session that is live **and** on disk with a stale mtime (resume a 6-week-old session; or set
`grok.launcherHistoryDays: 1`) is therefore neither windowed in nor synthesized: the launcher
shows no row for the session the user currently has open, and — worse — `dots` is still posted
for that id while `patchDot`'s `listEl.querySelector` finds nothing (`media/launcher.js:265-269`),
so a `needs-you` permission request in that background tab has **no dot anywhere in the
activity bar**, which is the only ambient signal that a tab is blocked.

Fix in the pure layer: `MergedSessionsPageDeps.pinnedIds?: ReadonlySet<string>`. The window
predicate becomes `mtimeMs >= sinceMs || pinnedIds.has(id)`. Pinned rows come through the
normal read path, so they get real names and participate in `total`. `sidebar.ts` passes every
live pool member's `activeSessionId`.

#### What bounds the list (Decision 3)

With the 7-row cap gone, **30 days is the only *semantic* bound** — so the honest question is
what a user with hundreds or thousands of sessions inside 30 days gets. The answer is
**incremental paging into the existing scroll container, with a hard render ceiling**, and
explicitly **not** virtualization:

- The host sends `LAUNCHER_PAGE_SIZE = 50` rows per page into `#launcher-list`, which
  **already** has `flex: 1 1 auto; min-height: 0; overflow-y: auto` (`media/chat.css:2803-2808`)
  — the vertical scrollbar the request asks for needs no new CSS.
- A scroll-near-bottom listener requests the next page, guarded by `hasMore` + a `loading`
  flag. So 2 000 in-window sessions materialise 50 rows, not 2 000.
- A hard ceiling `LAUNCHER_MAX_ROWS = 500` stops auto-loading and renders a muted notice:
  *"Showing the first 500 of {**total**} in the last {windowDays} days. Use the chat history
  for the full list."* — **`total`, the windowed count**, never `totalAll`. The chat popover
  is the destination because it is the surface with search and unwindowed pagination.
- **Virtualization is rejected** for v1: a new windowing/measurement layer in a webview that
  has none, for a case the 500-row ceiling already handles. Revisit only on a real complaint.

#### The load-more cursor must count DISK rows, not rendered rows

`chat.js` derives the next offset from the rendered row count —
`requestSessions(state.sessions.length)` (`media/chat.js:1812`) — but `buildSessionsMessage`
**prepends** host-synthesized live rows *after* pagination (and, now, pinned out-of-window
rows). Those are not part of disk pagination, so the next offset overshoots by their count
and real sessions are permanently skipped at every page boundary. With one unflushed new tab
and 60 in-window sessions: page 0 renders 1 synthetic + disk rows 1–50, `state.sessions.length === 51`,
the client asks for `offset: 51`, and disk row #51 is never reachable at any scroll position.

**Fix: the host sends an authoritative `nextOffset`** (`offset` + the number of rows that
actually came from the disk page, before any injection), and both webviews page with
`requestSessions(state.nextOffset)`. Client-side arithmetic over a list the host has since
mutated is the bug; an authoritative cursor removes the class.

This is a **shared-pattern fix** — the same latent bug exists in the shipped chat popover
today. **Decision 4** resolved this as fix-both; (a) launcher-only is recorded there as the
downgrade path.

#### A host-pushed refresh must not wipe scrolled-in pages

`broadcastSessionsList()` (`src/sidebar.ts:3194-3199`) ends with `this.postLauncherSessions()`
— no `offset`, so `offset: 0`, which under the new paging launcher means *replace*. It fires
on every send (`src/sidebar.ts:3949`, `:3971`), rename, delete, and tab open/close. A user who
scrolled to 250 rows and then sends a message watches the list collapse to 50 and jump to the
top, every single message. This is invisible today only because the list is a fixed 7 rows.

**Fix — "sticky window", the direct analogue of chat.js's existing sticky search**
(`media/chat.js:5002-5005`, which re-requests when an unfiltered refresh would clobber an
active search): when the launcher receives an `offset === 0` page while it has **more than one
page loaded**, it does not render that page — it re-requests the whole loaded window
(`{ type: "listSessions", offset: 0, limit: loadedCount }`) and renders the reply.

- The host must therefore cap the launcher's `limit` at **`LAUNCHER_MAX_ROWS`**, not
  `LAUNCHER_PAGE_SIZE`, or the refresh silently truncates back to one page.
- **Loop guard (mandatory):** the re-request's own reply is also `offset === 0` with
  `entries.length === loadedCount`, which re-satisfies the trigger and would recurse forever.
  A `pendingWindowRefresh` flag is set before the re-request and cleared on the next
  `sessions` message; the sticky path is skipped while it is set.
- Scroll offset is not preserved (listed as a non-goal).

### Thread 4 — Grok badge (history row only)

**Chosen:** flip `backendBadgeLabel` to label **both** backends, with a precise
legacy/unknown rule.

| input | output | why |
|---|---|---|
| `"grok"` | `"Grok"` | the ask |
| `"claude"` | `"Claude"` | unchanged |
| `undefined` / `""` / missing field | `"Grok"` | legacy rows predate the field; mirrors `deleteSession`'s documented "defaulting to grok when absent" |
| any other non-empty string | `""` | never invent a label for a backend we don't know |

Both badges keep the single neutral `.history-row-backend` chip
(`--vscode-badge-background`/`-foreground`, no hardcoded colors), distinguished by text alone.

*Alternative considered — per-backend accent classes.* Rejected for v1: it would force a
signature change on `backendBadgeLabel` or a `dataset` write inside **both** `renderRow`
implementations, colliding with the launcher rewrite for a cosmetic gain. As specified, the
badge flip touches **no** render site.

**The status-bar HUD deliberately does NOT flip (Decision 2).** `computeStatusBar` keeps its
quiet-for-grok segment. One idiom becomes **two intentional behaviours**:

| surface | behaviour | why |
|---|---|---|
| History row (launcher + chat popover) | labels **both** backends | rows from both backends are interleaved by recency in one list, so every row needs per-row disambiguation; the composer's `#backend-label` chip already names both |
| Status-bar HUD | stays **quiet for grok** | one always-visible item with a hard width budget, describing a single open session whose model is already named |

This divergence is the single most likely thing for a future reader to "tidy up" back into one
rule. It must be recorded **explicitly on both sides** — see § Docs and the ADR note.

---

## Change surface

### New files

| File | Pure? | What |
|---|---|---|
| `src/capabilities.ts` | **Pure** (no `vscode`, no top-level `node:fs`; injected `CapabilityFsLike`, mirroring `sessions.ts`'s `FsLike` and `session-store.ts`'s `ClaudeFsLike`) | `CAPABILITY_ROOTS` (per backend **and kind**), `CapabilityRootSpec`, `CAPABILITY_KIND_ORDER`, `parseFrontmatter`, `frontmatterBool`, `capabilityFromSkillFile`, `GROK_BUILTIN_AGENTS`, `dedupeByPriority`, `mergeAcpCommands`, `buildCapabilityGroups`, caps/limits |
| `test/capabilities.test.ts` | — | unit tests for the above |
| `test/capabilities.dom.test.ts` | — | happy-dom tests driving the real `media/chat.js` for both mounts |

### Modified

| File | Pure? | Change |
|---|---|---|
| `src/sidebar.ts` (host logic) | impure glue | `listCapabilities(session)` handler + `WebviewMsg` variant; bounded fs scan per `session.backend`; post `{type:"capabilities"}` via `postTo`; re-post on `commandsUpdate`; **guard `openFile` against a missing/blank path**; `buildSessionsMessage(sinceMs, pinnedIds)` + `totalAll`/`windowDays`/**`nextOffset`** in the `sessions` message; `LAUNCHER_HISTORY_LIMIT: 7` → `LAUNCHER_PAGE_SIZE: 50` + `LAUNCHER_MAX_ROWS: 500`; `launcherHistoryDays()` (0 ⇒ `sinceMs: undefined`); `postLauncherSessions` honors `offset` and caps `limit` at **`LAUNCHER_MAX_ROWS`**; **`onDidChangeConfiguration` re-posts for both new settings**; **`replySessionsList` deliberately passes no `sinceMs`/`pinnedIds`** |
| `src/sidebar.ts` → `getHtml` | — | `<button id="capabilities-btn">` + `<div id="capabilities-popover">` in `.top-bar`; `<div id="capabilities-panel">` inside `#welcome`, below `#session-setup-card` |
| **`src/sidebar.ts` → `getLauncherHtml`** | — | **`class="launcher-history launcher-section collapsed"` → `expanded`, and the toggle's `aria-expanded="false"`/`title="Expand section"` → `"true"`/`"Collapse section"` (`src/sidebar.ts:4567-4568`). Without this the view paints collapsed (`.launcher-section.collapsed > .launcher-section-body { display:none }`, `media/chat.css:2779`) until `launcher.js` evals — a visible collapse-then-expand flash on every load, with wrong ARIA in the pre-script DOM** |
| `src/session-store.ts` | **pure** | `MergedSessionsPageDeps.sinceMs?` + **`pinnedIds?: ReadonlySet<string>`**; window the merged index after sort, before pagination/search, exempting pinned ids; `MergedSessionsPage.totalAll` + **`diskCount`** (rows from the disk page, feeding the host's `nextOffset`); `index` stays unwindowed |
| `media/webview-helpers.js` | **pure** | `backendBadgeLabel` flip; new `capabilityGroupsView(...)` + `CAPABILITY_KIND_LABELS`; both added to the `api` export object |
| `media/chat.js` (WP2 region) | webview | `#capabilities-panel` + `#capabilities-popover`; `capabilities` message; the **four** lifecycle anchors; both `stopPropagation` guards; request from **`initialState`**; `showCapabilities` message handler; row click → seed / `openFile` / inert |
| **`media/chat.js` (WP3 region — Decision 4 option b)** | webview | `state.nextOffset` from the `sessions` message; `list.onscroll` uses `requestSessions(state.nextOffset)` instead of `state.sessions.length` (`media/chat.js:1812`). **Disjoint region from WP2's edits** (history popover vs. welcome/top-bar), but the same file — sequence WP3 after WP2, or expect a trivial merge |
| `media/launcher.js` | webview | **delete** `HISTORY_LIMIT = 7` and its slice; `offset===0` replaces / `offset>0` appends de-duped by id; scroll-near-bottom load-more using the host's **`nextOffset`**, guarded by `hasMore` + `loading` + `LAUNCHER_MAX_ROWS`; **sticky-window refresh + `pendingWindowRefresh` loop guard**; ceiling notice keyed off **`total`**; `updateFooter` keyed off **`totalAll`**; windowed empty state; `historyOpen` default `saved.historyOpen !== false` |
| `media/chat.css` | — | `.capabilities-*` rules (VS Code tokens only, reusing `.history-list`/`.toolbar-popover`/`.studio-popover-*`); `.launcher-list-notice`; `.capability-row.inert` (no pointer cursor / no hover affordance); update the `.history-row-backend` comment. **No scrollbar change needed** — `.launcher-list` already has `overflow-y: auto` |
| `package.json` | — | `grok.showCapabilities` (bool, default `true`), `grok.launcherHistoryDays` (number, default `30`, `0` = unlimited) |
| **`test/webview-harness.ts`** | — | **Add `#capabilities-btn`, `#capabilities-popover`, `#capabilities-panel` to the hand-maintained `BODY` mirror (`:21-62`). Every chat DOM suite boots through `bootWebview()`; chat.js's convention is `if (!el) return;`, so without this all nine WP2 DOM cases fail with null mounts and it looks like a chat.js bug. Additive — no existing suite is affected** |
| `test/webview-helpers.test.ts` | — | **rewrite** the `describe("backendBadgeLabel")` block; add `capabilityGroupsView` cases |
| `test/session-store.test.ts` | — | `sinceMs` / `pinnedIds` / `diskCount` cases |
| `test/launcher.dom.test.ts` | — | **rewrite three blocks** (see Test strategy) **and update the fixture `BODY` at `:22-23`** to mirror the new `getLauncherHtml` markup |
| `test/webview-ui.dom.test.ts` | — | **rewrite** `describe("history popover backend badges …")` (`:221-250`) — `:235` and `:249` assert the *old* quiet-for-grok behaviour and go red on the flip; plus the WP3 cursor case |
| `test/status-bar.test.ts` | — | **unchanged** — Decision 2 keeps `computeStatusBar` quiet for grok; the existing assertions are the guard |
| `CLAUDE.md`, `README.md`, `docs/architecture.md` | — | see below |

### Docs that must change (and the one that must be *qualified*, not just left alone)

- **CLAUDE.md § Module map** — new `src/capabilities.ts` row; updated `media/launcher.js`,
  `media/chat.{js,css}`, `media/webview-helpers.js` rows.
- **CLAUDE.md § Chat surfaces** — new "Capability browser" bullet.
- **CLAUDE.md § Native tabs + session pool** — add `capabilities` to the enumerated list of
  transient `postTo` message types.
- **CLAUDE.md § ACP surfaces** — `available_commands_update` now also feeds the capability
  browser; the two new settings alongside the other webview-only settings.
- **CLAUDE.md § History pagination** — the launcher is now a windowed, paged, scrollable list
  with a render ceiling (not a 7-row cap); `nextOffset` is the authoritative paging cursor for
  **both** surfaces; `total` vs `totalAll` vs `pinnedIds`; and the badge is no longer quiet for grok.
- **CLAUDE.md § Status-bar HUD** — its "grok stays the quiet default … mirroring
  `backendBadgeLabel`'s quiet-for-grok idiom" sentence is now **wrong as written**. Rewrite it
  to say the HUD *deliberately retains* the quiet default while the history badge labels both,
  **with the reason**. Both halves must be recorded, or a future reader will "fix" it.
- **CLAUDE.md § Known limits** — what is *not* enumerable (MCP servers, personas, plugins);
  workflows **deferred, not impossible**; grok's `config.toml` compat opt-out not honored
  (env-var form is).
- **README.md** — capability browser + 30-day launcher history.
- **docs/architecture.md** — the new module and the `listCapabilities` → `capabilities` flow.

### Message contract (frozen — WP2 is built against this)

Webview → host: `{ type: "listCapabilities" }`

Host → webview (`postTo`, per-panel, transient):

```ts
type CapabilityKind = "command" | "skill" | "agent";   // no `workflow` member — deferred

interface CapabilityItem {
  kind: CapabilityKind;
  name: string;
  description: string;     // "" when unknown
  invoke?: string;         // "/plan " — present iff user-invocable
  path?: string;           // absolute source file; ABSENT for ACP builtins and GROK_BUILTIN_AGENTS
  source: string;          // "Project (.grok)" | "Project (.claude)" | "User (~/.grok)" | "Built in"
  origin: "acp" | "disk";
}

interface CapabilityGroup {
  kind: CapabilityKind;
  title: string;
  items: CapabilityItem[]; // capped at CAPABILITY_GROUP_CAP
  total: number;           // pre-cap count, drives "+N more"
}

// { type: "capabilities", backend: BackendId, groups: CapabilityGroup[],
//   scannedRoots: number, truncated: boolean, error?: string }
```

`groups` is an ordered **array**, iterated by the consumer. The renderer must not branch on
the three known kinds. A row with neither `invoke` nor `path` is **inert**.

Config messages (mirroring `showThinking`/`compactActivity`):

```ts
// initialState gains:  showCapabilities: boolean
// broadcast on config change:  { type: "showCapabilities", value: boolean }
```

`sessions` message gains: `totalAll: number`, `windowDays: number`, `nextOffset: number`.

### Discovery limits (named constants in `src/capabilities.ts`)

- `CAPABILITY_HEAD_BYTES = 8 * 1024` — only the head of each file is read. Same bounded-slice
  discipline as `deriveClaudeRawTitleSource`.
- `CAPABILITY_SCAN_FILE_CAP = 300` — overall file ceiling across all roots.
- `CAPABILITY_GROUP_CAP = 40` — rendered items per group; `total` still reports the truth.
- No cache in v1. A scan is tens of small bounded reads on an explicit user action or a tab
  reveal. Add a cache only if measured.

---

## Test strategy

Everything stays in layer 1 (`npm test`): grok-free **and** claude-free, no spawned binary,
no network. `975` tests is the floor. Discovery I/O is injected (`CapabilityFsLike`), so the
policy is unit-tested against an in-memory fake and only the thin `sidebar.ts` glue touches
real `fs`.

**No test may reference workflows** (Decision 1). The extensibility constraint is a code-shape
constraint, verified by the group-ordering assertions, not by a speculative fourth-kind test.

Cases marked **[R]** exist because the review found the previous test list would have passed
while the defect shipped.

### `test/capabilities.test.ts` (pure)

Frontmatter parsing — the cases the real files on this machine exercise:
- plain `key: value` (`.claude/skills/adr/SKILL.md`).
- folded scalar `description: >` spanning indented lines (`.grok/skills/plan/SKILL.md`) → one line.
- quoted value containing a colon (`argument-hint: "[short decision title, e.g. 'use …']"`).
- **[R]** `parseFrontmatter("user-invocable: false")` returns the **string** `"false"`, and
  `frontmatterBool("false", true) === false` / `frontmatterBool(undefined, true) === true` /
  `frontmatterBool("weird", true) === true`.
- **no frontmatter at all** → name from the directory/file stem, description from the first
  non-heading body paragraph, truncated at the cap.
- unterminated `---` fence → treated as no frontmatter, never throws.

Item construction — **every case feeds raw file text, never a pre-parsed object** (structurally
prevents the fixture-vs-parser divergence):
- `user-invocable` absent ⇒ invocable (`invoke === "/name "`).
- **[R]** raw text containing `user-invocable: false` ⇒ **no `invoke`**, still listed, still has `path`.
- `disable-model-invocation: true` ⇒ **still invocable** (it restricts the *model*).
- an agent file is never invocable regardless of frontmatter.

Roots and precedence:
- **[R]** `CAPABILITY_ROOTS.grok` has **no `agent`-kind root under `.claude`/`.cursor`** —
  assert by filtering `kind === "agent"` and checking every `dir` starts with `.grok`/`~/.grok`.
- `CAPABILITY_ROOTS.grok` *does* have `skill`-kind `.claude`/`.cursor` roots;
  `CAPABILITY_ROOTS.claude` has no `.grok`/`.cursor` root of any kind.
- `disabledByEnv` honored: with `GROK_CLAUDE_SKILLS_ENABLED=false` in the injected env, the
  `.claude` skill roots are not scanned; unset ⇒ scanned.
- `layout` respected: `skill-dir` reads `<dir>/<name>/SKILL.md`; `flat-md` reads `<dir>/*.md`.
- `dedupeByPriority`: same name in project `.grok/skills` and `~/.grok/skills` ⇒ one item,
  project wins, `source` reflects the winner. **A skill and an agent sharing a name both
  survive** (key is `kind|name`).
- a missing root (`readdirSync` throws `ENOENT`) is skipped silently and does not abort later
  roots — the real `~/.claude/skills` case here.
- a file that throws on read is skipped; the scan completes.
- `CAPABILITY_SCAN_FILE_CAP` respected ⇒ `truncated: true`.

Merge and grouping:
- **[R]** a disk skill whose name matches an ACP command yields **exactly one** row, with
  `kind: "skill"`, `origin: "disk"`, `path` retained, `invoke` set — and the Commands group
  does **not** contain it.
- **[R]** description stability: a disk skill with a non-empty description keeps it when the
  ACP command supplies a different one; an empty disk description is filled from ACP.
- an ACP command with no disk match ⇒ `kind: "command"`, `origin: "acp"`, no `path`.
- **[R]** running `buildCapabilityGroups` with an empty ACP list and then with a populated one
  over the same disk items yields the **same Skills group** (the panel must not reorganize
  ~1ms after the session goes live).
- `GROK_BUILTIN_AGENTS` present for grok, absent for claude; **[R]** each built-in has no
  `path` and no `invoke`.
- zero discoveries anywhere ⇒ `groups: []`.
- groups ordered by `CAPABILITY_KIND_ORDER`, empty kinds omitted — assert by comparing
  `groups.map(g => g.kind)` to an expected array (the shape-check that keeps the producer
  data-driven rather than three-armed).

### `test/capabilities.dom.test.ts` (happy-dom, real `chat.js` via `bootWebview`)

- `capabilities` message with all three groups ⇒ panel renders headers + rows **in the order
  the message supplied** (assert the rendered header sequence, not three named lookups).
- clicking an **invocable** row seeds the composer with `/name ` and posts no `send`.
- clicking a non-invocable row **with** a `path` posts `{type:"openFile", path}` and leaves the
  composer untouched.
- **[R]** clicking a non-invocable row **without** a `path` (a built-in agent) posts **nothing
  at all** and leaves the composer untouched; the row carries the inert class.
- **[R]** lifecycle — the full fresh-tab sequence: `initialized` (panel hides) → `capabilities`
  (still hidden, `startingPhase` true) → `setBusy:false` ⇒ **the panel is now visible and
  populated from the retained payload**, with no second `listCapabilities` request.
- **[R]** `showOnboarding` (`{type:"onboarding", state:"missing-claude-adapter"}`) hides the
  panel; the onboarding card is the only thing on the canvas.
- **[R]** clicking `#capabilities-btn` leaves the popover **visible** after the click finishes
  (proves the button's `stopPropagation`); clicking inside the popover body does not close it
  (proves the popover's own guard). Both use the harness's real bubbling `click()`.
- **[R]** `initialState` with `showCapabilities: false` ⇒ **no `listCapabilities` posted** and
  neither mount renders; with `true` ⇒ exactly one `listCapabilities` posted. (Asserting from
  `initialState`, not `ready`, is the point — the flag does not exist at `ready` time.)
- a later `{type:"showCapabilities", value:false}` hides both mounts; `value:true` re-requests.
- `groups: []` ⇒ panel hidden, welcome layout otherwise unchanged.
- `error` set ⇒ a muted one-line message, no throw.
- the panel disappears on `clearWelcome()` (first `userMessage`) and does not resurrect on a
  later `capabilities` message.
- opening the popover posts `listCapabilities`; the popover renders the same rows.

### `test/session-store.test.ts` additions (pure)

- **Boundary:** `mtimeMs === sinceMs` is **included**; `sinceMs - 1` excluded.
- `sinceMs` undefined ⇒ byte-identical result to today (regression guard for the popover path).
- **[R]** `days === 0` maps to `sinceMs: undefined` (assert on the host-side helper's mapping,
  not the arithmetic) — 0 must mean "everything", not "nothing".
- `total` is the windowed count; `totalAll` the full count; `hasMore` from the windowed list.
- **[R]** `diskCount` equals the number of rows the disk page produced (and is what the host's
  `nextOffset` is built from) — including the case where the page is short.
- **[R]** `pinnedIds`: an entry whose `mtimeMs` is far outside the window but whose id is
  pinned **is returned**, in mtime order, and counted in `total`; unpinned out-of-window
  entries are still excluded.
- `index` returned is the **unwindowed** merged list (guards the live-synthesis duplicate bug).
- Cache/read interaction: with a counting `readEntries` spy, a windowed first page reads only
  in-window (+ pinned) ids.
- Cross-backend interleave survives windowing.
- `query` + `sinceMs` ⇒ search scoped to the window.

### `test/launcher.dom.test.ts` — **three blocks to rewrite, plus the fixture**

The fixture `BODY` at `:22-23` hardcodes `launcher-section collapsed` / `aria-expanded="false"`.
**Update it to mirror the new `getLauncherHtml` markup** — otherwise the expanded-by-default
change is untestable (the assertion runs after boot, when `applySectionOpen` has already
corrected the DOM, so the pre-script flash is invisible to the test).

Blocks that must be **rewritten, not appended to** — each currently encodes removed behaviour:
1. `describe("launcher recent history (cap 7)")` (`:75-132`) — includes
   `it("has no session-history search and never posts listSessions …")` (`:96-114`), which
   asserts zero `listSessions` posts; the paging launcher posts them on scroll. The
   "no search box" half of that assertion should survive the rewrite (search is still a non-goal).
2. `describe("launcher collapsible sections")` (`:183-230`) — `it("starts with Recent collapsed")`
   (`:184-190`) inverts.
3. `describe("launcher backend badges (merged grok + Claude history, WP4)")` (`:232-268`) —
   `:249` and `:267` assert no badge for grok / legacy rows.

Cases:
- Host sends 50 entries with `hasMore: true` ⇒ **all 50 render**.
- **[R]** Scroll-near-bottom posts `listSessions` with the offset the host supplied as
  `nextOffset` — specifically, a page whose message carries `nextOffset: 50` while
  `entries.length === 51` (one pinned/synthetic row prepended) must request **50, not 51**.
- A second scroll before the reply does not post again (`loading` guard).
- `offset > 0` appends and de-dupes by id; `offset === 0` (first page) replaces.
- **[R]** Sticky window: load 3 pages (150 rows), then dispatch an unsolicited
  `offset: 0, entries: 50` page ⇒ the launcher posts `{type:"listSessions", offset:0, limit:150}`
  and does **not** shrink to 50 rows; when that reply arrives it renders 150 rows and posts
  **no further** `listSessions` (the `pendingWindowRefresh` loop guard).
- **[R]** Ceiling: at `LAUNCHER_MAX_ROWS` rows, a further scroll posts nothing, and the notice
  row's text contains the **windowed `total`** and not `totalAll` — assert with
  `total: 620, totalAll: 3000` that the notice says `620` and never `3000`.
- **[R]** Footer: `entries: []`, `total: 0`, `totalAll: 120` ⇒ footer **shown** (keyed off
  `totalAll`) — the mirror of the ceiling case, so the two totals cannot be conflated.
- Empty window: `total: 0`, `totalAll: 0` ⇒ "No sessions yet."; `totalAll: 120` ⇒ the windowed
  empty copy pointing at the chat history.
- **[R]** Expanded by default: no persisted state ⇒ `.expanded`, not `.collapsed`,
  `aria-expanded="true"`; persisted `historyOpen: false` still collapses.
- **[R]** Live out-of-window row keeps its dot: dispatch a `sessions` page containing a pinned
  row plus a `sessionDot` for that id ⇒ `[data-session-dot]` for it exists and carries the
  `needs-you` class. (Pre-fix the row is absent and `patchDot` silently no-ops.)
- Badges: grok / claude / legacy-no-`backend` rows each render `.history-row-backend` reading
  `Grok` / `Claude` / `Grok`; `.history-row-name` still carries the ellipsis structure.

**[R] Markup parity test** (new, small): read `src/sidebar.ts` as text and assert
`getLauncherHtml`'s history section contains `launcher-section expanded` and
`aria-expanded="true"` — and that the fixture `BODY` agrees. This is deliberately a
source-text assertion: the fixture is a hand-maintained mirror and nothing else catches drift
between it and the shipped markup. (The same technique is *suggested*, not mandated, for
`test/webview-harness.ts` vs `getHtml`.)

### `test/webview-helpers.test.ts`

- `backendBadgeLabel`: `"grok" → "Grok"`, `"claude" → "Claude"`, `undefined → "Grok"`,
  `"" → "Grok"`, `"something-else" → ""`. The existing `describe("backendBadgeLabel")` block
  is the record of the old idiom — rewrite it.
- `capabilityGroupsView`: preserves the supplied group order, `+N more` when `total > items.length`,
  empty groups dropped, long descriptions truncated, and **an item with neither `invoke` nor
  `path` is marked inert** in the returned model.

### `test/webview-ui.dom.test.ts`

- **Rewrite** `describe("history popover backend badges …")` (`:221-250`): `:235` (grok row has
  no badge) and `:249` (legacy row has no badge) both invert to a `Grok` chip.
- **[R]** (Decision 4 option b) The chat popover pages off `nextOffset`: a first page with
  a synthetic row prepended (`entries.length === 101`, `nextOffset: 100`) followed by a
  scroll-to-bottom posts `listSessions` with `offset: 100`.

### `test/status-bar.test.ts`

- **Untouched.** Decision 2 — the existing quiet-for-grok assertions are the regression guard
  against someone "harmonising" the HUD with the new badge.

### Verify commands

```bash
npm test
npx tsc -p . --noEmit
```

Targeted: `npx vitest run test/capabilities.test.ts test/capabilities.dom.test.ts`,
`npx vitest run test/session-store.test.ts test/launcher.dom.test.ts test/webview-helpers.test.ts test/webview-ui.dom.test.ts`.

`npm run test:live` is **not** required (nothing changes the ACP wire); it remains mandatory
before any release/tag, per CLAUDE.md.

---

## Risks and resolved decisions

### Risks

- **Canvas clutter regression.** `74e923a` removed canvas chrome for good reasons. Mitigations:
  nothing renders unless discovery found something; every row is a real capability with a real
  action; `grok.showCapabilities` turns it off; the panel obeys the `clearWelcome()` lifecycle.
- **Frontmatter parser scope creep.** Deliberately limited to `key: value`, folded `>`/`|`
  blocks, and quoted scalars, returning strings; coercion is a separate named helper. Adding a
  YAML dependency is out of scope.
- **Scan cost.** Bounded by `CAPABILITY_SCAN_FILE_CAP` + `CAPABILITY_HEAD_BYTES` and by
  scanning only the fixed capability roots — never a workspace-wide glob.
- **Badge steals width in a narrow activity bar.** Every row now carries a chip; the row is
  flex with `min-width: 0` + ellipsis, so it degrades to a shorter name. Asserted structurally
  (happy-dom cannot verify real layout) — needs a human eyeball at a narrow width before ship.
- **Unbounded DOM growth in the launcher.** Bounded by `LAUNCHER_MAX_ROWS` + on-demand paging,
  with a test that the ceiling stops further requests.
- **Two totals are easy to swap.** `total` (windowed) drives paging + the ceiling notice;
  `totalAll` (unwindowed) drives only the footer. Two mirror-image tests pin both.
- **`index` windowing is a silent duplicate-row bug.** Explicitly tested.
- **`media/chat.js` is touched by two work packages.** WP2 edits the welcome/top-bar region;
  WP3 (option b) edits the history-popover paging region. Disjoint, but sequence WP3 after WP2
  or expect a trivial merge.
- **Doc drift on a now-divergent idiom.** CLAUDE.md states quiet-for-grok twice and § Status-bar
  HUD says it *mirrors* `backendBadgeLabel`. After this change that cross-reference is false;
  updating only the history section leaves the HUD section reading as a stale bug that a future
  agent will "fix". Both must be updated.

### ADR recommendation

Record **one ADR** via the `adr` skill (`.claude/skills/adr/SKILL.md`) covering the whole
backend-labelling decision, not half of it:

- **Context** — merged two-backend history; `backendBadgeLabel` was deliberately quiet for grok,
  and `computeStatusBar` was built to mirror that idiom.
- **Options** — (a) quiet-for-default everywhere; (b) label both everywhere; (c) **label both on
  history rows, stay quiet on the status bar** — chosen.
- **Decision + consequence** — the two surfaces diverge *on purpose*: interleaved rows need
  per-row disambiguation, a single width-constrained always-visible item does not.

A second ADR is worth considering for **"the on-disk capability-discovery contract"** —
committing to grok's documented root list (`08-skills.md`, `16-subagents.md`) and Claude's
`.claude/*` layout means an upstream CLI change can silently produce a wrong or empty panel.
Recommended if/when the deferred workflows group (or MCP/personas) widens the contract.

### Resolved decisions (were open questions)

Kept rather than deleted — the reasoning is the durable part.

1. **Scope of "capabilities" — RESOLVED: commands + skills + agents only; workflows deferred.**
   Rationale: workflows are not a CLI capability on either backend — `.grok/workflows/*` is this
   repo's GrokForge template convention, marked *"No — reference only"* by that template's own
   README, and Claude has no workflows concept. Shipping it now would put a group on the canvas
   the CLI cannot act on — the "decorative chrome" failure `74e923a` corrected. **Consequence:**
   no `workflow` kind, root, group, or test — but the group structure stays data-driven so
   adding one later is one entry in `CAPABILITY_KIND_ORDER`/`_LABELS` plus a discovery source.

2. **Status-bar HUD — RESOLVED: stays quiet for grok.** The rationales genuinely differ: a
   history *list* interleaves both backends by recency and needs per-row disambiguation; the
   status bar is a single always-visible item with a hard width budget describing one open
   session whose model is already named. **Consequence:** `src/status-bar.ts` and
   `test/status-bar.test.ts` untouched; CLAUDE.md must record **both** halves; the ADR covers
   the pair.

3. **7-row cap and collapse default — RESOLVED: the window fully replaces the cap, Recent
   defaults to expanded.** An always-collapsed section would hide the list the request asked
   for, and a 7-row cap inside a 30-day window is two competing bounds. **Consequence:**
   `HISTORY_LIMIT = 7` deleted; `LAUNCHER_PAGE_SIZE = 50` + `LAUNCHER_MAX_ROWS = 500`;
   `getLauncherHtml`'s server-rendered markup must flip too, or the view flashes collapsed.

4. **Paging cursor — RESOLVED: fix the shared pattern, both surfaces (option (b)).** Israel's
   call. The plan was already written for (b), so nothing below changes; option (a) is retained
   only as the documented downgrade path.

### Decision 4 in full — why the cursor fix spans both surfaces

The review found the load-more cursor bug (§ Thread 3) is **not new** — `media/chat.js:1812`
already computes `requestSessions(state.sessions.length)` while the host prepends synthesized
live rows, so the shipped chat history popover already skips a real session per page boundary
whenever a live session isn't yet flushed to disk (usually 1–2 rows).

- **(a) Launcher only.** Smallest diff, strictly scoped to this feature. Downside: the plan
  tells the implementer to "mirror chat.js", and the launcher would end up with the *correct*
  cursor while chat.js keeps the broken one — two paging idioms in one codebase, and the next
  person to touch either will not know which is canonical.
- **(b) Fix the shared pattern — CHOSEN, and what this plan is written for.** The host
  emits an authoritative `nextOffset` in the `sessions` message and **both** webviews page off
  it. Cost: one extra field, ~3 changed lines in `media/chat.js`, and one added case in
  `test/webview-ui.dom.test.ts`. It also removes the whole class (client arithmetic over a list
  the host has since mutated), which `pinnedIds` would otherwise widen — pinned out-of-window
  rows are a *second* source of non-disk rows in the page.

(a) was declined. Recorded here as the downgrade path should (b) prove costlier than estimated:
drop the `media/chat.js` (WP3 region) row from the Modified table, drop the
`test/webview-ui.dom.test.ts` `nextOffset` case, and keep `nextOffset` in the `sessions` message
consumed by `media/launcher.js` only. Everything else stands.

---

## Work packages

**One implementer dispatch handles exactly one work package, end to end** — its code, its tests,
and the doc updates it implies. WP1 and WP3 are independent. WP2 is written against the frozen
message contract and is independently testable (its DOM tests dispatch synthetic `capabilities`
messages), but should land **after** WP1 so the feature is live end to end; **WP3 should land
after WP2** if option (b) stands, since both touch `media/chat.js` (disjoint regions).

### WP1 — Capability discovery engine + host plumbing

Pure policy in `src/capabilities.ts`, impure glue in `src/sidebar.ts`. No webview rendering.

- [x] Create `src/capabilities.ts`, doc comment citing `~/.grok/docs/user-guide/08-skills.md`
      § Skill Locations **and `16-subagents.md`** as the source of the root list, and noting
      that the agent roots are grok-only by design.
- [x] Define `CapabilityKind` (`"command" | "skill" | "agent"` — **no `workflow`**),
      `CapabilityItem`, `CapabilityGroup` per the frozen contract, `CapabilityRootSpec`
      (`kind`/`base`/`dir`/`layout`/`source`/`disabledByEnv`), and `CapabilityFsLike`
      (`existsSync`/`readdirSync`/`statSync`/`readHead`).
- [x] Define `CAPABILITY_ROOTS` **per backend AND kind**, exactly as tabulated in § Root spec —
      grok's `agent` roots are `.grok/agents` + `~/.grok/agents` **only**.
- [x] Honor `disabledByEnv` from an **injected** env object (testable without mutating
      `process.env`); document that the `config.toml` opt-out form is not honored.
- [x] Define `CAPABILITY_KIND_ORDER` — group assembly iterates it; never branch on the kinds.
- [x] Implement `parseFrontmatter` returning `Record<string, string>` (plain/quoted scalars,
      folded `>`/`|` blocks; malformed input ⇒ `{}`, never throws) **and** the separate
      `frontmatterBool(raw, fallback)` coercion helper.
- [x] Implement `capabilityFromSkillFile` — name/description fallbacks, `user-invocable`
      defaulting to **true via `frontmatterBool`**, `disable-model-invocation` not affecting
      invocability, agents never invocable, description truncation, `layout`-aware naming.
- [x] Add `GROK_BUILTIN_AGENTS` (`general-purpose`, `explore`, `plan`) with descriptions from
      the shipped user guide, **no `path`, no `invoke`**; empty for Claude. Return fresh
      objects per call (never hand the shared constant's objects to a mutating merge).
- [x] Implement `dedupeByPriority` keyed on `` `${kind}|${name}` ``.
- [x] Implement `mergeAcpCommands` per § Merge rule — disk kind authoritative, ACP enriches,
      unmatched ACP commands become `kind: "command"`, disk description wins when non-empty.
- [x] Implement `buildCapabilityGroups` with `CAPABILITY_GROUP_CAP`, per-group `total`,
      `truncated`, `CAPABILITY_KIND_ORDER` ordering, empty groups dropped.
- [x] Add `CAPABILITY_HEAD_BYTES` / `CAPABILITY_SCAN_FILE_CAP`.
- [x] `src/sidebar.ts`: add `{ type: "listCapabilities" }` to `WebviewMsg` + the handler —
      resolve cwd + `resolveGrokHome`/`resolveClaudeHome`, walk `CAPABILITY_ROOTS[session.backend]`
      with per-root try/catch (missing dir = silent skip), bounded head reads, then
      `buildCapabilityGroups` with `session.client?.availableCommands ?? []`.
- [x] Post via `postTo(session, {type:"capabilities", …})` — **never** `emit`; add the short
      why-comment mirroring the existing `postTo` rationale comments.
- [x] Re-post from the existing `client.on("commandsUpdate", …)` handler (`src/sidebar.ts:2264`).
- [x] **Guard the `openFile` handler against a missing/blank `msg.path`** — return early rather
      than reaching `parseFileRef(undefined)` (`src/sidebar.ts:2747` → `src/file-ref.ts:21`).
- [x] `package.json`: add `grok.showCapabilities` (bool, default `true`); include it in
      `postPanelConfig`'s `initialState` alongside `showThinking`/`compactActivity`.
- [x] **Add `grok.showCapabilities` to the existing `onDidChangeConfiguration` watcher**,
      broadcasting `{type:"showCapabilities", value}` — mirroring how `showThinking` re-posts.
- [x] Write `test/capabilities.test.ts` per Test strategy, including every **[R]** case. Item
      tests feed **raw file text**. No workflows fixtures.
- [x] Update CLAUDE.md § Module map, § ACP surfaces, and add `capabilities` to § Native tabs'
      transient-`postTo` list.

Verify: `npm test && npx tsc -p . --noEmit`

### WP2 — Capability surfacing in the session tab (two mounts)

Pure view-model + webview rendering. Built against the frozen contract; lands after WP1.

- [x] `media/webview-helpers.js`: add `capabilityGroupsView({groups, backend})` — **iterates the
      supplied `groups` array**, no fixed keys, no three-kind branching — returning per-row
      label/description/action and an **inert** marker for a row with neither `invoke` nor
      `path`; plus `CAPABILITY_KIND_LABELS`. Export both from the `api` object.
- [x] `src/sidebar.ts` `getHtml`: add `<button id="capabilities-btn" class="toolbar-btn studio-top-btn">Skills</button>`
      + `<div id="capabilities-popover" class="toolbar-popover history-popover studio-popover" hidden>`
      to `.top-bar` beside Docs, and `<div id="capabilities-panel" class="capabilities-panel" hidden></div>`
      inside `#welcome`, below `#session-setup-card`.
- [x] **`test/webview-harness.ts`: add the same three ids to the `BODY` mirror (`:21-62`).**
      Do this first — without it every WP2 DOM case fails with null mounts.
- [x] `media/chat.js`: `state.capabilities` (ephemeral, not buffered); handle the `capabilities`
      message; `renderCapabilitiesPanel()` renders **from state** with `renderSessionSetupCard`'s
      gate; `hideCapabilitiesPanel()` clears the DOM **without discarding `state.capabilities`**.
- [x] `media/chat.js`: wire **all four** lifecycle anchors — `initialized` → hide (beside
      `hideSessionSetupCard()` at `:4554`); `setBusy` → re-render (beside
      `refreshSessionSettingsMounts()` at `:4969`); `showOnboarding` → hide in **each of the four
      branches** (`:2072, :2088, :2104, :2117`); `clearWelcome`/`resetForNewSession` → hide
      (`:2003, :2030`).
- [x] `media/chat.js`: `openCapabilitiesPopover()` reusing `closePopovers()` +
      `positionDropdownPopover`; register the popover in `closePopovers()`; **add both
      `stopPropagation` guards** — on `#capabilities-btn`'s `onclick` and as a `click` listener
      on `#capabilities-popover` (mirroring `:5085` and `:5090`).
- [x] `media/chat.js`: request `listCapabilities` from the **`initialState` handler** (gated on
      `msg.showCapabilities`), **not** from `ready`; handle `{type:"showCapabilities", value}`
      by hiding both mounts or re-requesting.
- [x] Row actions: invocable → `applyComposerSeed`/`insertComposerPrompt` with `"/name "`, never
      auto-send; non-invocable **with** `path` → `postMessage({type:"openFile", path})`;
      non-invocable **without** `path` → **no handler at all** (inert row).
- [x] `media/chat.css`: `.capabilities-panel`, `.capability-group`, `.capability-row`,
      `.capability-row.inert`, `.capability-more` — VS Code tokens only, reusing `.history-list` /
      `.studio-popover-*`; `[hidden]` needs an explicit `display:none` if an element inherits
      `inline-flex` from `.toolbar-btn` (the documented `#model-label` gotcha).
- [x] Write `test/capabilities.dom.test.ts` per Test strategy, including every **[R]** case
      (lifecycle sequence, onboarding hide, both popover guards, `initialState` gating, inert row).
- [x] Add the `capabilityGroupsView` cases to `test/webview-helpers.test.ts`.
- [x] Update CLAUDE.md § Chat surfaces ("Capability browser" — two mounts, one pure builder,
      seed/open-file/inert rule, the four lifecycle anchors, `grok.showCapabilities`), § Known
      limits (MCP/personas/plugins not enumerable; **workflows deferred, not impossible**;
      `config.toml` compat opt-out not honored), and the `media/*` rows in § Module map. Add the
      feature to `README.md` and `docs/architecture.md`.

Verify: `npm test && npx tsc -p . --noEmit`

### WP3 — History UX: 30-day launcher window, paging, and backend badges

Pure windowing in `session-store.ts`, host glue in `sidebar.ts`, launcher rewrite, badge flip.
Includes Decision 4's shared cursor fix (option **(b)** — both webviews page off `nextOffset`).

- [x] `src/session-store.ts`: add `sinceMs?: number` and **`pinnedIds?: ReadonlySet<string>`** to
      `MergedSessionsPageDeps`; add `totalAll` and **`diskCount`** to `MergedSessionsPage`. Window
      the merged index **after** the sort and **before** pagination/search, with
      `mtimeMs >= sinceMs || pinnedIds.has(id)`; keep the returned `index` **unwindowed** (comment
      explaining the live-synthesis duplicate-row hazard).
- [x] `src/sidebar.ts`: `LAUNCHER_HISTORY_LIMIT = 7` → `LAUNCHER_PAGE_SIZE = 50`; add
      `LAUNCHER_MAX_ROWS = 500`; add `launcherHistoryDays()` reading `grok.launcherHistoryDays`
      clamped 0–365 and **short-circuiting `0` to `sinceMs: undefined`** before any arithmetic.
- [x] `src/sidebar.ts`: thread `sinceMs` + `pinnedIds` (every live pool member's
      `activeSessionId`) through `buildSessionsMessage`; emit `totalAll`, `windowDays`, and
      **`nextOffset = offset + page.diskCount`** in the `sessions` message.
- [x] `postLauncherSessions`: pass `sinceMs`/`pinnedIds`, honor the client's `offset`, and cap
      `limit` at **`LAUNCHER_MAX_ROWS`** (not `LAUNCHER_PAGE_SIZE` — the sticky-window refresh
      re-requests the whole loaded window in one call). Leave `replySessionsList` with **no**
      `sinceMs`/`pinnedIds`, with a comment saying the popover intentionally keeps full history.
- [x] **Add `grok.launcherHistoryDays` to the existing `onDidChangeConfiguration` watcher**,
      calling `postLauncherSessions()` so a settings edit applies without a reload.
- [x] **`src/sidebar.ts` `getLauncherHtml` (`:4567-4568`)**: `collapsed` → `expanded`,
      `aria-expanded="false"` → `"true"`, `title="Expand section"` → `"Collapse section"`.
- [x] `package.json`: add `grok.launcherHistoryDays` (number, default `30`, `0` = unlimited).
- [x] `media/launcher.js`: **delete** `HISTORY_LIMIT = 7` and its `slice`; `offset===0` replaces /
      `offset>0` appends de-duped by id; store `state.nextOffset` from the message; scroll-near-
      bottom posts `listSessions` with **`state.nextOffset`**, guarded by `hasMore` + `loading` +
      `LAUNCHER_MAX_ROWS`.
- [x] `media/launcher.js`: **sticky-window refresh** — on an `offset === 0` page while more than
      one page is loaded, re-request `{offset: 0, limit: loadedCount}` instead of rendering it,
      guarded by a `pendingWindowRefresh` flag set before the request and cleared on the next
      `sessions` message (without the flag it recurses forever).
- [x] `media/launcher.js`: ceiling notice keyed off **`total`** (windowed) + `windowDays`;
      `updateFooter` keyed off **`totalAll ?? total`**; windowed empty-state copy; `historyOpen`
      default `saved.historyOpen !== false`.
- [x] **`media/chat.js` (option b)**: read `state.nextOffset` from the `sessions` message and use
      it in the history popover's `list.onscroll` in place of `state.sessions.length` (`:1812`).
- [x] `media/webview-helpers.js`: flip `backendBadgeLabel` per § Thread 4 and rewrite its
      comment (it currently documents the quiet-for-grok idiom). **Do not touch
      `src/status-bar.ts`** (Decision 2).
- [x] `media/chat.css`: update the `.history-row-backend` comment; add `.launcher-list-notice`.
      No new badge selectors; `.launcher-list` already scrolls.
- [x] `test/session-store.test.ts`: add the `sinceMs` / `pinnedIds` / `diskCount` / `days === 0`
      cases, including every **[R]**.
- [x] `test/launcher.dom.test.ts`: **update the fixture `BODY` (`:22-23`) to the new markup**, and
      **rewrite all three blocks** — `describe("launcher recent history (cap 7)")` (`:75-132`,
      incl. the "never posts listSessions" case at `:96`), `describe("launcher collapsible
      sections")` (`:183`, `it("starts with Recent collapsed")` at `:184`), and
      `describe("launcher backend badges …")` (`:232`, assertions at `:249`/`:267`). Add every
      **[R]** case (nextOffset cursor, sticky window + loop guard, ceiling denominator, footer
      denominator, expanded default, pinned-row dot).
- [x] Add the **[R]** markup-parity test asserting `getLauncherHtml`'s history section and the
      fixture `BODY` agree on `expanded` / `aria-expanded="true"`.
- [x] `test/webview-helpers.test.ts`: rewrite the `backendBadgeLabel` block.
- [x] `test/webview-ui.dom.test.ts`: **rewrite** `describe("history popover backend badges …")`
      (`:221-250`; `:235` and `:249` invert) and add the **[R]** `nextOffset` paging case.
      Leave `test/status-bar.test.ts` untouched.
- [x] Update CLAUDE.md § History pagination (badge labels both backends incl. the legacy default;
      windowed + paged + scrollable launcher with a render ceiling; `nextOffset` as the
      authoritative cursor for both surfaces; `total` vs `totalAll` vs `pinnedIds`) **and**
      § Status-bar HUD (rewrite the "mirroring `backendBadgeLabel`'s quiet-for-grok idiom"
      sentence: the HUD *deliberately retains* the quiet default, with the reason). Note the new
      settings in § ACP surfaces.
- [x] Record the backend-labelling decision as an ADR using the `adr` skill — covering **both**
      the history-row reversal and the retained quiet status bar, and why they differ.

Verify: `npm test && npx tsc -p . --noEmit`

---

## Review findings addressed

An xhigh multi-agent review (65 candidates, 50 verifiers, 9 refuted) surfaced 15 spec defects in
the first draft of this plan. All 15 are fixed above. Recorded so the next reader knows the plan
was hardened rather than written this way, and does not re-open settled ground.

| # | Defect | Fix |
|---|---|---|
| 1 | Load-more cursor said "mirror chat.js", but chat.js pages off the rendered row count while the host prepends synthetic rows ⇒ real sessions permanently skipped | Host emits authoritative `nextOffset`; both webviews page off it. Fork surfaced as **Decision 4** |
| 2 | `broadcastSessionsList()` pushes an offset-0 "replace" on every send/rename/delete/tab change ⇒ wipes every scrolled-in page | **Sticky-window refresh** + `pendingWindowRefresh` loop guard; host caps launcher `limit` at `LAUNCHER_MAX_ROWS` |
| 3 | `grok.showCapabilities` gated at `ready`, but it only arrives in `initialState` (posted *after* `ready`) | Request moved to the **`initialState` handler**; test asserts from `initialState` |
| 4 | Panel copied `renderSessionSetupCard`'s gate but none of its call-site anchors ⇒ rendered once, during priming, while the gate was shut; and not hidden by onboarding | **Four anchors** tabulated (`initialized`/`setBusy`/`showOnboarding`×4/`clearWelcome`) + hide-must-not-discard; lifecycle + onboarding tests added |
| 5 | New popover registered in `closePopovers()` but missing the two `stopPropagation` guards every sibling has ⇒ opening click immediately re-hides it | Both guards specified with their `media/chat.js:5085/5090` precedents; two DOM tests |
| 6 | `test/webview-harness.ts` (the hand-maintained `<body>` mirror all chat DOM suites boot through) missing from the change surface ⇒ all nine WP2 cases fail on null mounts | Added to the Modified table and as the **first** WP2 checklist item |
| 7 | One flat root list per backend ⇒ grok would list `.claude/agents` as grok subagents | `CapabilityRootSpec` defined and `CAPABILITY_ROOTS` made **per kind**; grok agents are `.grok`-only; env-var compat opt-out honored; tests assert both |
| 8 | Merge rule never said which kind/group a merged row lands in ⇒ duplicate rows, or Skills collapsing ~1ms after the session goes live | **Disk kind authoritative, ACP enriches**; Commands = unmatched ACP builtins; dedupe key `kind\|name`; stability test across the `commandsUpdate` transition |
| 9 | `parseFrontmatter` returns text, so `user-invocable: false` is the truthy string `"false"` ⇒ default-true rule inverts | Parser returns strings by contract + separate `frontmatterBool`; item tests must feed **raw file text** |
| 10 | Built-in agent rows have neither `invoke` nor `path` ⇒ click posts `openFile` with no path ⇒ `parseFileRef(undefined)` throws | Such rows are **inert** (no handler); host also guards `openFile`; DOM test asserts the click posts nothing |
| 11 | "Live rows exempt by construction" false for a live session on disk with a stale mtime ⇒ row *and* its status dot vanish | **`pinnedIds`** in the pure windowing layer; session-store + launcher-dot tests |
| 12 | Neither new setting re-posts on `onDidChangeConfiguration` ⇒ both read as broken until reload | Watcher entries specified in WP1 (`showCapabilities` broadcast) and WP3 (`launcherHistoryDays` re-post) |
| 13 | Ceiling notice denominator pinned to unwindowed `totalAll` ⇒ states a count the windowed list can never reach, baked into an assertion | Notice keyed off windowed **`total`**; mirror-image tests pin notice→`total` and footer→`totalAll` |
| 14 | `test/webview-ui.dom.test.ts` listed as add-only while `:235`/`:249` assert the old quiet-for-grok behaviour ⇒ 975-test floor broken | That `describe` block is now an explicit **rewrite**, with line refs |
| 15 | Expanded-by-default scoped to `launcher.js` while `getLauncherHtml` hardcodes `collapsed` ⇒ visible flash + wrong ARIA, invisible to the fixture-based test | `getLauncherHtml` given its own Modified-table row + checklist item; fixture `BODY` updated; **markup-parity test** added |

**Modified-table audit** (prompted by 14/15): also added `test/webview-harness.ts`,
`src/sidebar.ts → getLauncherHtml` as a distinct row, `media/chat.js` (WP3 region) for the
shared-cursor fix, and the `test/launcher.dom.test.ts` fixture. Two further stale suites were
found by inspection and named for rewrite: `test/launcher.dom.test.ts:96` ("has no
session-history search and never posts listSessions" — the paging launcher does post them) and
`:184` ("starts with Recent collapsed").

**Not re-litigated** — the review's 9 refuted candidates, chiefly: `applyComposerSeed`'s
newline-append behaviour, `launcherHistoryDays: 0` (the plan already said "`0` = no window"),
`totalAll` under a non-empty query, and the shared-constant mutation concern for
`GROK_BUILTIN_AGENTS` (nonetheless made explicit in WP1 — "return fresh objects per call" — as a
zero-cost hardening).
