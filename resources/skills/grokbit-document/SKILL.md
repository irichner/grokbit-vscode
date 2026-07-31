---
name: grokbit-document
description: Write or regenerate any software project document — README, ADR, changelog, API reference, user guide, contributing guide, test plan, security posture, runbook, SDD, PDD, BRD. Derives what it can from existing .grokbit plan artifacts and source, asks only for what cannot be derived, then verifies every command, path, and link actually works. Use this skill whenever the user asks for documentation, a doc, a write-up, a spec, a guide, release notes, a changelog, or names any document type; when they click the Documentation icon in the Grokbit extension; or after a plan is approved or a change ships and a document should follow. Do NOT use it for inline code comments or docstrings — write those directly.
---

# Grokbit — Document

Wrong code fails loudly. **A wrong document just sits there being confidently wrong**, and it is worse than no document because people act on it. There is no verify command that goes red.

That single asymmetry shapes everything here. The work is not producing prose — a model does that easily. The work is making sure the prose is *true now* and *stays true*, which is why this skill spends more effort on verification and provenance than on writing.

## Two entry points

**Extension (primary).** The user clicks the Documentation icon and picks a type. The extension invokes this skill with `{type_id, slug, target_path}`. No trigger ambiguity — the click is the intent.

**Natural language (CLI).** "Write a runbook for the reset flow." Resolve to a type id from `types/`, confirm the match in one line, proceed.

Either way the procedure below is identical. **Do not put document logic in the extension.** If section assembly lives in TypeScript, the CLI and the extension produce different documents from the same inputs, and you are maintaining two implementations of one thing.

## Plan-less invocation

Most requests for a document arrive with no `.grokbit/plans/{slug}/` on disk at all, because the user never ran `grokbit-plan` — for `readme`, `changelog`, and `contributing` especially, this is the common case, not the exception. It must not force a near-zero coverage refusal on the single most common request this skill gets.

When the named slug has no plan directory (or no slug was given at all — see `references/registry.md` § Extension contract for which types even need one), enter **source-only mode**: resolve only the `src:`-prefixed `derive_from` entries. A section whose only route to content is a plan artifact is not "derived and empty" — it is simply unavailable, and it does not count against coverage at all. Coverage in this mode is the fraction of sections that resolve from `src:` or a user answer, over the sections that have *either* a `src:` source *or* an `ask` prompt; sections with neither route are excluded from the denominator, not counted as failures.

Step 2's coverage report and the ~30% floor both run against this narrower, honest denominator. A README asked for on a repo with real source and no plan history usually clears the floor on `src:env:**` alone; a type built almost entirely from `ask` prompts (a BRD, most of a PDD) barely notices the difference, because most of its sections were never plan-only to begin with.

## Hard rules

1. **Derive before asking, ask before writing, never invent.** Any claim that is not derivable from an artifact or the source, and not supplied by the user, is omitted or marked `TODO` — never smoothed over with plausible prose. Plausible-and-wrong is the failure mode this whole skill exists to prevent.
2. **Document what the code does now**, not what the plan intended. Where they differ, the code wins and the difference is worth reporting.
3. **Every command, path, and link gets executed or resolved.** A quickstart whose first command fails is the most common documentation defect there is, and it is fully automatable.
4. **Every derived document carries provenance.** No `derived_from` frontmatter means no way to detect staleness, and a stale doc suite is negative value.
5. **Refusing to write a document is a valid outcome.** See the necessity gate.

## The registry

Document types are data, not prose in this file. Each lives in `types/<id>.md` with frontmatter declaring its audience, sections, derivation sources, and verification rules. Read `references/registry.md` for the schema.

Seeded types:

| id | Category | Answers |
|---|---|---|
| `readme` | hybrid | What is this and how do I run it? |
| `adr` | derived | Why is it built this way, and what else was considered? |
| `changelog` | derived | What changed, and does it affect me? |
| `api-reference` | derived | What can I call, with what, and what comes back? |
| `user-guide` | authored | How do I accomplish my task? |
| `contributing` | hybrid | How do I work in this repo without breaking conventions? |
| `test-plan` | derived | What is verified, and what is not? |
| `security-posture` | derived | What are the risks and what is done about them? |
| `runbook` | derived | It is broken at 2am — what do I do? |
| `sdd` | hybrid | How is the solution structured, component by component? |
| `pdd` | hybrid | What is the process, step by step, including exceptions? |
| `brd` | authored | What does the business need and how will we know it worked? |

Adding a type is adding a file. No change to this skill, no change to the extension.

## Step 1 — Necessity gate (Information Architect)

Before anything: **who reads this, and what will they do differently after?**

A button labeled Documentation invites generating documents nobody needs. The single most common documentation failure is not bad writing — it is a polished suite nobody opens, which then goes stale and misleads. Declining is a real outcome and often the right one.

