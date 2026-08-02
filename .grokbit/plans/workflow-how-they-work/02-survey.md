# Survey — Detailed “how they work” for each Grokbit workflow

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Suite skill names / order | EXISTS | `src/skill-suite.ts:47-53` (`SUITE_SKILL_NAMES`) |
| Suite bundle dir | EXISTS | `src/skill-suite.ts:56` (`resources/skills`) |
| Capability item shape | EXISTS | `src/capabilities.ts:40-58` — `description`, optional `hint`, `path`, `invoke`; **no** `detail` / long-body field |
| Description host cap | EXISTS | `src/capabilities.ts:168-171` — `CAPABILITY_DESCRIPTION_MAX_CHARS = 280` |
| Description webview cap | EXISTS | `media/webview-helpers.js:630` — `CAPABILITY_ROW_DESCRIPTION_MAX = 260` |
| Skill file head-read bound | EXISTS | `src/capabilities.ts:152-155` — `CAPABILITY_HEAD_BYTES = 8 * 1024` (frontmatter + first paragraph only) |
| Suite re-key to `grokbit` | EXISTS | `src/sidebar.ts:3253-3260` (`applySuiteKind` after scan) |
| `listCapabilities` payload | EXISTS | `src/sidebar.ts:3277-3285` — groups only; no detail markdown |
| Row click: invoke vs open | EXISTS | `media/chat.js:798-801` — `invoke` seeds composer; `open` → `{type:"openFile", path}` |
| `openFile` host handler | EXISTS | `src/sidebar.ts:2790-2824` — absolute/relative path → editor or external |
| View-model (label strip) | EXISTS | `media/webview-helpers.js:844-848` — grokbit labels drop `grokbit-` prefix; description truncated |
| Actions allowlist | EXISTS | `media/webview-helpers.js:695-697` — `CAPABILITY_VISIBLE_KINDS = ["grokbit"]` |
| Featured suite order | EXISTS | `media/webview-helpers.js:679-680` — all five suite names |
| Short tile descriptions | EXISTS | e.g. `resources/skills/grokbit-plan/SKILL.md:3` (plain-language one-liners; implement of `workflow-descriptions-plain-language` done) |
| Full agent procedure (Plan) | EXISTS | `resources/skills/grokbit-plan/SKILL.md` body (pipeline, hard rules, steps) |
| Loop tables (per skill) | EXISTS | e.g. `resources/skills/grokbit-plan/references/loops.md`; explore/implement/test counterparts |
| Suite maintainer README | EXISTS | `resources/skills/README.md` — pipeline diagram, loop-at-a-glance table, five rules, portability |
| Product README Actions table | EXISTS | `README.md:129-137` — one line per skill |
| Agentic-template WORKFLOW doc | EXISTS | `docs/WORKFLOW.md:1-21` — explore→plan→implement→verify→review→commit (**not** grokbit-* suite) |
| Template USER_GUIDE | EXISTS | `docs/USER_GUIDE.md:1-5` — points at `docs/WORKFLOW.md` as *that* template loop |
| vsix ships `resources/skills` | EXISTS | `.vscodeignore` does **not** exclude `resources/`; skills bundle ships |
| vsix ships `docs/**` | DOES NOT EXIST (excluded) | `.vscodeignore:33` — `docs/**` (except `docs/screenshots/**`) **not** in Marketplace vsix |
| Per-skill `how-it-works.md` | DOES NOT EXIST | searched under `resources/skills/*/references/` — only `loops.md`, `roles.md`, `host-adapters.md` (+ document extras) |
| In-Actions expandable technical detail | DOES NOT EXIST | row renders name + short desc + optional hint only (`media/chat.js:742-803`) |
| Rhai workflows in scope | OUT OF SCOPE | per intake answers — not surveyed deeply |

## Reusable code

