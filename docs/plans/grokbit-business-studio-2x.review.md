> **Superseded path:** durable Studio roadmap is now [`docs/plans/grokbit-business-studio-3.0.md`](grokbit-business-studio-3.0.md) (target major **3.0.0**). This file remains the historical cold-review of the 2.x-framed plan.

# Cold review of Grokbit Business Studio roadmap (2.x)

**Reviewer:** Cold review (adversarial, fresh read against codebase)  
**Date:** 2026-07-15  
**Plan version reviewed:** session `plan.md` — “Plan: Grokbit Business Studio roadmap (2.x)” (Status still “Draft — awaiting plan approval”)  
**Source sketch:** `docs/plans/Grokbit-ui-2.0.0`  
**Review schema:** cold-review skill + `.grok/docs/plan-quality-standards.md` hard gates 1–8

---

# Review Report
- Target: plan
- Paths: session plan.md (Business Studio 2.x); intended durable `docs/plans/grokbit-business-studio-2x.md` (not written yet)
- Pass: 1
- Overall: **Request Changes**
- Hard gates:
  - 1 Goal + acceptance: **WEAK / gap** — A1–A2, A4–A6 OK for docs package; **A3 overclaims** (“each phase has falsifiable success criteria”) while §4 admits E2–E6 are “summary only” with no AC tables
  - 2 Non-goals: **WEAK / gap** — architecture non-goals strong; vision items dropped without explicit non-goal (context menu “Send to Grokbit”, output version history, live preview, “Connected” status bar, enterprise blue theme as product skin)
  - 3 Risk / blast radius: **PASS** for WP-Roadmap (docs only); **WEAK** for E1 (no risk for discovery fragmentation vs existing starters)
  - 4 Ordered steps + per-step verification: **PASS** for WP-Roadmap steps 1–3; **N/A incomplete** for E1 (not this package’s execute bar, but plan still mixes them)
  - 5 Testing strategy: **PASS** for docs (N/A); E1 notes “define policy” for insert — **gap** if E1 is treated as implementable from this plan alone
  - 6 Failure modes: **WEAK** — misses seed quality, skill-not-installed, dual catalog sprawl, version-hint vs rebuild patch churn
  - 7 Observable verification: **PASS** for docs checklist; “tightly enough for follow-up implement” is soft
  - 8 UI/UX design: **N/A** for WP-Roadmap (docs only); E1 UI section present but **surface placement unresolved** (“prefer … final UX in E1 feature plan”) — must not pretend E1 is implement-ready
- Required Changes:
  - **[gap]** Soften or fulfill **A3**: either require the durable roadmap to include a minimal AC stub per epic E1–E5, or change A3 to “E1 full AC; E2–E5 goal + non-goal + deferred AC until feature plan.”
  - **[gap]** Add **vision drop-list as non-goals** (or map them): context menu, version history, live Office preview, “Grokbit • Connected” status, enterprise theme skin, 50+ templates in one ship, five always-visible sidebar tabs.
  - **[gap]** Document **product differentiation** of E1 vs shipped `businessDocTypeStarters` (launcher) + `welcomeStarters` (chat) — without this E1 is likely redundant chips.
  - **[gap]** Freeze E1 **insert policy** (replace empty / append / replace all) in the durable roadmap or mark “blocked until E1 feature plan”; remove “define policy” hand-wave from testing strategy if this plan claims E1 readiness.
  - **[risk]** Fix **false prior-knowledge names**: there is no `seedComposerFromLauncher` symbol — real path is `pendingComposerSeed` + host message `{ type: "seedComposer", text }` + launcher → `newTab({ composerSeed })` / `postTo(..., seedComposer)` in `src/sidebar.ts` / `media/chat.js`.
  - **[risk]** Version hints `~2.1`/`~2.2` will desync from rebuild-driven **patch** bumps (already `2.0.7`). Prefer epic IDs (E1…) as stable; treat numbers as marketing only or say “minor when product chooses,” not roadmap gates.
  - **[gap]** Add **roadmap lifecycle**: who updates epic Status when an epic ships; single source of truth (durable file wins over session plan and raw sketch).
  - **[nit/status]** Plan header still says “Draft — awaiting plan approval” after user approval — update status.
- Test/coverage gaps:
  - WP-Roadmap: none (docs).
  - E1 (if executed from this plan without a feature plan): missing frozen seed strings, insert policy tests, regression that launcher doc-type row still works, no negative for “does not auto-send.”
- Questions:
  - Is E1 still first if it largely duplicates launcher office icons + free-form chat? Would **E4 (small template set)** or **E2 (workspace docs list)** deliver more net-new value?
  - Should CLAUDE.md “What's next” reordering (Business Studio vs `@`-mention vs test-electron) be explicit or left parallel forever?
- Risk if implemented as-is:
  - Durable roadmap copies weak A3 and optional launcher mirror → later agents implement a second chip strip that clutters empty sessions without measurable product gain; sketch `Grokbit-ui-2.0.0` remains more vivid than the roadmap and keeps attracting React/rewrite proposals.
- Next: **revise plan** (and durable roadmap outline) → re-review pass 2 or user accepts residual with waiver → then WP-Roadmap docs write only

---

## Pass 1 follow-up (same day)

Session `plan.md` was **revised** to address Required Changes (A3 policy, vision drop-list, E1 differentiation + insert freeze, real seed symbol names, versioning note, lifecycle, status header, WP-Roadmap-only execute bar). Re-review pass 2 not yet run — durable `docs/plans/grokbit-business-studio-2x.md` still **not written**.

