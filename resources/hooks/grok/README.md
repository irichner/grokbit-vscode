# Grok hooks — runtime enforcement

This directory is GrokForge's answer to the residual risk recorded at the end
of `docs/plans/template-accuracy-review-remediation.md` ("Soft enforcement
remains: Grok path has no Stop-hook equivalent") and worked through in
`docs/plans/grok-harness-improvements.md` (WP1). It gives Grok sessions a
real, non-model-controlled gate: a `Stop` hook that runs the project's real
Lint + Unit tests commands and blocks completion when they fail.

**Hooks are a backstop, never a substitute** for running `/plan` → `/implement`
and the accuracy protocol. A green Stop gate proves Lint + Unit tests passed —
nothing about plan quality, coverage, test accuracy, review, or UI
verification. See `AGENTS.md` → "Runtime enforcement (hooks)".

---

## What fires when

| Event | Script | Effect |
|-------|--------|--------|
| `SessionStart` | `session_start.py` | Resets this session's change-marker + Stop-gate retry counter. Also prints a short git snapshot — **for human/`/hooks` visibility only**; see "Confirmed limitations" below, it is *not* injected into the model's context. |
| `PostToolUse` (matcher `write\|search_replace`) | `mark_changed.py` | Records that this session touched a file, so the Stop gate only runs when something actually changed. |
| `PreToolUse` (matcher `write\|search_replace`) | `protect_paths.py` | Denies writes to `.env*`, `*.pem`, `*.key`, `secrets/`, `.git/`, `.ssh/`, `id_rsa`, `.grok/hooks/`, `AGENTS.md`, and a bare project-root settings.json (a legacy pattern kept as a harmless extra guard; see below — it is not a real hook source on this CLI). Matching is normalized (`./`, `//` collapsed) and case-insensitive — see "Path-matching hardening" below. |
| `Stop` | `verify_on_stop.py` | Runs the **Lint** + **Unit tests** commands from `AGENTS.md` Project Test Commands (OQ2 scope — not Coverage/diff-cover/Regression) when this session changed a file. Blocks with the failing command + an output tail on red; releases after 3 blocked attempts with an explicit "not done" message. If files changed but zero real commands were found (TODO/NONE rows, or the markers are missing), it still allows the stop but emits a stderr note — never a silent allow. |
| `SessionEnd` | `record_session_tokens.py` | Best-effort: writes `docs/metrics/pending-commit.env` (`MODEL`/`INPUT`/`OUTPUT`/`NOTE`) from this session's real token usage, so `scripts/prepare_commit_metrics.py --from-env` records a **measured** ledger row instead of the honest-unmeasured fallback. Never invents numbers; never overwrites an existing pending file. |

Every hook has a pure decision function importable without the CLI (see
`tests/test_grok_hooks.py`); the `if __name__ == "__main__":` block in each
script is only a thin stdin/exit-code shell around it.

---

## How this was verified (do not trust this file blindly — reproduce it)

Per `docs/plans/grok-harness-improvements.md` §9 WP1, verifying the hook
contract against the *installed* CLI was step 1, before any wiring was
written. `grok 0.2.112 (9bbd559437) [stable]` was used. Two independent
sources were used and cross-checked:

1. **The CLI's own bundled docs** — `~/.grok/docs/user-guide/10-hooks.md`
   (also mirrored into `~/.grok/README.md`). This is the authoritative
   reference for event names, the JSON hook-file shape, the stdin/stdout
   envelope, and exit-code semantics.
2. **Live probes against this exact repo** — a temporary `.grok/hooks/*.json`
   wired to a script that dumped its real stdin + environment to a file, run
   via `grok -p "..." --yolo --output-format json`, for `SessionStart`,
   `PreToolUse`, `PostToolUse`, `Stop`, and (attempted) `SessionEnd`; plus a
   live seeded-red-test-suite run and a live protected-path edit attempt
   against the *shipped* hooks. No probe artifacts were committed.

### Confirmed facts (both sources agree, or a live probe directly proved it)

- **Discovery path:** `.grok/hooks/*.json` (any filename ending in `.json`
  directly under `.grok/hooks/`), merged with `~/.grok/hooks/*.json` (global,
  always trusted) and `.claude/settings.json` (Claude-compat layer, also
  requires trust). **A bare project-root settings.json (not inside the
  hooks directory) is *not* a hook source** — a probe file placed there was
  silently ignored by
  `grok inspect --json` while an identical `.grok/hooks/*.json` file was
  picked up immediately. This directly contradicts the plan's original
  assumption of a single top-level settings file; the real wiring file lives
  at `.grok/hooks/settings.json` instead (inside the hooks directory itself).
- **JSON shape:** `{"hooks": {"<PascalCaseEvent>": [{"matcher": "...", "hooks": [{"type": "command", "command": "...", "timeout": N}]}]}}`.
  Unknown top-level keys (like this file's `_comment`) are ignored, so a
  shared Claude/Cursor file — or a documentation note — can live alongside
  the real `hooks` key.
- **Event names:** config keys are PascalCase (`SessionStart`, `PreToolUse`,
  `PostToolUse`, `Stop`, `SubagentStop`, `SessionEnd`, ...); `grok inspect
  --json` and the `GROK_HOOK_EVENT` env var report them back in snake_case
  (`session_start`, `pre_tool_use`, ...).
- **stdin envelope (camelCase, confirmed by live capture):** every event
  carries `hookEventName`, `sessionId`, `cwd`, `workspaceRoot`, `timestamp`,
  `permissionMode`. `PreToolUse`/`PostToolUse` add `toolName`, `toolInput`,
  `toolUseId`, `toolInputTruncated`, `transcriptPath`. `Stop` adds `reason`
  (`"end_turn"` for a genuine turn end — filter on this, since a second,
  observe-only `Stop` also fires at session end/interrupt with a different
  reason), `stopHookActive`, `lastAssistantMessage`, `backgroundTasks`,
  `sessionCrons`, `promptId`.
- **Real tool names for file writes (confirmed by live capture, not just the
  docs):** creating a new file goes through a tool named **`write`**;
  modifying an existing file with a find/replace edit goes through
  **`search_replace`**. Both carry the target path at `toolInput.file_path`
  (same key name Claude uses). The CLI's own Claude-compat alias table maps
  `Edit`/`Write`/`MultiEdit` matchers onto `search_replace`, but does not
  mention the separate `write` tool, so this template's hooks match on the
  real names directly: `"matcher": "write|search_replace"`.
- **Exit-code / stdout contract:**
  - `PreToolUse`: print `{"decision": "deny", "reason": "..."}` to stdout to
    block (honored regardless of exit code); `protect_paths.py` also exits 2
    and repeats the reason on stderr as a fallback.
  - `Stop`/`SubagentStop`: a valid `{"decision": "block", ...}` (or
    `{"continue": false, ...}`) JSON object on stdout wins over the exit
    code; exit 2 with the reason on **stderr** is the fallback path used only
    when stdout has no usable JSON. Allowing the stop is exit 0 with no
    output, or any *non*-JSON output (`verify_on_stop.py` uses this for the
    plain-text "gate released" message after 3 blocked attempts).
  - Any other exit code / a crashing hook / a timeout is **fail-open**: the
    failure is recorded for the UI, nothing is blocked. `run_safely()` in
    `_common.py` guarantees this for an unexpected exception inside a hook.
- **`/hooks-trust` requirement:** project hooks are silently skipped until the
  project is trusted (`/hooks-trust`, or `grok --trust` at the process level).
  Global hooks (`~/.grok/hooks/`) are always trusted. Trust is recorded in
  `~/.grok/trusted_folders.toml` and also gates repo-local MCP/LSP servers.
- **Env vars available to every hook process:** `GROK_HOOK_EVENT`,
  `GROK_HOOK_NAME`, `GROK_SESSION_ID`, `GROK_WORKSPACE_ROOT`, and
  `CLAUDE_PROJECT_DIR` (a Claude-compat alias for `GROK_WORKSPACE_ROOT`, set
  for every hook, not just Claude-sourced ones). All five were captured
  correctly in the live probe.

### A real, load-bearing finding: `${VAR}` expansion in `command` does not fire in this CLI build

The docs state "Both `command` and `url` support `${VAR}` and `$VAR`
expansion." A live probe wired five otherwise-identical `SessionStart`
handlers side by side — `${GROK_WORKSPACE_ROOT}`, `$GROK_WORKSPACE_ROOT`,
`${CLAUDE_PROJECT_DIR}`, `$CLAUDE_PROJECT_DIR`, and `%GROK_WORKSPACE_ROOT%` —
against a script that logs every invocation it actually receives. **None of
them fired.** Only two forms reliably fired:

1. An absolute, literal path (`python "C:/full/path/.grok/hooks/x.py"`).
2. A path **relative to the hook process's own working directory**, which a
   separate probe confirmed **is the workspace root** on this CLI
   (`python ".grok/hooks/x.py"` — fired; a bare relative path with no `python`
   prefix did not, so this is not general shebang execution, just plain
   relative-path resolution against cwd for the argument list).

Shipping the originally-planned `${GROK_WORKSPACE_ROOT}/...` commands would
have been exactly the "fake enforcement" the plan's §7 risk table warns
against — the hooks would have been listed by `grok inspect` and looked
wired, but every invocation would have silently failed to launch (fail-open,
so nothing would ever have blocked anything). `.grok/hooks/settings.json`
in this repo therefore uses plain workspace-root-relative commands
(`python ".grok/hooks/session_start.py"`, etc.) instead. This is the
strongest reason to *reproduce* this file's finding on your own CLI build
rather than trust it indefinitely: expansion behavior is exactly the kind of
thing a future release could change.

### Confirmed limitation: `SessionStart` cannot inject context

The docs state under "Passive Hooks": *"For events like `SessionStart` or
`PostToolUse`, stdout is ignored. Just exit 0 on success."* Only `Stop` /
`SubagentStop` have a documented feedback channel
(`hookSpecificOutput.additionalContext`). So, unlike Claude Code's
`SessionStart` hook (whose stdout *is* injected into context), this
template's `session_start.py` snapshot is cosmetic — visible via `/hooks`
scrollback annotations and manual debugging only. Its only functional effect
is resetting the change-marker and retry counter for the new/resumed
session. Do not rely on it to orient the model; that remains `AGENTS.md`'s
job.

### `SessionEnd` / token capture — the one piece not fully confirmed

A one-shot headless `grok -p ... --yolo` session in this environment fired
`SessionStart`, `PreToolUse`, `PostToolUse`, and `Stop` but **never fired
`SessionEnd`** — it appears to require an interactive session's real
teardown, which this sandboxed verification pass could not script. So the
exact `SessionEnd` stdin payload (beyond the documented common fields) is
unconfirmed. What *is* confirmed by directly inspecting a real session's own
on-disk files (`~/.grok/sessions/<url-quote(cwd)>/<sessionId>/updates.jsonl`,
`signals.json`, `summary.json`): the transcript file's `turn_completed`
update records carry a real `usage.modelUsage` breakdown
(`inputTokens`/`outputTokens` per model id) — the same underlying numbers
surfaced in the headless `--output-format json` result (`usage.input_tokens`
/ `modelUsage`), just under different key casing.

`record_session_tokens.py` is therefore written to be robust to either case:
prefer an explicit `transcriptPath` field if `SessionEnd`'s payload supplies
one (other events do), otherwise recompute the same path from `sessionId` +
`cwd`/`workspaceRoot` using the confirmed on-disk layout
(`urllib.parse.quote(cwd, safe="")`). If neither yields a readable transcript
with a usable `turn_completed` usage block, it writes **nothing** — no
invented numbers, ever — leaving the existing honest-unmeasured fallback in
`scripts/githooks/pre-commit` / `prepare_commit_metrics.py` as-is.

---

## Post-review hardening (closed findings)

A code review of this package found several real gaps between the design
intent and the actual implementation. Fixed:

- **`verify_on_stop.py` executed `TODO`/`NONE` placeholders as shell
  commands.** The old check only skipped a row with *no backticks at all* —
  but the installer's `--no-scan` path emits the row verbatim, backticks
  included: `` `TODO — user must fill` ``. That parsed as a non-empty
  "command" and reached the shell runner, permanently red. Fixed: the
  *extracted* command (after stripping backticks) is now checked, and is
  skipped when empty or when it starts with `TODO`/`NONE` (case-insensitive).
  A row can also legitimately hold more than one backtick-quoted command (a
  monorepo Lint row joins them with `·`); every real command in the row now
  runs — not just the first — instead of silently ignoring the rest.
- **`protect_paths.py` had trivial bypasses on this repo's primary platform.**
  Matching was raw and case-sensitive, so a differently-cased hooks path, a
  dot-segment (`./`), or a doubled slash (`//`) inserted into an otherwise
  protected path all slipped past patterns meant to block `.grok/hooks/`/
  `.env`. Fixed: paths are normalized
  (`posixpath.normpath` after `\`→`/`, collapsing `./`/`//`/`..`) and every
  pattern carries `re.IGNORECASE` — Windows filesystems are case-insensitive,
  so a case-sensitive match was never meaningful protection there; the
  correct failure direction is to over-block on a case-sensitive filesystem,
  not to under-block on this repo's actual primary platform.
- **The gate was one edit away from silently gone.** `AGENTS.md` was not a
  protected path, so an agent could delete the `PROJECT_TEST_COMMANDS`
  markers or flip a row to `NONE` and the Stop gate would then find zero
  commands to run — an unconditional, silent allow with no trace anywhere.
  Fixed two ways: (a) `AGENTS.md` is now a protected path in
  `protect_paths.py` — **this means AGENTS.md becomes human-edit-only once
  hooks are enabled**, a deliberate, disclosed tradeoff (the file is the
  Stop gate's own command source, so it is part of "the enforcement layer"
  in the same sense `.grok/hooks/` is); (b) `verify_on_stop.py` no longer
  silently allows when files changed but zero gate commands were found — it
  still allows (a fresh, unfilled install is legitimate and must not block),
  but always emits a stderr note so a neutered gate is never silent.
- **Per-command timeout could outlast the wired Stop timeout.** The wired
  `Stop` timeout is 600s, but the old per-command subprocess timeout was a
  flat 560s — with 2 sequential commands (Lint + Unit tests) the worst case
  was ~1120s, so the CLI's own external kill could fire first, and a
  timeout is fail-open (silently allows). Fixed: the run budget (550s, a
  hair under the wired 600s) is now split across however many commands
  actually run (`550 / N`), so the *sum* of per-command timeouts stays under
  the wired ceiling regardless of how many commands a row holds.
- **`record_session_tokens.py` could raise on a non-numeric usage field.**
  Since the exact `SessionEnd`/transcript payload shape is inferred, not
  confirmed (see above), `int(stats.get("inputTokens") or 0)` would raise on
  a string or list value and `main()` would propagate it (only the outer
  `run_safely()` shell would have caught it). Fixed: wrapped in a
  `_safe_int()` helper that treats anything non-numeric as `0` instead of
  raising.
- **A crafted `sessionId` could inject a line into `pending-commit.env`.**
  `prepare_commit_metrics.py` parses that file line by line (last key wins),
  so a `sessionId` containing a newline followed by `MODEL=...` could in
  principle smuggle in a fake row. Realistically unreachable (the ID comes
  from the CLI, not attacker-controlled input), but cheap to close: `MODEL`
  and `NOTE` values are now run through `_sanitize_env_value()` (collapses
  CR/LF to spaces) before being written.

**Known limitation, accepted as-is (no code change):** per-session state
files under `%TEMP%/grokforge-hooks/` (or `GROK_HOOKS_STATE_DIR`) are never
garbage-collected. A session that ends while the gate is mid-block (rather
than going through a clean `SessionStart`/green `Stop`) leaves its
`blocks-<session>.count` / `changed-<session>.marker` files behind
indefinitely. This is harmless (each file is a few bytes, keyed by a UUID
session id that is never reused) but will accumulate over very many sessions
on a machine that's never had its temp directory cleared. Not worth building
a cleanup mechanism for a template harness; `session_start.py` already resets
*this session's* files on every fresh start/resume, which is the case that
actually matters.

---

## Enabling hooks

Hooks are **opt-in per workspace**, and installing them is the opt-in: the
Grokbit extension writes this whole directory — scripts, `settings.json` and
this README — only when you run **Grokbit: Install workspace harness hooks**
or set `grok.hooks.provision: workspace`. It never touches a workspace you
haven't asked it to.

Two steps remain after the copy:

1. **Python.** Every command in `settings.json` is `python "<script>.py"`. The
   installer probes for `python`, then `python3`, and rewrites the wiring to
   whichever it found; if it found neither it says so, and nothing will fire
   until one is on PATH.
2. **Trust.** Run `/hooks-trust` inside a Grok Build session in this repo (or
   launch with `--trust`). Confirm with `/hooks` (Hooks tab) or
   `grok inspect --json` (look for `"source": {"path": ".../.grok/hooks"}`
   entries with no `"vendor"` key). Untrusted project hooks never run.

*(Upstream, in the GrokForge template this tree is vendored from, the same
opt-in is expressed by shipping a `settings.json.example` that the operator
renames, or by `install_agentic_team.py --with-hooks`. The extension performs
that step for you, so no `.example` file is installed here.)*

## Disabling hooks

Delete or rename `.grok/hooks/settings.json` (the scripts alone do nothing —
`.grok/hooks/*.py` are never auto-executed; only a `.json` file in that
directory wires them to an event). `/hooks` → select the source → `x` also
removes it for the current session without touching the file.

## How to prove a hook actually fired

1. `grok inspect --json` (or `/hooks` in the TUI) — confirm each event is
   listed with `"source": {"type": "project", "path": ".../.grok/hooks"}`
   and no `"vendor"` key (that key marks hooks discovered from
   `.claude/settings.json` instead).
2. Deliberately break `Lint` or `Unit tests` (e.g. seed a failing test),
   make any edit, and try to finish the turn — the transcript / scrollback
   should show a blocked stop citing the failing command and an output tail.
   Fix the seed and confirm the next stop is clean.
3. Attempt to edit `.grok/hooks/settings.json` or a `.env` file — the edit
   should be denied with a `protect_paths.py` reason.
4. Inspect the per-session state files under
   `%TEMP%/grokforge-hooks/` (`$TMPDIR` on POSIX, or the directory named by
   `GROK_HOOKS_STATE_DIR` if set): `changed-<session>.marker` appears after
   an edit and disappears once the gate passes; `blocks-<session>.count`
   appears only while the gate is actively blocking.

## Configuration knobs

| Env var | Effect |
|---------|--------|
| `GROK_HOOKS_STATE_DIR` | Overrides the per-session state directory (default: `<tempdir>/grokforge-hooks`). Mainly for tests. |
| `GROK_HOOKS_MAX_BLOCKS` | Overrides the Stop gate's bounded-retry count (default: `3`). |
| `GROK_HOME` | Used by `record_session_tokens.py` to locate `sessions/` when `SessionEnd` doesn't supply a `transcriptPath` (default: `~/.grok`). |

## Design notes

- **Python, stdlib only** — matches the rest of this repo's `scripts/`
  (installer, metrics) and avoids the portability problems of the bash
  reference implementation (`.claude/hooks/*.sh`) on this repo's primary
  platform, Windows.
- **Every hook keeps its real logic in pure functions** — `tests/test_grok_hooks.py`
  exercises them directly with synthetic stdin JSON, no CLI required.
- **Fail-open everywhere** — malformed/empty stdin, a missing `sessionId`, an
  unreadable file, or an unhandled exception in a hook's shell all resolve to
  "allow" / "do nothing", never to a wedged session.
- **`TODO`/`NONE` rows in Project Test Commands are never executed** —
  `verify_on_stop.py` extracts every backtick-quoted command from a row and
  skips any that is empty or starts with `TODO`/`NONE` (case-insensitive), so
  a placeholder value like `` `TODO — user must fill` `` — which the
  installer's `--no-scan` path emits verbatim, backticks included — is never
  mistaken for a real command.
- **Path matching is normalization-first and case-insensitive** —
  `protect_paths.py` collapses `./`/`//`/`..` and folds case before matching,
  since this repo's primary platform (Windows) has a case-insensitive
  filesystem where a case-sensitive check is not real protection.
