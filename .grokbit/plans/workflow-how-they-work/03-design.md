# Design — Detailed “how they work” for each Grokbit workflow

## Options considered

### Option A — Docs rewrite + “Open skill” only
Approach: Write a full-technical `docs/grokbit-workflows.md` from the suite skill bodies and loop tables. In Actions, add a secondary control that `openFile`s the existing provisioned `SKILL.md` (`CapabilityItem.path`). Product README links to the new doc.

Trade-off (against constraints): **Minimal code**, reuses `openFile` (`sidebar.ts:2790`, `chat.js:800-801`). Full technical is available in the editor and on GitHub. **Weak product UX** — skill bodies are agent procedures, not framed guides; users get a raw multi-thousand-line skill. Docs path is **not in the vsix** (`.vscodeignore:33`), so installed-extension users only get the editor open, not an in-repo doc unless they clone. Depth C is *present* but poorly packaged.

### Option B — Curated guide files in the suite bundle + dual surface (chosen shape)
Approach: Add one human-facing full-technical guide per workflow under the **shipped** suite tree, e.g. `resources/skills/<name>/references/how-it-works.md`, covering roles, pipeline, loops/caps, artifacts, gates, next step. **Product how-it-works SoT** is those five files. Host exposes them in Actions via **in-panel Details** (lazy-loaded markdown body) plus optional open-in-editor. Durable repo doc `docs/grokbit-workflows.md` is overview + the same per-skill bodies (authored together, provenance header). README links to the docs file.

Trade-off: **More writing and a host/webview change**, but content ships in the vsix (`resources/skills` not excluded), works offline for installed users, and stays structured for depth C without blowing the 260-char tile description. Drift risk vs skill bodies is real — mitigated by “derived from SKILL.md / loops.md” headers and a verify task that checks each guide file exists and contains required section headings.

### Option C — Host injects assembled markdown into the capabilities payload
Approach: At `listCapabilities` time, read each suite skill’s `SKILL.md` + `references/loops.md` and post `detailMarkdown` (capped) on each item; webview renders an expandable panel with chat markdown.

Trade-off: Always “fresh” from agent sources, **no separate guide files**. Payload/size and scan cost jump; head read is only 8KB today (`CAPABILITY_HEAD_BYTES`) so full assembly needs new larger reads; agent-facing prose still lands in the UI; harder to review content in PR diffs as discrete docs.

## Decision
**Chosen: B**

Rationale against constraints:
- Depth C needs room; tile `description` must stay short (intent + prior plan).
- UI must work for **installed** extensions → content under `resources/skills` (ships), not only `docs/`.
- Docs surface required (answer 2C) → `docs/grokbit-workflows.md` + README link for GitHub.
- Standing renderer rule: no kind-string branch — use a host-supplied `detailPath` (or `action: "open-detail"`) field so `buildCapabilityRow` stays data-driven.
- In-panel Details is required for the Actions-surface done-criterion (Loop 3); open-in-editor is optional secondary.
- Editorial SoT for product how-it-works: the five suite `how-it-works.md` files; docs aggregate is authored with them.

What rejected options were better at:
- **A** is cheaper and faster to ship if content quality of raw SKILL.md were acceptable.
- **C** minimizes dual-write drift if we trusted auto-assembly of agent prose as product copy.

## Shape of the change

### Content model (editorial SoT)
For each of `SUITE_SKILL_NAMES` (`src/skill-suite.ts:47-53`):

```
resources/skills/<name>/references/how-it-works.md
```

**These five files are the product how-it-works SoT.** Agent procedure remains each skill’s `SKILL.md`. Suite `README.md` stays install/maintainer map and **links** to the five guides.

Required H2 sections (minimum — full technical; verify script checks headings exist):
1. `## Purpose` — when to run  
2. `## Pipeline` — steps/diagram from that skill’s SKILL.md  
3. `## Roles` — from `references/roles.md`  
4. `## Loops and caps` — tables from `references/loops.md`  
5. `## Cap behavior` — record vs revert vs block for this phase  
6. `## Artifacts` — written / read paths  
7. `## Human gates`  
8. `## Next step`  
9. `## Provenance` — “Derived from SKILL.md + references/; agent procedure remains SKILL.md”

