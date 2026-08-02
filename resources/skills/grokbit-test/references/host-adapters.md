# Host adapters

The skill body above is identical across hosts. Only dispatch, local capability, and distribution differ.

---

## Capability detection

Run once at the start of either mode. It changes how the rest of the run behaves.

| Capability | Effect if absent |
|---|---|
| Subagents with isolated context | Run roles sequentially; write-then-re-read between roles |
| Parallel dispatch | Run independent checks serially |
| Per-agent model selection | Ignore tier hints; single model throughout |
| Headless browser | Skip Loop T5 entirely — report every affected view `UNVERIFIED — no headless browser`, never silently, and never as passing |
| A production build toolchain (the project's real build command, not the dev server) | Step 6's build/start/health checks cannot run — report each `UNVERIFIED`, never assumed `PASS` |
| `git` | Cannot commit the baseline characterization tests (Loop T1) or the Step 7 baseline retirement — report the commit as blocked rather than leaving uncommitted test files a future session has no reason to trust |

Degradation is graceful for the first three. It is not graceful for the last three — a missing browser, build toolchain, or `git` means a whole category of this skill's job did not happen, and that has to be reported as a gap, never implied by silence.

---

## Claude Code

**Dispatch:** spawn roles via the Task tool, one subagent per role, passing the role prompt from `references/roles.md` plus the named inputs.

**Model tiers:** cheap -> Haiku, standard -> Sonnet, expensive -> Opus. This phase's roster is not cheap-tier-dominant — see `references/loops.md` § Loop budget — so tier choice matters more here than it does in Plan.

**Hooks:** `PreToolUse` can enforce the write restriction as a real invariant rather than an instruction — deny writes to test files during verify mode, with a narrow allowlist for the exact QA Automation Engineer subagent running Step 7 (baseline retirement) against exactly the files its findings name. That is what makes "never edit a test to make it pass" enforceable instead of merely stated.

---

## Grok Build

**Dispatch:** Grok Build delegates to parallel subagents, each with its own context window. Worktrees are unnecessary here — Test roles read a fixed set of artifacts and never touch each other's output mid-run, so there is nothing for a worktree to isolate that context isolation does not already cover.

**Config:** project settings under `.grok/`; user-level permission mode in the home config.

---

## Distribution

`grokbit-test` ships inside the Grokbit VS Code extension, not as a standalone install. On activation the extension provisions this skill — and its siblings, `grokbit-explore`, `grokbit-plan`, `grokbit-implement`, and `grokbit-document` — into the home tier of both CLIs:

```
~/.grok/skills/grokbit-test/
~/.claude/skills/grokbit-test/
```

Plain file copy, re-copied whenever the extension updates — there is no symlink and nothing to keep in sync by hand. `grok.skills.provision` (`auto` | `off`, default `auto`) turns this off if you want to manage the skill yourself. Because provisioning is home-tier, these skills are available in every session on the machine, not only ones started from the extension.

A project that wants its own fork of this skill drops a copy at `.grok/skills/grokbit-test/` or `.claude/skills/grokbit-test/` — project tier wins over the provisioned home-tier copy by the normal workspace-first precedence, so the fork shadows it without editing it in place.

---

## The Grokbit extension

Your extension is the one consumer you control end to end, which makes `.grokbit/plans/<slug>/test/` a product interface rather than an implementation detail.

- Show the verdict as evidence, not a status: criteria proven vs. unverified, before/after screenshots side by side, security findings by severity. The audience cannot read a diff and can read a screenshot.
- Make `CRITICAL` security findings genuinely blocking in the UI, not dismissible with a click.
- Surface `test/baseline.md`'s `NOT CAPTURED` section and a reduced-mode run's `## Reduced mode` statement prominently — both are the specific honesty this skill exists to enforce, and both are easy to bury in a wall of markdown.
- Let the user edit any artifact. It is all markdown; treat their edit as authoritative.
