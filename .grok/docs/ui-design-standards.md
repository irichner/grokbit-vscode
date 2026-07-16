# UI Design Standards

**Mandatory read** for `gf-frontend` before writing or changing UI code, and for anyone
judging the UI design gate (plan-quality hard gate 8) or the UI verification step in
`/post-change-accuracy-protocol` (`read_file` this document first).

Applies to any user-facing surface: views, components, styling, templates, and CLI/TUI
output when it is the product.

## Good

- Uses the project's design system / tokens (color, spacing, typography, radii) — no ad-hoc values where a token or scale exists.
- Full state inventory implemented for every touched interactive element: default, hover, focus-visible, active, disabled, loading, empty, error.
- Responsive at the breakpoints the project supports; no horizontal overflow or clipped content at supported widths.
- Accessible by default: keyboard reachable and operable, visible focus indicator, labels / accessible names on controls and images, WCAG AA contrast for text and interactive elements.
- Consistent with adjacent screens (spacing rhythm, capitalization, iconography, motion).
- Light/dark parity when the project themes both.

## Blockers (design NO-GO)

- Hardcoded color/spacing/font values where the design system provides a token or scale.
- Missing focus-visible styles, keyboard traps, or keyboard-unreachable controls.
- Missing loading / empty / error / disabled states for interactive or async UI.
- Text or interactive contrast below WCAG AA (when measurable).
- Layout breakage at supported breakpoints (overflow, overlap, clipped content).
- Unlabeled form controls or icon-only buttons without accessible names.
- Divergence from the plan's design reference (mockup / named pattern) without a recorded reason.

A design blocker = **gap** → blocks GO, same as a test-accuracy failure
(see `.grok/rules/accuracy-coverage.md`).

## State inventory minimum

For each interactive or data-driven element in the diff, account for:

- empty / zero-data
- loading / pending
- error / failure
- disabled / unauthorized
- overflow (long text, large counts, small viewport)

"Accounted for" = implemented, or explicitly N/A with a reason in the summary.

## Verification (observable only)

- Reject "looks good" / "matches design" without evidence — same rule as plan-quality gate 7.
- Evidence forms (any the repo supports): screenshots of key states, a Storybook story per state, browser/E2E assertions (e.g. Playwright), a11y linter output (axe, eslint-plugin-jsx-a11y), or snapshots **with stated behavior intent**.
- No tooling available → record `NO UI TOOLING` plus the manual checks performed; merge claims then need the same waiver discipline as `NO COVERAGE TOOL`.

## Relation to gates

- Plan review: hard gate 8 in `.grok/docs/plan-quality-standards.md` (conditional on UI scope; N/A counts as pass when no UI is touched).
- Post-change: UI verification step in `/post-change-accuracy-protocol` when UI changed.
- Severity: design blocker → **gap** → blocks merge (`.grok/rules/accuracy-coverage.md`).
- Harness check: Fixture E in `fixtures/agentic-template-acceptance/`.
