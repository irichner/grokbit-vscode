# Grokbit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com) [![Unofficial](https://img.shields.io/badge/Unofficial-community%20%C2%B7%20MIT-FF6B35)](#)

> A VS Code UI for **xAI's Grok Build CLI** — not affiliated with or endorsed by xAI. *Grok*, *Grok Build*, and *xAI* are trademarks of xAI; this project uses those names only to describe what it's compatible with.
>
> Based on [phuryn/grok-build-vscode](https://github.com/phuryn/grok-build-vscode) by Paweł Huryn, MIT License.

**Grokbit** is the friendly editor UI for **Grok Build** and optional **Claude Code**. Chat in native editor tabs, plan safely, review every edit before it lands, run a built-in explore → plan → implement → test → document workflow, attach files, paste screenshots into the composer, generate images & video, and dictate by voice — without living in the terminal.

Install the free `grok` CLI once, sign in (subscription or API key), and Grokbit is the GUI on top. Claude Code tabs use your existing `claude` login when that backend is enabled.

**Install free from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=grokbit.grokbit) or [Open VSX Registry](https://open-vsx.org/extension/grokbit/grokbit)**

![Grokbit in VS Code — a prompt and Grok's rendered response, each session in its own editor tab](docs/screenshots/PromptExample.png)

---

## Capabilities overview

Everything Grokbit ships, at a glance. Details and screenshots follow below.

### Sessions & layout

| Capability | What you get |
|---|---|
| **Native session tabs** | Each chat is its own editor tab — keep several open and switch like any document. Full-width canvas by default (no narrow ribbon). |
| **Activity-bar launcher** | Recent sessions (default last 30 days, scrollable & paged), status dots, rename/delete, split **New** for Grok or Claude. |
| **Session setup (top bar)** | Pick **Agent**, **Model**, **Thinking** depth, and **Mode** from a compact summary chip on the **left of the top bar** (also from the composer model chip). Empty-tab changes are free. |
| **Resumable history** | Resume, rename, delete, search, paginated load (100 at a time), clear-all (open tabs protected). Merged Grok + Claude list with backend badges. |
| **Tab restore** | After a VS Code reload, tabs come back; the visible tab reconnects first. |
| **Empty-session cleanup** | Abandoned primer-only “New session” tabs don’t clutter history (Grok). |

### Two agents

| Capability | What you get |
|---|---|
| **Grok Build** (default) | xAI’s coding agent via the Grok CLI — models, thinking depth, plan primer, `/imagine`, and more. |
| **Claude Code** (optional) | Per-tab backend switch; launcher **New Claude session**; own auth/onboarding; history resumes on the correct backend. |
| **Per-backend logout** | Log out of Grok or Claude without signing out of the other. |

### Safety & control

| Capability | What you get |
|---|---|
| **Agent mode** | Help right away; may ask before edits or commands. |
| **Plan first** | Draft a plan before anything changes; client-side gate blocks workspace writes and non-read-only commands until you approve. |
| **Auto accept** | Apply edits without per-change prompts when you trust the session. |
| **Permission cards + inline diffs** | Green/red diff *inside* the chat card — Allow this change / Allow always / Don’t allow. No focus-stealing diff editor tab. |
| **Path/command-bound grants** | “Allow always” stays scoped to the path or command when the payload carries one. |
| **Inline questions** | Multiple-choice cards from the agent; collapse to a green ✓ after you answer; replay on resume. |
| **Remembered mode** | Last non-plan mode (Agent / Auto accept) is remembered for new sessions; Plan first is always deliberate. |

### Grokbit Actions (bundled workflow)

Ships with the extension and works on **both** Grok and Claude. Click a tile to seed the composer — nothing sends until you press Enter.

| Skill | Purpose |
|---|---|
| **`/grokbit-explore`** | Map relevant code first — compact, cited orientation before changes. |
| **`/grokbit-plan`** | Grounded, reviewed plan — claims from the repo, tasks with proof commands. |
| **`/grokbit-implement`** | One task at a time; each check passes or is reverted — no half-finished state. |
| **`/grokbit-test`** | Baseline behavior before the change, then prove what did and didn’t change. |
| **`/grokbit-document`** | Write the doc, then run every command in it. |

How they work in depth: [docs/grokbit-workflows.md](docs/grokbit-workflows.md) (also **Details** on each tile in-app). Skills install into `~/.grok/skills` and `~/.claude/skills` on activation (`grok.skills.provision`). Set **`grok.actionsScope`** to `all` to also list your discovered skills, agents, and CLI commands in Actions; default is workflow-only. Slash **`/` autocomplete** always has CLI commands.

### Context & files

| Capability | What you get |
|---|---|
| **File chips** | Drag from Explorer, **+** button, right-click **Grokbit: Send File**, or **Alt+G**. |
| **Active-editor context** | Optional auto-include of the open file (`grok.includeActiveFileByDefault`). Explicit attachments rank stronger. |
| **Shift-drag embed** | Embed file contents as a fenced block instead of a path reference. |
| **Docs browser** | Top-bar **Docs** — browse business documents in the workspace; open, reveal, attach, or seed into the composer. |
| **Document cards** | When a turn produces a doc path — Copy / Open / Reveal. Generation via CLI skills (`/docx`, `/pptx`, `/xlsx`, …) or plain language. |

### While the agent works

| Capability | What you get |
|---|---|
| **Activity carousel** | One compact strip per turn (current action, step counter, ‹ › peek); collapses to a plain-language summary (e.g. *Explored 5 items, edited 2 files · 9 steps*). Off = classic stream (`grok.compactActivity`). |
| **Tool rows** | Category icons, expandable command output + copy, failed tools with a short reason, view-diff on past edits. |
| **Files-changed strip** | Scannable `auth.ts +12 −3` chips above the composer for this turn’s applied edits. |
| **Thinking control** | Full traces off by default; *Thinking…* stand-in; toggle live (`grok.showThinking`). Continuous progress affordance mid-turn. |
| **Streaming answers** | Agent text streams live with markdown, code, tables. |

### Awareness & multi-session

| Capability | What you get |
|---|---|
| **Status dots** | Blue working · yellow needs you · green/red unread done · gray at rest — on launcher and history rows. |
| **Status-bar HUD** | Always-visible model · thinking · mode · context % · working spinner · “needs you” count. Click to jump to chat. |
| **Background notifications** | Optional passive “Go to session” when a hidden tab needs you (`grok.notifyWhenWaiting` — never steals focus). |

### Models, media & voice

| Capability | What you get |
|---|---|
| **Model picker** | Choose the model from setup card, model chip, gear, or command palette. Cross-agent switches restart cleanly. |
| **Thinking depth** | Per-tab reasoning effort (none → xhigh) for Grok; omitted cleanly for Claude (no effort axis). |
| **Image & video** | `/imagine` and `/imagine-video` render **inline** (subscription Grok features); copy path / open in VS Code; resume-safe. Reference-photo edit when the CLI offers it. |
| **Voice control** | Mic in the composer → live STT; say **“grok send”** (configurable) to submit. Needs `ffmpeg` + a separate xAI API key (pay-as-you-go). |

### Rich chat & power tools

| Capability | What you get |
|---|---|
| **Markdown** | Full formatting — code, lists, tables. |
| **LaTeX** | MathJax offline; hover to copy or export PNG/SVG. |
| **Mermaid** | Inline diagrams (theme-aware); hover to copy or export. |
| **Slash commands** | Type `/` for CLI autocomplete (`/compact`, `/imagine`, your skills, …). |
| **MCP tools** | Configure in the CLI config; gear links to config; new session to reload. |
| **Context donut** | How full the conversation window is; `/compact` or new session to free room. |
| **Chat zoom** | Zoom only the chat panel 60–300% (`grok.chatFontScale`). |
| **Keyboard shortcuts** | `Ctrl/Cmd+;` open, `Alt+G` attach file, Enter/Ctrl+Enter send — listed in gear → Keyboard shortcuts. |
| **Sign out** | Per-backend logout; history stays on disk. |
| **Telemetry** | Anonymous `session_start` only (install id + mode/model/effort) — never content, code, or paths. Opt out anytime. |

![Multiple sessions in the launcher with status dots, each session its own editor tab](docs/screenshots/NewSession.png)

---

## Who this is for

- **Prefer a GUI over the terminal** — chat, approve changes, and manage history without memorizing CLI commands.
- **Want a safety net** — Plan first mode, permission cards, and inline diffs so you always see what will change.
- **Work in VS Code / Cursor / similar** — the agent sits next to your files, not in a separate app.
- **Use Grok and/or Claude Code** — one extension, per-tab choice of agent.

Engineers can still use the CLI; this extension does not remove power features — it wraps them in plain language.

---

## Requirements

- **VS Code** 1.94+ (or a compatible editor — Cursor, Windsurf, VSCodium).
- **The Grok Build CLI** (`grok`) on macOS, Linux, or Windows. A native Windows build is supported — no WSL required (WSL2 + Remote-WSL still works if you prefer it).
- **A login for Grok:** either a **SuperGrok or X Premium+** subscription (`grok /login`) or an xAI API key. Subscription unlocks **Grok Build**; an API key can also unlock additional models and **grok-imagine**. (Grok's free tier does **not** include the CLI agent.)
- **For Claude Code tabs (optional):** Claude Code / `claude` CLI signed in, plus the ACP adapter (onboarding can **Install** it for you).
- **For voice control only** (optional): [`ffmpeg`](https://ffmpeg.org) on `PATH`, and a *separate* xAI API key for Speech-to-Text (pay-as-you-go — your CLI login does **not** cover it). See [Voice control](#voice-control).

---

## Install

**1. Install the CLI and sign in.**

macOS / Linux / WSL:

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
grok /login
```

Windows (PowerShell):

```powershell
irm https://x.ai/cli/install.ps1 | iex
grok /login
```

`grok /login` opens a browser and completes sign-in in one step. Prefer an API key? Get one at [console.x.ai](https://console.x.ai) and set `XAI_API_KEY` in your shell or a workspace `.env` (the extension auto-loads it).

**2. Install the extension.**

From the Marketplace — search **Grokbit**, or:

```bash
code --install-extension grokbit.grokbit
```

Or build from source:

```bash
git clone https://github.com/irichner/grokbit-vscode.git
cd grokbit-vscode
npm install
npm run rebuild             # bump → package → reinstall → publish to Marketplace
# same as: ./scripts/install.sh  |  Windows: pwsh scripts\install.ps1
# local only: npm run rebuild -- --no-publish
# needs VSCE_PAT (Marketplace Manage) or: npx @vscode/vsce login Grokbit
# in a Grok chat: /rebuild
```

Reload VS Code (**Ctrl+Shift+P → Developer: Reload Window**) and click the Grok icon in the activity bar.

> **Tip:** Right-click the Grok icon → **Move To → Secondary Side Bar** to park Grok on the right, next to other AI tools.

**Uninstall:** `./scripts/uninstall.sh` (Windows: `pwsh scripts\uninstall.ps1`) or `code --uninstall-extension grokbit.grokbit`.

---

## Quick start

1. **Open** Grokbit (activity bar icon, or `Ctrl/Cmd+;`). The **launcher** lists sessions; **New session** opens a chat tab (split button for Grok vs Claude).
2. **Type your first message.** The welcome screen’s **Session setup** card lets you pick agent, model, thinking depth, and mode before you start — changing them on a fresh tab is free.
3. **Press Enter** to send. The agent streams an answer. While it works you may see *Thinking…* (turn on full thinking details in the gear menu if you want them).
4. **Approve actions.** When the agent wants to edit a file or run a command, a **permission card** appears — review the **inline diff**, then *Allow this change*, *Allow always*, or *Don't allow*.
5. **Choose a mode** (Agent / Plan first / Auto accept), **model**, and **thinking depth** from the bottom toolbar and gear menu.
6. **Come back later** — history and launcher list past chats for this project so you can resume anytime.

---

## Features in depth

_Expand any section for detail and screenshots._

<details>
<summary><strong>Native session tabs + activity-bar launcher</strong></summary>

Each chat lives in its **own editor tab** (like a document). The left activity bar is a **launcher**: a scrollable Recent list (default last 30 days via `grok.launcherHistoryDays`), status dots, rename/delete, and **New session** (Grok or Claude). Full history and search live in the chat tab’s history popover. You can keep several chats open and switch between them like any other tabs.

A tab uses the **whole editor canvas** by default — no centred column, no width setting. Cards and capability rows flow into more columns as the tab gets wider; the transcript, composer, and code blocks are always full-bleed. The one exception is agent reply text, which keeps a left-aligned ~95-character reading measure so long paragraphs stay legible without narrowing anything else.

Closing a tab stops that chat’s live process but keeps history on disk (unless it was an empty “new session” you never used). After a VS Code reload, tabs can restore; the visible tab reconnects first.

The small line above **New session** reads e.g. `v2026.8.9 · 1.2B tokens`. That is **not your usage** — it is what building Grokbit itself has cost, aggregated across every maintainer and every session, baked into the build and identical for everyone (hover for the exact number and the date it was measured). Your own session's context lives in the composer donut and the status-bar percentage.

![Multiple sessions in the launcher with status dots, each session its own editor tab](docs/screenshots/NewSession.png)

</details>

<details>
<summary><strong>Session setup</strong> — pick agent, model, thinking, and mode from the top bar</summary>

A compact **Session setup** chip on the **left of the top bar** opens **Agent** (Grok / Claude Code), **Model**, **Thinking** depth, and **Mode** (Agent / Plan first / Auto accept). The same popover is available from the model chip in the composer toolbar. A brand-new tab has no history, so changing any of them there is free and invisible — nothing to restart, nothing to lose. Claude omits the Thinking row (no reasoning-effort axis).

</details>

<details>
<summary><strong>Grokbit Actions</strong> — bundled workflow on both agents</summary>

**Grokbit Actions** is on the welcome canvas of every new session, and any time from the **Grokbit Actions** button in the top bar or "Browse Grokbit Actions…" beside the composer's **+** button.

By default it shows the **bundled Grokbit workflow** as bordered tiles — five skills that ship with the extension and work identically on Grok and Claude Code (see the [capabilities table](#grokbit-actions-bundled-workflow) above) — plus **User Workflows** from the active backend (Grok: `.grok/workflows/*.rhai`; Claude: `.claude/workflows/*.js`).

**How the workflows work (full technical):** roles, loops, caps, artifacts, and human gates for each step — [docs/grokbit-workflows.md](docs/grokbit-workflows.md). In the extension, open a workflow tile’s **Details** control for the same guide in-panel.

Click a tile to seed the composer (e.g. `/grokbit-plan `) — nothing is sent until you press Enter. Your own skills, agents, and the CLI’s slash commands still work via **`/` autocomplete**. Set **`grok.actionsScope`** to `all` if you want Actions itself to list discovered skills, agents, and commands as well as the workflow.

The workflow skills are installed into `~/.grok/skills` and `~/.claude/skills` when the extension starts, and refreshed when it updates. Because that is a per-user install, they also show up in Grok and Claude Code sessions you start outside VS Code. Set **`grok.skills.provision`** to `off` to manage your own skills instead, or **`grok.showCapabilities`** to `false` to hide Actions entirely.

</details>

<details>
<summary><strong>Business Studio (3.0)</strong> — docs browser</summary>

Thin-client Studio surfaces (not a separate Office app, not five permanent sidebar tabs):

- **Docs** (chat top bar) — browse a capped list of business documents already in the workspace; open, reveal in the OS, attach as context, or seed a path into the composer.

When a turn produces a document path, a **document card** still offers Copy path / Open / Reveal. Generation still uses CLI skills (`/docx`, `/pptx`, `/xlsx`, …) and ordinary file tools — ask in plain language or use slash skills from autocomplete. This is not a built-in Office suite.

</details>

<details>
<summary><strong>Modes — Agent, Plan first & Auto accept</strong></summary>

| Mode | In plain English |
|---|---|
| **Agent** (default) | The agent can help right away. It **may ask** before editing files or running commands. |
| **Plan first** | The agent drafts a plan first. **Nothing changes** in your project until you approve the plan. |
| **Auto accept** | The agent acts **without asking** for permission on each change. Use when you trust the session. |

Your last non-plan mode (Agent or Auto accept) is remembered for **new** sessions. Plan first is always a deliberate choice for the task at hand.

![Plan mode — Grok drafts a plan and blocks workspace writes until you approve](docs/screenshots/PlanningMode.png)

</details>

<details>
<summary><strong>Permission cards with inline diff</strong> — see every edit before you approve</summary>

When the agent proposes an edit, the **diff is shown inside the chat card** — green additions, red deletions, long unchanged stretches collapsed. Buttons use plain language:

- **Allow this change** — approve once
- **Allow always** — approve this kind of action for the rest of the session (when the CLI offers it; path/command-bound when extractable)
- **Don't allow** — reject

The file is written only **after** you approve. Past edits stay reviewable via **view diff** on the tool row. Diffs never open a separate editor tab (so focus stays on chat).

</details>

<details>
<summary><strong>Questions from the agent</strong></summary>

Sometimes the agent needs a choice from you (multiple options). An **inline question card** appears; pick an option (and Submit if there are several questions). After you answer, the card collapses to a green “✓ your choice” summary. On resume, past answers replay as read-only cards.

</details>

<details>
<summary><strong>File context chips</strong> — point the agent at the right files</summary>

- The **active editor** can be included automatically as context (setting: `grok.includeActiveFileByDefault`).
- **Drag** files from the Explorer, right-click → **Grokbit: Send File**, press **Alt+G**, or use the **+** button to attach files. **Paste a screenshot** into the message box (thumbnail appears above the input). Vision-capable agents (e.g. Claude when the adapter advertises image input) receive the image on send; Grok Build currently gets a file path plus a short notice that it cannot view images.
- Explicit attachments are stronger than the ambient “currently open” file.
- Hold **Shift** while dragging to embed file contents as a fenced block instead of a path reference.

</details>

<details>
<summary><strong>Session history — resume, rename, delete, clear all</strong></summary>

The **clock** icon (and the launcher) lists this project’s sessions, newest first, **merged across Grok and Claude** with a backend badge on each row:

- Click a row to **resume** (conversation, images, plans, and tools replay on the correct agent).
- Hover to **rename** or **delete**.
- **Search** filters by name across your whole history.
- The list loads **100 at a time** and loads more as you scroll (stays fast with thousands of sessions).
- **Clear all history** removes every session for this project **except** ones that still have an open tab.

![Session history — resume, rename, delete, search, or clear past sessions](docs/screenshots/SessionHistory.png)

</details>

<details>
<summary><strong>Status dots</strong> — see which chats need you</summary>

| Dot | Meaning |
|---|---|
| 🔵 Blue | Working on it |
| 🟡 Yellow | Needs your OK (permission, question, or plan) |
| 🟢 Green | Finished — not opened yet |
| 🔴 Red | Finished with an error — not opened yet |
| ⚪ Gray | At rest / already seen |

Unread green/red badges persist across reloads until you open that session.

</details>

<details>
<summary><strong>Status-bar HUD + optional notifications</strong></summary>

A native **status bar** item (bottom of VS Code) mirrors the active chat: model, thinking depth, mode, context %, working spinner, and a **bell** count when any session needs you. Click it to jump back to chat. Claude omits the effort segment (no reasoning-effort axis).

Optional setting **`grok.notifyWhenWaiting`** (off by default): a passive notification when a **background** tab needs you — it never steals focus; you choose *Go to session*.

</details>

<details>
<summary><strong>Image & video generation</strong> — <code>/imagine</code> in chat</summary>

Type `/imagine <description>` (or `/imagine-video <description>`) and results render **inline** in the chat. Hover for **Copy path** / **Open in VS Code**. Subscription-only Grok features; they survive session resume. Editing a reference photo with `/imagine` is supported when the CLI offers it.

</details>

<details>
<summary><strong id="voice-control">Voice control</strong> — speak instead of type</summary>

The **microphone** in the composer records speech via [xAI Speech-to-Text](https://docs.x.ai/developers/model-capabilities/audio/voice). Words appear live as you talk. Say your send phrase (default **“grok send”**) to submit hands-free.

**Needs:** `ffmpeg` on PATH + a separate API key (`grok.voiceApiKey` or env). **Cost:** pay-as-you-go STT (~$0.10/hr batch, ~$0.20/hr streaming) — not covered by SuperGrok alone. Details: [research/voice-input.md](research/voice-input.md).

</details>

<details>
<summary><strong>Tool activity</strong> — what the agent did, in plain language</summary>

While the agent works, each turn's activity rolls into **one compact carousel strip** instead of a scrolling list: the strip shows the current action (*Reading chat.js…*, *Running command…*) with a step counter, and **‹ ›** flips back through earlier steps. When the turn finishes it collapses to a one-line summary — e.g. *Explored 5 items, edited 2 files · 9 steps* — that expands to the full detail (tool rows, step narration, thinking). Commands can show **output**, failed tools turn red with a short reason, and a **files changed** strip above the composer summarizes applied edits this turn. Prefer the classic scrolling stream? Turn off `grok.compactActivity` (gear → **Config & debug → Compact activity view**).

</details>

<details>
<summary><strong>Model & thinking depth</strong></summary>

Pick the **model** and **reasoning effort** (none → xhigh) from the gear menu or the small model chip in the toolbar. Effort is how deeply Grok “thinks” (more depth = more tokens/time) and is **per tab**, not global. Changing effort restarts that session only (optional summarize-and-restart). Some model switches restart when the CLI requires a different agent type — the extension handles that. Claude has no effort axis; the UI omits it cleanly.

![Model and reasoning-effort controls in the gear popover](docs/screenshots/ModelSelection.png)

</details>

<details>
<summary><strong>Show / hide thinking & chat size</strong></summary>

- **`grok.showThinking`** (default off) — when off, a short *Thinking…* stand-in is shown instead of full reasoning traces. Toggle live under gear → **Config & debug → Show thinking details**.
- **`grok.chatFontScale`** — zoom only the Grok chat (60–300%), not the whole editor.

</details>

<details>
<summary><strong>Math, diagrams & markdown</strong></summary>

- **LaTeX** math renders via MathJax (offline). Hover a display equation to copy or export PNG/SVG.
- **Mermaid** diagrams render inline (offline, theme-aware). Hover to copy source or export.
- Normal markdown (code, lists, tables) is fully supported.

![Mermaid diagram rendered inline in the chat](docs/screenshots/v1.4.6%20Mermaid%20diagrams.png)

</details>

<details>
<summary><strong>Slash commands</strong></summary>

Type `/` in the composer for autocomplete from your installed CLI (e.g. `/imagine`, `/compact`, …). Snapshot: [docs/SLASH-COMMANDS.md](docs/SLASH-COMMANDS.md).

</details>

<details>
<summary><strong>Cost awareness</strong></summary>

The **context donut** shows how full the conversation window is. Use **`/compact`** (gear → Compact) to compress history, or start a **new session**. Lower **thinking depth** for cheaper/faster turns.

</details>

<details>
<summary><strong>MCP tools</strong></summary>

Extra tools (browser automation, etc.) are configured in the **CLI** (`~/.grok/config.toml` or project `.grok/config.toml`). Gear → **Connected tools (MCP)** / open config files, then start a new session to reload.

</details>

<details>
<summary><strong>Sign out</strong></summary>

Gear → **Log out of Grok/Claude** (label follows the tab’s backend), or command **Grokbit: Log Out** — signs out that backend only, closes its live session tabs, and shows the signed-out launcher. History stays on disk; sign in again to resume.

</details>

<details>
<summary><strong>Telemetry (opt-out)</strong></summary>

Anonymous usage only: one `session_start` per real conversation with install id + mode/model/effort — **never** message content, code, or paths. Off with `grok.telemetry.enabled: false` or VS Code’s global telemetry setting. See [docs/privacy.md](docs/privacy.md).

</details>

---

## Configuration

<details>
<summary><strong>All <code>grok.*</code> settings</strong> (VS Code Settings → search "Grokbit" or "grok")</summary>

| Setting | Default | Notes |
|---|---|---|
| `grok.cliPath` | `""` | Path to the `grok` binary. Empty = auto-discover. |
| `grok.defaultBackend` | `"grok"` | Agent for **new** tabs: `grok` or `claude`. |
| `grok.defaultModel` | `""` | Model ID for new sessions. Empty = CLI default. |
| `grok.defaultEffort` | `""` | Thinking depth seed for new Grok tabs (`none`…`xhigh`). Effort is per-session after that. |
| `grok.defaultMode` | `""` | Mode for new sessions: Agent or Auto accept (Plan first is never remembered). Empty = Agent. |
| `grok.includeActiveFileByDefault` | `true` | Auto-add the active editor as a context chip. |
| `grok.useCtrlEnterToSend` | `false` | When true, Enter inserts a newline and Ctrl/Cmd+Enter sends. |
| `grok.showThinking` | `false` | Show full thinking details in chat. |
| `grok.compactActivity` | `true` | Roll each turn's activity into one carousel strip (off = classic scrolling stream). |
| `grok.showCapabilities` | `true` | Show Grokbit Actions on the welcome canvas and top-bar button. |
| `grok.actionsScope` | `"workflow"` | `workflow` = bundled suite + User Workflows; `all` = plus skills, agents, commands. |
| `grok.skills.provision` | `auto` | Install the bundled Grokbit workflow skills into `~/.grok/skills` and `~/.claude/skills`. `off` to manage yourself. |
| `grok.launcherHistoryDays` | `30` | Days of history in the launcher Recent list (`0` = unlimited). Chat history popover is always full. |
| `grok.notifyWhenWaiting` | `false` | Passive notification when a background tab needs you. |
| `grok.telemetry.enabled` | `true` | Anonymous usage telemetry (see Privacy). |
| `grok.chatFontScale` | `100` | Chat-only zoom percent (60–300). |
| `grok.claude.executablePath` | `""` | Optional path to a native `claude` binary. |
| `grok.claude.adapterPath` | `""` | Path to the Claude ACP adapter entrypoint. Empty = auto / onboarding Install. |
| `grok.claude.allowInheritedApiKey` | `false` | Allow inherited `ANTHROPIC_API_KEY` (off by default so subscription login wins). |
| `grok.voiceApiKey` | `""` | xAI API key for voice STT (separate from CLI login). |
| `grok.ffmpegPath` | `""` | Path to `ffmpeg`. Empty = PATH. |
| `grok.voiceInputDevice` | `""` | Microphone override. Empty = system default. |
| `grok.voiceSendPhrase` | `"grok send"` | Spoken phrase to auto-submit. Empty = disable. |
| `grok.voiceStreaming` | `true` | Live streaming STT (`false` = cheaper batch). |

</details>

---

## Commands & keyboard shortcuts

<details>
<summary><strong>VS Code commands & keys</strong> (Ctrl/Cmd+Shift+P → "Grokbit")</summary>

| Command | What it does |
|---|---|
| `Grokbit: Open` | Open the Grokbit launcher / focus chat |
| `Grokbit: New Session` | Start a fresh session tab |
| `Grokbit: Compact Conversation` | Compress conversation context |
| `Grokbit: Pick Model` | Open the model picker |
| `Grokbit: Toggle Plan / Agent Mode` | Open the mode picker |
| `Grokbit: Send File` | Attach the selected file as context |
| `Grokbit: Send Selection` | Send the current text selection |
| `Grokbit: Insert @-Mention` | Attach the active file from the editor |
| `Grokbit: Show Logs` | Open troubleshooting logs |
| `Grokbit: Log Out` | Sign out of the active tab’s backend |

| Key | Action |
|---|---|
| `Ctrl+;` / `Cmd+;` | Open Grokbit |
| `Alt+G` | Attach the current file (when the editor is focused) |
| `Enter` | Send message (default) |
| `Shift+Enter` | New line (default) |
| `Ctrl/Cmd+Enter` | Send, if you enabled “Ctrl+Enter to send” |

Also listed in-app: gear → **Keyboard shortcuts**.

</details>

---

## How it works

The extension is intentionally **thin**: it talks to `grok agent stdio` (or the Claude Code ACP adapter) and renders the results. The CLI owns sessions, memory, tools, and models; Grokbit mediates file access, terminals, permissions, and the UI.

**Plan first** is the one place the extension adds a safety layer: it blocks workspace writes and non-read-only commands until you approve a plan, using clear follow-up messages the agent understands.

Full architecture notes: **[docs/architecture.md](docs/architecture.md)**.

---

## Development

<details>
<summary><strong>Build, test & repo conventions</strong></summary>

```bash
npm install
npm test         # grok-free unit/DOM/integration suite — same as CI
npm run package  # → grokbit-<version>.vsix
```

`npm test` never spawns the real `grok` binary. A separate `npm run test:live` exercises the real CLI before releases. See **[TESTS.md](TESTS.md)** and **[docs/architecture.md](docs/architecture.md)**.

</details>

---

## Known limits

- **Diff preview** compares proposed old vs new text (not necessarily disk at preview time); the write happens after you approve.
- **No worktree UI** yet.
- **Subagent inspector** is not shipped (the CLI does not expose nested subagent cards over ACP in current builds).
- **Grokbit Workflows** defaults to the bundled suite plus User Workflows (backend-native Rhai/JS); set `grok.actionsScope` to `all` for skills/agents/commands in that menu (slash autocomplete always has CLI commands).
- The launcher defaults to the **left** activity bar; move it to the secondary side bar manually if you want it on the right.

---

## Privacy

**Privacy by design** — no message content, no code, no file paths, and no account identity leave your machine via telemetry. Turn telemetry off anytime with `grok.telemetry.enabled: false` or VS Code's global telemetry setting.

More: [docs/privacy.md](docs/privacy.md).

---

## License & attribution

Licensed under the **MIT License** — see [LICENSE](LICENSE). MIT is permissive (use, modify, sell, even in closed-source products) but **not** obligation-free: the copyright notice and license text must travel with **all copies, including compiled builds**. If you're reusing this project, see [docs/attribution.md](docs/attribution.md) for what that means and how to credit it properly.
