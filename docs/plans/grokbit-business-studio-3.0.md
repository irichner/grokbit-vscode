# Grokbit Business Studio — roadmap to **3.0.0**

| Field | Value |
|-------|--------|
| **Status** | Active — durable SoT for epic Status (**E1 + E2 + E4 shipped** for 3.0.0 bar) |
| **Source vision sketch** | [docs/plans/Grokbit-ui-2.0.0](Grokbit-ui-2.0.0) (historical); product plan [Grokbit-ui-3.0.0](Grokbit-ui-3.0.0) |
| **Prior cold review** | [docs/plans/grokbit-business-studio-2x.review.md](grokbit-business-studio-2x.review.md) (pass 1 on 2.x framing; findings incorporated here) |
| **Architecture** | **Thin-client, chat-first** — keep ACP + `media/chat.js` / launcher; no React / Tailwind / React Flow rewrite for 3.0.0 |
| **This document** | Executable **roadmap** (epics, non-goals, release bar, lifecycle). **Does not authorize E1+ product code.** Each epic needs a dedicated feature plan (bar = [business-documents.md](business-documents.md) rigor) before implement. |

---

## Context

The sketch [Grokbit-ui-2.0.0](Grokbit-ui-2.0.0) labels itself “Version 2.0.0,” but **product 2.0.0 already shipped** (2026-07-07: Grokbit rebrand + native session tabs). The package has continued on the **2.x** line (rebuild patch bumps). The Studio ideas in that sketch are therefore the **3.0.0 vision**, not a rewrite of shipped 2.0.0 history.

| Vision sketch (file name / body) | Reality / this roadmap |
|----------------------------------|------------------------|
| “Version 2.0.0” ships whole Studio | **3.0.0** is the Studio major; 2.0.0 history stays as rebrand + tabs |
| Extension id `xai.grokbit`, React + Tailwind + shadcn | Stay `grokbit.grokbit`, vanilla webview |
| `vscode.tasks` + bundled Office npm engines | Thin ACP + CLI skills (`/docx`, `/pptx`, `/xlsx`, `/imagine`) |
| Five always-visible sidebar tabs | Launcher + chat tabs + lightweight popovers (3.0 chat-first) |
| React Flow workflows + n8n/Zapier export | **Not** in 3.0.0 bar; post-3.0 research / ADR (E6) |

**Goal of this file:** map sketch ideas → phased epics (or explicit non-goals), keep thin-client architecture, define a falsifiable **3.0.0 release bar**, and gate all product work behind per-epic feature plans.

---

## Versioning model

| Line | Meaning |
|------|---------|
| **2.x** (current) | Shipped product: rebrand, tabs, document cards, launcher polish, engineering backlog (`@`-mention, test-electron, …). Continues until 3.0.0 is cut. |
| **3.0.0** | **Business Studio major** — ships when the **3.0.0 release bar** (below) is met; user-initiated version bump + changelog + tag/release per `CLAUDE.md`. |
| **Pre-3.0 epic ships** | May land on 2.x as incremental features *or* hold for the 3.0.0 cut — **product choice per epic**, recorded in **Status** below. Epic IDs remain the planning keys either way. |
| **Rebuild policy** | Unchanged: local rebuild still **patch**-bumps `package.json`. That does **not** rename 2.x → 3.0.0. Only an explicit major bump does. |

Do **not** use marketing version hints (`~2.1` / `~2.2`) as roadmap gates — they desync from rebuild-driven patch bumps. **Epic IDs (E0–E6) are the stable keys.**

### 3.0.0 release bar (falsifiable)

**3.0.0 may be tagged only when all of the following are true** (or waived in `docs/waivers/`):

1. **E1** task quick-actions shipped (welcome/empty-session task seeds; insert policy; tests).
2. **E2** workspace documents browser shipped (list + open/attach/seed; caps + empty state).
3. **E4** template gallery v1 shipped (~12–15 templates; search; Use → seed, no auto-send).
4. README / `CLAUDE.md` describe Studio surfaces honestly (thin client, skills, not an Office suite).
5. `npm test` green; no open gate-blocking bugs for those epics.

| Stretch (nice for 3.0.0, **not** required for the bar) | Explicitly **not** required for 3.0.0 |
|--------------------------------------------------------|----------------------------------------|
| E3 media gallery | E6 React Flow / visual canvas |
| E5 conversational-workflow research note | Live Office preview |
| Context-menu “Send to Grokbit” | Enterprise blue/white theme skin |
| Connected-style status | 50+ templates in one ship; five always-visible sidebar tabs; bundled Office engines |

