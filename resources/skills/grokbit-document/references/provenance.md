# Provenance and staleness

A doc suite six months stale is negative value — it actively misleads, and it is trusted precisely because it looks maintained. Generating documents is easy; keeping them true is the product.

## Frontmatter

Every emitted document carries:

```yaml
---
grokbit_type: adr
derived_from:
  - .grokbit/plans/password-reset/03-design.md@a3f9c21
  - src/auth/reset.ts@a3f9c21
authored_sections: [consequences, escalation]
verified: 2026-07-30
---
```

`derived_from` is `<path>@<commit>` — the commit the content was read at, not the commit the doc was written at. Those differ whenever a doc is generated from history.

**Uncommitted sources:** if the source file is dirty or untracked, use `@WORKING` (or `@DIRTY`) instead of inventing a commit SHA. Drift tools must treat `@WORKING` as always needing re-check — never as a permanent green CI baseline. Prefer committing sources before emitting long-lived docs when the human allows it; if not, the document's provenance must still be honest so CI can flag `untracked`/`WORKING` rather than claiming a false anchor.

`authored_sections` lists sections whose content came from a human. Drift detection must treat these differently: they cannot be regenerated, so a changed source means *review this*, not *rerun the generator*.

`verified` is the last date `verify_doc.py` passed. A document that has never been verified should say so rather than omitting the field.

`content_hash` (optional but recommended) is a stable hash of the emitted body (excluding volatile fields you intentionally refresh). Used with the living-docs regenerate rule in `registry.md` so a hand-tuned file with leftover `grokbit_type` frontmatter is not silently overwritten.

## Claim-level staleness

`check_drift.py` flags the sections that cite a changed source, not the whole document. Marking a forty-page guide stale because one signature moved teaches people to ignore the marker, and once they do, the mechanism is worse than nothing.

The section attribution is deliberately simple — headings under which the source's filename appears verbatim. That simplicity has a real cost: it **under-reports routinely**. A section can cite a source in its frontmatter and never repeat that source's filename anywhere in its own prose, and when that happens the section list comes back empty even though the whole document is exactly the thing that changed. Treat an empty `sections` list on a real finding as "review the whole document," never as "nothing to review" — the attribution is a pointer to *some* of the stale prose, not proof there's no more of it.

Not every finding is drift in the literal "the source changed" sense, and the tool says so rather than folding everything into one bucket: a source with no commit history (`untracked`), a recorded commit that no longer resolves in this repository (`unknown-commit`), a source that no longer exists (`deleted`), and a document with no `derived_from` at all (`no-provenance` — the enforcement mechanism for hard rule 4; a document invisible to this whole system is reported, not silently skipped) are each their own status. All of them are equally untrustworthy claims, and all of them fail `--ci`.

## Where it runs

**On save, in Claude Code** — `hooks/doc-drift.json` documents a `PostToolUse` snippet you copy into your own `settings.json` (Claude Code does not auto-load a skill's `hooks/` directory; that auto-load exists only for plugins — see `references/host-adapters.md`). It filters by the edited path itself (read from the hook's own stdin payload) so it doesn't fire a git scan for every edit to every file, and it always exits 0 — advisory only, so a false alarm never blocks an edit. Grok Build has no equivalent hook mechanism at all; run `--ci` manually there, or from your own CI.

**In CI** — `check_drift.py --ci` exits non-zero when any finding of any status exists. This is what actually keeps a suite honest over months; the save-time hook is a courtesy, the CI gate is the enforcement.

**In the extension** — `--json` feeds a sidebar badge. Show the count, not a modal.

None of it is model work. "Did this file change since commit X, and does its commit history even support that claim" is a git question, and routing it through a model is slower, costlier, and less reliable.

## Two readers

Documentation in an agentic workflow has a second reader: **the model**. Your suite already depends on this — the Systems Analyst's survey quality is the largest single determinant of whether a plan is grounded or fabricated, and a current, citable doc set makes that survey both cheaper and more accurate.

The two readers want different registers from the same facts. A human wants narrative, motivation, and worked examples. A model wants precise current statements with paths attached and no throat-clearing.

So emit both from one provenance-tracked source: `docs/` for humans, `.grokbit/context/<type>.md` as a compact digest for the next survey. Same facts, same staleness tracking, different shape. Writing them separately guarantees they diverge.

This is the angle worth building the product story around. "Documentation as context engineering" — where the return shows up as cheaper and more accurate agent runs rather than as a wiki nobody opens — is a much easier sell to a vibe coder than "you should write documentation," which they have already decided they do not do.

## Manifest

`.grokbit/docs-manifest.json` indexes type → path → provenance → last verified, so the extension can render the doc set without walking the tree and CI can check completeness against the registry.