Document’s guide must include registry/types/verification at technical depth (not a thin stub).

### Host
1. Pure helper (e.g. in `skill-suite.ts` or small pure module):  
   `suiteHowItWorksPath(extensionRoot: string, skillName: string): string`  
   → `path.join(extensionRoot, "resources", "skills", skillName, "references", "how-it-works.md")`.
2. After `applySuiteKind` in `listCapabilities` (`sidebar.ts:3258-3260`), for each suite skill name, if `fs.existsSync(suiteHowItWorksPath(extensionPath, name))`, set optional **`hasDetail: true`** (or `detailAvailable`) on the wire item — **not** the multi-KB body.
3. New message pair (names exact at implement time, suggested):
   - Webview → host: `{ type: "getCapabilityDetail", name: string }`
   - Host → webview: `{ type: "capabilityDetail", name, markdown, path? }` or `{ error }`  
   Host reads the guide from **extension bundle** via `extensionPath` (same root provision uses for the suite source), bound read (e.g. 64KB max), never from arbitrary user paths except that resolved suite path.
4. Optional: include `detailPath` so webview can offer “Open in editor” via existing `openFile`.

Do **not** put multi-KB bodies in every `listCapabilities` response.

### Webview
- `capabilityGroupsView` passes through `hasDetail` / `detailPath` when present (data-driven; **no** kind-string branch in `buildCapabilityRow`).
- `buildCapabilityRow`: if `hasDetail`, render **Details** control:
  - Click → stopPropagation → request `getCapabilityDetail` → show **in-panel** expanded region (row body or panel slide-over) with scroll (`max-height` + overflow).
  - Render markdown via the **same safe path as agent messages** if available; else plain `textContent` with newlines. **Never** assign untrusted detail string to `innerHTML` directly.
  - Optional “Open in editor” posts `openFile` with `detailPath`.
- Primary row click remains invoke when `action === "invoke"`.
- Locked/priming: no Details handler (same as row invoke).
- CSS: Details control + detail region; no `@media`.

### Docs
- New `docs/grokbit-workflows.md`: pipeline overview + one major section per workflow **containing the same technical body** as each `how-it-works.md` (authored together; each section starts with source path header).
- `README.md` Grokbit Actions block: keep one-line table; add link to `docs/grokbit-workflows.md`.
- `docs/WORKFLOW.md`: **do not delete**. Short top banner: agentic Claude **template** loop; Grokbit suite → `docs/grokbit-workflows.md`.
- `resources/skills/README.md`: cross-link to each `references/how-it-works.md`.

### Non-changes
- Frontmatter `description:` one-liners stay.
- Skill hard rules / agent procedure bodies not rewritten for behavior.
- Provisioning / suite membership unchanged (new files under skill dirs copy with recursive provision).

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Short tile `description:` lines | LEAVE | Compact primary UX; depth C is second layer | Do not expand past 260 chars |
| README Actions one-liners | COEXIST | One-liners stay for scan; full doc linked | README gains link + optional one-sentence pointer |
| `docs/WORKFLOW.md` (template) | LEAVE (+ pointer) | Still SoT for agentic-template USER_GUIDE | Banner note pointing to `docs/grokbit-workflows.md` for Grokbit suite |
| `docs/USER_GUIDE.md` | LEAVE | Different product surface | No rewrite of body |
| `resources/skills/README.md` | COEXIST | Maintainer/install map remains | Cross-link to how-it-works files |
| Skill body procedures | LEAVE | Agent SoT | Guides cite them; do not replace SKILL.md |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Missing `how-it-works.md` for one skill | `hasDetail` false; no Details control; plan verify fails until file exists |
| Read fails / oversize | `capabilityDetail` error string in panel; no crash |
| User clicks Details while locked/priming | No handler |
| XSS / hostile markdown in guide | Safe render path only; suite guides are first-party but still not `innerHTML` raw |
| Detail expand in narrow popover | Scrollable max-height region |

## Migration
Schema change: no  
Reversible: yes (delete guide files + revert host/webview fields)  
Existing rows: n/a  
Mixed-version: old extension ignores unknown `detailPath` if any client lag; new webview without host field simply omits Details

## New dependencies
None.