- **`openFile` message path** — `media/chat.js:800-801` + `src/sidebar.ts:2790-2824` — already opens absolute skill paths in the editor; a “Details” affordance can reuse without new protocol *if* the detail file path is known.
- **`capabilityGroupsView` / `buildCapabilityRow`** — pure view-model + DOM; data-driven `action` (`invoke`/`open`/`inert`); standing rule: renderer must **not** branch on kind strings (`media/chat.js:742-745`). New UI must use a field (e.g. `detailPath`) or control shape, not `if (kind === "grokbit")` in the renderer.
- **`applySuiteKind` + `suiteTargets`** — `src/skill-suite.ts` / `sidebar.ts:3258-3260` — suite membership and managed home dirs; natural place to attach suite-only metadata (detail path) without polluting every skill/agent.
- **Markdown in chat** — agent bubbles already render markdown (`media/chat.js`); optional in-panel detail can reuse patterns, but editor-tab open is simpler and already tested for openFile.
- **DOM tests** — `test/capabilities.dom.test.ts` covers Actions mounts, openFile for non-invocable rows, refresh, expand; extend for Details.
- **Suite README content** — `resources/skills/README.md:35-156` already holds pipeline, loop table, cap-behavior philosophy — primary reuse for docs synthesis.

## Supersession

| Item | Location | Callers | Why superseded / overlapped |
|---|---|---|---|
| One-line Actions `description:` | `resources/skills/*/SKILL.md:3` | Host scan → webview tiles | Still needed for compact grid; **not** replaced by full technical text (would re-break 260-char UX) |
| README Actions one-liners | `README.md:133-137` | Public product readme | Incomplete vs depth C; should link or expand, not stay the only story |
| `docs/WORKFLOW.md` | agentic-template loop | Linked from `docs/USER_GUIDE.md:4` | **Different product** (Claude template `/ship` loop). Overlaps *conceptually* with explore→plan→… naming; misleading if a Grokbit user opens it expecting suite skills |
| `resources/skills/README.md` | maintainer suite map | Humans + agents who open the bundle | Full technical already; not surfaced in Actions UI; not linked from product README Actions section as the “how they work” guide |
| Skill body procedure | `resources/skills/*/SKILL.md` | Agent runtime when skill invoked | Authoritative procedure; agent-facing register — poor default product UI body unless framed |

## Prior attempts

- **`workflow-descriptions-plain-language`** — short plain `description:` only; implement progress T1/T2 done. Live short strings match intent of compact tiles.
- **`workflow-title-and-color` / `workflow-display-polish`** — label prefix strip + accent (label transform present at `webview-helpers.js:844-846`). Display polish, not how-it-works content.
- **`actions-workflow-tiles` / suite multi-dimensional review** — tiles + suite quality; not expandable technical guides.
- **`docs/WORKFLOW.md` + `docs/USER_GUIDE.md`** — live for **agentic Claude template**, not Grokbit suite skills. Do not treat as current SoT for `/grokbit-*`.

## Conventions

- **Capabilities pure/impure split:** pure discovery in `src/capabilities.ts`; impure scan + post in `sidebar.ts` (`listCapabilities` ~3230).
- **Webview pure view-model:** `capabilityGroupsView` in `media/webview-helpers.js`; DOM in `media/chat.js`.
- **Tests:** vitest unit + happy-dom (`test/capabilities*.ts`, `test/webview-helpers.test.ts`); `npm test` is the verify floor.
- **No `docs/**` in vsix** — product-in-extension content must live under `resources/` or `media/` (or be generated into `out/`).
- **Provision:** home-tier copy of suite; `path` on disk items points at provisioned `SKILL.md` under `~/.grok/skills` / `~/.claude/skills` after provision.

## Absences

- No `detail` / `longDescription` / `howItWorks` on `CapabilityItem`.
- No per-skill human “how it works” guide file under the suite bundle.
- No Grokbit-suite-specific durable doc under `docs/` (only the unrelated template WORKFLOW).
- No lazy-load message for capability detail markdown.
- `docs/**` excluded from vsix — cannot rely on opening `docs/…` from an installed extension.

## Danger zones

- **`media/chat.js` capability renderer** — heavily tested; kind-branching is an architectural foul (`chat.js:742-745`).
- **Description caps** — stuffing full technical into `description:` reopens the truncation/jargon failure `workflow-descriptions-plain-language` fixed.
- **Content drift** — skill bodies, suite README, product README, and any new guide can diverge; plan must name a single editorial source of truth.
- **`.vscodeignore:33`** — docs edits never reach Marketplace builds; UI that depends on `docs/` paths will fail for installed users.
