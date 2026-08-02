---
name: grokbit-explore
description: Look around your project and explain what matters — without changing any files.
---

# Grokbit — Explore

Planning fails when the model invents the codebase. **Explore fails when it pretends to plan** — or when it wanders without citations. This skill's job is orientation only: a short, grounded map of what matters for the user's question, returned **in chat**, so the next step (often `/grokbit-plan`) starts from something real.

This is the **first** step of the Grokbit workflow:

```
  grokbit-explore  ──▶  grokbit-plan  ──▶  human approval  ──▶  grokbit-test (baseline)
                                                                  │
                                                                  ▼
                   verdict  ◀──  grokbit-test (verify)  ◀──  grokbit-implement
```

Explore is optional in the sense that a user who already knows the area can skip it. It is **not** a substitute for Plan Survey (`02-survey.md`): chat orientation is memory, not an authoritative artifact.

## Hard rules

1. **Read-only — files and machine state.** Do not edit application source, tests, configs, or package manifests. Do not implement features. Also do **not** run state-mutating commands: no installs, builds that write artifacts, test runs that update snapshots, migrations, formatters that rewrite files, or anything else that changes the working tree or external services. Prefer host plan mode when available. Read, grep, glob, list, and non-mutating inspect commands only.
2. **Cite or flag.** Every claim about the repo is a `path:line` citation from a file you opened this session, or explicitly marked unknown. No plausible invention.
3. **Chat map only.** Do **not** write plan artifacts under `.grokbit/plans/**`. Do **not** produce `01-intent.md`, `02-survey.md`, `plan.md`, or implement/test outputs. Do not require durable digests under `.grokbit/context/` for success.
4. **Do not plan.** No approach trade-offs, no task lists, no “implement next” diffs. If the user wants a change, invite `/grokbit-plan` after the map.
5. **Loops terminate.** Cap breadth; disclose sampling. An incomplete honest map beats a sprawling confident one.
6. **Secrets stay out of the map.** If you open a credential-shaped file (`.env*`, keys, tokens), cite the **path only** — never paste values into chat.

## Pipeline

```
  Scope ──▶ Map (read-only) ──▶ Cite-check ──▶ Present map in chat
  (Scope)     (Cartographer)     (Checker)      (end turn)
```

Read `references/roles.md` for role prompts. Read `references/loops.md` for caps. Read `references/host-adapters.md` for host differences.

### Step 1 — Scope (Scope Setter)

Turn the user's question into a **map charter** in a few lines:

- What to find (feature area, bug path, module name, or “how does X work?”)
- What is out of bounds this pass
- At most **one** clarifying question if the target is impossible to guess; otherwise infer and state the assumption

### Step 2 — Map (Cartographer)

Read-only exploration. Prefer existing entry points: README, module map, main packages, then grep/list for the charter. For each relevant entity:

- Open the file and cite `path:line`
- Note how pieces connect
- Record conventions only when observed
- List unknowns explicitly

**Bound the pass:** sample large trees; cap caller-chasing; say when you sampled. Exit criteria (from product workflow language): you can name the files a later change would likely touch and the contracts you must not break — even if you are not the one changing them.

Use `assets/map.template.md` as the shape of the **chat** reply (fill it in the message; do not require writing that file to disk).

### Step 3 — Cite-check (Citation Checker)

Re-open key citations. Drop or flag any claim you cannot re-confirm. Prefer fewer true bullets over a long soft map.

### Step 4 — Present

Post the map in chat. End with one of:

- **If they want a change:** “Next step when you're ready: `/grokbit-plan <brief>` — Plan will re-read the files; this map is orientation, not a substitute for Survey.”
- **If they only wanted orientation:** stop. Do not invent a follow-up project.

## Relationship to Plan Survey

| | Explore | Plan Survey |
|---|---|---|
| Output | Chat map | `02-survey.md` under a plan slug |
| Goal | Orientation | Entity resolution for a specific change |
| Authority for implement | No | Yes (with design + plan) |

If Plan runs after Explore in the same conversation, Plan may use the chat as a **hint list of paths to open**, but must still open files and write its own survey. Never copy an uncited chat bullet into `02-survey.md`.

## Output contract

**Chat only** — structured with `assets/map.template.md` sections. No required files on disk.

## Failure modes to watch for

- **Fake Survey.** Writing `02-survey.md` or claiming entity resolution is “done.” That is Plan’s job.
- **Silent implementation.** “While I was here I fixed…” — stop. Restore **only** the lines you changed, from content you already read earlier this session (or show the user the diff and let them decide). Never run destructive git commands (`git checkout --`, `git reset --hard`, `git clean`) to “undo” Explore mistakes — those wipe the user’s uncommitted work in the same files. Restate read-only and continue mapping.
- **Uncited map.** Pretty architecture with no `path:line` is worse than “unknown.”
- **Unbounded crawl.** Disclose caps; stop.
- **Confusing with the built-in `explore` agent type.** This skill is the portable suite skill `grokbit-explore`; CLI agent names may differ by host.
