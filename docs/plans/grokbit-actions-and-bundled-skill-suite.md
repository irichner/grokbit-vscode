# Grokbit Actions + the bundled skill suite

**Status:** implemented 2026-07-30 (WP1–WP7; WP8 deferred as scoped)
**Date:** 2026-07-30

**Two refinements made during implementation**, recorded here rather than smoothed over:

1. **D3 gained a second condition.** Re-keying a discovered item to `kind: "grokbit"` requires name membership **and** that the item's path sits inside a directory this extension actually wrote. Name alone would let any repository ship `.grok/skills/grokbit-plan/SKILL.md` and have it promoted into the group the UI presents as Grokbit's own — and because workspace items win `dedupeByPriority`, that impostor would be the *only* row rendered. A deliberate workspace fork now stays in Skills: discovered and invocable, simply not badged as ours.
2. **D2's staleness check is an inequality, not "bundled is newer."** A version *downgrade* must re-copy too, because the correct suite for an installed extension is the one that shipped with it; treating a downgrade as up-to-date would pair a newer suite with older extension code.
**Supersedes in part:** docs/plans/capability-surfacing-and-history-ux.md § WP2 (the two-mount capability browser stays; its *content policy* changes), docs/plans/actions-panel-featured-capabilities.md (its featured-list data is re-keyed)

---

## 1. Why

Three problems, one plan.

**The Actions menu has no identity of its own.** It renders whatever the selected backend's CLI happens to have on disk, so a Grok tab and a Claude tab show two different menus, and a fresh vibe-coder repo shows almost nothing at all. The panel's own honest empty state — *"No skills installed yet"* — is the common case for the audience this product targets. A menu whose content depends on which agent you picked cannot be taught, screenshotted, or supported.

**The skill suite that would fix that isn't installed, isn't shipped, and isn't discoverable.** `grokbit-skills/` sits untracked at the repo root (0 files in git) behind a bash-only `install.sh` a vibe coder will never run. Meanwhile `.grok/skills/` holds an older agentic-team suite whose skills are literally named `plan` and `implement` — so anyone who *did* run the installer would get two competing plan/implement pairs with no disposition. That is the "silent COEXIST" the suite's own README names as the largest cause of decay in a mature codebase.

**The suite itself is not yet true.** Two independent deep reviews (§ 7) found the documentation skill's two Python scripts to be substantially broken — the drift checker flags every document stale the moment it is generated, and the doc verifier executes unlabeled code fences as shell — plus three pipeline holes an agent will reliably fall into, and a systematic Windows blind spot on a product whose primary platform is native Windows. Shipping the suite inside the extension raises the stakes: a bundled skill is an implicit endorsement, and the maintainer can no longer say "the user installed that themselves."

The through-line: **Grokbit should ship one opinionated workflow, present it identically everywhere, and be able to defend every line of it.**

---

## 2. Decisions

### D1 — "Grokbit Actions" is one menu with a stable core and an honest tail

The menu is renamed and re-anchored: its first group is **Grokbit workflow**, containing the bundled suite, identical on both backends by construction. Everything discovered on disk (the user's own skills, agents, and the CLI's own `/new` · `/compact` · `/resume` plumbing) stays, below it, in the existing groups with the existing featured/expand behavior.

Final group order in the popover: **Session controls → Grokbit workflow → Skills → Agents → Commands.** The welcome-canvas panel is the same minus Session controls (per the existing mount policy in docs/plans/actions-panel-layout-and-dynamic-capabilities.md § WP2).

**Rejected: drop discovery entirely** so the menu is byte-identical across backends. It would make the "one menu" claim literally true, but it hides capabilities the CLI can genuinely run — a lie of omission — and deletes a shipped, tested feature for the power-user case. What the user asked for is one *menu with one identity*, and that is satisfied: what you see by default is the Grokbit suite, the same on Grok and on Claude. The tail varies because the underlying CLIs genuinely differ, and pretending otherwise would be the dishonest option.

