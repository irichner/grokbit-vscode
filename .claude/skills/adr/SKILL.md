---
name: adr
description: Record an Architecture Decision Record — capture a significant, hard-to-reverse technical decision with its context, the options considered, and the consequences. Use when choosing between meaningfully different approaches, adopting or dropping a dependency or pattern, or any time someone will later ask "why did we do it this way?". Accepts a short title for the decision.
argument-hint: "[short decision title, e.g. 'use Postgres row-level security for tenancy']"
allowed-tools: Read, Write, Glob, Bash(git log:*)
---

# Architecture Decision Record

Capture the decision: **$ARGUMENTS**

ADRs are short, immutable records of *why* a significant choice was made. They cost
minutes now and save hours of archaeology later. Write one whenever a decision is
costly to reverse, affects multiple parts of the system, or settles a real debate.

## Steps
1. **Locate the ADR log.** Look for an existing `docs/adr/`, `docs/decisions/`, or
   `adr/` directory (use Glob). If none exists, create `docs/adr/`.
2. **Number it.** Find the highest existing `NNNN-*.md` and use the next zero-padded
   integer (start at `0001`). Filename: `NNNN-kebab-case-title.md`.
3. **Read the template** `template.md` in this skill's directory and follow its
   structure exactly.
4. **Fill it in honestly:**
   - **Context**: the forces at play — requirements, constraints, what's true today.
     Neutral; no foregone conclusion.
   - **Options considered**: the real alternatives, each with its trade-offs. Include
     the one you rejected and *why* — that's the most valuable part.
   - **Decision**: what was chosen, stated plainly, and the key reason it won.
   - **Consequences**: what becomes easier, what becomes harder, what new risks or
     follow-ups this creates. Be honest about the downsides you're accepting.
5. **Status**: new ADRs are `Proposed` until accepted, then `Accepted`. Superseding a
   past decision? Set the old one's status to `Superseded by NNNN` (ADRs are
   append-only; you don't edit history, you add to it).
6. **Keep it tight.** One page. Link out for detail rather than inlining everything.

Use `git log` for dates/authorship context if helpful. Don't overuse ADRs — reserve
them for decisions worth remembering, not routine choices.
