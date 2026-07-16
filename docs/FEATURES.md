# Feature Map & Extension Guide

A tour of every Claude Code surface this template uses, *where* it lives, and *why* it's
set up the way it is — plus the advanced knobs left on the table so you can reach for
them deliberately. Authoritative docs: <https://code.claude.com/docs>.

---

## The six surfaces, and where each lives

### 1. Project memory — `CLAUDE.md`
Loaded into context at the start of every session. This is standing policy, not a
tutorial: the verification loop, the non-negotiable principles, the Definition of Done,
and a **Project Facts** block *you fill in* (stack, and the exact typecheck / lint /
test commands). The hooks read those same commands, so keeping this section accurate is
what makes the Stop gate work for your project.

> Personal, uncommitted memory can also live in `CLAUDE.local.md`, and you can nest a
> `CLAUDE.md` inside a subdirectory to add context that only applies there.

### 2. Subagents — `.claude/agents/*.md`
Separate context windows with their own tool allowlist and model. Markdown body = the
agent's system prompt; YAML frontmatter = its configuration. This template ships nine,
one per job:

| Agent | Model | Tools | Why |
|---|---|---|---|
| `explorer` | haiku | Read/Grep/Glob | Cheap, fast, read-only mapping. |
| `planner` | opus | + WebFetch/WebSearch | Judgment-heavy; no edits. |
| `implementer` | sonnet | + Write/Edit/Bash | Balanced builder. |
| `test-engineer` | sonnet | + Write/Edit/Bash | Writes & runs real tests. |
| `code-reviewer` | opus | Read/Grep/Glob/Bash | Skeptical, read-only review. |
| `security-auditor` | opus | Read/Grep/Glob/Bash | Focused security pass. |
| `debugger` | sonnet | Read/Grep/Glob/Bash | Root-cause diagnosis. |
| `refactorer` | sonnet | + Write/Edit/Bash | Behavior-preserving change. |
| `docs-writer` | sonnet | + WebFetch/WebSearch | Docs grounded in code. |

Two levers worth understanding:
- **Model tier is a cost dial.** Reading is done on cheap models; judgment on
  expensive ones; building in the middle. Tune per agent to taste.
- **Descriptions drive auto-delegation.** Each description starts with "Use this agent
  when…" so Claude routes work to the right specialist without being told. Some agents
  preload a skill via `skills:` so the method is in-context from turn one.

### 3. Skills — `.claude/skills/<name>/SKILL.md`
Reusable *methods*, auto-loaded when their `description` matches the situation. The
directory name is also a slash command (skills and commands are the same system). This
template's skills:

