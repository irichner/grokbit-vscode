# Survey — Workflow click replaces prior seed in composer

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Pure composer seed policy | EXISTS | `media/webview-helpers.js:957-963` (`applyComposerSeed`) |
| Webview wrapper that applies seed + caret | EXISTS | `media/chat.js:2711-2721` (`insertComposerPrompt`) |
| Capability/workflow row click → seed | EXISTS | `media/chat.js:853-854` (`item.action === "invoke"` → `insertComposerPrompt(item.invoke)`) |
| Host → webview seed message | EXISTS | `media/chat.js:5388-5391` (`seedComposer` → `insertComposerPrompt`) |
| Docs “Use this document” seed | EXISTS | `media/chat.js:1829` (`insertComposerPrompt("Use this document…")`) |
| Unit tests for append policy | EXISTS | `test/studio-3.0.test.ts:17-34` |
| DOM tests for capability seed (first click only) | EXISTS | `test/capabilities.dom.test.ts:115-122`, `225-236` |
| Shared helper export surface | EXISTS | `media/webview-helpers.js:1228` exports `applyComposerSeed` |
| Visible Actions kinds (workflows only) | EXISTS | `media/webview-helpers.js:697` (`CAPABILITY_VISIBLE_KINDS = ["grokbit"]`) |

## Reusable code

- **`applyComposerSeed(currentText, seedText)`** — `media/webview-helpers.js:957-963` — documented Studio policy: empty/whitespace → set; non-empty → append seed on a new line; empty seed is a no-op. This **is** the append behavior the bug reports. Used by `insertComposerPrompt` for *all* seeds.
- **`insertComposerPrompt(prompt)`** — `media/chat.js:2711-2721` — sets `input.value` via `applyComposerSeed`, focuses, caret at end, updates slash/highlight. Single choke point for capability rows, Docs Use, and `seedComposer`.
- **Capability row builder** — `media/chat.js:853-854` — invocable rows only; both welcome panel and Actions popover use `buildCapabilityRow` (same click path).
- **Existing first-click tests** — `test/capabilities.dom.test.ts:115-122` expects `/grokbit-explore ` after one click; `225-236` expects `/plan ` and no send. No second-click assertion exists today.

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| “Always append when non-empty” for **workflow/capability invoke** | Policy of `applyComposerSeed` when used from capability row | Direct: capability onclick (`chat.js:854`); indirect: every `insertComposerPrompt` uses append | User wants last workflow only; append stacks slash commands |
| (Not superseded) append policy for Docs / multi-seed Studio use | same helper | Docs Use `chat.js:1829`; `seedComposer` `chat.js:5391`; unit tests `studio-3.0.test.ts:28-29` | Intent non-goal: keep intentional append for non-workflow seeds |

Caller count for `insertComposerPrompt` / `applyComposerSeed` in product code (this session):
- `insertComposerPrompt` definitions/call sites in `media/chat.js`: capability invoke (~854), Docs Use (~1829), definition (~2711), `seedComposer` (~5391).
- `applyComposerSeed` only applied inside `insertComposerPrompt` in chat.js (plus pure export for tests).

## Prior attempts

- none found for “replace last workflow seed” specifically.
- Studio seed design intentionally chose append (`webview-helpers.js:953-956` comment; CLAUDE.md Chat surfaces notes the empty→set / non-empty→append contract). Live code still uses that contract; the bug is that **workflow browsing** is a replace UX, not a multi-seed stack.

## Conventions

- **Pure helpers in `webview-helpers.js`, DOM glue in `chat.js`** — seed policy is pure and unit-tested (`test/studio-3.0.test.ts:17`); DOM behavior in `test/capabilities.dom.test.ts`.
- **Never auto-send on capability click** — `capabilities.dom.test.ts:121`, `234`; row only seeds composer.
- **Tests:** vitest + happy-dom for webview; `npm test` from repo root (Windows PowerShell host; CI Ubuntu — use cross-platform `npm test -- <file>`).
- **Invoke strings** include trailing space (e.g. `/grokbit-explore `) per suite fixture expectations.

## Absences

- No existing `replace` / `mode` parameter on `applyComposerSeed` or `insertComposerPrompt`.
- No DOM test that clicks two workflows in sequence.
- No host-side involvement required for this bug.

## Danger zones

- **`applyComposerSeed` global semantics** — changing default append would regress Docs Use + Studio unit tests and any multi-seed host messages. Prefer a **mode flag** or a **capability-only replace path**, not a silent global policy flip.
- **`insertComposerPrompt` shared by three product intents** — a blanket replace inside it would break Docs append.
- **Free text in composer** — replace-on-workflow-click will discard user-typed text; product assumption in intent (not encoded today).
