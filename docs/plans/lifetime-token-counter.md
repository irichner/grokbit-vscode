# Lifetime token counter (launcher header) — development-cost ledger

> Status: **planned, decisions made, ready to implement.**
> Bug report: *"We seem to have a bug in reporting tokens used on the left nav next to
> version. This is supposed to be a running total of all tokens used to create and update
> this extension. This should be an aggregated total number. Can you find out why it is not
> being incremented by each session?"*

---

## Decisions (answered by the user — these govern the design)

| # | Question | Answer (verbatim) |
|---|---|---|
| Q1 | Which quantity? | *"This project lives in a public repo, any development tokens spent changing it should be logged and aggregated."* |
| Q2 | Accounting rule? | *"Only tokens spent changing this project. This is a grokbit development number. User activity will never effect this number."* |
| Q3 | Backfill history? | Yes — backfill. |
| Q4 | Proceed? | Yes, implement after the plan is corrected. |

**What this rules out, permanently.** Any runtime meter fed by the user's own sessions is
"user activity affecting the number" and is out of scope by definition. Specifically dead:
a `globalState` ledger, per-completed-turn accumulation, a `max(stored, scanned)` floor
maintained by the extension, and any runtime scan of `~/.grok/sessions` or
`~/.claude/projects`. **The shipped extension performs no token computation at all** — it
displays a constant. All scanning is dev-time, on a maintainer's machine, in the Python
aggregator.

---

## Goal

The `N tokens` figure in the activity-bar launcher header becomes the **aggregated
development cost of Grokbit itself** — every token any maintainer has spent, in any agent
session, changing this repository — computed at dev time by
`scripts/aggregate_token_usage.py`, committed to the public repo as
`docs/metrics/token-usage.json`, baked into the extension as a generated constant at package
time, and refreshed as a routine part of the existing rebuild/release procedure.

It is identical for every user of the extension, and no user's activity can ever move it.

## Non-goals

- **Not** a per-user usage meter. Nothing about the viewer's own sessions is measured,
  stored, or displayed here.
- **Not** a runtime filesystem read of any kind. No `~/.grok`, no `~/.claude`, no
  `docs/metrics/**` read at runtime, no `.vscodeignore` change.
- **Not** telemetry. Nothing is transmitted; `src/telemetry.ts` is untouched.
- **Not** a dollar-cost figure, per-model breakdown, or usage chart in the UI.
- **Not** a change to the context donut or the status-bar `%` — those legitimately show
  *current context* and are correct.
- **Not** committing any transcript. Transcripts stay local and gitignored; only the
  aggregate leaves the machine (see § Git tracking & privacy).
- **Not** touching `readSessionTokenUsage` (`src/sessions.ts:444`) or
  `SessionStore.readTokenUsage` (`src/session-store.ts:66`) in their resume-donut role
  (`src/sidebar.ts:2586-2592`).

---

## Root cause — with evidence

The user's phrase "not being incremented by each session" has two mechanical causes and one
design-level cause. The suspected cache-staleness is **not** among them.

### RC-1 — the figure is a sum over *surviving* session directories, so it is structurally non-monotonic

`src/sidebar.ts:911-923`:

```ts
private computeLifetimeTokens(): number {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const grokHome = resolveGrokHome(process.env);
  const disk = readWorkspaceTokenUsage({ fs: defaultFs, grokHome, cwd });
  ...
  return mergeWorkspaceTokenUsage(disk, live);
}
```

`readWorkspaceTokenUsage` (`src/sessions.ts:489-521`) `readdirSync`s
`~/.grok/sessions/<encodeURIComponent(cwd)>/` and sums each directory's `signals.json`
estimate. A sum over a mutable directory listing **falls** when a directory disappears — and
this extension deletes session directories from **six** places:

| Deletes a session dir | file:line | refreshes the badge? |
|---|---|---|
| `onPanelClosed` empty-primer recycle → `removeSessionFromDisk` | `src/sidebar.ts:840-856`, `4367-4383` | **no** |
| `discardRestartedEmptySession` (model/effort switch on an empty session) | `src/sidebar.ts:2067-2083` | **no** |
| `discardAbandonedBackendSession` (backend flip on an empty session) | `src/sidebar.ts:630` | **no** |
| `sweepEmptyPrimerSessions` (once per activation) | `src/sidebar.ts:4390-4443` | **no** |
| `deleteSession` (per-row trash) | `src/sidebar.ts:3455-3480` | yes (`:3479`) |
| `clearAllSessions` | `src/sidebar.ts:3486-3540` | yes (`:3539`) |

The number can go **down**, and four of the six paths make it go down *silently*.

### RC-2 — the summed field is *current context size*, not tokens spent

`sessionTokenEstimate` (`src/sessions.ts:461-475`) returns
`contextTokensUsed + totalTokensBeforeCompaction`. Its own doc comment concedes the point
(`src/sessions.ts:455-460`): *"Grok does not persist a full billable input+output lifetime
counter — this is the closest durable signal."*

Real data, `…\019f3f9c-df05-7941-98a4-52661afdb5c8\signals.json`:

```
"turnCount":11, "assistantMessageCount":74, "toolCallCount":74,
"compactionCount":0, "totalTokensBeforeCompaction":0,
"contextTokensUsed":97427, "contextWindowTokens":512000
```