---

## Architecture decision (thin-client, chat-first)

Grokbit remains a **thin ACP client** over `grok agent stdio`. Document generation, media, and agent tools live in the **CLI / skills**; the extension owns discovery, chat UX, cards, chips, plan gate, and session tabs.

**Why not the sketch’s React rewrite for 3.0.0**

- Shipped 2.x already delivers multi-tab chat, launcher, document cards, media, plan mode — rebuilding in React/Tailwind/shadcn would reset test surface and break the pure-module + happy-dom strategy without a user-facing requirement.
- CLI skills (`/docx`, `/pptx`, `/xlsx`, `/imagine`) already produce real files; bundling Office engines in the extension duplicates that stack.
- Chat-first + popovers matches how power users already work; five always-visible sidebar tabs fight VS Code density and our launcher design.

**Modules to extend (not replace)** for Studio epics:

| Module | Role |
|--------|------|
| `media/webview-helpers.js` | Pure catalogs (`welcomeStarters`, `businessDocTypeStarters`, future task/template catalogs) |
| `media/chat.js` / `media/chat.css` | Welcome, composer seed, cards, galleries, banners |
| `media/launcher.js` | Launcher list + doc-type row (E1 v1 does **not** add a task row here) |
| `src/sidebar.ts` | Host messages, `newTab({ composerSeed })`, `pendingComposerSeed`, list/fs helpers |
| `src/session.ts` | `pendingComposerSeed` and related session bag fields |
| `src/acp-dispatch.ts` | Path classify/extract (already for document cards); reuse patterns for browsers |
| `test/*` | Pure + DOM (happy-dom) — grok-free floor |

---

## Non-goals

### Architecture / process

- **Not** rewriting 2.0.0 history or claiming Marketplace 2.0.0 was the Studio.
- **Not** React / Tailwind / shadcn / React Flow for the 3.0.0 bar.
- **Not** bundling `docx` / `exceljs` / `pptxgenjs` / `pdf-lib` (or similar) in the extension.
- **Not** an in-webview WYSIWYG Office suite or live Office preview engine.
- **Not** mandatory `.grokbit/` storage fighting `~/.grok/sessions`.
- **Not** shipping all vision tabs as always-visible sidebar chrome.
- **Not** Marketplace publish as part of maintaining this roadmap.
- **Not** E1+ product code authorized by **this** document alone.

### Vision disposition (3.0.0)

| Vision idea (from sketch) | Disposition for 3.0.0 |
|---------------------------|------------------------|
| Five always-visible sidebar tabs | **Non-goal** — launcher + chat + popovers |
| Enterprise blue/white skin | **Non-goal** — `--vscode-*` tokens only |
| Live Office preview pane | **Non-goal** — card + OS open |
| Output version history | **Post-3.0** candidate |
| Status “Grokbit • Connected” | **Stretch / post-3.0** — not release bar |
| Right-click “Send to Grokbit Chat” | **Stretch** — small epic, not bar |
| 50+ templates one ship | **Non-goal** — E4 starts ~12–15 |
| In-extension Office engines / tasks backend | **Non-goal** |
| React Flow + n8n/Zapier UI | **E6 / post-3.0 + ADR** |

---

## Epic map

| Epic | Role vs 3.0.0 | Thin-client shape | Status |
|------|---------------|-------------------|--------|
| **E0** | Foundation (already in **2.x**) | Tabs, launcher, doc cards, office format starters | **Shipped** |
| **E1** | **In 3.0.0 bar** | Task quick-actions on welcome / empty session only | **Shipped** — [business-quick-actions.md](business-quick-actions.md) |
| **E2** | **In 3.0.0 bar** | Workspace business-doc browser | **Shipped** — [workspace-documents-browser.md](workspace-documents-browser.md) |
| **E3** | Stretch | Media gallery + “use in document” seed | **Planned** (stretch) — stub; full AC in feature plan before implement |
| **E4** | **In 3.0.0 bar** | Template gallery ~12–15 | **Shipped** — [template-gallery.md](template-gallery.md) |
| **E5** | Stretch / research | Conversational workflows only | **Deferred research** — stub; full AC in research/feature note before implement |
| **E6** | **Post-3.0** | Visual canvas (React Flow, …) | **Out of 3.0.0** — ADR required before any implement |

