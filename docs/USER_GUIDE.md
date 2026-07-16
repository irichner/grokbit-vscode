# User Guide

How to install this template in a repo and actually use it day to day. If you want the
*why* behind the design, read `docs/WORKFLOW.md` (the loop) and `docs/FEATURES.md` (the
surfaces). This document is the *how*.

---

## Contents

1. [What you're installing](#1-what-youre-installing)
2. [Prerequisites](#2-prerequisites)
3. [Install in 5 minutes](#3-install-in-5-minutes)
4. [Confirm it works](#4-confirm-it-works)
5. [Your first task](#5-your-first-task)
6. [The commands, and when to use them](#6-the-commands-and-when-to-use-them)
7. [Two ways to work](#7-two-ways-to-work)
8. [A full worked example](#8-a-full-worked-example)
9. [Working with the subagents](#9-working-with-the-subagents)
10. [Living with the guardrails](#10-living-with-the-guardrails)
11. [Customizing it for your project](#11-customizing-it-for-your-project)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick reference](#13-quick-reference)

---

## 1. What you're installing

A `.claude/` directory plus a `CLAUDE.md` that turn Claude Code into a disciplined
engineer for *your* repo. It encodes one workflow — **explore → plan → implement →
verify → review → commit** — across six surfaces (memory, subagents, skills, commands,
hooks, MCP). The headline feature: a Stop hook that **won't let a task be declared
"done" while your typecheck, lint, or tests are red.**

You drive it with slash commands like `/ship` and `/fix`; the guardrails run on their
own whether or not you remember them.

## 2. Prerequisites

- **Claude Code installed** and working from your terminal (or the desktop/IDE
  integration). If `claude` doesn't run yet, set that up first — see
  <https://code.claude.com/docs>.
- **A git repository.** The review/commit/PR commands and several hooks assume `git`.
  If your project isn't a repo yet: `git init`.
- **`jq` (recommended).** The hooks use it to parse event data and fall back to
  `python3` if it's missing — but `jq` is faster and cleaner. Install it if you can.
- A formatter/linter/test runner for your stack (whatever you already use). The
  template wires *into* your tools; it doesn't replace them.

## 3. Install in 5 minutes

**Step 1 — Copy the template into your repo.** From the unzipped template, copy these
into the root of your project:

```
.claude/        CLAUDE.md        .mcp.json        docs/
```

(Also merge the provided `.gitignore` entries if you don't already ignore
`.claude/settings.local.json`, `.env`, and `.claude/logs/`.)

**Step 2 — Fill in Project Facts (required).** Open `CLAUDE.md` and complete the
**Project Facts** block at the bottom — your stack, package manager, and especially the
exact **typecheck / lint / test** commands. This block is loaded into every session, so
Claude stops guessing your conventions. *These three command lines are the ones the
hooks rely on*, so get them right.

**Step 3 — Wire your commands into the completion gate (required).** Open
`.claude/hooks/verify-on-stop.sh` and set the three variables near the top to match
what you just put in Project Facts:

```bash
TYPECHECK_CMD=""   # e.g. "npm run typecheck"  |  "tsc --noEmit"  |  "mypy ."
LINT_CMD=""        # e.g. "npm run lint"       |  "ruff check ."  |  "cargo clippy"
TEST_CMD=""        # e.g. "npm test"           |  "pytest -q"     |  "cargo test"
```

> Leave a line empty to skip that check. If you leave **all three** empty, the script
> tries to auto-detect them from `package.json` / `Cargo.toml` / `go.mod` /
> `pyproject.toml` — fine for a quick start, but setting them explicitly is more
> reliable.

**Step 4 — Point the formatter at your tools (recommended).** Open
`.claude/hooks/format.sh` and keep the formatters you use, delete the rest. It's
best-effort: any formatter that isn't installed is silently skipped, so an unconfigured
formatter won't break anything — it just won't format.

**Step 5 — Personal settings (optional).** Copy the example to create your own
gitignored overrides:

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

Put machine-specific allow/deny rules or local env vars here. `settings.json` is the
shared team policy (committed); `settings.local.json` is yours (ignored).

**Step 6 — Start Claude Code in the repo and approve the hooks.** Launch a session from
the project root. For safety, Claude Code asks you to **review and approve hooks** the
first time it sees them — that's expected. Approve them so the guardrails activate.

That's it. Nothing to compile; the template *is* configuration.

## 4. Confirm it works

Three quick checks tell you it's live.

**Commands are discovered.** Type `/` and you should see `ship`, `plan`, `fix`,
`review`, `test`, `commit`, `pr`, and `checkpoint` among the options. (`/help` lists
everything available.) If they're missing, see Troubleshooting.

**The path guard bites.** Ask Claude to edit a protected file — e.g. *"add a line to
`.env`"* or *"edit `.claude/hooks/verify-on-stop.sh`"*. The `protect-paths.sh` hook
should block the edit and explain why. (Protected paths must be edited by a human.)

**The completion gate fires.** With your check commands set, ask Claude to make a
trivial change that breaks a test, then watch it try to finish — the Stop hook should
refuse and hand back the failing output instead of ending on red. When the test passes,
the turn ends normally. This is the single most important behavior in the template; once
you've seen it once, you'll trust it.

## 5. Your first task

The fastest way to feel the whole loop is one command:

```
/ship add a --version flag that prints the app version and exits
```

`/ship` runs the full loop end to end — it explores, plans, **pauses to show you the
plan**, then (after you confirm) implements, verifies, reviews, and commits. That pause
is the point: course-correct while it's still just words, before any code is written.

Prefer to look before you leap? Start with `/plan` instead (below), read the plan, then
proceed by hand.

## 6. The commands, and when to use them

All eight are **operator-triggered** — Claude won't fire them on its own; you invoke
them deliberately. Each takes free-text arguments where it makes sense.

| Command | Use it when… | What it does |
|---|---|---|
| `/ship <task>` | You want the whole thing done well, hands-off-ish. | Drives the full loop with a human checkpoint after planning. |
| `/plan <task>` | You want a plan to review before any edits. | Explores + plans only. No code changes. |
| `/fix <problem>` | Something's broken. | Reproduce → root-cause (debugger) → fix → regression test. |
| `/test [filter]` | You want to run and triage tests. | Runs the suite; sends failures to the debugger. |
| `/review` | You have a diff and want a skeptical pass. | Reviews working changes by severity; adds security audit if sensitive. |
| `/commit [hint]` | Staged changes are ready to record. | Writes one clean Conventional Commit from the staged diff. |
| `/pr [context]` | A branch is ready to share. | Drafts a reviewer-ready PR title + description from the branch. |
| `/checkpoint` | You've lost the thread mid-task. | Read-only status: what's done, what's risky, what's left. |

Rules of thumb: **`/ship`** for a complete change, **`/plan` + by hand** when you want
control, **`/fix`** for bugs, and the smaller verbs (`/test`, `/review`, `/commit`,
`/pr`, `/checkpoint`) as the individual gears when you're driving manually.

## 7. Two ways to work

**A) Let `/ship` drive.** One command runs the loop, stopping once after planning for
your sign-off. Best for well-scoped features and fixes where you're happy to review at
the plan and the diff, not every step.

**B) Drive it by hand.** Run the loop yourself with the small commands — more control,
same discipline:

```
/plan add rate limiting to the login endpoint    →  read it, adjust, agree
( implement — directly, or "use the implementer subagent to do step 1" )
/test                                             →  run + triage
/review                                           →  skeptical pass on the diff
git add -p
/commit                                           →  Conventional Commit
/pr                                               →  when the branch is ready
```

Use `/checkpoint` any time to get re-oriented. Both paths run the *same* loop and hit
the *same* Stop gate — the difference is only how much you hold the wheel.

## 8. A full worked example

Goal: **add a `--dry-run` flag** to a command-line tool so it previews actions without
performing them.

```
You:    /ship add a --dry-run flag to the sync command that logs each action
        it would take but makes no writes

Claude: [Explore] Dispatches the explorer subagent. Reports: the sync command
        lives in src/commands/sync.*, writes happen via writeBatch() at
        sync.*:142, no existing flag-parsing for sync. (path:line included.)

        [Plan] Proposes: add a boolean --dry-run, thread it to writeBatch(),
        short-circuit the write and log intent when set. Test strategy: a test
        asserting no writes occur and the intended actions are logged.
        ── Pauses here for your confirmation. ──

You:    looks good, but log at info level not debug

Claude: [Implement] Uses the implementer subagent: adds the flag, guards the
        write, logs each skipped action at info. Pulls in the test-engineer to
        add the dry-run test (written to fail first, then pass).

        [Verify] Runs your typecheck/lint/tests. One test fails — a log
        assertion. It fixes the root cause and re-runs until green. (Even if it
        tried to stop here on red, the Stop gate would send it back.)

        [Review] Runs the code-reviewer on the diff. Minor finding: the dry-run
        branch duplicates a log format — extracts a helper. No blocking issues.

        [Commit] feat(sync): add --dry-run to preview actions without writing

You:    /pr

Claude: Drafts a PR title + Summary / Changes / Testing / Notes from the branch
        diff, ready to paste.
```

Notice what you did: set direction, made one correction at the checkpoint, approved the
result. The loop handled the rigor.

## 9. Working with the subagents

Subagents are specialists, each in its **own context window** with its **own tools and
model**. There are nine: `explorer`, `planner`, `implementer`, `test-engineer`,
`code-reviewer`, `security-auditor`, `debugger`, `refactorer`, `docs-writer`.

You usually don't summon them by hand — the commands above delegate to the right one,
and Claude **auto-routes** work based on each agent's description (e.g. a debugging
request tends to engage the `debugger`). You *can* be explicit whenever you want:

```
use the explorer subagent to map how auth tokens flow through the app
use the security-auditor subagent on the changes to the upload handler
have the refactorer extract the duplicated retry logic, keeping tests green
```

Why this matters: the `explorer` runs read-only on a cheap model so wide reads don't
bloat your main thread or your bill; the `code-reviewer` reviews in a *fresh* context,
so it catches what the implementer's context glossed over. You can inspect or tweak the
roster from the `/agents` interface, or by editing files in `.claude/agents/`.

## 10. Living with the guardrails

The hooks are deterministic and run regardless of what the model decides. Day to day,
you'll meet these:

**The completion gate (`verify-on-stop.sh`) blocking you is the feature.** When Claude
tries to end a turn with failing checks, the gate refuses and feeds the failure back so
it keeps working. The way to "get past" it is the right way: **make the checks pass.**
Never delete a test or weaken a check to escape the gate — that defeats the entire point
of the template. (The gate only runs when files were actually edited this session — a
turn that just answers a question won't trigger your test suite.)

**It won't loop forever.** If a check genuinely can't pass, the gate gives up after
`MAX_BLOCKS` (default **3**) attempts and hands control back to you with a warning,
rather than burning tokens. So a hard failure surfaces *to you* instead of spinning. If
you keep hitting the limit, the check itself (or the task) needs a human — that's the
signal working as intended.

**Secret and path protection.** `protect-paths.sh` refuses edits to things like `.env`,
`*.pem`, `*.key`, `secrets/`, `.git/` — and to the enforcement layer itself
(`.claude/hooks/` and `.claude/settings.json`), so the agent can't weaken its own
guardrails. If you have a legitimate reason to touch a protected path, do it yourself
outside the agent, or adjust the patterns in that script.

**Dangerous shell blocking (opt-in).** `guard-bash.sh` blocks a denylist of destructive
commands (recursive root deletes, fork bombs, `curl | sh`, force-push, `git reset
--hard`, etc.). It ships **unwired** to keep shell friction-free under
`bypassPermissions` — the wiring snippet is at the top of the script if you want it.

**Auto-format on save.** After each edit, `format.sh` formats the touched file with your
configured tools. If a save isn't getting formatted, that formatter probably isn't
installed or isn't in the script — see Troubleshooting.

**No permission prompts — by design.** `settings.json` sets
`permissions.defaultMode: "bypassPermissions"`: the agent never stops to ask, and the
hooks above are the guardrails instead. If you want prompts back (e.g. on a
higher-stakes repo), change `defaultMode` in `settings.json` — or override it just for
yourself in `settings.local.json`.

## 11. Customizing it for your project

**Tune the cost/quality dial.** Model per agent is the main lever — defaults are *haiku
to read, sonnet to build, opus to judge*. Edit the `model:` field in any
`.claude/agents/*.md`. Tighter budget → move reviewers to sonnet; higher stakes → push
reviewers to the strongest model. `CLAUDE_CODE_SUBAGENT_MODEL` overrides subagent models
globally for a quick sweep.

**Add a reusable method →** make a **skill**: a new folder
`.claude/skills/<name>/SKILL.md` with a `description` that says when it applies. It
becomes `/name` automatically and auto-loads when relevant.

**Add an operator workflow →** make a **command**: a file
`.claude/commands/<name>.md`. Set `disable-model-invocation: true` if it has side
effects (so only you trigger it), and inject live state with `` !`git status` `` or
free-text with `$ARGUMENTS`.

**Add a specialist →** make a **subagent**: `.claude/agents/<name>.md`. Give it the
*least* tools it needs and the *cheapest* model that does the job, and start its
`description` with "Use this agent when…" so auto-delegation finds it.

**Add a guardrail →** add a **hook** in `.claude/settings.json` (deterministic,
unskippable) or a **permission** rule (to gate a tool). Hooks inspect the *actual
command*; permissions gate the *tool* — use both for defense in depth.

**Add an external tool →** enable an **MCP server** in `.mcp.json`. Keep the config
committed and the credentials in environment variables (`${ENV_VAR}` placeholders are
already shown there).

**Make it portable across repos →** package the whole thing as a Claude Code **plugin**
so teammates install one workflow instead of copy-pasting `.claude/`. See
`docs/FEATURES.md` → "Packaging as a plugin."

After changing project files, restart the session if new commands/agents/hooks don't
show up (and re-approve hooks if you changed `settings.json`).

## 12. Troubleshooting

**A `/command` doesn't appear.** Make sure the file is under `.claude/commands/` (or the
skill under `.claude/skills/<name>/`) in the repo you launched Claude Code from, and that
you started the session at the project root. Added it mid-session? Restart the session.
Confirm with `/help`.

**Hooks don't seem to run.** Three usual causes: (1) you haven't **approved** the hooks
yet — Claude Code prompts on first sight of new hooks; (2) `settings.json` has a JSON
error, so the whole file is ignored — validate it:
`python3 -c "import json;json.load(open('.claude/settings.json'))"`; (3) `bash` isn't
on your PATH — the hooks are invoked as `bash <script>` (no execute bit needed), which
on Windows means Git Bash must be installed.

**The completion gate never triggers.** First, remember it only runs when files were
edited that session (via the Edit/Write tools) — pure conversation won't trigger it.
Beyond that, your check commands probably aren't set and couldn't be auto-detected. Put
explicit values in `TYPECHECK_CMD` / `LINT_CMD` / `TEST_CMD` at the top of
`verify-on-stop.sh`. Test a command in isolation first — if `npm test` doesn't run in
your shell, the hook can't run it either.

**The gate keeps blocking and I'm stuck.** It releases after `MAX_BLOCKS` (3) and tells
you so. If you hit that repeatedly, the failing check needs you — run it yourself, read
the real error, and fix the root cause (or fix a genuinely-wrong test). Don't raise
`MAX_BLOCKS` to paper over a real failure.

**Files aren't being auto-formatted.** Open `.claude/hooks/format.sh` and confirm the
formatter for that file type is listed *and installed* (e.g. `prettier`, `ruff`,
`gofmt`, `rustfmt`, `shfmt`). Missing tools are skipped silently by design.

**I want permission prompts back.** This template runs in `bypassPermissions` mode (no
prompts; hooks are the guardrails). Change `permissions.defaultMode` in
`settings.json` — or in `settings.local.json` if it's just your preference — and add
allow/deny rules to taste.

**Claude edited something it shouldn't / I want a path protected.** Add the pattern to
`protect-paths.sh`. For shell-level protection too, wire the opt-in `guard-bash.sh`
(instructions at the top of that script).

**A hook misbehaves and I need to disable it fast.** Comment that hook's entry out of
`.claude/settings.json` and restart the session. Re-enable once fixed.

When a Claude Code behavior or setting name doesn't match what you expect, check the
current docs — <https://code.claude.com/docs> — since the tool evolves.

## 13. Quick reference

**Commands**

```
/ship <task>        full loop: explore → plan → (you confirm) → build → verify → review → commit
/plan <task>        explore + plan only, no edits
/fix <problem>      reproduce → root-cause → fix → regression test
/test [filter]      run the suite, triage failures
/review             skeptical review of the working diff
/commit [hint]      Conventional Commit from staged changes
/pr [context]       draft a PR title + description for the branch
/checkpoint         read-only "where am I" status
```

**Files you edit first**

```
CLAUDE.md                          → fill in Project Facts (stack + check commands)
.claude/hooks/verify-on-stop.sh    → set TYPECHECK_CMD / LINT_CMD / TEST_CMD
.claude/hooks/format.sh            → keep the formatters you use
.claude/settings.local.json        → your personal allow/deny/env (copy from .example)
```

**Where everything lives**

```
CLAUDE.md                  standing policy, loaded every session
.claude/agents/            the nine subagent specialists
.claude/skills/            reusable methods (also slash commands)
.claude/commands/          operator-triggered workflows
.claude/hooks/             the deterministic guardrails
.claude/settings.json      permission mode + hook wiring (committed)
.mcp.json                  external tool servers (config committed, secrets in env)
docs/                      WORKFLOW.md (the loop) · FEATURES.md (the surfaces) · this guide
```

**The one rule that makes it all work:** when the gate blocks you, fix the code — never
the check.