Eleven turns, 74 assistant messages — contributing **97,427**. Each turn re-sends the whole
growing context as input, so the tokens actually spent are the *sum of per-turn contexts*,
roughly an order of magnitude larger.

Compaction is **not** a cause: `compactionCount:0` here, and `totalTokensBeforeCompaction` is
grok's own carry-forward of context dropped by a `/compact`, so `sessionTokenEstimate` already
handles compaction as well as grok's on-disk data permits.

### RC-3 — Claude sessions contribute nothing durable, and closing a Claude tab makes the number *drop*

`computeLifetimeTokens` builds only a grok `readWorkspaceTokenUsage`.
`SessionStore.readTokenUsage` exists for both backends (`src/session-store.ts:66`; grok
`:100-102`, Claude `:489+`) but is wired **only** into the resume-donut path
(`src/sidebar.ts:2586-2592`).

Worse, the live lift at `src/sidebar.ts:915-921` pushes *every* pool member — including Claude
tabs — into `mergeWorkspaceTokenUsage` (`src/sessions.ts:527-539`). Since `disk.byId` holds no
Claude ids, `prev = 0` and the entire live Claude context is added; when the tab closes it
vanishes. **Open a Claude tab, work, close it → the badge goes back down.**

### RC-4 — work done outside the extension is invisible, and that is most of the development

`postLauncherMeta({ refresh: true })` fires from exactly four sites: launcher `ready`
(`src/sidebar.ts:384`), the `promptComplete` handler (`:2410`), `deleteSession` (`:3479`) and
`clearAllSessions` (`:3539`). Any agent session run **in a terminal** is structurally
invisible — and that is where this repo's development actually happens:

- `~/.claude/projects/c--Users-israe-Projects-Grokbit-ai/` holds **341 transcript files**
  (~28 top-level session `.jsonl` plus nested `subagents/**/agent-*.jsonl` and
  `subagents/workflows/wf_*/**`). **None** of it is a Grokbit-hosted session; none of it counts
  today, and none of it *could* count under any grok-`signals.json`-only design.
- grok CLI sessions run from a terminal *do* land in `~/.grok/sessions/…`, so they are counted
  — but at the wrong magnitude (RC-2) and only while their directory survives (RC-1).

Magnitude check, from the one source that already does per-turn accounting properly —
`.claude/logs/token-usage.jsonl:1`:

```json
{"cache_create":333626,"cache_read":30648296,"input":258,"output":154895,"total":31137075,...}
```

**31.1 million tokens in a single session.** The grok-only sum over 60 surviving session
directories cannot plausibly reach single-digit millions. Different quantity, different order
of magnitude.

### RC-5 — cache staleness is **not** the bug (checked)

`lifetimeTokensCache` (`src/sidebar.ts:248-252`) is recomputed on every `opts.refresh`, and
`promptComplete` passes `refresh: true` on **every** completed turn (`:2410`). The badge does
refresh per turn. The real defects at this site are the mirror image: the four silent deletion
paths defer *shrinks*, and the per-turn refresh costs a full `readdirSync` +
`readFileSync` + `JSON.parse` of every session's `signals.json` with no mtime memoization
(unlike `sessionCache`, `:247`).

### RC-6 — workspace-key fragility (minor, and already solved in the aggregator)

`sessionsDirFor` (`src/sessions.ts:95-97`) keys on `encodeURIComponent(cwd)`. Verified: globbing
both `c%3A%5C…Grokbit.ai\*\signals.json` and `C%3A%5C…Grokbit.ai\*\signals.json` returns the
**identical 60 session ids** — Windows' case-insensitive filesystem collapses them. Same result
on the Claude side: `c--Users-israe-Projects-Grokbit-ai` and `C--Users-israe-Projects-Grokbit-ai`
glob to the **same** session ids (`f937805e-…`, `c7f6c117-…`, `531cdc0f-…`, …), so there is one
physical directory here, not two.

This is why the aggregator must keep grouping by the record's own **`cwd` field**, never by the
folder slug — `scripts/aggregate_token_usage.py:12-17,58-81` already does exactly this, and it
is the behaviour that makes a case-sensitive filesystem (Linux/macOS, or a second maintainer)
safe.

### Conclusion — this is the *wrong quantity, by design*, not a mis-wired refresh

`docs/metrics/README.md.bak-agentic-20260716-052728:10-12` records the original split in as
many words:

> This ledger is the **shared, version-controlled commit history of tokens used to develop this
> extension** (any contributor). […] It is **not** the activity-bar launcher `N tokens` line (that
> is a project-lifetime estimate from on-disk session `signals.json`) and **not** the
> active-session context donut.

The launcher line was *specified* as a per-workspace estimate of grok session context. The user
wants — and this plan delivers — the other quantity: the committed, aggregated development cost.
No amount of refresh-site correction reaches it, because the data it sums is the wrong data,
gathered on the wrong machine, at the wrong time. **The fix is to stop computing at runtime
entirely.** RC-1…RC-6 are retained above because they explain every symptom the user observed,
and because RC-1/RC-3's non-monotonicity is a trap the *aggregator* must now avoid in its own
way (see § Determinism & monotonicity).

---

## State of the dev-metrics pipeline (load-bearing, verified)

