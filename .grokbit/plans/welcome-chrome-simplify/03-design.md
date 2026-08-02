# Design — Simplify session-tab welcome chrome

## Options considered

### Option A — Delete chrome entirely (markup + CSS + JS + dead pure helper)
Approach: Remove from `getHtml` / harness: `.welcome-mark`, `.welcome-tagline`, `#welcome-version`, `#welcome-guide`. Keep only `<h2>Grokbit</h2>` then `#welcome-grid` (Session Setup + Actions), then onboarding + About byline. Delete `hideWelcomeGuide` / `renderWelcomeGuide` and all call sites; stop writing `#welcome-version`; remove `welcomeGuide` export and unit/DOM tests that exist solely for the guide and version-line behavior; update or delete CSS for removed classes; retarget the tagline layout `[R]` test to assert absence of tagline rules/markup.

Trade-off (against the intent's constraints): Maximum chrome reduction and no dead code. Requires coordinated test rewrites (`welcome-canvas.dom.test.ts` largely becomes a "chrome absence" suite; `webview-ui` version-line describe block is rewritten or removed; onboarding tests that only check the version line status string move to assert onboarding card headings). Slightly larger diff, still webview-only, no deps.

### Option B — Hide chrome with CSS / `hidden` only
Approach: Leave markup and JS writers; hide logo/tagline/version/guide with CSS `display:none` or permanent `hidden` attributes. Keep `welcomeGuide` and version lifecycle.

Trade-off: Smaller first-pass diff and fewer test rewrites if tests only check visibility. Leaves dead lifecycle code, still runs guide renders on every `setBusy`/`modeChanged`, and violates the survey's preference to not leave supersession as silent COEXIST. Easier to accidentally re-show chrome. Does not cleanly meet "remove" language.

## Decision
**Chosen: A**

Rationale against constraints: Intent is permanent product chrome reduction, not a temporary hide. Non-goals exclude launcher and card redesign. Option A keeps Session Setup / Actions and onboarding, preserves About via gear and byline, and removes dead surfaces so the next survey does not report a guide that nothing shows. Test suite is the real gate (`npm test`); rewriting tests that encoded the old chrome is required work, not optional polish.

What the rejected option was better at: Option B is faster to prototype and lower risk of missing a null-ref if someone forgets a JS site — but null-guards already tolerate missing nodes, so A's risk is mainly incomplete test updates, not runtime crashes.

## Shape of the change

Target welcome tree after change (order):

1. `#welcome` container (keep)
2. `<h2>Grokbit</h2>` only (keep styling on `.welcome h2` — `media/chat.css:281-288`)
3. `#welcome-grid` → `#session-setup-card` + `#capabilities-panel` (unchanged)
4. `#welcome-onboarding` (unchanged card HTML)
5. `.welcome-byline` / `#welcome-about-link` (keep per intent assumption)

**Markup:** `src/sidebar.ts` `getHtml` (~4793-4805) and `test/webview-harness.ts` BODY (~33-44) delete the four removed nodes.

**JS (`media/chat.js`):**
- Delete `hideWelcomeGuide` / `renderWelcomeGuide` and every call (survey call sites).
- Remove `welcomeGuide` from the helpers destructure (~1145).
- Delete all `#welcome-version` reads/writes (`initialized`, `cliUpdating`, `setBusy` version-hide block, `showOnboarding` `ver` assignments, `resetForNewSession` ver reset).
- **`state.startingPhase` is version-line-only** (confirmed in survey re-check: only `media/chat.js:214` init, `:5382` set true, `:5805-5815` clear + hide version). Remove the flag with the version line. **Keep** `flushVoiceQueue()` on `!state.busy` (sibling of that block, not gated only for version). Keep `cliVersion` (About panel still uses it).
- Keep `showOnboarding` hide of setup/capabilities and card HTML as today. Full removal of the status line includes priming and CLI-update states (not only the ready canvas); composer busy/spinner remains the progress affordance.



**Helpers:** Remove `welcomeGuide` function and export from `media/webview-helpers.js`; remove unit describe in `test/webview-helpers.test.ts`.

**CSS:** Delete `.welcome-mark`, `.welcome-tagline`, `.welcome-guide`, `.welcome-guide-row` (and related comments). Keep `.welcome`, `.welcome h2`, `.welcome-byline`, `.muted-link`, `.welcome-grid`, onboarding styles. Optionally tighten `.welcome` padding if the logo gap is gone (cosmetic, allowed if tests don't pin padding).

**Tests:**
- Replace `test/welcome-canvas.dom.test.ts` guide assertions with absence checks: no `#welcome-guide`, no `.welcome-mark`, no `.welcome-tagline`, no `#welcome-version`; `#welcome` first meaningful child is h2 "Grokbit" then `#welcome-grid` (or document-order assertions). Keep the non-resurrection `[R]` for starters/task chips.
- Remove or rewrite `test/webview-ui.dom.test.ts` "welcome version line" describe (~767-828): drop tests that require the line; keep onboarding card tests that already assert `#welcome-onboarding` content.
- Update `test/chat-layout.dom.test.ts` tagline rule: assert rule/markup absence instead of "no 320px".

**Docs:** Runtime does not depend on CLAUDE.md/ADR; disposition LEAVE for docs unless implement chooses a one-line known-limit note (optional).

## Disposition of superseded code

Every item from the survey's supersession section. No item may be omitted.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| `.welcome-mark` | REPLACE | Intent forbids logo on session welcome | Delete markup + CSS; do not delete shared `blackhole-icon.svg` or launcher logo |
| `.welcome-tagline` | REPLACE | Intent forbids marketing copy above cards | Delete markup + CSS; retarget layout test |
| `#welcome-version` | REPLACE | Intent forbids status strip above cards; About + onboarding headings cover | Delete markup + all chat.js writers; rewrite/remove version-line DOM tests; onboarding assertions use card headings |
| `#welcome-guide` + hide/render | REPLACE | Intent forbids guide above cards | Delete markup, functions, call sites, CSS |
| `welcomeGuide()` | REPLACE | Only consumer removed | Delete function, export, unit tests |
| `.welcome-guide` CSS | REPLACE | Dead with mount | Delete rules |
| ADR / CLAUDE.md guide prose | LEAVE | Out of scope for this UI diff; docs lag is acceptable | Optional follow-up; do not reintroduce guide citing ADR without product revisit |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Network failure | N/A — pure static/chrome removal |
| Empty / ready session | Welcome shows title + setup + actions only above the fold chrome |
| Priming / busy | Setup + actions still render locked (existing lifecycle); no "Starting" line |
| CLI update in progress | No dedicated welcome status line; spinner/busy on composer send button remains (existing) |
| Onboarding required | Onboarding card still shown; setup/actions still hidden; no version-line status |
| Concurrent tab switch / clearWelcome | Unchanged hide of welcome on first real user message |
| Permission denied | N/A |

## Migration

Schema change: no  
Reversible: yes (`git revert`)  
Existing rows: N/A  
Mixed-version window: N/A (extension reload picks up new webview HTML)

## New dependencies

| Package | Why nothing in-repo suffices | Size | License |
|---|---|---|---|
| — | none | — | — |
