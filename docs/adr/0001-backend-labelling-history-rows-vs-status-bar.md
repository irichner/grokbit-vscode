# 0001. Label both backends on history rows, keep the status bar quiet for grok

- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Israel Richner

## Context

Grokbit runs two agent backends per tab — grok (the default and majority backend) and
Claude Code. Two surfaces disclose which backend something belongs to:

1. **History rows** (the activity-bar launcher and the chat history popover), rendered
   from the pure `backendBadgeLabel` in `media/webview-helpers.js`.
2. **The status-bar HUD** (`src/status-bar.ts`), the always-visible native mirror of the
   *active* session.

Both were built on one shared idiom, documented in `CLAUDE.md` in two places: **quiet for
grok**. `backendBadgeLabel` returned `""` for grok so only Claude rows rendered a chip, and
the HUD likewise omitted any backend segment for grok, adding `Claude ·` only for Claude.
The stated rationale was that the default/majority backend needs no callout, so the common
case stays visually unchanged and only the secondary backend is disclosed.

That rationale held while the two surfaces were symmetric. They are not. A history *list*
merges both backends interleaved by recency (§ History pagination), so adjacent rows can
belong to different agents. There, absence-of-badge is doing double duty: it means both
"this is grok" and "this row predates the `backend` field" — and a user scanning a mixed
list has to infer grok from the *lack* of a mark, which is exactly the signal that
disappears when you are skimming. The status bar has no such ambiguity: it describes one
open session, is a single item on a shared bar with a hard width budget, and already names
the model driving that session.

The user asked for a Grok badge on grok history rows. Honoring that reverses a documented
idiom, and the question is whether the reversal applies to one surface or both.

## Options considered

### Option A — Keep quiet-for-grok everywhere (decline the change)
- Pros: no reversal; the two surfaces keep one shared rule; zero churn; existing
  assertions stay green.
- Cons: does not deliver what was asked. Leaves the mixed history list disambiguated only
  by absence, and leaves legacy rows (no `backend` field) indistinguishable from grok rows
  by design rather than by accident.

### Option B — Flip both surfaces to label both backends
- Pros: preserves a single shared idiom, so there is nothing for a future reader to
  reconcile; fully consistent disclosure.
- Cons: spends scarce status-bar width on a segment that restates what the adjacent model
  name already implies, for the backend that is the default. The HUD's constraint (one
  line, always visible, competing with every other extension's items) is real and does not
  apply to a list row.

### Option C — Flip the history rows only; the status bar deliberately stays quiet
- Pros: fixes the surface where the ambiguity actually bites, at no cost to the surface
  where it does not; each surface follows the rule its own constraints justify.
- Cons: the two surfaces stop sharing an idiom, so the divergence looks like an
  oversight unless it is written down — an invitation for someone to "fix" the
  inconsistency later and silently undo half of this decision.

## Decision

We chose **Option C**. The deciding factor was that the two surfaces solve genuinely
different problems: a history list interleaves both backends by recency and needs per-row
disambiguation, whereas the status bar describes a single open session under a hard width
budget and already names its model. A shared idiom is only worth preserving when the
surfaces share the constraint that produced it, and here they do not.

Concretely: `backendBadgeLabel` now returns `"Grok"` for `"grok"`, `"Claude"` for
`"claude"`, and `"Grok"` for a legacy row with no `backend` field (the pre-WP4 default);
`src/status-bar.ts` and `test/status-bar.test.ts` are deliberately untouched.

## Consequences

- **Easier:** a mixed history list is scannable — every row states its agent positively
  rather than by absence, and legacy rows stop being a silent third case.
- **Harder / accepted trade-offs:** the "quiet for grok" rule no longer holds project-wide;
  it now holds *only* in the status bar, for a stated reason. Anyone reasoning about
  backend disclosure must check which surface they are on. Four existing assertions that
  encoded quiet-for-grok on history rows were inverted as part of this change.
- **Risks & follow-ups:** the divergence is the standing risk — it reads as an
  inconsistency, and the natural instinct is to unify it. Mitigated by recording the
  reason in `CLAUDE.md` in *both* places (§ History pagination and § Status-bar HUD, whose
  prose previously claimed it mirrored `backendBadgeLabel`'s idiom and is now corrected)
  and by this ADR. The existing `test/status-bar.test.ts` assertions are the executable
  guard: they fail if someone flips the HUD to match.