**Consequence worth naming:** with the suite always present, the panel's empty state becomes nearly unreachable. Keep the empty-state code and its test — it is still the correct render when provisioning is off or has failed (D3).

### D2 — The suite ships in the vsix and is provisioned to the home tier

`resources/skills/<skill>/…` in the repo (flattening today's double-nested `grokbit-skills/grokbit-skills/`). `.vscodeignore` is an exclude list and does not mention `resources/`, so the suite ships automatically — no `.vscodeignore` change, and `resources/` already ships the extension icons, so the mechanism is proven.

On activation the extension copies the suite into **`~/.grok/skills/`** and **`~/.claude/skills/`** — the home tier, because that is where each CLI actually looks, and because it works in every workspace without writing into the user's repo or dirtying their `git status`. Copy, not symlink: the extension owns both copies and re-copies on upgrade, which sidesteps the exact failure `install.sh`'s symlink-or-copy fallback creates (on native Windows the symlink silently fails, the copy branch runs, and subsequent edits to the canonical copy stop propagating with no signal). It is ~50 small files; copying twice is cheap.

Idempotent and version-stamped: a `.grokbit-suite-version` marker holding the extension version sits beside the copied skills; provisioning re-runs only when the bundled version is newer or the marker is missing.

**Rejected: workspace tier** (`.grok/skills/` + `.claude/skills/` inside the open repo). It scopes the install to where you are working, but it dirties every repo the user opens, and gitignoring it in *this* repo does nothing for theirs.

**Side effect that must be disclosed, not buried:** provisioning to the home tier installs skills into the user's Claude Code and Grok CLIs *globally* — they will appear in sessions that have nothing to do with this extension. That is the price of the CLI finding them at all. It gets a setting (`grok.skills.provision`: `auto` | `off`, default `auto`), a one-line note in the README, and an Output-channel line on every provisioning run.

`dedupeByPriority` is workspace-first, so a user who wants to fork a suite skill can drop their own copy in the project tier and it wins.

### D3 — Suite membership is a post-scan reclassification, not a new root

Provisioning writes into `~/.grok/skills/`, which the existing home skill root already scans — so suite items arrive as ordinary `kind: "skill"` items and cannot be told apart by root.

So: `CapabilityKind` gains a `"grokbit"` member (the data-driven extension point `src/capabilities.ts:64-73` was explicitly designed for), and a new pure `applySuiteKind(items, manifest)` runs **after** `scanCapabilityRoots` and **before** `buildCapabilityGroups`, re-keying any item whose name is in the bundled manifest.

Running after `scanCapabilityRoots` is load-bearing and worth stating: `dedupeByPriority` keys on `` `${kind}|${name}` `` (`src/capabilities.ts:444-454`), so a workspace copy and a home copy of `grokbit-plan` have already collapsed into one item while both are still `kind: "skill"`. Reclassify first and they would carry different keys and both survive as duplicate rows. **No dedupe change is needed — only this ordering.**

If provisioning is off or failed, the manifest matches nothing, the group is simply absent, and the menu degrades to exactly today's behavior. That is the correct fallback, not an error state.

### D4 — `.grok/` and `.claude/` leave version control

Per the request. `git rm -r --cached .grok .claude` (files stay on disk), plus `.grok/` and `.claude/` in `.gitignore`. This also resolves the competing-suite problem in D1's preamble by removing the old agentic-team `plan`/`implement` skills from the repo.

**This is the one hard-to-reverse step in the plan and it must not be executed silently.** It untracks 72 files, and 35 of them under `.claude/` are live harness configuration, not shippable content: 9 subagent definitions, 7 slash commands, 7 hooks — including `session-start.sh`, which produced this session's own repository snapshot — plus `settings.json`. They keep working locally (the files remain on disk) and everything is recoverable from git history, but contributors cloning the repo will no longer get them.

Recommendation: proceed as asked, and if shared harness config later proves worth keeping, re-add exactly `settings.json` and `hooks/` via a negation pattern rather than reverting the whole rule. Minor bonus: `.claude/logs/subagents.log` is currently tracked *despite* `.claude/logs/` already being gitignored (gitignore does not untrack) — this cleans that up.

No `.vscodeignore` change: it already excludes `.claude/**` and `.grok/**` from the vsix, so the packaging side of "only ship grokbit-skills" is already true today.

---

## 3. Work packages

Ordering: WP1 → WP2 (the menu needs the bundle). WP3 is independent. WP4–WP7 are skill-content work with no extension dependency and can run in parallel with WP1–WP3.

### WP1 — Bundle and provision the suite

- Move `grokbit-skills/grokbit-skills/*` → `resources/skills/*`, dropping the double nesting; delete `install.sh`; `git add` the result (currently untracked).
- Rewrite `resources/skills/README.md`: "Three portable skills" → four (stale today, README.md:3 vs :5-9); replace the `## Install` section with "ships with the Grokbit extension, provisioned automatically"; keep the pipeline diagram, the loop table, and the cap-behavior rationale — they are the best explanation of the suite that exists.
- New `src/skill-suite.ts`, **pure** (no `vscode`, no top-level `node:fs`; filesystem injected, mirroring `capabilities.ts`'s `CapabilityFsLike`):
  - `SUITE_MANIFEST` — the bundled skill names + display order.
  - `suiteTargets(homeDir)` — the two destination directories.
  - `shouldProvision(installedVersion, bundledVersion)` — the staleness decision, so version comparison is unit-testable without touching disk.
  - `applySuiteKind(items, manifest)` — D3's reclassification.
- Impure glue in `extension.ts` (activation): read the marker, copy on mismatch, log to the Output channel, never throw into activation — a provisioning failure degrades to D3's absent group, it does not break the extension.
- New setting `grok.skills.provision` (`auto` | `off`, default `auto`) in `package.json` § `contributes.configuration`.

### WP2 — Grokbit Actions

- `src/capabilities.ts`: add `"grokbit"` to `CapabilityKind` (:32), to `CAPABILITY_KIND_ORDER` at the front (:73), and `CAPABILITY_KIND_LABELS.grokbit = "Grokbit workflow"` (:75-79). Delete the "No `workflow` member" comment's implication that no kind may ever be added — it explicitly permits this.
- `src/sidebar.ts` `listCapabilities` (:3112-3154): insert `applySuiteKind` between `scanCapabilityRoots` and `buildCapabilityGroups`, per D3's ordering rule.
- Copy: `#capabilities-btn` label `Actions` → `Grokbit Actions` and its `title` → `Grokbit skills, commands & agents` (`src/sidebar.ts:4635`); the panel heading and popover head to match.
- `media/webview-helpers.js` `CAPABILITY_FEATURED` (:644-658): add a `grokbit` list (all suite names — the group is ≤6 items, so it is fully featured and renders no expander) and **remove the stale `plan`/`implement` entries from the `skill` list**, which currently feature the old agentic-team suite this plan untracks.
- Verify the group renders in both mounts and that the popover's Session-controls group still leads (`sessionToggleGroup` never passes through `capabilityGroupsView`, so it carries no `featuredCount` — unchanged).

### WP3 — Repo hygiene

`.gitignore` += `.grok/`, `.claude/`; `git rm -r --cached .grok .claude`. **Requires explicit go-ahead at execution time** per D4. Update `CLAUDE.md` § Module map (new `src/skill-suite.ts` row), § ACP surfaces (the `grok.showCapabilities` entry's content policy), § Chat surfaces (the capability-browser paragraph), and `README.md`.

### WP4 — Fix the documentation skill's scripts

The suite's staleness and verification story is these two files; both are currently broken.

- **`check_drift.py`** — the comparison is wrong per the suite's own provenance definition. It compares the recorded commit against the file's *last-touch* commit, so any file whose last-touch commit is not exactly the recorded HEAD sha flags stale immediately after generation. Replace with `git diff --quiet <recorded>..HEAD -- <path>`. Also: a scalar `derived_from` (valid YAML) iterates its characters and silently checks nothing; a UTF-8 BOM makes frontmatter parse as `{}` and the doc drops out of checking silently; malformed frontmatter raises `AttributeError` and kills the whole CI scan; and the default `docs/` scan path never reaches `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` — 3 of the 12 registered types.
- **`verify_doc.py`** — `SHELL_LANGS` includes `""`, so unlabeled fences (output samples, directory trees, ASCII diagrams) are collected as commands and, under `--execute`, run through `shell=True`. Drop `""`; honor the `$`-prefix convention inside `console` blocks; run each fenced block as one script instead of per-line (fixes `cd`, continuations, and shell builtins, which `shutil.which` currently false-fails). The "sandbox" both `SKILL.md:87` and the Docs QA role claim **does not exist** — either implement a real interlock or delete the claim. Exit 0 without `--execute` is currently indistinguishable from "verified": record run-mode in the JSON and return a distinct code when commands were listed-not-run.
- **The registry advertises six checks; three are unimplemented and none are selectable.** `signatures_match` — which `api-reference.md:35` calls "the verification that matters here" — does not exist. Either implement with a `--checks` selector or delete `samples_compile`/`signatures_match`/`citations_valid` from `registry.md:51`, `SKILL.md:87`, and every type's `verify:` list. Advertising verification that does not run is the one defect this skill exists to prevent.
- **`hooks/doc-drift.json` is loaded by nothing** — Claude Code reads hooks from settings, not from a skill's `hooks/` directory; `install.sh` never merged it; grok's config is TOML. Its `python3 … || true` line would also fail silently forever on native Windows. Either wire it properly or delete it; configuration-shaped documentation that silently does nothing is worse than its absence.

### WP5 — Close the pipeline holes

- **Baseline never runs in the default flow.** Plan hard-stops at approval, "go" routes straight to `grokbit-implement`, and implement's entry conditions never check for `test/baseline.md`. The README calls baseline "the important one" and it is silently skipped. Fix: a fourth implement entry condition — if any task declares `baseline:` ≠ `none` and `test/baseline.md` is absent, run `grokbit-test` baseline mode first or record an explicit waiver.
- **Characterization tests after an INTENDED change are unspecified.** Baseline tests are committed into the project suite; after an intended behavior change they are red by design, and "never edit a test to make it pass" has no carve-out — so they permanently pollute the next session's preflight. Add an explicit, cited post-verdict retire/regenerate step.
- **"Revert to clean" does not cover untracked files.** `git checkout` restores tracked files but leaves the new files a failed task created — the most common shape of agent work, and precisely the debris the phase exists to prevent. Record created paths per task in `progress.md` and delete them on revert. Related: in dirty-tree mode the same `git checkout` clobbers the user's own uncommitted edits — snapshot first.
- **`.grokbit/handoff.md` is a dead contract** — read at `grokbit-plan/SKILL.md:33` and `references/roles.md:11`, written by nothing. Add a producer or delete the read; it also name-collides with the per-slug `implement/handoff.md`.
- **`grokbit-document` has no `references/loops.md`** — D1 and D2 are cited with caps but defined nowhere, including what a cap-3 failure emits for the skill's self-described highest-value check.
- **No plan-less entry path.** Every type's derivation targets `.grokbit/plans/{slug}/`, so "write me a README" in a repo that never ran `grokbit-plan` — the most common vibe-coder request — hits near-0% coverage and a mandated refusal. Add `src:`-only derivation.

### WP6 — The vibe-coder gaps

- **No git, no suite.** Clean tree, commit-per-task, `git checkout` revert, and `git revert` rollback are all load-bearing, and preflight never checks whether git exists or the directory is a repo. Vibe coders frequently have neither. Add a preflight gate that offers `git init`.
- **Windows.** Every example `verify:` command is POSIX (`rg … | wc -l`), and nothing instructs the Architect to write commands runnable in the user's actual shell. Add that instruction plus an optional `cwd:` task field (which also addresses monorepos).
- **Environmental verify failures burn the retry budget.** A verify command that cannot execute — command not found, wrong shell, wrong cwd — consumes all three Loop I2 attempts and then **reverts working code**. Add a branch: if the command itself cannot run, that is a plan-specification deviation, not an attempt.

### WP7 — Consistency cleanups

Stale copy-pasted `host-adapters.md` in three skills (names roles that do not exist in those skills; its install list omits `grokbit-document`, contradicting the installer; and it opens with a note addressed to the suite's author sitting in a file the executing agent reads as instructions). Loop-ID drift (implement's pipeline diagram says `L2`/`L3`, its `loops.md` says `I2`/`I3` — and `L2`/`L3` are *Plan's* loops, so an agent following the diagram reads the wrong spec). Reviewer roles declared `Tools: read only` while required to write their findings file — both in plan and implement; the Business Analyst role gets this right and is the model. Missing `assumptions.template.md` and `05-review.md` templates. `UNVERIFIED` vs `UNRESOLVED` used interchangeably with no defined vocabulary. Code Reviewer told to read `progress.md`, which is not among its declared inputs. `ask_cap` conflict: `SKILL.md` says five flatly, types declare 1–5. README role-name and loop-table drift.

### WP8 — Deferred (not in this plan's scope)

Recorded so they are decisions rather than omissions: the pipeline stepper card and approval-gate card (both read `.grokbit/plans/<slug>/` as a state machine — the suite's README explicitly anticipates this), the registry-driven documentation picker, and five proposed new skills — `grokbit-fix` (the biggest gap: today's routing offers only "full pipeline" or "trivial edit"), `grokbit-ship`, `grokbit-rescue`, `grokbit-setup`, `grokbit-explain`. Each needs its own plan.

---

## 4. Test plan

The 1314-test floor holds; everything stays grok-free and claude-free.

- `test/skill-suite.test.ts` (new) — `shouldProvision` version comparison, `suiteTargets`, and `applySuiteKind` including the D3 ordering guard: reclassification after dedupe yields one row, before dedupe yields two.
- `test/capabilities.test.ts` — the new kind orders first; a manifest matching nothing yields no group (D3's fallback).
- `test/capabilities.dom.test.ts` — the Grokbit group renders in both mounts; the welcome-canvas panel still renders no switch (the existing mount-policy guard).
- `test/webview-helpers.test.ts` — `CAPABILITY_FEATURED.grokbit` covers the whole manifest, so the group never renders an expander.
- Python: extend `scripts/verify_token_aggregator.py`'s fixture idiom to the two doc scripts — fixture-driven, manual, out of `npm test`/CI, keeping both Python-free.
- `npm run test:live` before any release, per the standing gate.

## 5. Risks

**Provisioning writes to the user's home CLI directories** (D2) — global side effect, disclosed via setting, README, and Output channel.
**Untracking `.claude/`** (D4) — removes live harness config from version control; needs explicit go-ahead.
**The suite is bundled before WP4–WP7 land** if the work packages ship separately. Bundling broken scripts is worse than not bundling: WP4 in particular should land in the same release as WP1, or `grokbit-document`'s scripts should ship disabled.

## 6. Non-goals

MCP servers, personas, plugins, and workflows stay out of the capability browser (unchanged from docs/plans/capability-surfacing-and-history-ux.md § Non-goals). No filesystem watcher over capability roots — provisioning is activation-time, and the existing Refresh affordance covers mid-session change.

## 7. Provenance

§ 1 and WP4–WP7 fold in two independent deep reviews of the suite conducted 2026-07-30 — one covering `grokbit-plan` + `grokbit-implement` supporting files, one covering `grokbit-test` + `grokbit-document` including both Python scripts. Findings are reproduced here in condensed form; every claim about extension code carries a `path:line` citation read from disk in that session.