---

## Top three weakest assumptions

1. **“E1 is highest UX leverage / planned first.”**  
   Falsifier: users already discover docs via launcher office icons + natural language; another chip row adds density without conversion.  
   If false: wasted UI surface, delayed E2/E4, and welcome/composer clutter (already listed as risk but not used to challenge priority).

2. **“A3: each phase has falsifiable success criteria” will be true in the durable file** while the plan body only fully specifies E1 and waves E2–E6.  
   Falsifier: durable doc ships with the same summary bullets.  
   If false: roadmap fails its own acceptance and cannot gate later feature plans.

3. **“Optional launcher mirror” is safe optionality.**  
   Falsifier: implementers either ship nothing (orphan chat chips) or stuff the already-dense launcher (doc types + New + history@7 + clear-all).  
   If false: E1 either fails discovery goals or harms launcher usability (recent work deliberately capped history and pinned docs to top).

## Missing failure modes

- **Discovery fragmentation:** three catalogs (`welcomeStarters`, `businessDocTypeStarters`, proposed `businessQuickActions`) with overlapping “create document” intent — no merge/supersede rule.
- **Seed → skill gap:** invoice/receipt/pitch seeds assume `/docx`/`/xlsx`/vision skills + deps exist; no UX for “skill missing” (extension cannot fix CLI skills).
- **Insert policy bugs:** replace-vs-append undefined → wiping user draft mid-type, or double-stacking seeds.
- **Version-hint confusion:** rebuild script bumps patch every install → “ship E1 as 2.1” never matches package version without a deliberate minor bump policy (not documented; conflicts with CLAUDE rebuild = patch +1).
- **Roadmap drift:** session plan, durable `docs/plans/…`, and raw sketch can diverge; no ownership line for Status updates.
- **Vision items silently dropped** (context menu, version history, Connected status) — future “you forgot our 2.0 vision” without an explicit reject.

## Undocumented prior knowledge

- Real seed plumbing: `Session.pendingComposerSeed`, webview `seedComposer` message, launcher click → host open/reuse session (not a function named `seedComposerFromLauncher`).
- Document-type starters **already live only on the launcher** (removed from chat welcome) — E1 chat chips reverse that density decision unless carefully scoped.
- `welcomeStarters` already covers explain / write / plan / imagine / voice — business actions must not fight those cards for the same empty-state real estate.
- Prior approved plan quality bar: `docs/plans/business-documents.md` + `.review.md` used frozen allowlists, open strategy pure helpers, and DOM tests — E1 should mirror that rigor in its own feature plan, not inherit it from a roadmap sketch.
- No `docs/plans/_archive/` comparison available; only `business-documents*` as same-area precedent.

## Verification gaps

- A3 is not currently satisfied by the plan body for E2–E6.
- Done-bar item “E1 specified tightly enough…” is subjective — replace with checklist: catalog ≥5 with frozen example seeds, insert policy one-liner, surface decision (welcome-only | empty-composer | launcher subset), no-auto-send test named.
- Step 1 verify “hard-gate sections present” does not check **content quality** of those sections.
- No check that durable roadmap **does not** reintroduce React/tasks/bundled Office as recommended architecture.

## Scope concerns

- **Two packages in one plan:** WP-Roadmap (docs) vs E1+ (code). Done bar is docs-only; E1 detail invites “implement everything” scope creep after approval.
- **Optional** work (launcher mirror, CLAUDE link) is not acceptance-gated — either in or out of WP-Roadmap / E1.
- Engineering backlog (`@vscode/test-electron`, `@`-mention) said parallel — fine, but Business Studio is not ordered against it; agents may thrash.

## Comparison to prior plans

| Prior (`business-documents`) | This plan |
|------------------------------|-----------|
| Single feature, frozen allowlist, open strategy pure | Multi-epic roadmap + partial E1 |
| Full AC A1–A7 + UI D1–D4 | Full AC only for docs package + E1 sketch |
| Explicit false-positive / binary-open risks | Architecture risks strong; product-UX risks thin |
| Implement next after Approve | Docs next; E1 needs **another** feature plan (stated) but E1 section reads implement-ready |

Intentional: multi-epic roadmap is broader. Oversight: does not meet the same AC rigor for each epic it claims in A3.

## Hard-gate summary (WP-Roadmap only)

If the execute package is **strictly docs**, gates 1–7 can pass **after** Required Changes on A3, non-goal vision drop-list, naming fixes, and lifecycle. Gate 8 = **N/A**.

If anyone treats this plan as **E1 implement authority**, gate 8 and testing fail until surface + insert policy freeze.

## Overall

The plan correctly rejects the vision’s React/Office-engine rewrite and correctly frames 2.0.0 as already shipped — that direction is sound. It is **not** ready to execute as written without revision: acceptance criterion A3 contradicts the body, E1 priority and differentiation from shipped starters are unproven, symbol names are wrong, version hints will lie under the patch-bump rebuild policy, and several vision features disappear without non-goals.  

**Minimum to proceed:** revise for Required Changes (especially A3, vision drop non-goals, E1 vs existing starters, insert policy or “E1 not implement-ready”), update status, then write the durable roadmap **as docs-only**. Do **not** start E1 code from this plan alone — open a dedicated E1 feature plan that matches `business-documents.md` rigor.
