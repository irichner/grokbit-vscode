---
grokbit_type: features-use-cases
derived_from:
  - README.md@f21d093
  - package.json@f21d093
  - docs/grokbit-workflows.md@f21d093
  - src/skill-suite.ts@f21d093
authored_sections: []
verified: 2026-08-03
content_hash: d82f66b5dbc162f41dec95cad1a2fb0f139816e4f13e2bf653e410fd23d67469
formats:
  - docs/features-and-use-cases.md
  - docs/Grokbit-Features-and-Use-Cases.docx
generator: scripts/_gen_features_use_cases_docx.py
extension_version: 2026.8.27
---

# Grokbit — Features and Use Cases

**Product document** for the Grokbit VS Code extension (`grokbit.grokbit`, version **2026.8.27**).  
Word export: [Grokbit-Features-and-Use-Cases.docx](./Grokbit-Features-and-Use-Cases.docx).

This describes what Grokbit **ships today**. Claims are derived from the extension README, package identity, workflow reference, and suite membership in `src/skill-suite.ts` — not from planned work.

> **Source note:** `docs/FEATURES.md` and `docs/USER_GUIDE.md` currently describe a Claude Code agentic **template**, not the Grokbit product. They are **not** sources for this document.

## 1. What Grokbit is

Grokbit is a VS Code extension that provides a friendly editor UI for **xAI’s Grok Build CLI** and, optionally, **Claude Code**. Each chat runs in its own native editor tab. You plan safely, review edits with inline diffs, attach files, paste screenshots, run a built-in explore → plan → implement → test → document workflow, generate images and video (Grok subscription features), and dictate by voice — without living in the terminal.

The extension is intentionally **thin**: the CLI owns sessions, memory, tools, and models; Grokbit mediates file access, terminals, permissions, and the UI. **Plan first** is the main client-side safety layer — workspace writes and non-read-only commands are blocked until you approve a plan.

- Marketplace: `grokbit.grokbit` (publisher Grokbit)
- Repository: https://github.com/irichner/grokbit-vscode
- Based on [phuryn/grok-build-vscode](https://github.com/phuryn/grok-build-vscode) (MIT)

## 2. Who this is for

- Prefer a **GUI over the terminal** — chat, approve changes, manage history without memorizing CLI commands.
- Want a **safety net** — Plan first, permission cards, inline diffs.
- Work in **VS Code / Cursor / Windsurf / VSCodium** — agent next to files.
- Use **Grok and/or Claude Code** — one extension, per-tab agent choice.

## 3. Requirements

| Need | Detail |
|------|--------|
| Editor | VS Code 1.94+ or compatible |
| Grok CLI | `grok` on macOS, Linux, or native Windows |
| Grok auth | SuperGrok or X Premium+ (`grok /login`), or xAI API key (free tier does **not** include the CLI agent) |
| Claude (optional) | `claude` signed in + ACP adapter |
| Voice (optional) | `ffmpeg` + separate xAI API key for STT |

## 4. Feature catalog

See the full tables in the Word document and the canonical prose in [README.md](../README.md) § Capabilities overview and § Features in depth. Categories covered:

1. Sessions and layout (native tabs, launcher, history, restore)
2. Two agents (Grok Build, Claude Code, per-backend logout)
3. Safety and control (modes, plan gate, permission cards, bound grants)
4. Grokbit Actions + User Workflows (suite skills including `/grokbit-ship`)
5. Context and files (chips, screenshots, Docs browser)
6. Activity carousel, tool rows, files-changed strip, thinking control
7. Status dots, status-bar HUD, optional waiting notifications
8. Models, thinking depth, `/imagine` media, voice
9. Markdown / LaTeX / Mermaid, slash commands, MCP, context donut, telemetry

## 5. Use cases

| ID | Goal | Primary surfaces |
|----|------|------------------|
| UC-1 | First coding session in the editor | New session, chips, permission cards |
| UC-2 | Plan before any file changes | Plan first mode, plan card / `/grokbit-plan` |
| UC-3 | Full feature with bundled pipeline | Actions tiles / `/grokbit-ship` |
| UC-4 | Parallel work across sessions | Tabs, launcher dots, status-bar HUD |
| UC-5 | Switch Grok ↔ Claude | Backend chip, split New, merged history |
| UC-6 | Media generation or voice dictation | `/imagine`, mic + STT |
| UC-7 | Review what the agent did this turn | Activity carousel, files-changed strip |
| UC-8 | Attach the right context for a hard bug | Chips, paste screenshot, Docs |

Narratives for each UC live in the DOCX (steps + expected outcome).

## 6. Modes at a glance

| Mode | In plain English |
|------|------------------|
| **Agent** (default) | May ask before edits or commands |
| **Plan first** | Nothing changes until you approve a plan |
| **Auto accept** | Acts without per-change prompts |

## 7. Known limits

- Diff preview is proposed text, not necessarily disk at preview time
- No worktree UI
- Subagent inspector not shipped
- Actions default scope = suite + User Workflows (`grok.actionsScope`)
- User Workflow formats are backend-native (not interchangeable)
- Mid-turn business-doc auto-cards disabled (Docs browser remains)

## 8. Further reading

| Document | Path |
|----------|------|
| Product README | `README.md` |
| Architecture | `docs/architecture.md` |
| Workflows | `docs/grokbit-workflows.md` |
| Slash snapshot | `docs/SLASH-COMMANDS.md` |
| Privacy | `docs/privacy.md` |
| Tests | `TESTS.md` |
| Contributor map | `CLAUDE.md` |

## Regenerating the Word file

```bash
python scripts/_gen_features_use_cases_docx.py
```
