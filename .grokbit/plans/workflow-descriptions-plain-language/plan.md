# Plan — Plain-language Grokbit workflow descriptions

Slug: `workflow-descriptions-plain-language` · Approach: rewrite five suite frontmatter descriptions to short plain language (Option A) · Blast radius: 5 skill files + 1–2 test files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Rewrite suite skill frontmatter descriptions
- **intent:** Replace each of the five Grokbit workflow `description:` lines with short, non-technical, benefit-first copy that fits fully in the Actions tile (≤260 characters).
- **files:** `resources/skills/grokbit-explore/SKILL.md`, `resources/skills/grokbit-plan/SKILL.md`, `resources/skills/grokbit-implement/SKILL.md`, `resources/skills/grokbit-test/SKILL.md`, `resources/skills/grokbit-document/SKILL.md`
- **cwd:** none
- **depends:** none
- **verify:** `node -e "const fs=require('fs');const path=require('path');const names=['grokbit-explore','grokbit-plan','grokbit-implement','grokbit-test','grokbit-document'];let bad=0;for(const n of names){const t=fs.readFileSync(path.join('resources/skills',n,'SKILL.md'),'utf8');const d=(t.match(/^description:\\s*(.+)$/m)||[])[1]||'';const len=d.length;console.log(n,len,d);if(!d||len>260)bad++;}process.exit(bad?1:0);"`
- **removes:** none (content replace only)
- **baseline:** none (display copy only; no product behavior under test suite contracts beyond discovery of description text)
- **rollback:** `git checkout -- resources/skills/grokbit-explore/SKILL.md resources/skills/grokbit-plan/SKILL.md resources/skills/grokbit-implement/SKILL.md resources/skills/grokbit-test/SKILL.md resources/skills/grokbit-document/SKILL.md`
- **state-after:** working
- **notes:**
  - Source of current strings: `resources/skills/*/SKILL.md:3` (survey). Caps: webview 260 (`media/webview-helpers.js:630`), host 280 (`src/capabilities.ts:171`).
  - Voice: user outcome first; no role pipeline / path jargon as primary message (`03-design.md` draft table is starting point; polish allowed).
  - Do not edit skill bodies, names, or order.
  - Draft candidates (may refine if still clear to non-technical readers):
    - explore: Look around your project and explain what matters — without changing any files.
    - plan: Work out a clear step-by-step plan you can approve before any code is changed.
    - implement: Build the approved plan one step at a time, checking each step works before moving on.
    - test: Check that the change works and nothing else broke — so you know if it is safe to ship.
    - document: Write clear project docs (like a README or guide) from your code and plans.

### T2 — Fix description-related tests for new copy and trim behavior
- **intent:** Keep the suite green: stop coupling the sentence-aware trim test to the old multi-paragraph plan description; ensure no other test asserts the superseded jargon strings.
- **files:** `test/webview-helpers.test.ts` (and any other test that hardcodes the old plan/explore/implement/test/document frontmatter if found at implement time)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test`
- **removes:** hardcoded production plan description fixture content (replaced by synthetic long multi-sentence string for trim, or by expectations matching new short plan string)
- **baseline:** none
- **rollback:** `git checkout -- test/webview-helpers.test.ts`
- **state-after:** working
- **notes:**
  - Current coupling: `test/webview-helpers.test.ts:1009-1038` embeds the full old plan description and expects a three-sentence trim ending at `.grokbit/plans/.`.
  - Preferred fix (design): synthetic long string still >260 with multiple `". "` boundaries so trim behavior stays tested without blocking future copy edits.
  - Grep for unique old fragments e.g. `four-role pipeline`, `bounded correction loops`, `revert-on-failure`, `production-parity` before finishing.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Each tile description understandable without agent jargon | T1 content review + human read of the five printed strings from T1 verify |
| Each description fully visible (≤260 chars) | T1 `verify` node script exits 0 |
| Plain what/when, not role titles as primary message | T1 notes voice rules; human gate on printed output |
| Slash command / skill name unchanged | T1 only edits `description:` line; grep names still `grokbit-*` |
| Both backends see new copy after provision | Same disk files provisioned to both homes (no code fork); rebuild/re-provision after ship (outside implement if local-only) |
| `npm test` green | T2 verify |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 2 | T1 (five descriptions), T2 (test fixture) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 3 | display-override API (out of scope); cap/trim code; suite README pipeline prose |

Net lines: roughly −1500 chars of description prose across five files, + small test edit. Not net-additive feature code.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` Primary audience is Actions tiles; slightly weaker agent auto-routing from shorter descriptions is acceptable.
- Re-provision / rebuild required before home-tier `~/.grok/skills` and `~/.claude/skills` show new text on the machine.

## Approval
- [x] Human approved — 2026-08-01 (user: /grokbit-implement this plan)