| Artefact | Status |
|---|---|
| `scripts/aggregate_token_usage.py` | exists, tracked, well-formed; global dedupe by `message.id` → `requestId` → usage fingerprint (`:130-143`), groups by normalized `cwd` (`:58-81`), `rglob("*.jsonl")` picks up nested subagent transcripts for free (`:84-93`) |
| `.claude/hooks/record-session-tokens.sh` | exists, **UNTRACKED in git** |
| `.claude/.template-manifest.json` | exists, **UNTRACKED in git** (references the hook at `:117`) |
| `.claude/settings.json:71-81` | **tracked**, registers the untracked hook as a `SessionEnd` command → a fresh clone has a `SessionEnd` hook pointing at a nonexistent file |
| `.claude/logs/token-usage.jsonl` | **3 lines only** (2026-07-29 ×2, 2026-07-30 ×1) — the hook is new (`892da9c`); `.gitignore:16` ignores `.claude/logs/`, so it is local-only and holds ~3 of ~28 sessions |
| `docs/metrics/token-usage.json` | **does not exist** — the aggregator's full scan has never been run |
| `docs/metrics/token-ledger.md` | 11 entries, **all `[unmeasured]`, all totals 0** (`:12-16`) |
| `.vscodeignore:5,13,33` | excludes `.claude/**`, `scripts/**`, `docs/**` from the vsix (only `docs/screenshots/**` ships) |

So: the engine exists and is sound; nothing has ever been run with it; and half the plumbing
that is supposed to feed a **public-repo** number is untracked.

---

## Approach

**Compute at dev time, commit the aggregate, bake it in at package time, display a constant.**

```
~/.claude/projects/<slug>/**.jsonl   ─┐
~/.grok/sessions/<enc-cwd>/*/signals ─┤→ scripts/aggregate_token_usage.py (merge, not overwrite)
                                      │        │
                                      │        ├→ docs/metrics/token-usage.json   (committed ledger)
                                      │        └→ src/token-metrics.ts            (generated constant, committed)
                                      │                    │
                                      │            tsc → out/token-metrics.js  (shipped in the vsix)
                                      │                    │
                                      └────────────  src/sidebar.ts reads the constant → launcherMeta
```

### Why a generated constant, not shipping `docs/metrics/` and reading it at runtime

Both routes were considered. The generated constant wins on five independent counts, not just
convenience:

1. **No packaging change.** `.vscodeignore:33` excludes `docs/**`; the runtime-read route needs
   that loosened (plus a `!docs/metrics/**` re-include), which quietly widens what ships from a
   directory that also holds plans, ADRs, the changelog archive and screenshots. A generated
   `src/token-metrics.ts` compiles to `out/token-metrics.js`, which is *already* shipped by the
   existing `!out/**/*.js` rule (`.vscodeignore:21`). Zero packaging surface change.
2. **No runtime failure mode.** A runtime read must answer "what if the file is missing,
   truncated, or malformed in a user's install?" A compiled-in `export const` cannot be any of
   those. The only remaining display branch is the one that already exists (no number → show the
   version alone, `media/webview-helpers.js:1011-1015`).
3. **No runtime I/O on the extension host.** The badge currently costs a directory walk per
   turn (RC-5); the constant costs nothing, ever — a strict improvement on the very cost
   CLAUDE.md § Known limits already frets about at scale.
4. **Type-checked and diffable.** `tsc -p . --noEmit` proves the constant's shape at build time,
   and a reviewer sees the number change in the commit diff — which is precisely what "logged and
   aggregated in a public repo" (Q1) asks for.
5. **Trivially unit-testable** without `vscode` or fixtures: import the module, assert a finite
   non-negative integer and a well-formed `generatedAt`.

The counter-argument for the runtime route — "one artefact instead of two" — is real but weak:
both are written by the same command in the same run and committed together, and the JSON is the
human-readable ledger while the `.ts` is the machine input. Keeping them separate is what lets
the JSON carry the full per-session breakdown (required by the merge in § Determinism) without
shipping any of it.

### Consequence the user has accepted (Q2)

Per-turn/billed accounting means the displayed figure lands in the **tens of millions**, not the
tens of thousands the badge shows today — roughly a **100× jump**. That is expected and correct:
it is what "all tokens spent developing this" costs when each turn's re-sent context is counted
once per turn, exactly as `.claude/logs/token-usage.jsonl` already reports (31.1M for one
session). It is not a calibration bug to be tuned down later, and the `CHANGELOG.md` entry must
say so explicitly or the next reader will "fix" it.

---

## Determinism & monotonicity (the aggregator's own version of RC-1)

Two maintainers, or one maintainer on two machines, must not produce wildly different totals, and
re-running must never double-count. Today `write_report` (`scripts/aggregate_token_usage.py:248-250`)
**blindly overwrites** the output file with a full recompute of whatever transcripts happen to be
on the current machine. That reproduces RC-1's exact failure one layer up: transcripts get pruned,
a second machine has a different subset, and the committed total silently drops.

The committed artefact therefore becomes an **accumulating ledger, merged rather than replaced**:

- **Unit of accounting: the session id.** Bucket every record by the record's own
  `record["sessionId"]` field — *not* by which file it was found in. Verified necessary: the
  workflow subagent transcript `subagents/workflows/wf_8a544813-aa2/agent-abb6b7f66614a19f7.jsonl`
  exists under **three** different parent session directories (`c9cf8123-…`, `b4374679-…`,
  `20283516-…`), and each copy carries its own parent's `sessionId` and its own distinct
  `message.id`s (spot-checked: `msg_011Cd52qKqEL…` vs `msg_011Cd535U5Tj…`). They are three real
  runs sharing a filename, not copies — file-path-based keying would mis-merge them.
- **Global record dedupe stays.** `aggregate_records` holds one `seen` set across the whole scan
  (`:178-214`, fed by `scan_projects` `:217-226`), so a streaming response repeated across
  consecutive JSONL lines counts once. Verified live: `msg_011Cd52qKqELmucfGxuUsuff` appears on
  lines 4 and 5 of the same file.
- **Merge rule: per-session `max(existing, recomputed)`, union of keys.** This gives all four
  properties at once — idempotent (recomputing an unchanged session yields the same number),
  monotonic (a pruned transcript keeps its last recorded total), growing (a continued session's
  total rises and `max` takes it), and mergeable (two machines' session sets union; a git conflict
  is resolvable per key rather than on one opaque total).
- **Headline total = sum over the merged ledger**, recomputed from the map on every write — never
  carried forward independently, so it can never drift from its own breakdown.
- **Stable ordering.** `iter_transcript_files` already yields `sorted(rglob(...))` (`:93`), so
  attribution within a run is deterministic. Residual, currently unobserved risk: if the same
  `message.id` ever appeared under two different `sessionId`s, first-wins attribution could move
  between runs and the per-session `max` would then inflate the total. Document it; revisit only
  if observed.
- **Never write zeros.** A run on a machine with no transcripts (a CI box, a fresh clone) must
  leave the committed ledger untouched and exit non-destructively, not overwrite it with an empty
  report.

### Two buckets, two accountings — stated honestly, not silently mixed

| Bucket | Source | Accounting | Fidelity |
|---|---|---|---|
| `claude_sessions` | `~/.claude/projects/<slug>/**.jsonl` | `input + output + cache_read + cache_creation`, per assistant record, deduped | **exact** billed tokens |
| `grok_sessions` | `~/.grok/sessions/<enc-cwd>/*/signals.json` | `sessionTokenEstimate` (`contextTokensUsed + totalTokensBeforeCompaction`) | **lower bound** — grok persists no per-turn record |

Verified that the grok lower bound is the ceiling of what is recoverable: `events.jsonl` carries
only `first_token` latency markers (no counts), and `chat_history.jsonl` carries no `usage`
object. Each bucket therefore records its own `accounting: "billed-per-turn" | "context-proxy"`
in the JSON, both feed the headline total, and `docs/metrics/README.md` states that the grok
portion under-reports. This is a documented approximation, not a hidden fudge — and strictly
better than excluding grok development entirely.

---

## Regeneration cadence — routine, not heroic

The number is only honest if it is refreshed as development continues. Three tiers:

1. **`npm run metrics:tokens`** (new script → `python scripts/aggregate_token_usage.py --write`)
   — the manual command, runnable any time, idempotent.
2. **Wired into the rebuild contract.** `npm run rebuild` → `scripts/install.ps1` /
   `scripts/install.sh` already run *bump version → package → install → publish*
   (`scripts/rebuild.js:2-5`, CLAUDE.md § Repo conventions). Insert regeneration **after the
   version bump and before `npm run package`**, so the vsix always carries a constant no older
   than the build shipping it. It must be **non-fatal**: no Python, no transcripts, or an
   aggregator error logs a warning and proceeds with the committed constant unchanged — a metrics
   refresh must never be able to block a rebuild or a release.
3. **Release procedure.** CLAUDE.md § Publishing step 1 already mandates a docs-staleness review
   at version-bump time; add `docs/metrics/token-usage.json` + `src/token-metrics.ts` to that
   checklist so every release ships a current figure and the diff is visible in the release commit.

**What the `SessionEnd` hook's role becomes.** `docs/metrics/token-usage.json` is now
authoritative, so `.claude/hooks/record-session-tokens.sh` is demoted to a *local convenience
mirror* — a per-session breadcrumb in a gitignored log, useful for eyeballing one session's cost
without a full scan. It is explicitly **not** an input to the committed ledger (it holds ~3 of ~28
sessions and could never be complete). Keep it, commit it so the tracked `settings.json`
reference resolves, and document the demotion in `docs/metrics/README.md` so nobody later wires
the partial log into the total.

---

## Git tracking & privacy

**Must be committed** (the pipeline behind a public-repo number cannot be half-untracked):

- `.claude/hooks/record-session-tokens.sh` — currently untracked while the **tracked**
  `.claude/settings.json:71-81` registers it; a fresh clone has a broken `SessionEnd` hook today.
- `.claude/.template-manifest.json` — currently untracked; it is the manifest declaring the hook
  (`:117`).
- `docs/metrics/token-usage.json` — the aggregate ledger.
- `src/token-metrics.ts` — the generated constant (committed so a clean clone builds without
  Python).

**Must stay ignored / never committed:**

- `.claude/logs/**` (`.gitignore:16`) — machine-local derived data, and the log lines carry
  session ids.