Answer from the type's `audience` and `answers` fields plus the repo context. Only ask the user when the type is `authored` and the reader is genuinely unclear.

## Step 2 — Coverage (Documentation Engineer)

Resolve every section's `derive_from` against the plan artifacts and source. Compute coverage before writing a word, and report it:

```
PDD — password-reset
  6 of 9 sections draftable from your artifacts
  3 need input: exception handling, process owner, volume estimates
```

**If coverage is below roughly 30%, say so and stop.** "This would be mostly placeholders — your plan doesn't have the source material yet" is more useful than a spinner followed by a hollow document, and it gives the user something to act on.

Coverage is also the honest replacement for the conversational necessity gate that the click removed.

## Step 3 — Gap fill

Ask only for sections that cannot be derived, using the section's `ask` prompt. Batch the questions into one round, capped at the type's own `ask_cap` (1–5, set per type in `types/<id>.md` — the type's value always wins; five is the loosest ceiling any type gets, not a default every type reaches).

The ceiling is looser than Plan's flat three because the user came here deliberately for a document and expects to supply content. It still exists — a twenty-question intake produces an abandoned document.

## Step 4 — Draft (Technical Writer)

Write per the type's section list, in the register the type declares. Follow the conventions in `02-survey.md` for naming and terminology so the document sounds like the repo rather than like a model.

Where a section derives from an artifact, carry the citation through. Where content came from the user, mark it so drift detection knows it cannot be re-derived.

## Step 5 — Executable verification (Docs QA)

Run `scripts/verify_doc.py`. It resolves every file path and internal link — including anchors, not just file existence — checks every citation in the document's own `derived_from` frontmatter, does a best-effort syntax check on the code samples it has a checker for, and lists every shell command it finds.

**There is no sandbox.** `--execute` actually runs those commands with the full inherited environment and network, and the script refuses to do that at all unless it detects a container/CI environment or you pass `--i-understand-this-runs-shell` — a doc-verification tool that silently runs whatever it reads is a remote-code-execution path wearing a helpful hat. Without `--execute`, commands are listed, not verified, and the script's own exit code says so.

Enter **Loop D1** (`references/loops.md`), cap 3. **A document whose commands fail is blocked, not shipped with a warning.** That is the doc equivalent of verify-or-revert, and it is the single highest-value check in this skill.

## Step 6 — Fresh-reader test (Docs QA)

Same context-isolation mechanism as the Plan Reviewer, and it works better here.

Dispatch a reviewer with **only the document and a clean environment** — no codebase, no conversation, no plan artifacts. It attempts the task the document describes. Every point where it must guess, or needs knowledge the document never supplied, is a finding.

This catches the one defect proofreading never catches: the author knew something and did not notice they knew it. Enter **Loop D2** (`references/loops.md`), cap 2.

## Step 7 — Emit with provenance

Write to the type's `output` path with frontmatter:

```yaml
---
grokbit_type: adr
derived_from:
  - .grokbit/plans/password-reset/03-design.md@a3f9c21
  - src/auth/reset.ts@a3f9c21
authored_sections: [consequences]
verified: 2026-07-30
---
```

Also update `.grokbit/context/<type>.md` — a compact digest for the next session's Systems Analyst survey. Same facts, different register: humans want narrative and worked examples, models want precise current statements with paths attached and no throat-clearing. Generate both from one source rather than letting them drift.

## Staleness

`scripts/check_drift.py` compares each `derived_from` commit against HEAD and flags **the specific claims** sourced from a changed file — not the whole document. It also flags a document with no `derived_from` at all: hard rule 4 says every derived document carries provenance, and a script that quietly skipped the ones that don't would make that rule aspirational instead of enforced. Stale-marking a forty-page guide because one signature changed trains people to ignore the marker.

Runs as an advisory check right after an edit in Claude Code (`hooks/doc-drift.json` — a manual copy into your own `settings.json`, not something auto-loaded; see that file and `references/host-adapters.md`) and as the actual enforcement in CI (`--ci`, exit non-zero on any finding). It is deterministic — a frontmatter parse and a couple of `git` calls — so it is a script, not model work. Faster, cheaper, and more reliable that way.

## Output contract

```
docs/                      human-facing, paths per type
.grokbit/context/          compact digests for the next survey
.grokbit/docs-manifest.json  type → path → provenance → last verified
```

## Failure modes to watch for

- **Confident invention.** The model fills a gap with plausible prose instead of marking it `TODO`. The most damaging thing that can happen here, and the hardest to spot on review, because it reads well.
- **Documenting the plan instead of the code.** The plan said the endpoint takes `email`; the code shipped `emailAddress`. Read the source.
- **Aspirational documentation.** Describing intended behavior in the present tense.
- **Generating on request without a reader.** The document exists, nobody opens it, it goes stale, and it eventually misleads someone.
- **Skipping verification because the commands "obviously work."** They obviously worked in the author's shell, which has state a new reader's shell does not.
