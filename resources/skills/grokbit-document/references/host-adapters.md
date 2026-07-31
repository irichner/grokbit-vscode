# Host adapters

The skill body is identical across hosts. Only dispatch, installation, and
hook wiring differ.

---

## Capability detection

Run once at the start of a document request. It changes how the later steps
run.

| Capability | Effect if absent |
|---|---|
| Subagents with isolated context | Run roles sequentially; write-then-re-read between roles. Loop D2 (the fresh-reader test) needs this the most — without real isolation the reviewer already knows the answer, and the check stops meaning anything |
| Parallel dispatch | Run independent checks serially. Little here actually parallelizes — one document, one draft, one verification pass — so this matters less to this skill than to Plan or Test |
| Per-agent model selection | Ignore tier hints; single model throughout |
| `git` | `scripts/check_drift.py` cannot run at all — every `derived_from` claim becomes permanently unverifiable, not merely unchecked. Say so; do not silently skip staleness tracking |
| `python3` (or `python` / the Windows `py` launcher) | Neither script can run. Verification and drift detection degrade to manual review, which is exactly the gap this skill exists to close — report the degradation, don't proceed as though it were covered |
| A disposable container or CI runner | `scripts/verify_doc.py --execute` refuses to run anything (see its own `--i-understand-this-runs-shell` escape hatch and SAFETY note). Commands stay listed, not run, and **Loop D1 cannot exit clean** — see `references/loops.md` |

This skill has no dependency on a headless browser, plan-mode edit blocking,
or any of the write-restriction machinery Plan and Implement rely on —
writing the document *is* the task here, not something to gate.

---

## Claude Code

**Install:** `.claude/skills/grokbit-document/` (project) or
`~/.claude/skills/grokbit-document/` (user).

**Dispatch:** spawn roles via the Task tool, one subagent per role, passing
the role prompt from `references/roles.md` plus the named inputs.

**Model tiers:** cheap → Haiku (Documentation Engineer — mechanical
derivation, no judgment about wording), standard → Sonnet (Information
Architect, Docs QA verification), expensive → Opus (Technical Writer, Docs QA
fresh-reader — the two roles that actually have to write well or judge
someone else's reading of it).

**Hooks:** `PostToolUse` can flag drift right after an edit lands, using the
stdin JSON to skip noise directories rather than firing blind on every
Edit/Write. This skill ships that as `hooks/doc-drift.json` — a manual
copy-into-`settings.json` snippet, **not** something Claude Code auto-loads
from a skill's own `hooks/` directory (that auto-load exists only for
plugins). See that file's own `$comment` for the exact merge instructions and
why it's advisory-only; enforcement is `scripts/check_drift.py --ci` in CI,
same as every other host.

---

## Grok Build

**Install:** copy the same folder into the project, or into
`~/.grok/skills/`. Grok Build reads the Anthropic skill format directly, so
no translation layer is needed.

**Dispatch:** Grok Build delegates to parallel subagents, each with its own
context window — genuinely useful for Loop D2's fresh-reader isolation, since
a parallel subagent with no shared context is exactly the isolation that
loop needs. Worktrees add nothing here: there is no concurrent-task
commit-per-task discipline to protect, because this skill emits a document,
not code.

**Verification:** `scripts/verify_doc.py` and `scripts/check_drift.py` are
plain `python3` + `git`. Grok Build has no special interaction with either —
they run identically regardless of which host invoked the skill.

**Config:** project settings under `.grok/`. No plan-mode or dependency-gate
interaction — Document doesn't block writes or gate installs the way
Implement does; it just writes files, like any other document-producing
tool, and its own gates (the necessity gate, the coverage floor, Loop D1's
block-on-fail) are enforced by the skill body itself, not by host permission
settings.

---

## The Grokbit extension

Your extension is the third consumer and the only one you control end to
end. For this skill, `references/registry.md` § Extension contract is the
full spec — it does three things and no more: enumerate `types/*.md` for the
picker, compute coverage for the active slug, invoke the skill.

- Render the type picker grouped by `category` (`derived` / `hybrid` /
  `authored`), each row showing its `label` + `answers`.
- Show the coverage preview before the user commits to anything — `N of M
  sections draftable`, which ones need input (`SKILL.md` Step 2). This is the
  honest replacement for the necessity gate a one-click invocation removes.
- Surface the verification report (`scripts/verify_doc.py --json`, including
  its `mode` field — `listed` vs `executed`, see hard rule 3) and the drift
  count (`scripts/check_drift.py --json`) as a badge, not a modal — see
  `references/provenance.md`.
- Let the user edit any emitted document. It is all markdown with
  frontmatter; treat their edit as authoritative, the same rule the rest of
  this suite applies to every artifact.

---

## Single-source install

One canonical copy, symlinked into both host directories:

```
.grokbit/skills/grokbit-{plan,implement,test,document}/  # canonical
.claude/skills/grokbit-*  ->  ../../.grokbit/skills/grokbit-*
.grok/skills/grokbit-*    ->  ../../.grokbit/skills/grokbit-*
```

`install.sh` does this. On Windows without developer mode, symlinks fail — it
falls back to copying, which means edits need a re-run. A stale duplicate
that silently diverges is an unpleasant bug to track down.
