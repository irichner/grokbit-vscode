# Survey — User Workflows (Grok + Claude)

Every claim below was confirmed by opening the cited file in this session (or installed Grok user guide / on-disk Claude workflow sample).

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Grokbit Workflows UI | EXISTS | `media/chat.js:750`; `src/sidebar.ts:5280` |
| Suite tiles `kind: "grokbit"` | EXISTS | `src/skill-suite.ts:47–53`; labels `src/capabilities.ts:92–97` |
| Visible-kinds allowlist | EXISTS | `media/webview-helpers.js:738–761` (`["grokbit"]` only) |
| Capability scan | EXISTS | `src/capabilities.ts:575–677`; wire `src/sidebar.ts:3420–3488` |
| `CapabilityKind` (no workflow) | EXISTS | `src/capabilities.ts:30–38` |
| flat layout (`.md` only) | EXISTS | `src/capabilities.ts:642–646` |
| `CAPABILITY_ROOTS` grok / claude | EXISTS | `src/capabilities.ts:123–154` — **no workflow roots** |
| Rhai workflow paths (CLI) | EXISTS (docs) | `~/.grok/docs/user-guide/05-configuration.md:318` |
| Grok invoke | EXISTS (docs) | create-workflow skill: `/name` or `/workflow name` |
| Claude saved workflow path (project) | EXISTS (sample) | `C:\Users\israe\Projects\LanshoreMarketing\.claude\workflows\spot-review-fanout.js` |
| Claude workflow meta shape | EXISTS (sample) | same file L1–: `export const meta = { name, description, whenToUse, phases }` |
| Claude home workflows dir | EXISTS (changelog) | `~/.claude/workflows/` / `CLAUDE_CONFIG_DIR` (changelog save dialog); this machine’s home dir was **missing** at survey time |
| Claude `/workflows` run UI | EXISTS (changelog) | Claude Code changelog (dynamic workflows, `/workflows`) — **run** dashboard, not extension scope |
| Dual-backend User Workflows UI | DOES NOT EXIST | no empty helper that teaches Claude create path; no Claude roots |
| Rhai / JS workflow parsers | DOES NOT EXIST | only YAML frontmatter (`src/capabilities.ts:280–422`) |
| Prior Decision 1 (defer all workflows) | EXISTS (stale) | `docs/plans/capability-surfacing-and-history-ux.md:35–42`, `:781–787` — assumed neither CLI had authored workflows |

## Reusable code

- `scanCapabilityRoots` + caps + symlink containment (`src/capabilities.ts:500–677`) — extend layouts; do not second-scanner.
- Parallel pure constructors: `capabilityFromSkillFile` pattern for Rhai + JS meta extractors.
- `dedupeByPriority` per `` kind|name ``; project-before-home root order.
- `buildCapabilityGroups` / `CAPABILITY_KIND_ORDER` data-driven groups.
- `visibleCapabilityGroups` — allowlist add `"workflow"`.
- Tile renderer invoke/open/inert (`media/chat.js:911–920`) — no kind branch required.
- Dual mounts panel + popover (`media/chat.js:1065–1173`).
- Tests: `test/capabilities.test.ts`, `test/capabilities.dom.test.ts`, `test/webview-helpers.test.ts`.

## Supersession

| Item | Location | Callers | Why |
|---|---|---|---|
| Decision 1 “no CLI workflows / no workflow kind” | plan + comments `src/capabilities.ts:30–32` | docs/comments | **Both CLIs now have native saved workflows** (different formats). |
| Prior plan version “Claude = Grok-only empty forever” | this slug’s earlier `01-intent` / design | plan only | **Superseded** by dual-backend product direction. |
| `CAPABILITY_VISIBLE_KINDS = ["grokbit"]` | `webview-helpers.js:740` | both mounts | Must include `workflow`. |
| flat-md `.md` only | `capabilities.ts:642–646` | flat roots | Need `flat-rhai` + `flat-js` (or one flat multi-ext layout parameterized by extension). |
| Empty groups omitted in host | `buildCapabilityGroups` | payload | Empty UX remains webview-side **per backend**, not “Grok only.” |

## Prior attempts

- Capability Decision 1 deferred workflows (stale for Grok **and** Claude).
- Earlier draft of this slug planned Grok-only discovery + Claude dead-end — **replaced** by this survey pass.
- Real Claude workflow sample: `spot-review-fanout.js` (LanshoreMarketing) — live proof of format.

## Conventions

- Pure discovery in `capabilities.ts`; `sidebar.listCapabilities` injects fs/backend/cwd.
- Vitest pure + DOM; no real CLI spawn in `npm test`.
- Invoke seeds with trailing space; Actions replace mode.
- Name charset `CAPABILITY_NAME_PATTERN` for invocable strings.

## Absences

- No dual parsers, no workflow roots on either backend, no dual-backend empty copy.

## Danger zones

- `src/capabilities.ts` scan branching (must not mis-read skills as workflows).
- Dual mount short-circuit when suite exists but workflows empty (and reverse).
- Hard-coded `CAPABILITY_KIND_ORDER` equality in `test/capabilities.test.ts:738–739`.
- Cross-backend pollution (listing wrong extension on wrong backend).
