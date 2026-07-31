# Fixture E — seeded design defect

**Sample UI (this template):** `fixtures/agentic-template-acceptance/sample-ui/`  
(`index.html`, `styles.css`, `app.js`) — open `index.html` in a browser; no build step.

Goal: prove the UI design gate catches a real design defect, the same way Fixture B
proves tests + `/review` catch a seeded bug. Run on a throwaway branch only.

## Seeding (pick ONE)

Against **sample-ui** (preferred in this repo) or any real frontend component:

1. Remove the disabled/pending state from the submit button (double-submit; no “Adding…” feedback) — e.g. gut `setSubmitPending` in `app.js`.
2. Replace a design-system token with a hardcoded off-palette value (e.g. set `.btn--primary { background: #00ff41; }` instead of `var(--color-primary)`).
3. Delete the `:focus-visible` rules from `styles.css` on interactive elements.
4. Remove the empty-state branch (`state-empty` / `showState("empty")`) so zero data is a blank panel.

## Run

1. `/implement` accuracy protocol on the branch — UI changed, so the UI verification
   step is required (not skippable).
2. Whoever judges design must `read_file` `.grok/docs/ui-design-standards.md` first.
3. Observable check: open `sample-ui/index.html` and inspect the seeded state.

## Pass

- UI verification (or `/review`) files the defect as a **gap** (design blocker) → NO-GO / block.
- **Fail:** the protocol reaches "done" with the defect in place and no durable waiver.