**Lifecycle / single source of truth:** when an epic ships, is deferred, or is waived, update the **Status** column (and any epic section header) **in this file**. Session plans and the raw sketch are not authoritative for Status. Feature plans link here; they do not fork Status.

---

## E0 — Shipped foundation (2.x)

**Status:** Shipped (product 2.x)

Already landed and available as the base for Studio work:

- Multi-session **native editor tabs** + activity-bar **launcher** (history cap 7, rename/delete, signed-out / missing-CLI states)
- **Business document result cards** + pure extraction helpers (`businessDocKindForPath`, `extractBusinessDocumentPaths` in `acp-dispatch.ts`)
- Launcher **office type starters** (`businessDocTypeStarters` → `Create <type>: ` via seed)
- Chat **welcome starters** (`welcomeStarters`: explain / write / plan / document / imagine / voice, etc.)
- Image / video generation cards; file chips; plan mode + primer; status-bar HUD
- **Seed plumbing (real names — use these, never invent `seedComposerFromLauncher`):**
  - `Session.pendingComposerSeed` (`src/session.ts`)
  - Host → webview `{ type: "seedComposer", text }`
  - `newTab({ composerSeed })` / `postTo(session, { type: "seedComposer", text })` in `src/sidebar.ts`
  - Webview handler for `seedComposer` in `media/chat.js`

---

## E1 — Task quick-actions

**Status:** **Shipped** — feature plan [business-quick-actions.md](business-quick-actions.md).

**Role:** In **3.0.0 release bar**. Candidate first Studio code epic after its feature plan is approved.

### Goal

On the **welcome / empty-session** surface only, offer **task-oriented** quick actions (e.g. invoice, receipt, weekly report, pitch, approval workflow) that **seed the composer** with a ready-to-edit prompt so non-coders start a real business deliverable without hunting slash skills.

### Differentiation (must not re-list existing catalogs)

| Existing | E1 must **not** |
|----------|-----------------|
| Launcher `businessDocTypeStarters` (Word / Excel / PowerPoint / PDF / CSV / Markdown) | Re-list the six **format** icons in chat |
| Chat `welcomeStarters` (explain, write, plan, document, imagine, voice, …) | Replace or crowd out those general starters |
| Free-form chat + CLI skills | Chips that only say “create a doc” with no task intent |

**Intent of E1:** *task* seeds (invoice, receipt, weekly report, pitch, approval workflow) — not format icons and not a second “create document” mega-card.

### Surface (frozen for E1 v1)

- **Welcome / empty-session only** (same empty-state region as welcome starters — layout detail in feature plan).
- **No launcher task row in E1 v1** (launcher keeps format icons only; avoids dual-catalog sprawl and density regression).

### Insert policy (frozen)

| Composer state | Behavior |
|----------------|----------|
| Empty or whitespace-only | **Set** composer to the seed text |
| Non-empty | **Append** seed on a **new line** |
| Any | **Never auto-send** |

### Seed plumbing (reuse only — verified names)

- Pattern: `businessDocTypeStarters` catalog style in `webview-helpers.js`
- `Session.pendingComposerSeed`
- Message `{ type: "seedComposer", text }`
- `newTab({ composerSeed })` when opening a tab with a seed
- **Do not invent** `seedComposerFromLauncher` or other fictional symbols

### E1 acceptance criteria (for future `business-quick-actions.md` — outline here)

| # | Criterion | How verified (feature plan will lock tests) |
|---|-----------|-----------------------------------------------|
| A1 | Catalog has **≥5** task actions with frozen ids + seed strings (invoice, receipt, weekly report, pitch, approval — or equivalent set named in feature plan) | Pure unit test on catalog |
| A2 | Actions appear on **welcome / empty session only**; not mid-conversation chrome; **no launcher task row** in v1 | DOM + launcher regression |
| A3 | Insert policy: empty → set; non-empty → append newline; **never auto-send** | Unit + DOM positive/negative |
| A4 | Differentiation: no duplicate of the six format `businessDocTypeStarters` icons in chat; does not remove core `welcomeStarters` | Catalog tests + DOM |
| A5 | Seeds are editable drafts only; user must press Send | DOM: no `send` side effect on chip click |
| A6 | a11y: focusable controls, labels; styles use `--vscode-*` only | Manual + UI standards |
| A7 | Layout: no horizontal overflow at ~280px narrow panel | CSS / visual pass |
| A8 | `npm test` green; `tsc -p . --noEmit` clean | CI floor |
| A9 | README / discovery copy does not claim an Office suite | Doc checklist |

