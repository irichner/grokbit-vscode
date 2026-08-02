# Plan — Detailed “how they work” for each Grokbit workflow

Slug: `workflow-how-they-work` · Approach: Option B — suite `how-it-works.md` SoT + in-Actions Details (lazy load) + `docs/grokbit-workflows.md` · Blast radius: ~5 guide files + docs/README + skill-suite/capabilities/sidebar/chat/css/tests; 0 deps; no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Author five full-technical `how-it-works.md` guides
- **intent:** Create product SoT full-technical guides (roles, pipeline, loops/caps, artifacts, gates, next step) for each suite skill under the shipped bundle.
- **files:** `resources/skills/grokbit-explore/references/how-it-works.md`, `resources/skills/grokbit-plan/references/how-it-works.md`, `resources/skills/grokbit-implement/references/how-it-works.md`, `resources/skills/grokbit-test/references/how-it-works.md`, `resources/skills/grokbit-document/references/how-it-works.md`
- **cwd:** none
- **depends:** none
- **verify:** `node -e "const fs=require('fs');const path=require('path');const names=['grokbit-explore','grokbit-plan','grokbit-implement','grokbit-test','grokbit-document'];const need=['## Purpose','## Pipeline','## Roles','## Loops and caps','## Cap behavior','## Artifacts','## Human gates','## Next step','## Provenance'];let bad=0;for(const n of names){const p=path.join('resources/skills',n,'references','how-it-works.md');if(!fs.existsSync(p)){console.log('MISSING',p);bad++;continue;}const t=fs.readFileSync(p,'utf8');for(const h of need){if(!t.includes(h)){console.log('MISSING HEADING',n,h);bad++;}}console.log('ok',n,t.length);}process.exit(bad?1:0);"`
- **removes:** none
- **baseline:** none (new content files; no product behavior yet)
- **rollback:** delete the five new files
- **state-after:** working
- **notes:** Derive from each skill’s `SKILL.md` + `references/loops.md` + `references/roles.md` and suite `README.md` loop philosophy. Document skill must cover registry/types/verify depth. Do not change frontmatter `description:` lines.

