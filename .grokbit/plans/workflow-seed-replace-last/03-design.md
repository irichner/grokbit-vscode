# Design — Workflow click replaces prior seed in composer

## Options considered

### Option A — Capability invoke sets composer (replace), leave `applyComposerSeed` append for other seeds
Approach: On invocable capability row click only (`media/chat.js` `item.action === "invoke"`), set the composer to `item.invoke` directly (or call `insertComposerPrompt` with an explicit **replace** mode). Docs Use and host `seedComposer` keep calling the existing append path via `applyComposerSeed`.

Trade-off (against constraints):
- **Pros:** Surgical; preserves Studio append contract for non-workflow seeds (`02-survey.md` unit tests at `test/studio-3.0.test.ts:28-29`); both Actions mounts share `buildCapabilityRow` so one fix covers panel + popover.
- **Cons:** Two seed policies to understand; free text in the composer is wiped on workflow click (per intent assumption).

### Option B — Change `applyComposerSeed` globally to always replace
Approach: Make empty→set / non-empty→replace the only policy.

Trade-off:
- **Pros:** One policy everywhere; trivial implementation.
- **Cons:** Breaks intentional multi-seed append (Docs “Use this document” when the user already has a prompt; Studio unit tests; CLAUDE.md / Studio 3.0 contract). Violates non-goals.

### Option C — Smart replace: swap only a trailing/lone prior slash-command seed, keep free text
Approach: Detect if current composer is empty, whitespace-only, or matches a prior `^/\S+\s*$` (or last line is a slash token) and replace that portion; otherwise append or merge.

Trade-off:
- **Pros:** Nicer when user typed after `/grokbit-plan ` then clicked another workflow.
- **Cons:** Heuristics are easy to get wrong (user free-text that looks like a command; multi-line; custom args after slash). Larger than the reported bug. Intent assumes full replace for workflow picks.

## Decision
**Chosen: A**

Rationale against constraints:
- Fixes the observed multi-click stack without touching Docs/Studio append.
- Single call-site change at capability invoke (plus optional pure helper for testability).
- Matches non-goals and “only the last workflow” wording.

What Option C was better at: preserving free text when the user is mid-edit after a seed. Revisit only if users report that wipe as painful.

What Option B was better at: conceptual simplicity — rejected because of documented multi-seed append.

## Shape of the change

1. **Pure policy (preferred):** Extend `applyComposerSeed` with an optional third argument or options object, e.g. `mode: "append" | "replace"` defaulting to `"append"` so all existing call sites and `test/studio-3.0.test.ts` stay green. When `mode === "replace"`, return `seed` (empty seed still no-op). Citations: current body `media/webview-helpers.js:957-963`.

   *Alternative equally acceptable under Option A:* leave the pure helper alone and in the capability onclick set `input.value = item.invoke` (with the same focus/caret/slash/highlight steps as `insertComposerPrompt`). Prefer the mode flag so replace is unit-tested without DOM and so `insertComposerPrompt` stays the single caret/focus path.

2. **`insertComposerPrompt(prompt, opts?)`** — `media/chat.js:2711-2721` — pass through replace mode to `applyComposerSeed` when provided.

3. **Capability row** — `media/chat.js:853-854` — call `insertComposerPrompt(item.invoke, { mode: "replace" })` (or equivalent). Docs Use (~1829) and `seedComposer` (~5391) unchanged (default append).

4. **Tests**
   - Unit: `applyComposerSeed("…", "/b ", { mode: "replace" })` → `"/b "`; default still appends.
   - DOM: in `test/capabilities.dom.test.ts`, click two suite rows; assert only second invoke remains; still no send.

No host, no package.json, no schema.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Append-on-non-empty for **workflow capability invoke only** | REPLACE | User wants last workflow only | Capability click uses replace mode; panel + popover covered via shared row builder |
| Append policy for Docs / `seedComposer` / default `applyComposerSeed` | LEAVE | Non-goal; intentional multi-seed | Keep default `"append"`; unit tests unchanged |
| Smart free-text merge (Option C) | LEAVE | Out of scope / non-goal complexity | — |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Empty composer, first workflow click | Set to that invoke (same as today) |
| Composer has prior workflow only, second click | Replace with second invoke |
| Composer has free text / multi-line user draft, workflow click | **Replace entire value** with workflow seed (intent assumption) |
| Empty seed / non-string | No-op (existing `insertComposerPrompt` guard) |
| Locked / priming row | No handler (existing) |
| Docs Use while composer has text | Still appends (unchanged) |
| Concurrent edit | N/A (single-threaded webview) |

## Migration
Schema change: no  
Reversible: yes (`git revert`)  
Existing rows: n/a  
Mixed-version window: n/a (extension webview only)

## New dependencies
None.
