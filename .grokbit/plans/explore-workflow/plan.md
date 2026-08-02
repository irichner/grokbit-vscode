# Plan — Explore workflow in Grokbit Actions

Slug: `explore-workflow` · Approach: fifth suite skill + explore-first manifest · Blast radius: ~12–18 files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Prepend `grokbit-explore` to suite + webview name lists
- **intent:** Extension treats Explore as a suite member and Actions sorts/features it first, in lockstep across host and webview.
- **files:** `src/skill-suite.ts`, `media/webview-helpers.js`
- **cwd:** none
- **depends:** none
- **verify:** From repo root (PowerShell-friendly):  
  `node -e "const s=require('./out/skill-suite.js'); const a=s.SUITE_SKILL_NAMES; if(a[0]!=='grokbit-explore'||a.length!==5) process.exit(1);"`  
  after `npx tsc -p .` (or `npm test -- test/skill-suite.test.ts test/webview-helpers.test.ts` once T4 updates those tests). Until T4, also:  
  `node -e "const fs=require('fs'); const t=fs.readFileSync('src/skill-suite.ts','utf8'); if(!/grokbit-explore/.test(t)) process.exit(1); const w=fs.readFileSync('media/webview-helpers.js','utf8'); if(!/grokbit-explore/.test(w)) process.exit(1);"`  
  Confirm order in both files: explore, plan, implement, test, document.
- **removes:** none (array contents replaced in place)
- **baseline:** Actions currently shows four grokbit tiles plan-first when suite provisioned; suite name lists omit explore
- **rollback:** revert the two files
- **state-after:** working (missing skill dir still silently skips provision for explore only; other four continue)
- **notes:** `src/skill-suite.ts:47-52`; `media/webview-helpers.js:669-670` and `:689-691`. Do not change `applySuiteKind` algorithm.

### T2 — Author full `resources/skills/grokbit-explore` package
- **intent:** Ship a full suite skill: chat-only orientation map, roles/loops, distinct from Plan Survey.
- **files:** `resources/skills/grokbit-explore/SKILL.md`, `resources/skills/grokbit-explore/references/roles.md`, `resources/skills/grokbit-explore/references/loops.md`, `resources/skills/grokbit-explore/references/host-adapters.md`, `resources/skills/grokbit-explore/assets/map.template.md`
- **cwd:** none
- **depends:** none (can parallel T1; should land before or with T3 docs)
- **verify:**  
  `node -e "const fs=require('fs');const p='resources/skills/grokbit-explore'; const need=['SKILL.md','references/roles.md','references/loops.md','references/host-adapters.md','assets/map.template.md']; for (const f of need) if(!fs.existsSync(p+'/'+f)) process.exit(1); const sk=fs.readFileSync(p+'/SKILL.md','utf8'); if(!/^---[\s\S]*name:\s*grokbit-explore/m.test(sk)) process.exit(1); for (const needle of ['read-only','path:line','grokbit-plan','02-survey','chat']) if(!sk.toLowerCase().includes(needle.toLowerCase()) && !sk.includes(needle)) { /* allow case variants */ } const low=sk.toLowerCase(); if(!low.includes('read-only')||!low.includes('path:line')||!low.includes('grokbit-plan')) process.exit(1); if(low.includes('write 02-survey')||low.includes('produce plan.md')) process.exit(1);"`  
  Manual content check: frontmatter `description` first sentence is self-contained tile blurb; hard rules forbid product-source edits and writing plan artifacts; pipeline is Scope→Map→Cite-check→Present; map template matches chat sections in design.
- **removes:** none
- **baseline:** none (new package)
- **rollback:** delete `resources/skills/grokbit-explore/`
- **state-after:** working
- **notes:** Follow sibling structure of `resources/skills/grokbit-plan/`. Steal exit criteria ideas from `docs/WORKFLOW.md:27-34` without requiring durable digests. Explicit anti-COEXIST: never write `.grokbit/plans/**`; Plan Survey remains authoritative for change planning.

