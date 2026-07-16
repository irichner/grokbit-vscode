# Slash commands

Slash commands are sourced live from the running CLI via the ACP `available_commands_update` notification — the autocomplete list reflects exactly what your installed `grok` version and auth method expose. Type `/` in the composer to open it.

This page is a snapshot for reference; the autocomplete list is the source of truth. Skills installed under `~/.grok/skills/` or `~/.grok/bundled/skills/` also appear in autocomplete as `/<skill-name>` but are not documented here — they vary per install and are owned by their respective `SKILL.md` files.

Snapshot last reconciled against a recent `grok` 0.2.x build; the autocomplete list is the source of truth.

## Built-in

| Command | Effect |
|---|---|
| `/compact` | Compress conversation history to save context (optional hint about what to preserve) |
| `/context` | Show context window usage and session stats |
| `/session-info` | Show session details (model, turns, context usage) |
| `/flush` | Flush conversation memory to disk now |
| `/memory` | Browse, view, and manage your memories |
| `/dream` | Memory consolidation — merge session logs into organised topics |
| `/always-approve` | Toggle always-approve mode (`on` / `off`) |
| `/plugins` | Manage plugins — `list` / `reload` / `trust <path>` / `add <path>` / `remove <path>` |
| `/reload-plugins` | Reload plugins from disk (alias for `/plugins reload`) |
| `/feedback` | Send feedback about the current session |
| `/loop` | Run a prompt on a recurring interval |

## Subscription only

Present in subscription mode, not on API-key auth.

| Command | Effect |
|---|---|
| `/imagine` | Generate an image from a text description (also edits a reference photo) |
| `/imagine-video` | Generate a video from a text description |

Since v1.4.0 the extension **renders the result inline** — `/imagine` output shows as an image (click to open the source file), `/imagine-video` as a playable `<video>`. Grok writes the file into its session directory and the extension serves it to the webview via `asWebviewUri` (streamed from disk; a base64 `data:` URI is used only as a fallback for files outside grok's served roots). Inline media is capped at 320px, and hovering an image/video reveals **Copy path** / **Open in VS Code** actions pinned to the media. When `/imagine` is given a source image to edit, grok runs an `image_edit` tool call, which the extension detects and renders the same way. See [research/image-generation.md](../research/image-generation.md) for the wire format.

## Skills (install-dependent)

Skills under `~/.grok/skills/` or `~/.grok/bundled/skills/` appear in autocomplete as `/<skill-name>`. Common business-document skills (when installed):

| Command | Effect |
|---|---|
| `/docx` | Create / edit Word (`.docx`) documents |
| `/pptx` | Create / edit PowerPoint (`.pptx`) decks |
| `/xlsx` | Create / edit Excel (`.xlsx`) workbooks |

You can also ask in plain language (“create a one-page PDF summary…”, “turn this CSV into a chart-ready spreadsheet”). When a completed tool result includes a path to a known business format (`.docx`, `.xlsx`, `.pptx`, `.pdf`, `.csv`, `.md`, `.txt`, …), the extension shows a **document result card** (Copy path / Open / Reveal in file explorer). Skills may require local dependencies documented in their own `SKILL.md` (for example Node `docx`).

## Not slash commands

A few things look like slash commands but are surfaced through the extension UI, not the CLI:

- **New session** — sidebar `+` button (`Grok: New Session` from the command palette)
- **Plan mode** — mode picker in the bottom toolbar; enabled and enforced client-side (Grok proposes a plan; workspace writes and non-read-only commands are blocked until you approve — see [src/plan-gate.ts](../src/plan-gate.ts) and [src/grok-primer.ts](../src/grok-primer.ts))
- **Auto accept (YOLO)** — mode picker; toggles auto-approval on the client side