- Transcripts themselves. `~/.claude/projects/**` and `~/.grok/sessions/**` live outside the repo
  and must stay there; they contain full conversation content, file contents, and paths. **Only
  the aggregate may be committed**, and the aggregate must carry no free text — the JSON holds
  session ids, model names and integers, nothing else. The implementer must verify that no
  prompt/summary/title string can reach the committed file.

---

## Exact UI copy

The visible label stays compact (the launcher header is narrow, and `formatTokenCount`
`media/webview-helpers.js:994-999` already renders the `M` unit correctly). The tooltip carries
the meaning, because the entire risk of this feature is a user reading it as *their* usage.

- **Visible** (`formatLauncherMeta`, unchanged shape): `v2.0.4 · 42.7M tokens`
- **Tooltip** (replaces `media/launcher.js:156-165`'s *"tokens used (project lifetime estimate)"*):

  > `Grokbit v2.0.4 — 42,700,000 tokens spent developing this extension (all maintainers, all sessions, as of 2026-07-30). This is not your usage.`

  The date comes from the generated constant's `generatedAt`; omit the parenthetical if absent.
- **Version-only fallback** (no constant / zero): unchanged — `Extension v2.0.4`
  (`media/launcher.js:161-163`).

---

## Change surface

### New files

| File | Contents |
|---|---|
| `src/token-metrics.ts` | **Generated + committed.** `export const DEV_TOKENS_TOTAL: number`, `DEV_TOKENS_GENERATED_AT: string`, `DEV_TOKENS_SESSIONS: number`, plus a do-not-hand-edit header naming its generator. No logic, no imports — a data module (the `src/session.ts` precedent for "framework-free data, not policy"). |
| `docs/metrics/token-usage.json` | **Generated + committed.** Merged ledger: `{schema, generated_at, total_tokens, buckets: {claude_sessions: {accounting, total, by_session:{…}}, grok_sessions: {…}}}`. |
| `fixtures/token-usage/` | Synthetic transcript tree for verifying the aggregator (see § Test strategy). |
| `test/token-metrics.test.ts` | Guards the generated module's shape. |

### Modified — TypeScript / webview

| File | Change |
|---|---|
| `src/sidebar.ts:910-923` | **Delete `computeLifetimeTokens` entirely**, including the live-pool lift that made the number drop when a Claude tab closed (RC-3). |
| `src/sidebar.ts:248-252` | **Delete `lifetimeTokensCache`** — nothing to cache. |
| `src/sidebar.ts:892-908` | `postLauncherMeta()` loses its `opts?: {refresh?: boolean}` parameter and posts `DEV_TOKENS_TOTAL` + `DEV_TOKENS_GENERATED_AT`. Rewrite the doc comment to state what the number now is and that it is a build-time constant no user activity can move. |
| `src/sidebar.ts:384, :2410, :3479, :3539` | Drop the `{refresh:true}` arguments. `:2410` (inside the `promptComplete` handler) is **removed outright** — a constant needs no per-turn re-post; only the launcher-`ready` post at `:384` remains. This is what deletes the per-turn directory walk (RC-5). |
| `src/sidebar.ts:79-93` | Drop the now-unused `readWorkspaceTokenUsage` / `mergeWorkspaceTokenUsage` imports (`:88`, `:90`); **keep** `readSessionTokenUsage` (still used at `:2589`). |
| `src/sessions.ts:477-539` | `readWorkspaceTokenUsage` + `mergeWorkspaceTokenUsage` have no remaining caller — **delete both**, with their tests, rather than leaving dead exports. **Keep** `sessionTokenEstimate` (`:461-475`): the Python grok bucket mirrors it, and the two must stay documented as a pair. |
| `media/launcher.js:119, :148-166, :519-524` | Keep `state.totalTokens`'s shape; accept and store `generatedAt`; new tooltip copy (§ Exact UI copy). |
| `media/webview-helpers.js:1007-1016` | No change required — `formatLauncherMeta` already yields `v2.0.4 · 42.7M tokens`. Touch only if the visible label is revised. |

### Modified — pipeline / tooling

| File | Change |
|---|---|
| `scripts/aggregate_token_usage.py` | Add the grok bucket; bucket by `record["sessionId"]`; add `merge_ledger(existing, computed)` with per-session `max`; replace the blind `write_report` overwrite (`:248-250`) on the committed path; emit `src/token-metrics.ts`; refuse to write when the scan found nothing; keep the existing `--projects-dir` fixture mode (`:352-356`). `--print`, `--transcript` and `--append-project-log` must keep working — the `SessionEnd` hook calls them (`.claude/hooks/record-session-tokens.sh:41`). |
| `package.json:309-322` | `"metrics:tokens": "python scripts/aggregate_token_usage.py --write"`. |
| `scripts/install.ps1`, `scripts/install.sh` | Non-fatal regeneration step after the version bump, before `npm run package`. |

### Modified — docs

`CLAUDE.md` (module-map row for `src/token-metrics.ts`; a short section defining the three
distinct token surfaces — dev-cost badge vs context donut vs status-bar %; § Known limits entries
for the grok lower-bound bucket, single-machine coverage and release-lag staleness; **and a
correction**: § Repo conventions claims the vsix bundles `CLAUDE.md`/`docs/`, contradicted by
`.vscodeignore:30,33`), `README.md` (document the launcher line — it appears in neither README nor
CHANGELOG today), `CHANGELOG.md` (**must state the ~100× jump**), `docs/metrics/README.md` (the
ledger↔badge relationship, replacing the stale *"It is **not** the activity-bar launcher line"*
framing preserved in the `.bak`; the hook's demotion; the never-commit-transcripts rule),
`TESTS.md` (how the Python side is verified and why it is not in CI).

---

## Test strategy

`npm test` stays **grok-free, claude-free and Python-free**, at the 1285-test floor. Nothing in
the suite spawns a binary or reads a real transcript.

### TypeScript / vitest

1. **`test/token-metrics.test.ts`** — the generated module exports a finite, non-negative, integer
   `DEV_TOKENS_TOTAL`; `DEV_TOKENS_GENERATED_AT` parses as a date; `DEV_TOKENS_SESSIONS` is a
   non-negative integer. This is the guard that a bad generator run cannot ship silently.
2. **`test/launcher.dom.test.ts`** (extends `:392-412`) — a `launcherMeta` message with
   `totalTokens: 42_700_000` renders `v2.0.4 · 42.7M tokens`; the tooltip contains `42,700,000`,
   the words *developing this extension*, and *not your usage*; the existing version-only case
   (`:406-412`) and the `totalTokens: 0` case (`test/webview-helpers.test.ts:546`) still pass
   unchanged.
3. **Regression / deletion** — `test/sessions.test.ts`'s `readWorkspaceTokenUsage` and
   `mergeWorkspaceTokenUsage` blocks (`:591-660`) are removed with their subjects;
   `sessionTokenEstimate`'s tests (`:574-589`) stay. `npx tsc -p . --noEmit` is what proves no
   caller was missed.

### Python aggregator — explicit choice

**It is not in `npm test`, and CI stays Python-free.** CI (`.github/workflows/ci.yml`) runs
`npm ci && npm test && npm run package` on a clean Ubuntu box with no Python guarantee and no
transcripts; adding a Python step would put a maintainer-machine-only tool on the critical path of
every push, for a number that changes only at release time. Instead:

- **Fixture-driven verification, run by hand and as part of the package's verify step.** Commit
  `fixtures/token-usage/` — a synthetic `projects/<slug>/` tree with hand-written records plus a
  synthetic grok `sessions/<enc-cwd>/<id>/signals.json` — and verify with
  `python scripts/aggregate_token_usage.py --projects-dir fixtures/token-usage/projects --print`.
  The `--projects-dir` override exists for exactly this (`:38`, `:352-356`).
- Fixtures must cover the cases that actually bite:
  - **streaming dedupe** — three consecutive records sharing one `message.id` with identical
    `usage` count **once** (verified real: lines 4-5 of a live transcript);
  - **all four usage fields summed**, including both cache fields (omitting them understates by
    orders of magnitude — `research/claude-code-backend.md:249-253`);
  - **nested subagent transcripts** under `<session>/subagents/**` and
    `subagents/workflows/wf_*/**` are included;
  - **same-named subagent file under two parent sessions** attributes to each record's own
    `sessionId`, not the file path (verified real: `agent-abb6b7f66614a19f7.jsonl` under three
    parents, distinct `message.id`s);
  - **merge is monotonic** — re-running against a *reduced* fixture set leaves the committed total
    unchanged; re-running against the same set is idempotent (byte-identical output but for
    `generated_at`);
  - **empty scan writes nothing** — a run against an empty `--projects-dir` leaves an existing
    ledger untouched and exits non-destructively;
  - malformed / blank / truncated lines and non-`assistant` records are skipped without raising
    (already the behaviour at `:96-127`; pin it).
- `TESTS.md` gains a short section recording that this is manually-run tooling with a fixture
  suite, and why it is not in CI.

### Verify

```powershell
npx vitest run test/token-metrics.test.ts test/launcher.dom.test.ts test/webview-helpers.test.ts test/sessions.test.ts
npm test
npx tsc -p . --noEmit
python scripts/aggregate_token_usage.py --projects-dir fixtures/token-usage/projects --print
python scripts/aggregate_token_usage.py --print   # real scan, read-only sanity check
```

`npm run test:live` is not required (no ACP surface changes) but remains mandatory before any
release that ships this.

---

## Risks & residual open items

- **The figure is only as complete as the machines that have run the aggregator.** Today that is
  one maintainer's laptop, and Claude Code prunes transcripts over time. The per-session `max`
  merge preserves what has been seen; it cannot recover what was pruned before the first run.
  **Mitigation: run the backfill now, as part of this work (Q3), before more history ages out.**
- **The grok bucket under-reports** (context proxy, not billed tokens) and cannot be improved —
  grok persists no per-turn record on disk (verified). Documented in the JSON and in
  `docs/metrics/README.md`.
- **~100× jump in the displayed number.** Expected (Q2), not a bug. Must be in `CHANGELOG.md`.
- **Untracked pipeline files** — see § Git tracking & privacy. A fresh clone currently has a
  `SessionEnd` hook pointing at a file that does not exist.
- **Privacy** — transcripts must never be committed; the aggregate must contain no free text. The
  implementer must eyeball the generated JSON before committing it.
- **Staleness between releases.** The badge shows the cost *as of the last regeneration*, so it
  lags live development by up to one release. The tooltip's `as of <date>` is the honest
  disclosure; do not try to close this gap at runtime — that is the design that was rejected.
- **A stale constant survives a failed regeneration silently** (by design — regeneration is
  non-fatal). Accepted: the alternative is a metrics script that can block a release.
- **Attribution edge case** — a `message.id` appearing under two `sessionId`s could inflate the
  total across runs via the per-session `max`. Not observed; documented; revisit if seen.

### ADR — recommended, for the *contract* rather than the mechanism

The earlier ADR rationale (an irrecomputable `globalState` key) is **gone** — the ledger is a
committed file, fully recomputable, and every mechanism decision here is reversible in one commit.
What still earns an ADR is the **contract**, because it is the thing future contributors will
misread: *what this number means, what it deliberately excludes (all end-user activity), which
buckets use which accounting, how and when it is regenerated, and why it is baked in rather than
computed.* Without that written down, the single most likely future change is someone "fixing"
the badge back into a live per-user meter — the exact bug being removed here.

**Recommend `docs/adr/0003-development-token-ledger.md` via the `adr` skill**, following the
`0001`/`0002` house style.

---

## Work packages

**One package, one implementer, end to end.**

Splitting the Python pipeline from the TypeScript display was considered and rejected: the
boundary between them is a *single generated file* (`src/token-metrics.ts`) whose exact shape one
side emits and the other imports. A split would force the second agent to re-read the whole
aggregator to learn that shape, and would leave an unshippable intermediate state (a constant with
no generator, or a generator with no consumer). The TypeScript side is also mostly **deletion** —
`computeLifetimeTokens`, `lifetimeTokensCache`, the live-pool lift, two `sessions.ts` exports and
their tests — so the combined package is one coherent batch, not two stacked ones.

---

### WP1 — Development-token ledger: aggregator, backfill, generated constant, and runtime removal

**Aggregator (`scripts/aggregate_token_usage.py`)**

- [x] Bucket every record by the record's own `record["sessionId"]` (never the file path); keep the
      existing global `message.id` → `requestId` → fingerprint dedupe (`:130-143`) and the
      `cwd`-field grouping (`:58-81`) — both are already correct and are what make case-variant
      project directories and duplicated subagent files safe.
- [x] Add the **grok bucket**: scan `~/.grok/sessions/<encodeURIComponent(cwd)>/*/signals.json`,
      valuing each session as `contextTokensUsed + totalTokensBeforeCompaction` (mirror of
      `sessionTokenEstimate`, `src/sessions.ts:461-475`). Tag it `accounting: "context-proxy"`;
      tag the Claude bucket `accounting: "billed-per-turn"`.
- [x] Add `merge_ledger(existing, computed)` — union of session ids, per-session
      `max(existing, computed)`, headline total recomputed from the merged map. Replace the blind
      overwrite on the committed path (`write_report`, `:248-250`). `--print`, `--transcript` and
      `--append-project-log` must keep working unchanged (the `SessionEnd` hook calls them,
      `.claude/hooks/record-session-tokens.sh:41`).
- [x] Refuse to write when the scan found no records — leave the committed ledger untouched and
      exit non-destructively (never write zeros over real history).
- [x] Emit `src/token-metrics.ts` alongside the JSON: `DEV_TOKENS_TOTAL`,
      `DEV_TOKENS_GENERATED_AT`, `DEV_TOKENS_SESSIONS`, plus a do-not-hand-edit header naming the
      generator. Verify the emitted JSON and `.ts` carry **no free text** (ids, model names and
      integers only) before committing either.

**Backfill + wiring**

- [x] Run the full backfill on this machine; commit `docs/metrics/token-usage.json` and
      `src/token-metrics.ts`.
- [x] `git add .claude/hooks/record-session-tokens.sh .claude/.template-manifest.json` (the tracked
      `.claude/settings.json:71-81` already references the hook). Leave `.claude/logs/**` ignored
      (`.gitignore:16`).
- [x] `package.json:309-322`: add `"metrics:tokens"`.
- [x] `scripts/install.ps1` + `scripts/install.sh`: non-fatal regeneration after the version bump,
      before `npm run package`. Missing Python, missing transcripts, or an aggregator error logs a
      warning and continues — it must never block a rebuild or release.

**Extension (mostly deletion)**

- [x] Delete `computeLifetimeTokens` (`src/sidebar.ts:910-923`) **including the live-pool lift**,
      and `lifetimeTokensCache` (`:248-252`).
- [x] `postLauncherMeta` (`:892-908`): drop the `refresh` option, post `DEV_TOKENS_TOTAL` +
      `DEV_TOKENS_GENERATED_AT`, rewrite the doc comment to say it is a build-time constant that
      no user activity can move.
- [x] Drop the `{refresh:true}` call-site arguments (`:384, :3479, :3539`) and **remove the
      `promptComplete` call entirely** (`:2410`) — this is what deletes the per-turn directory walk.
- [x] Remove the unused `readWorkspaceTokenUsage` / `mergeWorkspaceTokenUsage` imports
      (`src/sidebar.ts:88,90`), then delete both functions from `src/sessions.ts:477-539` and their
      tests (`test/sessions.test.ts:591-660`). Keep `sessionTokenEstimate` and
      `readSessionTokenUsage` (both still used). `npx tsc -p . --noEmit` proves no caller is left.
- [x] `media/launcher.js`: accept `generatedAt`; apply the § Exact UI copy tooltip; keep the
      version-only fallback (`:161-163`) intact.

**Tests**

- [x] `test/token-metrics.test.ts` (generated-module shape).
- [x] `test/launcher.dom.test.ts`: large-number render + new tooltip assertions; existing
      version-only and zero cases still green.
- [x] `fixtures/token-usage/`: synthetic Claude project tree + grok `signals.json`, covering
      streaming dedupe, all four usage fields, nested + workflow subagent transcripts, same-named
      subagent files under two parents, monotonic merge, idempotent re-run, empty-scan no-write,
      and malformed lines.

**Docs**

- [x] `CLAUDE.md` (module-map row; a section distinguishing the three token surfaces; § Known
      limits entries for the grok lower bound, single-machine coverage and release-lag staleness;
      correct the `.vscodeignore` claim in § Repo conventions).
- [x] `README.md` — document the launcher line for the first time.
- [x] `CHANGELOG.md` — terse entry that **explicitly states the ~100× jump** and that the number is
      Grokbit's development cost, not the user's usage.
- [x] `docs/metrics/README.md` — ledger↔badge relationship (replacing the stale *"It is **not** the
      activity-bar launcher line"* framing), the `SessionEnd` hook's demotion to a local mirror,
      and the never-commit-transcripts rule.
- [x] `TESTS.md` — how the Python aggregator is verified and why it is not in CI.
- [x] CLAUDE.md § Publishing step 1 — add the two generated artefacts to the release doc-review
      checklist.
- [x] Recommend `docs/adr/0003-development-token-ledger.md` via the `adr` skill (contract, not
      mechanism — see § ADR).

**Verify**

```powershell
npx vitest run test/token-metrics.test.ts test/launcher.dom.test.ts test/webview-helpers.test.ts test/sessions.test.ts; npm test; npx tsc -p . --noEmit; python scripts/verify_token_aggregator.py
```

---

### WP1 — implementation notes (what reality changed)

**Backfill result: `1,044,022,556` tokens across `93` sessions** (33 Claude = 1,039,182,404
billed-per-turn; 60 grok = 4,840,152 context-proxy). The plan predicted "tens of millions"
and a "~100× jump"; the real figure is ~1.0 **billion**, a ~215× jump over the old badge's
~4.8M. The magnitude was verified against the one independent source that already does
per-turn accounting — `.claude/logs/token-usage.jsonl` — and reconciles exactly: a session
with no subagent transcripts matches the hook's line to the token (295,416), while a session
with 10 subagent transcripts reads 31.1M in the hook log (top-level thread only) and 424.5M
in the ledger (thread + every subagent it spawned). `CHANGELOG.md` states the real ~200×
figure, not the plan's estimate.

**Deviations, and why:**

1. **`--print` alone cannot verify the fixture cases the plan lists.** Merge monotonicity,
   idempotency, empty-scan-no-write and per-`sessionId` attribution are invisible in a
   per-project table. Added `scripts/verify_token_aggregator.py` — 13 stdlib assertions over
   `fixtures/token-usage/`, writing only to a temp dir. Still manual, still out of `npm
   test`/CI. The plan's literal `--projects-dir … --print` command also needed
   `--grok-sessions-dir` and `--project` to say anything about the ledger (the fixture cwd is
   synthetic, and the grok bucket is keyed by `encodeURIComponent(cwd)`); the working
   invocation is recorded in `fixtures/token-usage/README.md`.
2. **Ledger scope is the project root *and its subdirectories*, not an exact `cwd` match.**
   Real sessions run from e.g. `<repo>/research/work-resume` get their own Claude project
   slug and their own `cwd`; they are development of this repo. Exact matching would silently
   drop them. `is_within_project` does a path-boundary check (case-insensitive only for
   Windows-style paths), so the sibling directory `…\Grokbit.ai-other` is still excluded.
3. **`postLauncherMeta` call sites at `:3479`/`:3539` were removed, not just de-argumented.**
   The WP1 checklist said to drop the `{refresh:true}` argument there; § Change surface said
   "only the launcher-`ready` post at `:384` remains". Followed the latter: after a delete the
   constant cannot have changed, so re-posting it is dead work *and* implies to a future
   reader that the badge tracks deletions — the exact misreading this change removes.
4. **Ledger field is `total_tokens`, not the plan's shorthand `total`** — consistent with
   every other total in the aggregator and in its existing per-project report shape.
5. **The tooltip builder is a pure helper (`formatLauncherMetaTooltip` in
   `media/webview-helpers.js`), not inline in `launcher.js`** — matching its sibling
   `formatLauncherMeta` and the file's stated "pure so unit tests pin the format without the
   webview" idiom.
6. **`scripts/aggregate_token_usage.py` was itself untracked**, contrary to the plan's
   pipeline table (which listed it as tracked). It joins the list of files needing `git add`.
   `.claude/settings.json` registering a hook that a fresh clone does not have is therefore
   the *smaller* half of that problem — the aggregator the hook invokes is missing too.
7. **`README.md:105` still says the launcher shows "recent sessions (up to 7)"**, which the
   30-day paged window replaced. Out of scope here, left untouched, flagged for the next
   docs-staleness pass.
