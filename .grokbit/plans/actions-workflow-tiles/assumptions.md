# Assumptions — Grokbit Actions: workflows only, as readable tiles

The one rolled-up ledger of every open item from this plan. Read at the approval
gate, and again by `grokbit-implement` before touching a task one of these bears
on.

## From intake

Copied from `01-intent.md` § Assumptions — decided rather than asked, so the
plan could be delivered complete instead of blocking on a question batch.

- `UNVERIFIED` **"Workflows" = the bundled `grokbit` group** (grokbit-plan /
  implement / test / document) — the group CLAUDE.md already calls "the bundled
  Grokbit workflow". No new discovery source is implied. *If wrong:* the whole
  plan retargets, because `CAPABILITY_VISIBLE_KINDS` would name a kind that does
  not exist yet (`src/capabilities.ts:30`–`31` documents `workflow` as
  deliberately deferred). Bears on T1.
- ~~`UNVERIFIED`~~ **CONFIRMED at the gate — workflow-only applies to both
  mounts.** Gate question 1, answered "Both". T2 wires the filter at
  `media/chat.js:972` *and* `:1023` as planned; no change to any task.
- `UNVERIFIED` **The Session controls / Auto-accept switch stays.** It is
  session state, not a listed capability, and it is the popover's only in-place
  control. Structurally unaffected by the chosen design — `sessionToggleGroup`
  never passes the filter — so *if wrong*, removing it is a separate one-line
  change, not a rework. Bears on T2.
- `UNVERIFIED` **Derived tile copy is good enough.** "Enough room to read what
  they do" is met by a sentence-aware trim of the existing frontmatter
  description rather than hand-written blurbs. Measured against all four real
  descriptions and it produces complete sentences today; nothing guarantees a
  future frontmatter edit keeps that property. *If wrong:* `03-design.md`
  Decision 2 Option 3 (a `short-description` frontmatter key) is purely additive
  on top of this. Bears on T3. This is gate question 3.

## From grounding (Loop 2)

Entities the Systems Analyst could not resolve within 3 passes.

- **RESOLVED (mostly) at the gate, once the human answered "disappear entirely".**
  The original item asked whether every disk-discovered capability stays
  reachable by typing `/`. Broken down by kind, three of the four are now settled
  from code rather than assumption:

  - **Commands — no loss, proven.** A `kind: "command"` row is *only ever*
    constructed from an ACP command (`src/capabilities.ts:706`, inside
    `mergeAcpCommands`'s "no disk match" branch). Every command row is therefore
    in `availableCommands` by construction, which is exactly what feeds slash
    autocomplete (`src/sidebar.ts:2292` → `media/chat.js:5218`). Removing the
    Commands group costs nothing.
  - **Agents — no invocation loss, proven.** An agent is never user-invocable:
    `src/capabilities.ts:399` hard-codes `kind === "agent" ? false`. Agent rows
    were only ever *inert* or *open-the-file* affordances. Removing the Agents
    group costs a file-open shortcut, not a way to run anything.
  - **Home-tier grok skills — documented to appear.** `docs/SLASH-COMMANDS.md:5`
    and `:38` state that skills under `~/.grok/skills/` and
    `~/.grok/bundled/skills/` appear in autocomplete as `/<skill-name>`. Project
    documentation, not a live capture, but written against this CLI.

- `UNRESOLVED — Loop 2` **The residue: a *workspace-tier* skill
  (`.grok/skills`, `.agents/skills`, `.claude/skills`, `.cursor/skills` inside
  the repo — `src/capabilities.ts:118`–`124`) that the CLI does not register as
  a slash command loses its only browsable surface.** Neither
  `docs/SLASH-COMMANDS.md` nor any captured probe covers the workspace tier or
  the Claude backend; `research/plan-probe.log` records
  `available_commands_update` arriving but never dumps its payload. Confirming
  it needs a live session, which the grok-free suite cannot provide.

  **Severity after the breakdown above:** much smaller than it looked at the
  gate — it is one tier of one kind, not "your skills and commands vanish". It
  does not block any task; the check is a few minutes against a live session and
  `research/*.cjs` is where such a probe would live.

## From adversarial review (Loop 3)

Findings that survived 3 rounds between the Reviewer and the Architect.

- None. Loop 3 exited clean at round 2 — two `BLOCKER`s (filter placement, CSS
  line clamp) and four `MAJOR`s were raised in round 1 and all six were accepted
  and resolved by design revision rather than rebuttal. See `04-review.md`.

## From verifiability (Loop 4)

- `UNRESOLVED — Loop 4` **Done-criterion 5 (multi-column when wide, single
  column when narrow, no horizontal scrollbar) has no automated proof.** The
  repo has no visual/layout test and happy-dom does not lay out
  (`02-survey.md` § Absences). T4's verify proves the *cause* as a CSS source
  fact (`auto-fit` grid retained, `min(100%, …)` clamp retained, `nowrap`
  removed) and the plan names an explicit manual check. This is a disclosed
  limitation of the verification, not a task that can be split further —
  splitting it would produce two tasks with the same unprovable criterion.

## Resolution

- **Gate round 1 (answered):** Q1 "Both mounts" and Q2 "disappear entirely" both
  confirmed the planned defaults — no task changed. Q3 (tile copy) was not
  answered and stands on its default: derive from the existing frontmatter via
  the sentence-aware trim, no hand-written blurb field.
- Two intake assumptions remain open (`grokbit` = "workflows"; derived copy is
  good enough) and are carried in `plan.md` § Open assumptions.
- The Loop 2 item was largely resolved from code at the gate (see above) once Q2
  was answered "disappear entirely". Its residue — workspace-tier skills — does
  not block any task.
- The Loop 4 item is accepted as a permanent limitation of this repo's test
  layers and is stated in the verification matrix rather than papered over.