- `verification-loop` — the flagship method the whole template orbits.
- `tdd` — red → green → refactor.
- `debug-protocol` — reproduce → isolate → confirm → fix + regression test.
- `code-review-rubric` — the priority-ordered review standard (`user-invocable: false`,
  so it's a background standard rather than a command).
- `commit-conventions` — Conventional Commits (also `user-invocable: false`).
- `adr` — Architecture Decision Records; reads its sibling `template.md`.
- `codebase-scan` — a read-only health scan that demonstrates `context: fork`.

A skill can bundle more than instructions — `adr/` ships a `template.md` next to its
`SKILL.md`, and skills can include scripts or reference files the same way.

### 4. Slash commands — `.claude/commands/*.md`
Operator entry points. Every command here sets `disable-model-invocation: true` because
each one *does something deliberate* — you want these triggered by a human, not
auto-fired. Several inject live repo state with `` !`git …` `` and take free text via
`$ARGUMENTS`.

`/ship` · `/plan` · `/fix` · `/review` · `/test` · `/commit` · `/pr` · `/checkpoint`

### 5. Hooks — `.claude/settings.json` → `hooks`, scripts in `.claude/hooks/`
Deterministic shell that runs on lifecycle events — the part that doesn't depend on a
model choosing to behave:

| Hook script | Event | Purpose |
|---|---|---|
| `session-start.sh` | SessionStart | Inject a repo snapshot; reset the verify gate + change marker. |
| `protect-paths.sh` | PreToolUse · Edit/Write | Refuse edits to secrets, `.git/`, and the enforcement layer itself (`.claude/hooks/`, `settings.json`). |
| `mark-changed.sh` | PostToolUse · Edit/Write | Record that files changed, so the Stop gate only runs when there's something to verify. |
| `format.sh` | PostToolUse · Edit/Write | Best-effort auto-format the touched file. |
| `log-subagent.sh` | SubagentStop | Append an audit line per subagent run. |
| `verify-on-stop.sh` | Stop | **The gate:** run checks; block "done" while red. |
| `guard-bash.sh` | *(opt-in, not wired)* | Block destructive shell (`rm -rf /`, fork bombs, force-push, `curl \| sh`, …). Wiring instructions are at the top of the script. |

`verify-on-stop.sh` is the keystone. It auto-detects your checks (or you set them
explicitly at the top of the file), and emits `{"decision":"block","reason":…}` to keep
the turn going until typecheck/lint/tests pass — with a bounded retry count so a stuck
run releases instead of looping forever. **This is what turns "please verify" from a
hope into a guarantee.**

### 6. MCP servers — `.mcp.json`
Project-scoped external tools (databases, issue trackers, browsers, …). Ships with
disabled, commented examples and `${ENV_VAR}` placeholders so no secret ever lands in
the file. Enable what you need; commit the config, not the credentials.

---

## Permissions & settings, briefly

`.claude/settings.json` is committed team policy. This template runs with
`permissions.defaultMode: "bypassPermissions"` — no permission prompts; the agent works
friction-free and the **hooks** are the guardrails (deterministic, content-aware, and
protected from agent edits by `protect-paths.sh`). If your risk tolerance is lower,
change `defaultMode` (e.g. to `acceptEdits` or the default prompt mode) and add
allow/deny rules — permissions gate the *tool*, hooks inspect the *actual content*, and
they compose as defense in depth. Personal overrides go in `settings.local.json`
(gitignored) — copy `settings.local.json.example` to start.

---

## Advanced knobs left on the table

Deliberately unused here, but supported — reach for them when a project needs them:

- **`disallowedTools` (subagent denylist).** This template uses tool *allowlists*; for
  a "can do everything except X" agent, a denylist is cleaner.
- **`permissionMode` (per agent).** e.g. a tightly-scoped agent could run in a stricter
  mode, or a trusted background agent in a looser one. Left at project default.
- **`isolation: worktree` (per agent).** Run an agent in its own git worktree so
  parallel/large refactors can't collide. The `refactorer` mentions this as opt-in.
- **`maxTurns` / `background` / `memory` (per agent).** Cap an agent's turns, run it in
  the background, or give it persistent memory across runs.
- **`context: fork` (per skill/command).** Run in an isolated sub-context so a big
  read-only scan doesn't bloat the main thread. Demonstrated in `codebase-scan`.
- **`user-invocable: false` vs `disable-model-invocation: true`.** Two opposite locks:
  the former hides a skill from humans (background standard); the latter hides a command
  from the model (operator-only). Both are used above — know which you want.
- **Positional args `$1`, `$2` …** Commands here use `$ARGUMENTS` (everything). For a
  command with structured operands, zero-based positionals are available.
- **`@path` file references.** Pull a file's contents directly into a command/skill
  prompt with `@relative/path`, alongside the `` !`shell` `` injection used here.
- **More hook events.** ~30 exist (UserPromptSubmit, PreCompact, Notification,
  SessionEnd, …). This template wires five high-leverage ones (SessionStart,
  PreToolUse, PostToolUse, SubagentStop, Stop); add others as needs appear.

---

## Tuning the cost/quality dial

Model choice per agent is the main lever. Defaults here: **haiku** to read, **sonnet**
to build, **opus** to judge.

- Tighter budget → move `planner`/`reviewer` to sonnet, or builders to haiku for simple
  stacks.
- Higher stakes → push reviewers/security to the strongest model and raise `maxTurns`.
- `CLAUDE_CODE_SUBAGENT_MODEL` can override the model used for subagents globally
  without editing every file — handy for a quick cheap/expensive sweep.

---

## Packaging this as a plugin

Everything here is a portable convention, so the whole setup can ship as a **plugin**
and be installed across repos instead of copied. Broadly: add a plugin manifest, point
it at these `agents/`, `skills/`, `commands/`, and `hooks/` directories, and distribute
it through a marketplace/registry your team controls. Teams converge on one shared
workflow; updates roll out in one place. (See the plugins section of the docs for the
current manifest format and registry mechanics — verify against your installed version,
since this is an evolving area.)

---

## Extending the template — rules of thumb

- **Adding a phase or method?** It's probably a **skill** (reusable method), optionally
  with a thin **command** wrapper if operators should trigger it directly.
- **Adding a specialist?** It's a **subagent** — give it the *least* tools it needs and
  the *cheapest* model that does the job, and start its description with "Use this agent
  when…".
- **Adding a guardrail?** It's a **hook** if it must be deterministic and unskippable;
  a **permission** if it's about gating a tool.
- **Adding an integration?** It's an **MCP server** in `.mcp.json` — config committed,
  secrets in env.

Keep each surface doing the one thing it's best at, and the whole stays coherent as it
grows.
