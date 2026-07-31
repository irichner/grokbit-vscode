# Host adapters

The skill bodies are identical across hosts. Only dispatch and installation differ.

---

## Capability detection

Run once at the start of any phase. It changes how every later step runs.

| Capability | Effect if absent |
|---|---|
| Subagents with isolated context | Run roles sequentially; write-then-re-read between roles |
| Parallel dispatch | Run independent checks serially |
| Per-agent model selection | Ignore tier hints; single model throughout |
| Plan mode / edit blocking | Enforce write restrictions by self-discipline |
| Headless browser | Skip visual verification; report it as `UNVERIFIED`, never as passing |

Degradation is graceful in every case except the last. A missing browser means visual checks did not happen, and that must be reported as a gap rather than silently omitted.

---

## Claude Code

**Install:** `.claude/skills/<skill-name>/` (project) or `~/.claude/skills/` (user).

**Dispatch:** spawn roles via the Task tool, one subagent per role, passing the role prompt from `references/roles.md` plus the named inputs. Optionally mirror roles as standing definitions in `.claude/agents/` so they can be invoked directly outside a phase.

**Model tiers:** cheap -> Haiku, standard -> Sonnet, expensive -> Opus. The Systems Analyst is this skill's only cheap-tier role, and it does the highest-volume work — opening files, counting callers — so it is where most of the savings live; the Business Analyst is standard-tier, and the Solutions Architect and Plan Reviewer are both expensive.

**Hooks:** `PreToolUse` can enforce the write restrictions as real invariants rather than instructions — deny source writes during Plan, deny writes to test files during Test verify mode, with a narrow allowlist for the exact QA Automation Engineer subagent running Test's Step 7 (baseline retirement) against exactly the files its findings name. Worth doing for both; the second one is what makes "never edit a test to make it pass" enforceable instead of merely stated.

---

## Grok Build

**Install:** copy the same folder into the project, or into `~/.grok/skills/`. Grok Build reads the Anthropic skill format directly, so no translation layer is needed.

**Dispatch:** Grok Build delegates to parallel subagents, each with its own context window, and can launch them in separate git worktrees. Worktrees are unnecessary for Plan and Test but genuinely useful in Implement when independent tasks run concurrently — though note that concurrent tasks break the commit-per-task discipline unless each worktree commits separately and merges after its scope audit.

**Plan mode:** the native plan mode blocks edits until approval and renders a sub-task graph. Run `grokbit-plan` inside it and hard rule #1 becomes host-enforced, with the approval gate rendered natively. Emit `plan.md` in the documented task-block format so the viewer can parse it.

**Config:** project settings under `.grok/`; user-level permission mode in the home config. Do not enable always-approve for Implement — the dependency gate depends on the install command being interceptable.

---

## The Grokbit extension

Your extension is the third consumer and the only one you control end to end, which makes `.grokbit/plans/<slug>/` a product interface rather than an implementation detail.

- Render `plan.md` as a task checklist with each `verify:` command as a run button.
- Show `progress.md` live during Implement — blocked tasks in red, retry counts visible. Retry count is the best available early signal that a plan is going wrong.
- Banner `assumptions.md` and `deviations.md`. At two deviations, warn; at three, prompt to re-plan. This is the single most valuable piece of UI in the product, because the escalation threshold is the rule an agent is least inclined to respect on its own.
- Show the Test verdict as evidence, not a status: criteria proven vs. unverified, before/after screenshots side by side, security findings by severity. The audience cannot read a diff and can read a screenshot.
- Make `CRITICAL` security findings genuinely blocking in the UI, not dismissible with a click.
- Let the user edit any artifact. It is all markdown; treat their edit as authoritative.

Because both CLIs read the same skill folders and write the same artifacts, a user can plan in Grok, implement in Claude, and test in either. That interop is worth putting on the landing page.

---

## Installation

The suite ships inside the Grokbit extension (`resources/skills/`) and is provisioned automatically: on activation the extension copies it into the home tier, `~/.grok/skills/` and `~/.claude/skills/`, so it works in every workspace without writing into the user's repo. Copy, not symlink — there is no cross-platform symlink step to fail silently on Windows, and no install script to re-run by hand. Re-provisioning is version-stamped and only runs when the bundled suite is newer than what is already installed.
