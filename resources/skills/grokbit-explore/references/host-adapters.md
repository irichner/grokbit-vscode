# Host adapters — grokbit-explore

The skill body is identical across hosts. Only dispatch and installation differ.

---

## Capability detection

| Capability | Effect if absent |
|---|---|
| Subagents with isolated context | Run Scope → Map → Cite-check sequentially in one context |
| Parallel dispatch | Serial only (Explore is naturally serial) |
| Per-agent model selection | Ignore tier hints |
| Plan mode / edit blocking | Prefer host plan mode or self-discipline: **no product edits** |
| Headless browser | Not required for Explore |

---

## Claude Code

**Install:** provisioned by the Grokbit extension into `~/.claude/skills/grokbit-explore/`, or project fork at `.claude/skills/grokbit-explore/`.

**Dispatch:** Task tool per role when available; otherwise sequential.

**Model tiers:** Cartographer cheap; Scope Setter and Citation Checker standard.

---

## Grok Build

**Install:** provisioned into `~/.grok/skills/grokbit-explore/`, or project fork under `.grok/skills/`.

**Dispatch:** subagents when available. Plan mode is ideal for Explore (blocks accidental writes).

---

## The Grokbit extension

This skill ships in `resources/skills/grokbit-explore/` and is provisioned with the rest of the suite (`grokbit-explore`, `grokbit-plan`, `grokbit-implement`, `grokbit-test`, `grokbit-document`) on activation. It appears first in **Grokbit Actions**. Clicking the tile seeds `/grokbit-explore ` — nothing auto-sends.

Explore produces **no** required on-disk artifact for the extension to render; the value is the chat map.

---

## Installation

Copy/provision only — same mechanism as sibling suite skills. No separate install script.
