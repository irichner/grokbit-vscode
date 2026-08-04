# Baseline — create-workflow-screen-ux

Captured BEFORE implementation at working tree (dirty main) on 2026-08-03.

Records what the system does TODAY. Not what it should do.

## Captured behaviors

### B1 — Builder form order and fields (T2 baseline)

Path exercised: Open Create Workflow tile → `#workflow-builder` DOM (`test/capabilities.dom.test.ts` + source `media/chat.js:1193–1433`).

Observed:

- Fields order: Goal (required) → Name (optional, kebab) → Save scope segmented Project/User home → Constraints (optional) → Pipeline canvas beside form (flex wrap).
- `validateWorkflowBuilderDraft`: goal required; name optional but if present must be kebab (`test/webview-helpers.test.ts`).
- Focus on open: goal textarea (`media/chat.js:1189–1190`).

Characterization: existing DOM/unit tests assert open builder, goal, Craft seed.

### B2 — Craft with AI seed-only (T3 baseline)

Path exercised: fill goal → Craft with AI (`test/capabilities.dom.test.ts` “seeds composer without auto-send”).

Observed:

- Composer filled with `/create-workflow` brief including goal + pipeline.
- `posted` has **no** `{ type: "send" }`.
- Builder `hidden === true` after Craft.
- Brief documents “seed-only; never auto-sends” in helpers.

### B3 — Workflow detail host path (T1)

Path exercised: source read.

Observed:

- Webview posts `{ type: "getCapabilityDetail", name, detailKind?, path? }` (`media/chat.js:894–897`).
- Host routes `detailKind === "workflow"` → `postWorkflowDetail` requiring `requestedPath` (`src/sidebar.ts:3531–3603`).
- Reply `{ type: "capabilityDetail", name, workflow, path }` or error.
- **No name-only lookup** without path — craft apply needs Path B (`getWorkflowCraftResult` / resolve by name under allowed roots).

## Visual captures

NOT CAPTURED — no headless browser in CI for this extension webview.

## NOT CAPTURED

- Live multi-turn `/create-workflow` against real grok (out of `npm test`).
- Permission card stacking under full-screen builder during craft (will change by design).
