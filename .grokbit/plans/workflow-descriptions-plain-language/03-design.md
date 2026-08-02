# Design — Plain-language Grokbit workflow descriptions

## Options considered

### Option A — Rewrite frontmatter `description:` only (plain language, ≤260 chars)
Approach: Edit the five `resources/skills/*/SKILL.md` YAML `description` lines to short, benefit-first sentences a non-technical user can scan. Keep under `CAPABILITY_ROW_DESCRIPTION_MAX` (260) so tiles show the full string. Update the one test that hardcodes the old plan description. Rely on normal suite provisioning for user machines.

Trade-off (against the intent's constraints):
- **Pros:** Smallest blast radius; no extension API change; identical copy for Actions UI and CLI skill metadata; meets “rewrite descriptions” literally.
- **Cons:** Agent auto-routing historically used long “Use when / Do NOT” blocks; shorter copy may slightly weaken automatic skill selection when the user never clicks a tile. Skill *bodies* still define full procedure.

### Option B — Split display vs agent description
Approach: Keep long agent-oriented frontmatter (or add `description` + new field / extension map). Teach `capabilityFromSkillFile` or the webview to prefer a short human string for suite skills only.

Trade-off:
- **Pros:** Best of both worlds for routing vs UI.
- **Cons:** New schema or hardcoded map; two sources of truth; larger test surface; overkill for a copy complaint; violates non-goal of avoiding a second description system unless necessary.

### Option C — Frontmatter block scalar with multi-paragraph “user then agent”
Approach: First sentence(s) plain language (what UI sentence-trim shows), remainder agent routing past 260 chars.

Trade-off:
- **Pros:** Preserves agent prose after the cut.
- **Cons:** Host hard-clips at 280 before webview trim (`src/capabilities.ts:168-171`), so agent tail is often *discarded* for disk-loaded skills, not just hidden. Users still only see first sentences. Does not fix “wordy” if first sentences stay jargon-heavy. Worse dual-audience than A if first sentences must carry everything.

## Decision
**Chosen: A**

Rationale against constraints:
- Done-criteria are about what **non-technical users see** on tiles; A addresses the source of that text with minimal risk.
- Existing caps already destroy most of the long agent tails today (all five live strings are 346–710 chars; UI max 260) — so the “routing wall of text” is largely **not displayed and often truncated at the host** already. Replacing with complete plain-language strings that fit the cap is a net UX win and does not make truncation *worse*.
- Non-goals reject building a display override system unless required; A is sufficient.
- Test update is bounded to one fixture (and any golden length assertions).

What the rejected options were better at:
- **B** better if product later proves auto-routing regressions from short copy and wants dual strings.
- **C** better only as a transitional hack if we insisted on keeping full agent prose in the same field *and* raised caps — which we are not doing.

## Shape of the change

1. **Copy rewrite** (canonical): five `description:` lines in `resources/skills/{explore,plan,implement,test,document}/SKILL.md`.
2. **Voice rules for authors:**
   - Lead with *user outcome*, not internal machinery.
   - One or two short sentences; target ≤ ~180 chars, hard max ≤ 260.
   - Allowed plain words: project, plan, steps, check, docs, files, approve.
   - Avoid as primary message: role titles (Business Analyst…), loop names, path dumps (`.grokbit/plans/`), “bounded”, “preflight”, “durable artifacts”, long doc-type laundry lists.
   - Optional second sentence may lightly guide *when* (“when you want…”) without “Do NOT use…” walls.
3. **Proposed copy candidates** (implementer may polish tone; must keep meaning + length):

| Skill | Proposed description (draft) | ~chars |
|---|---|---|
| grokbit-explore | Look around your project and explain what matters — without changing any files. | ~80 |
| grokbit-plan | Work out a clear step-by-step plan you can approve before any code is changed. | ~80 |
| grokbit-implement | Build the approved plan one step at a time, checking each step works before moving on. | ~95 |
| grokbit-test | Check that the change works and nothing else broke — so you know if it is safe to ship. | ~95 |
| grokbit-document | Write clear project docs (like a README or guide) from your code and plans. | ~80 |

4. **Tests:** Update `test/webview-helpers.test.ts` sentence-aware case so it no longer depends on the old multi-sentence plan wall. Prefer a **synthetic** long multi-sentence string (≥260 chars) to lock trim behavior, so future copy edits do not break the trim test again. Assert new suite descriptions (optional length check) stay ≤ `CAPABILITY_ROW_DESCRIPTION_MAX` if easy via reading files; not required if synthetic test covers trim.
5. **No product code change** to caps, capability browser, or provisioning unless a test failure forces a tiny fixture fix.
6. **Ship path:** normal extension rebuild re-provisions suite (version inequality). Until then, only `resources/skills` in the repo has the new text.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Old five frontmatter descriptions | REPLACE | Wordy / technical; exceed display cap | Overwrite `description:` lines; no callers to migrate beyond test fixture |
| Hardcoded plan description in `test/webview-helpers.test.ts` | REPLACE | Coupled to old production string | Replace with synthetic long string for trim behavior *or* new production string + adjusted expectations |
| Agent “Use when / Do NOT” walls in frontmatter | REPLACE (in frontmatter) | Crowded tiles; mostly truncated already | Full procedure remains in skill body; no second field |
| Display-override API (Option B) | LEAVE | Out of scope; Option A chosen | — |
| Cap constants / trim algorithm | LEAVE | Still correct; new copy respects them | — |
| Suite README pipeline prose | LEAVE | Not the Actions tile surface | Optional later doc pass |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Description still >260 after rewrite | Trim still applies; treat as failed done-criterion — shorten further |
| Home-tier skills not re-provisioned | User still sees old copy until extension version bump re-copies; document in notes / rebuild |
| Agent auto-selects wrong skill | User can still click tile or type `/grokbit-*`; skill body unchanged; monitor; escalate to Option B only if real reports |
| Empty description | Falls back to first body paragraph (`capabilityFromSkillFile`) — avoid empty YAML |
| Concurrent edit of SKILL body | Only touch description line to minimize merge noise |

## Migration
Schema change: no  
Reversible: yes — restore previous YAML strings from git  
Existing rows: N/A (not a DB)  
Mixed-version window: installed extension may show old copy until rebuild/re-provision

## New dependencies
None.