### T2 — Pure path helper + attach `hasDetail` / `detailPath` on suite items
- **intent:** Resolve extension-bundle how-it-works paths and mark suite capability items so the webview can offer Details without kind-branching.
- **files:** `src/skill-suite.ts` (or new pure helper colocated), `src/capabilities.ts` (optional `hasDetail`/`detailPath` on `CapabilityItem`), `src/sidebar.ts` (`listCapabilities`), `test/skill-suite.test.ts` (and/or new unit test)
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/skill-suite.test.ts test/capabilities.test.ts`
- **removes:** none
- **baseline:** none (additive payload fields; old clients ignore)
- **rollback:** `git checkout -- src/skill-suite.ts src/capabilities.ts src/sidebar.ts test/skill-suite.test.ts`
- **state-after:** working
- **notes:** `suiteHowItWorksPath(extensionRoot, skillName)` per design. Use `extensionPath` for bundle root. Set `hasDetail` only when file exists. Do not embed markdown in `listCapabilities`.

### T3 — Lazy `getCapabilityDetail` host handler
- **intent:** On request, read the suite how-it-works file (bounded) and post markdown to the requesting panel only.
- **files:** `src/sidebar.ts` (message type union + handler), tests if host messages are covered elsewhere
- **cwd:** none
- **depends:** T2
- **verify:** `npx vitest run test/skill-suite.test.ts` ; manual-or-unit: path outside suite tree is refused (if pure guard extracted, unit-test that)
- **removes:** none
- **baseline:** none
- **rollback:** revert sidebar message handler
- **state-after:** working
- **notes:** Cap read size (~64KB). Resolve path only via pure helper + suite names allowlist (`SUITE_SKILL_NAMES`), never arbitrary client paths. `postTo` not buffer.

### T4 — Webview Details control + in-panel detail (safe render)
- **intent:** From Actions tiles, user can open full-technical how-it-works **inside** the Actions surface; primary click still seeds `/grokbit-*`.
- **files:** `media/webview-helpers.js`, `media/chat.js`, `media/chat.css`, `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T3
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts`
- **removes:** none
- **baseline:** Actions row click seeds invoke / no Details (characterize via existing capabilities.dom tests)
- **rollback:** revert webview/css/test files
- **state-after:** working
- **notes:** Data-driven on `hasDetail`; no kind-string branch in `buildCapabilityRow`. stopPropagation on Details. Safe markdown/text render (no raw `innerHTML` of detail string). Scrollable max-height. Optional Open in editor via `detailPath` + `openFile`.

### T5 — Docs aggregate + README + WORKFLOW banner + suite README links
- **intent:** Full-technical docs surface for GitHub/repo readers; disambiguate template WORKFLOW.md; discoverability from README and suite README.
- **files:** `docs/grokbit-workflows.md` (new), `README.md`, `docs/WORKFLOW.md`, `resources/skills/README.md`
- **cwd:** none
- **depends:** T1
- **verify:** `node -e "const fs=require('fs');const d=fs.readFileSync('docs/grokbit-workflows.md','utf8');const need=['grokbit-explore','grokbit-plan','grokbit-implement','grokbit-test','grokbit-document','## Loops','## Roles'];let bad=0;for(const s of need){if(!d.includes(s)){console.log('missing',s);bad++;}}const r=fs.readFileSync('README.md','utf8');if(!r.includes('docs/grokbit-workflows.md')&&!r.includes('grokbit-workflows')){console.log('README missing link');bad++;}const w=fs.readFileSync('docs/WORKFLOW.md','utf8');if(!/grokbit-workflows|Grokbit workflow/i.test(w.slice(0,800))){console.log('WORKFLOW missing banner');bad++;}process.exit(bad?1:0);"`
- **removes:** none
- **baseline:** none (docs only; WORKFLOW still describes template)
- **rollback:** delete `docs/grokbit-workflows.md`; revert README, WORKFLOW.md, skills README
- **state-after:** working
- **notes:** `docs/grokbit-workflows.md` includes pipeline overview + per-skill bodies aligned with T1 files. USER_GUIDE left alone (LEAVE).

### T6 — Full suite green
- **intent:** No regressions across the test floor after UI/host changes.
- **files:** none new
- **cwd:** none
- **depends:** T4, T5
- **verify:** `npm test`
- **removes:** none
- **baseline:** none
- **rollback:** n/a (verification only)
- **state-after:** working
- **notes:** Floor currently 1400+ tests; keep green.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Each of five workflows has full-technical explanation (roles, loops, caps, artifacts, gates, next) | T1 verify headings + human skim of files |
| Content in product UI (Actions) without hand-hunting skill files | T4 DOM tests: Details → in-panel content; T3 host |
| Content in docs without skill files as only source | T5 `docs/grokbit-workflows.md` + README link |
| Depth matches suite-README class | T1 content review vs loops.md tables |
| Short tile blurbs still ≤260 / second layer | T1 does not edit description; T4 Details separate |
| Tile click still seeds `/grokbit-*` | T4 DOM: primary invoke unchanged |
| `npm test` green | T6 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 0 | — |
| DEPRECATE | 0 | — |
| COEXIST | 2 | T5 — README one-liners + suite README (links) |
| LEAVE | 4 | short descriptions; WORKFLOW.md (+banner); USER_GUIDE; skill bodies |

Net lines: large docs (+), small host/webview (+). Not a silent COEXIST of a second procedure — guides are explicitly derived display layer.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` Exact chat markdown sanitizer entry point for reuse in Details — implement must confirm or fall back to `textContent`.
- `UNVERIFIED` `GrokSidebar` already holds `extensionPath`/`context` at `listCapabilities` (expected; confirm at implement).

## Approval
- [x] Human approved — 2026-08-01 (user: approved)