**Full AC, frozen seed strings, risks, and test file names** live only in the E1 feature plan — this outline is the contract that plan must meet or exceed.

---

## E2 — Workspace documents browser

**Status:** **Shipped** — feature plan [workspace-documents-browser.md](workspace-documents-browser.md).

### Goal

Let users **find and act on business documents already in the workspace** (list + open / attach / seed composer) without leaving Grokbit chat/launcher surfaces.

### Non-goals

- Live Office / PDF preview in the webview
- Full VS Code Explorer replacement
- Recursive unbounded scans without caps
- Bundled document parsers

### Stub success criteria (≥2; expand in feature plan)

1. User can open a capped list of workspace business files (by known extensions aligned with document cards) and **Open** or **Reveal** a selected file.
2. User can **attach as chip** and/or **seed composer** with a path reference for a selected file; empty-state messaging when none found; list is capped (exact N in feature plan).

**Full AC in feature plan before implement.**

---

## E3 — Media gallery + “use in document” (stretch)

**Status:** Planned (stretch — **not** required for 3.0.0 bar). **Full AC in a dedicated feature plan before implement.**

### Goal

Surface recently generated or workspace media and offer a one-click **“use in document”** (or equivalent) that **seeds** a prompt to insert/reference the image in a business deliverable.

### Non-goals

- Full “Media Lab” always-visible sidebar tab
- Replacing `/imagine` / video gen pipelines
- In-webview image editor

### Stub success criteria (≥2; expand in feature plan)

1. User can browse a capped set of generated/workspace media paths relevant to the session or workspace.
2. Choosing “use in document” (or equivalent) **seeds** the composer (no auto-send) with a prompt that references the media path for insertion into a doc workflow.

**Full AC in feature plan before implement.**

---

## E4 — Template gallery v1

**Status:** **Shipped** — feature plan [template-gallery.md](template-gallery.md).

### Goal

Ship a **small** gallery of business templates (~**12–15**, not 50+) with search; **Use** seeds the composer with a fill-ready prompt (skills still generate files).

### Non-goals

- 50+ templates in the first ship
- In-extension template engine / Office generation
- Auto-send on Use
- Always-visible fifth sidebar “Templates” tab as mandatory chrome

### Stub success criteria (≥2; expand in feature plan)

1. Gallery exposes ~12–15 templates with searchable titles/tags; empty search shows full set or clear empty state.
2. **Use** fills composer via seed plumbing only (empty → set / non-empty → append policy consistent with E1 unless feature plan documents a deliberate exception); **never auto-send**.

**Full AC in feature plan before implement.**

---

## E5 — Conversational workflows (research / stretch)

**Status:** Deferred research (stretch — **not** required for 3.0.0 bar). **Full AC in a research note or feature plan before implement.**

### Goal

Support **conversational** multi-step business workflows (e.g. approval, reporting checklist) as guided chat seeds or lightweight multi-turn prompts — **without** a visual canvas.

### Non-goals

- React Flow / node canvas
- n8n / Zapier export UI
- Background workflow engine inside the extension

### Stub success criteria (≥2; expand in research/feature note)

1. Written **go/no-go** research note: which workflow types are pure chat seeds vs need host state; decision recorded under this epic’s Status.
2. If go: at least one end-to-end conversational flow (seed → multi-turn → deliverable card) with tests; if no-go: Status set to **Won’t do for 3.x** with rationale.

**Full AC in research/feature note before implement.**

---

## E6 — Visual workflow canvas (post-3.0 + ADR)

**Status:** **Partial / superseded for Grokbit Create path** — ADR [0004](../adr/0004-workflow-builder-canvas.md) accepted (vanilla pipeline canvas, not React Flow). Product surface: `.grokbit/plans/user-workflows-display-builder/` Workflow Builder (form + phase/agent canvas → Craft with AI). Full Business Studio React Flow / export remains deferred.

### Goal (future)

Evaluate a visual workflow builder (e.g. React Flow) and optional export integrations only if chat-first Studio (E1–E5) proves insufficient.

### Non-goals for 3.0.0

- React Flow / freeform graph **as a Business Studio dependency** (Grokbit Workflows builder uses zero-dep vanilla per ADR 0004)
- Replacing chat-first architecture “because the sketch said so”
- Bundled automation runtime

### Gate

