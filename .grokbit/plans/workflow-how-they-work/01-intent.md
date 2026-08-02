# Intent — Detailed “how they work” for each Grokbit workflow

## Problem
The five Grokbit workflows (Explore → Plan → Implement → Test → Document) already have short plain-language tile blurbs and one-line README table copy. Users who open Actions or the docs still lack a clear, per-workflow explanation of **how each step actually works** at full technical depth (roles, loops, caps, artifacts, gates) without hunting skill source files or the maintainer suite README alone.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] For **each** of the five workflows (Explore, Plan, Implement, Test, Document), a reader can find a dedicated full-technical explanation of how that step works: roles, pipeline/loops, caps and cap behavior, artifacts, human gates, and relation to the next step.
- [ ] That content is available in **product UI** (Grokbit Actions surface) without opening skill files on disk by hand.
- [ ] That content is available in **docs** (README and/or a durable user/maintainer-facing doc path under the repo) without opening skill files as the only source.
- [ ] Depth matches suite-README technical level (roles, loops, caps) — not only one-line benefit blurbs — while remaining accurate to the current skill bodies.
- [ ] Short Actions tile blurbs (≤260 chars) still work for the default compact grid; full detail is a deliberate second layer (expand/detail/link), not forced into the 260-char clamp.
- [ ] Clicking a tile still seeds the same `/grokbit-*` slash form; skill names, order, and provisioning mechanics unchanged.
- [ ] After ship, `npm test` stays green for any code/copy paths touched.

## Non-goals
- Rewriting skill hard rules, loops, role prompts, or internal templates as a behavioral change (copy/docs/UI surfacing only, unless a display-only field is required).
- Changing skill names, order, slash invoke forms, or provisioning mechanics.
- Documenting Grok Build **Rhai** workflows (`create-workflow` / `.grok/workflows`).
- Localizing into other languages.
- Replacing the short tile descriptions with multi-paragraph primary copy (that already failed UX once — clip/jargon).
- Full redesign of Grokbit Actions chrome beyond what’s needed to surface detail.

## Constraints
- Stack: bundled suite under `resources/skills/`; Actions via host discovery + webview; description display caps (~260 webview / ~280 host) unless a new detail field/path is introduced.
- Must not break: invocable `/grokbit-*` seeds, suite membership, capability discovery, `npm test` floor.
- Prior related work: plain-language descriptions (implement done); title/color polish; Actions tiles; suite multi-dimensional review.

## Assumptions
- Confirmed: workflows = five Grokbit Actions suite skills only.
- Confirmed: surfaces = **both UI and docs**.
- Confirmed: depth = **full technical** (roles, loops, caps), suite-README class.
- Inferred: short Actions blurbs stay as the compact primary line; full technical detail is secondary (expand/doc), not stuffed into `description:`.
- Inferred: canonical technical truth remains skill bodies + suite README; product/docs should **derive or link**, not invent a third divergent procedure.
- Handoff from prior session (`changed-files-dedupe`) is unrelated.

## Questions asked
1. Which workflows? → **A** Five Grokbit Actions
2. Where details live? → **C** Both UI and docs
3. How deep? → **C** Full technical (roles, loops, caps)
