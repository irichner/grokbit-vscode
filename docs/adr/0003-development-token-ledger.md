# 0003. The launcher's token figure is Grokbit's development cost, baked in at build time

- **Status:** Accepted
- **Date:** 2026-07-30
- **Deciders:** Israel Richner

## Context

The activity-bar launcher shows a small line above **New session**: `v3.0.4 · 1.0B tokens`.
The bug report was *"This is supposed to be a running total of all tokens used to create and
update this extension… why is it not being incremented by each session?"*

What it actually did (`GrokSidebar.computeLifetimeTokens`, since removed) was sum
`contextTokensUsed + totalTokensBeforeCompaction` across every surviving
`~/.grok/sessions/<encodeURIComponent(cwd)>/*/signals.json` on **the viewer's** machine,
lifted by any live session's in-memory context. Three things were wrong with that at once,
and only the third is fixable by editing the number's plumbing:

1. **It was non-monotonic by construction.** A sum over a mutable directory listing falls
   when a directory disappears, and the extension deletes session directories from six
   places — four of which never refreshed the badge, so it dropped silently.
2. **It summed the wrong quantity.** `contextTokensUsed` is *current context size*, not
   tokens spent. Each turn re-sends the whole growing context, so tokens actually spent are
   the sum of per-turn contexts — roughly two orders of magnitude larger. Its own doc
   comment conceded the point.
3. **It measured the wrong machine, at the wrong time.** Almost all of this repo's
   development happens in terminal agent sessions that the extension never hosts and
   therefore cannot see, and none of a *user's* activity is development of Grokbit anyway.

The user's answers settled the contract before any design work: *"This project lives in a
public repo, any development tokens spent changing it should be logged and aggregated"* and
*"Only tokens spent changing this project. This is a grokbit development number. User
activity will never effect this number."* Plus: backfill the history.

That last sentence is the whole design constraint. Any runtime meter fed by the viewer's own
sessions — a `globalState` ledger, per-turn accumulation, a `max(stored, scanned)` floor, any
scan of `~/.grok` or `~/.claude` — is *by definition* "user activity affecting the number".

## Options considered

### Option A — Fix the existing runtime meter (make it monotonic, count per-turn usage)
- Pros: smallest visible diff; no new artefacts, no new tooling, no pipeline.
- Cons: cannot deliver the requested quantity at all. It would still measure the *viewer's*
  sessions on the *viewer's* machine, which is the one thing the contract forbids. Making it
  monotonic (a persisted high-water mark) would additionally create an irrecomputable
  per-install number that drifts between users and can never be audited or corrected.

### Option B — Ship `docs/metrics/token-usage.json` in the vsix and read it at runtime
- Pros: one artefact instead of two; the ledger and what's displayed are trivially the same
  file.
- Cons: `.vscodeignore` excludes `docs/**`, so this needs that loosened plus a
  `!docs/metrics/**` re-include — quietly widening what ships from a directory that also
  holds plans, ADRs and the changelog archive. It also re-introduces a runtime failure mode
  (missing / truncated / malformed file in a user's install) and runtime I/O on the
  extension host, for a value that cannot change after packaging.

### Option C — Aggregate at dev time, commit the ledger, bake a generated constant into the build
- Pros: `src/token-metrics.ts` compiles to `out/token-metrics.js`, which the existing
  `!out/**/*.js` rule already ships — **zero packaging-surface change**. A compiled-in
  `export const` has no runtime failure mode and costs no I/O, deleting the per-turn
  directory walk the old badge paid on every completed turn. `tsc` proves its shape at build
  time and a reviewer sees the number move in the commit diff — which is precisely what
  "logged and aggregated in a public repo" asks for. The JSON stays out of the vsix, so it
  can carry the full per-session breakdown the merge needs without shipping any of it.
- Cons: two artefacts to keep in step, and the figure lags live development by up to one
  release.

## Decision

We chose **Option C**. The deciding factor is the contract, not the mechanism: because no
user activity may move the number, the correct amount of computation for the shipped
extension to do is **none**. Everything else follows from that — if the extension computes
nothing, the value must arrive at build time, and a generated constant is the cheapest,
safest way to carry it.

The contract, stated once so it is not re-litigated by inference:

- **What it means.** Every token every maintainer has spent, in any agent session, changing
  this repository.
- **What it excludes.** All end-user activity, permanently. It is not a usage meter, not
  telemetry, and nothing about it is transmitted.
- **What it is not to be confused with.** The composer context donut and the status-bar
  percentage show the *active session's* current context. Those are correct, different, and
  untouched.
- **Two buckets, two accountings.** `claude_sessions` is exact billed tokens
  (`input + output + cache_read + cache_creation` per assistant record, deduped by
  `message.id`); `grok_sessions` is a documented **lower bound**
  (`contextTokensUsed + totalTokensBeforeCompaction`), because grok persists no per-turn
  record on disk. Both feed the headline total and each records its own `accounting` tag.
- **How it is regenerated.** `npm run metrics:tokens`, plus a **non-fatal** step in the
  rebuild scripts after the version bump and before packaging, plus a line in the release
  doc-review checklist. Non-fatal is deliberate: a metrics refresh must never be able to
  block a rebuild or a release.
- **Why it is merged, not overwritten.** Bucketed by each record's own `sessionId`, written
  as a union of ids with a per-session `max`, headline total recomputed from the map. A blind
  full recompute would reproduce the original non-monotonicity one layer up, since
  transcripts get pruned and a second maintainer holds a different subset. A scan that finds
  nothing writes nothing.
- **Privacy.** Transcripts are never committed. The aggregate carries session ids, integers
  and two fixed accounting tags — no prompts, titles, model names or paths.

## Consequences

- **Easier:** the number only goes up, means one auditable thing, is identical for every
  user, and is reviewable as a diff. The per-turn directory walk is gone.
- **Harder / accepted trade-offs:**
  - **The displayed figure jumps ~200×** — from a few million to ~1.0 billion at the first
    backfill. That is what per-turn accounting costs and is not a calibration bug. The
    `CHANGELOG.md` entry says so explicitly, because the next reader's instinct will be to
    "fix" it downward.
  - **It is stale between releases**, by up to one release. The tooltip's `as of <date>` is
    the honest disclosure. Do not close this gap at runtime — that is Option A.
  - **It is only as complete as the machines that have run the aggregator** (today: one
    maintainer's laptop), and Claude Code prunes transcripts over time. The per-session `max`
    preserves what has been seen; it cannot recover what aged out before the first run.
  - **A failed regeneration is silent** by design, since regeneration is non-fatal. Accepted:
    the alternative is a metrics script that can block a release.
  - **The Python side is not in CI.** `npm test` and CI stay Python-free; the aggregator is
    verified by `scripts/verify_token_aggregator.py` against `fixtures/token-usage/`, run by
    hand, with `test/token-metrics.test.ts` guarding the committed constant's shape in layer 1.
- **Risks & follow-ups:** the standing risk is someone "fixing" the badge back into a live
  per-user meter — the exact bug removed here — because a build-time constant looks like an
  oversight next to a live donut. Mitigated by this ADR, by the doc comments on
  `postLauncherMeta` and `src/token-metrics.ts`, by `CLAUDE.md § Token surfaces`, and by
  `test/token-metrics.test.ts`'s "data module — no imports, no logic" assertion, which fails
  the moment anything executable is added to the generated module.