### T3 — Update suite README, product docs, package.json settings copy
- **intent:** Teaching surfaces say five skills, explore-first, matching Actions.
- **files:** `resources/skills/README.md`, `README.md`, `CLAUDE.md`, `docs/architecture.md`, `package.json`, optionally sibling `resources/skills/*/references/host-adapters.md` enumerations and light `resources/skills/grokbit-plan/SKILL.md` Step 0 cross-link
- **cwd:** none
- **depends:** T2 (skill exists so docs can describe real behavior)
- **verify:**  
  `node -e "const fs=require('fs'); const files=['resources/skills/README.md','README.md','CLAUDE.md','docs/architecture.md','package.json']; for (const f of files){ const t=fs.readFileSync(f,'utf8'); if(!/grokbit-explore|Explore/.test(t)) { console.error('missing explore mention:',f); process.exit(1);} } const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); const conf=JSON.stringify(pkg.contributes.configuration); if(!/explore/i.test(conf)) process.exit(1); if(/plan → implement → test → document/.test(conf) && !/explore/i.test(conf)) process.exit(1);"`  
  Spot-check: suite README pipeline shows explore before plan; `package.json` enum description and `grok.skills.provision` markdown no longer omit explore.
- **removes:** none (prose replaced)
- **baseline:** “four skills” copy in README/CLAUDE/architecture/settings
- **rollback:** revert listed docs
- **state-after:** working
- **notes:** LEAVE historical CHANGELOG entries; add shipping CHANGELOG bullet only if/when user rebuilds (can be same PR as implement).

### T4 — Update unit/DOM tests for five-step suite
- **intent:** Tests encode explore-first featured list and first-row seed `/grokbit-explore `.
- **files:** `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts`, optionally `test/skill-suite.test.ts` (order assertion)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/webview-helpers.test.ts test/capabilities.dom.test.ts test/skill-suite.test.ts`  
  (Windows: same; vitest accepts path args.)
- **removes:** none
- **baseline:** four-name fixtures; first click seeds `/grokbit-plan `
- **rollback:** revert test files
- **state-after:** working
- **notes:** `SUITE_GROUP` total/featuredCount → 5; items lead with explore; `FEATURED_FOUR` → five suite names; expand tests that inject sixth `alpha` still valid; `[R] renders all four steps` → five; first-row seed expects `/grokbit-explore `.

### T5 — Full suite green + wiring smoke
- **intent:** No regressions elsewhere; suite manifest length/order asserted.
- **files:** none additional (verification only)
- **cwd:** none
- **depends:** T1, T2, T3, T4
- **verify:** `npm test`  
  Plus: `node -e "const fs=require('fs'); const n=require('./src/skill-suite.ts');"` is not valid without compile — prefer after `npx tsc -p .`: load `out/skill-suite.js` and assert `SUITE_SKILL_NAMES[0]==='grokbit-explore' && SUITE_SKILL_NAMES.length===5` and `fs.existsSync('resources/skills/grokbit-explore/SKILL.md')`.
- **removes:** none
- **baseline:** full suite currently green without explore
- **rollback:** N/A (verify-only)
- **state-after:** working
- **notes:** Manual smoke after rebuild (not blocking T5): open new session → Actions shows five tiles explore-first → click Explore seeds composer → optional run with a small question yields a cited chat map without source edits.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Five Actions tiles, Explore first | T1 + T4 (`npm test` DOM/helpers) + manual after rebuild |
| Click Explore seeds invoke, no auto-send | T4 DOM test (first row → `/grokbit-explore `, no send) |
| Chat map only; no required `.grokbit` explore artifacts | T2 SKILL.md hard rules + content review (no disk output contract) |
| Read-only / no implement | T2 SKILL.md hard rules grep + manual smoke |
| Full suite member (bundle, provision, re-key) | T1 + T2 + T5 (manifest + dir); provision path unchanged |
| Docs say five-step explore-first | T3 node checks + human skim |
| Targeted tests green | T4 + T5 `npm test` |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 9 | T1 (3 name lists), T3 (docs + package.json + host-adapters), T4 (tests) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — (Plan Survey is LEAVE, not COEXIST of two suite skills) |
| LEAVE | 4 | built-in agent explore; Plan Survey; document context digests; historical CHANGELOG |

Net lines: additive skill package + small list/doc/test edits. Legitimate new feature, not silent COEXIST with an existing suite skill.

## Open assumptions
Full ledger: `assumptions.md`.

- Manual conversational quality of Explore is residual after green `npm test`.
- Explore is not a hard gate before Plan.

## Approval
- [x] Human approved — 2026-08-01 (user invoked `/grokbit-implement This plan`)