- Architecture Decision Record in `docs/` (or project ADR location) covering: dependency cost, webview CSP, test strategy, coexistence with thin client. **Done for v1:** `docs/adr/0004-workflow-builder-canvas.md`.
- Explicit product approval to open a post-3.0 epic after 3.0.0 ships (or waiver) — **partial waiver via user-workflows-display-builder plan approval** for the Create Workflow builder only.

---

## Feature-plan bar (mandatory for E1+)

This roadmap **does not authorize** product TypeScript/JS/CSS work for E1–E6.

Before implement of any epic:

1. Write `docs/plans/<epic-name>.md` with the rigor of [business-documents.md](business-documents.md): goal, falsifiable AC table, non-goals, assumptions, risks/blast radius, surfaces, phases, testing strategy.
2. Pass plan review / user approval per project gates.
3. Update this file’s epic **Status** when work starts / ships / is deferred.

**E1 blocked until:** `docs/plans/business-quick-actions.md` exists and is approved.

---

## Sequencing

```
WP-Roadmap (this file — done when Status Active + links live)
  → per-epic feature plans (E1 candidate first, or product reorders)
  → implement on 2.x or hold for major cut
  → when E1 + E2 + E4 (+ docs honesty + green tests) → user cuts 3.0.0
  ↛ E6 without ADR / post-3.0
```

Engineering backlog items in `CLAUDE.md` § What’s next (`@vscode/test-electron`, `@`-mention, …) remain **parallel** — this roadmap does not outrank them unless product reorders that list.

---

## Risks (roadmap-level)

| Risk | Mitigation |
|------|------------|
| Agents still implement “2.0 Studio” from sketch filename | Sketch header annotation; durable path `…-3.0.md`; `CLAUDE.md` link |
| Premature major bump before bar | Release bar checklist; user-only major bump |
| E1 duplicates existing starters | Differentiation table; no launcher tasks in E1 v1 |
| React rewrite sneaks into 3.0 | Architecture non-goals; E6 post-3.0 + ADR |
| Pre-3.0 epics on 2.x confuse “are we 3 yet?” | Status in this file; changelog language |
| Discovery fragmentation (three catalogs) | E1 differentiation + welcome-only surface freeze |
| Seed quality / missing CLI skills | Feature plans must not promise engines; honest README |
| False symbol names (`seedComposerFromLauncher`) | Real names only: `pendingComposerSeed`, `seedComposer`, `newTab({ composerSeed })` |

---

## Testing strategy (roadmap vs epics)

| Layer | What |
|-------|------|
| This roadmap (WP-Roadmap) | Docs only — checklist below; no product tests |
| Future E1+ | Per feature plan; grok-free `npm test`; **NO COVERAGE TOOL** → existing waiver `docs/waivers/coverage-no-tool.md` |
| Pre-release | `npm run test:live` per `CLAUDE.md` when shipping user-facing Studio cuts |

---

## Observable verification (WP-Roadmap complete)

- [x] This file exists with **3.0.0** bar, E0–E6, vision disposition, lifecycle SoT.
- [x] Sketch labeled historical; **target major 3.0.0**.
- [x] E1 blocked for code; differentiation + insert policy + real seed names present.
- [x] E2–E5 goal + non-goals + ≥2 stub success bullets; E6 post-3.0 + ADR.
- [x] `CLAUDE.md` What’s next links this roadmap as **3.0.0 Business Studio**.
- [x] No claim that shipped 2.0.0 = Studio complete.
- [x] Cold-review gaps from 2.x pass 1 reflected (AC policy, drop-list, E1 differentiation, insert freeze, seed names, versioning, lifecycle).

---

## Cold-review findings incorporated

From [grokbit-business-studio-2x.review.md](grokbit-business-studio-2x.review.md) (and session plan revise):

1. **A3 policy** — E1 full outline AC; E2–E5 stubs only; not “every epic fully AC’d here.”
2. **Vision drop-list** — explicit disposition table (tabs, theme, preview, version history, Connected, context menu, 50+, engines, React Flow).
3. **E1 differentiation** vs `businessDocTypeStarters` / `welcomeStarters`.
4. **Insert policy frozen** (set / append / never auto-send).
5. **Real seed plumbing names** — no `seedComposerFromLauncher`.
6. **Versioning** — epic IDs stable; rebuild patch ≠ major; **3.0.0 release bar** instead of `~2.1` hints.
7. **Lifecycle** — this file is SoT for epic Status.
8. **Reframe** — target major **3.0.0**, not a second “2.x Studio” durable path.
