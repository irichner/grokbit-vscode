# Plan: Rapid thinking color bar (plan-banner slot)

**Slug:** `thinking-color-bar`  
**Depends on:** freeze-fix T3 already in tree (`addPlanNotice`); this change is independent except both touch `media/chat.js` / `chat.css` / harness.  
**Pass-1 review:** `docs/plans/thinking-color-bar.review.md` (Request Changes). This revision addresses RC 1–5.

## Goal

While a session is **thinking** (in-flight turn), show a rapidly color-rotating bar in the same place as the screenshot’s largest bar: the full-width strip under the top bar (`#plan-banner` slot). That bar is the ambient “AI is thinking” signal. It must be correct with **multiple session tabs** and **reloads / hidden-tab reveal**.

### Acceptance criteria (falsifiable)

1. OCR/screenshot slot: a `#thinking-bar` sits **immediately under** `.top-bar` and **above** `#plan-banner` / `#messages` (same horizontal span as `#plan-banner`).
2. After default boot (`busy=true`, `busyLocked=true` priming): `#thinking-bar[hidden]` is **true** (spawn is not “thinking”).
3. `userMessage` then `{ type:"setBusy", value:true }` (unlocked): `#thinking-bar.hidden === false`.
4. `{ type:"setBusy", value:false }` or `agentEnd`: bar hidden again.
5. `{ type:"setBusy", value:true, locked:true }`: bar stays **hidden**.
6. `historyReplay` (`state.replaying` true): bar stays **hidden** even if busy.
7. **Panel rebuild (hide→reveal):** `{ type:"beginPanelReplay" }` then unlocked busy / buffered `userMessage` → bar **stays hidden**. `{ type:"endPanelReplay" }` after in-flight `userMessage`/`agentStart` with **no** `agentEnd` → bar **visible**. `{ type:"endPanelReplay" }` after `agentEnd` → bar **hidden**. `historyReplay` (AC 6) is a **separate** case from `panelReplaying`.
8. **Needs-you:** while a **live** unresolved interactive card exists, bar is **hidden**. Selector is **not** a bare `.card:not(.resolved)` — that would match restored **plan-history** cards (`class="card plan plan-history"`, never `.resolved`) and permanently hide the bar after a plan-mode resume. Use:

   `.card.permission:not(.resolved), .card.question:not(.resolved), .card.plan:not(.plan-history):not(.resolved)`

   After the card resolves, if still unlocked-busy with no matching card, bar **shows**. `planHistory` then unlocked busy → bar **visible** (negative test).
9. Plan-mode banner still shows/hides solely from `modeId === "plan"` (existing `test/plan-banner.dom.test.ts` green). Both can be visible at once (thinking bar above plan banner) when thinking **and** not needs-you.
10. CSS source-text (`ruleBlock`): `.thinking-bar` has a looping `background-position` animation with duration **0.6s–0.8s**; uses `--neon-*-ink` or `--neon-*-soft` (not raw `--neon-cyan` fill); `.thinking-bar[hidden] { display: none }`. Reduced-motion: **fold into the existing grokking `@media (prefers-reduced-motion: reduce)` block** so `test/chat-layout.dom.test.ts` `@media` count stays **2**. Frozen gradient remains visible (`animation: none`).
11. Harness `BODY` and `getHtml` both include `#thinking-bar`. Missing harness node would make `$("thinking-bar")` null and every visibility assertion a silent no-op — T1 is load-bearing.
12. No host protocol change. Per-tab isolation = per-webview DOM (no shared timer). Reload/reveal: **not** via a fresh `setBusy` after `ready` — live busy is reconstructed from buffered `userMessage` / `agentStart` / `agentEnd`; the bar is gated off for the whole `panelReplaying` window (AC 7).
13. Targeted tests + `npx tsc -p . --noEmit` + `npm test` green. `media/` **UNMEASURED**; `getHtml` string → **UNMEASURED / no changed executable lines** for `src/`. No fake 100%. **NO UI TOOLING** for keyframes (happy-dom cannot assert a running animation).

## Non-goals

- Replacing Grokking / activity carousel / status-bar HUD (they stay).
- Animating the plan-banner **text** (readability).
- Persisting animation phase across reloads.
- A global VS Code progress API / status-bar rainbow (webview-only).
- Changing Plan-first gate policy (separate freeze-fix).
- Sound, reduced-motion override setting (OS `prefers-reduced-motion` only).

## Risk / blast radius

| Surface | Change |
|---|---|
| `src/sidebar.ts` `getHtml` | Add `#thinking-bar` markup |
| `test/webview-harness.ts` | Mirror the element (startup query) |
| `media/chat.js` | `updateThinkingBar()` from busy/replay/end paths |
| `media/chat.css` | Bar + keyframes + reduced-motion |
| Tests | new `test/thinking-bar.dom.test.ts` + CSS `ruleBlock` in `test/chat-layout.dom.test.ts` |

User: every live thinking tab shows its own bar; idle/hidden-teardown tabs don’t leak animation (no shared CSS). Reload/reveal: bar stays off for the whole `panelReplaying` window, then follows reconstructed busy (AC 7). No data/auth.

## Approach (chosen)

**A — Dedicated `#thinking-bar` sibling (chosen).** 4px full-width strip. Sliding `background-position` on a repeating **ink/soft** neon gradient, duration **0.6s** (floor–ceiling 0.6–0.8s). No `hue-rotate`, no luminance strobe. Visibility:

```
show = busy && !busyLocked && !replaying && !panelReplaying && !hasUnresolvedCard()
```

`hasUnresolvedCard()` queries live interactive cards only:

`.card.permission:not(.resolved), .card.question:not(.resolved), .card.plan:not(.plan-history):not(.resolved)`

Restored `.plan-history` / `.card.question.resolved` do **not** count. Plan banner unchanged.

**B (rejected):** Paint `#plan-banner` background rainbow — hides plan copy; bar absent outside plan mode.

**C (rejected):** Host `StatusBarItem` — wrong location vs screenshot; not in the chat panel.

## Ordered steps

### T1 — Markup slot

**Files:** `src/sidebar.ts` (`getHtml`), `test/webview-harness.ts`

Insert immediately after `</header>` / before `#plan-banner`:

```html
<div id="thinking-bar" class="thinking-bar" hidden aria-hidden="true"></div>
```

(`aria-hidden`: Grokking already exposes `aria-label="Grok is working"`; a second `aria-live` would double-announce every turn.)

**Verify:** `npx vitest run test/thinking-bar.dom.test.ts` — `getElementById("thinking-bar")` not null. Source-check `getHtml` contains `id="thinking-bar"` (same pattern as launcher absence guards).

### T2 — Visibility policy

**Files:** `media/chat.js`

- `$("thinking-bar")` at startup (null-safe).
- `updateThinkingBar()` implements the show formula above.
- Call from:
  - `setBusy`
  - every assignment to `state.busy` **except** `agentReset` (that handler does **not** assign `state.busy`; hide still follows a later `agentEnd` / `setBusy`)
  - `historyReplay` start/end (`state.replaying`)
  - **`beginPanelReplay` / `endPanelReplay`** (set/clear `panelReplaying`; call **after** the flag flips — in `endPanelReplay` after `panelReplaying = false` in the `finally`)
  - card add / collapse / resolve paths that create or resolve `.card` (permission, question, plan) so needs-you AC 8 holds
- Do **not** rely only on `setBusy` — `agentEnd` sets `state.busy = false` without that message. Hide→reveal does **not** re-post `setBusy` for an in-flight turn.

**Verify:** DOM tests for AC 2–8, including distinct `beginPanelReplay` / `endPanelReplay` / `historyReplay` cases.

### T3 — Visual + a11y CSS

**Files:** `media/chat.css`

- Height 4px, `flex-shrink: 0`, full width (block in the column under `.top-bar`).
- Repeating linear-gradient using **`--neon-cyan-ink` / `--neon-magenta-ink` / `--neon-green-ink`** (or `-soft`), matching `.plan-banner` `border-image` — **not** raw `--neon-cyan` as the fill.
- Animate `background-position` only, duration **0.6s** linear infinite (`background-size` ≥ 300%).
- `[hidden] { display: none }` (same gotcha as `#model-label[hidden]`).
- Reduced-motion: add `.thinking-bar { animation: none; }` **inside the existing grokking** `@media (prefers-reduced-motion: reduce)` block (`media/chat.css` ~813) so `expect((css.match(/@media/g) ?? []).length).toBe(2)` stays true. Static fill remains (bar still visible while thinking).
- No viewport `@media`.

**Verify:** `ruleBlock` in `test/chat-layout.dom.test.ts` + `@media` count still 2.

### T4 — Tests + regression

**Verify:** `npx vitest run test/thinking-bar.dom.test.ts test/plan-banner.dom.test.ts test/chat-layout.dom.test.ts test/plan-card.dom.test.ts`; `npx tsc -p . --noEmit`; `npm test`.

**NO UI TOOLING** for motion: happy-dom does not run keyframes. Machine checks = `hidden` + CSS source-text. Manual (Lead UI verify): (1) two tabs — bar only on the thinking tab; (2) hide then reveal a live tab — **no flash** during rebuild, bar appears only after `endPanelReplay` if still in-flight; (3) OS reduced-motion — bar visible, not cycling.

## Testing strategy

| Behavior | Test | Edge/negative |
|---|---|---|
| Priming hidden | default boot | locked busy ≠ thinking |
| Live turn shows | setBusy true unlocked | setBusy false hides |
| History replay hidden | `historyReplay` + busy | distinct from panel replay |
| Panel rebuild hidden | `beginPanelReplay` + userMessage | no strobe |
| Panel rebuild restore | `endPanelReplay` after agentStart, no agentEnd | bar visible |
| Panel rebuild idle | `endPanelReplay` after agentEnd | bar hidden |
| Needs-you hidden | `permissionRequest` while busy | card resolve + still busy → show |
| Plan-history is not needs-you | `planHistory` then unlocked busy | bar **visible** |
| Plan banner independent | plan-banner.dom.test.ts | both visible when thinking + plan, no card |
| Reduced motion | CSS: grokking `@media` contains `.thinking-bar`; count stays 2 | |
| Missing node | harness + getHtml source-check | `$` null-safe |

Coverage: `media/` UNMEASURED; no src executable lines expected (markup-only in `sidebar.ts` getHtml string). If `getHtml` is not in `src/**` coverage as a string, record UNMEASURED / no changed executable lines for src. Waiver not required.

## Failure modes

- **Forgot `agentEnd`:** bar stuck on after the turn — AC 4 + grep all `state.busy` assignments.
- **Priming flash:** locked busy would show a false “thinking” on every new tab — AC 2.
- **History-replay flash:** `historyReplay` rainbow — AC 6.
- **Panel-rebuild strobe:** buffered `userMessage`/`agentEnd` pairs during `panelReplaying` would cycle the bar and `aria-live` — AC 7 + hook `beginPanelReplay`/`endPanelReplay`.
- **Needs-you over a permission card:** bar would keep spinning while the user must click — AC 8 hides it.
- **`[hidden]` overridden by `.thinking-bar { display:block }`:** explicit `[hidden] { display:none }`.
- **Third `@media`:** fails chat-layout count=2 — fold into grokking reduce block.
- **Two tabs:** CSS on each webview; no shared timer.
- **Rollback:** revert the four files.

## Observable verification

- DOM `hidden` boolean as above.
- CSS `ruleBlock` on `.thinking-bar` contains `animation` 0.6s and ink tokens; grokking `@media` contains `.thinking-bar { animation: none }`; `@media` count stays 2.
- Manual (NO UI TOOLING): two session tabs (bar only on thinking tab); hide then reveal live tab with **no flash** during rebuild; reduced-motion OS setting.

## UI/UX design

**Reference:** `#plan-banner` slot (screenshot y≈108 full chat width) + existing neon tokens (`.plan-banner` already uses cyan→magenta `border-image`). Grokking `aria-label="Grok is working"` is reused on the bar (`role="status"`).

| State | Expected |
|---|---|
| empty / idle | hidden |
| priming (`busyLocked`) | hidden |
| loading / thinking (unlocked busy, no unresolved card) | visible, 0.6s ink-gradient slide |
| needs-you (unresolved `.card`) | **hidden** — card is the signal |
| panel rebuild (`panelReplaying`) | **hidden** — no strobe |
| history replay (`replaying`) | hidden |
| error (`exit` / agentEnd) | hidden |
| disabled | N/A (not a control) |
| overflow / narrow split | 4px × 100% column; no horizontal scroll |
| focus | N/A (not interactive, not a tab stop) |
| reduced motion | visible if thinking, static fill, `animation: none` |
| plan mode + thinking | bar **and** plan banner |
| plan mode + idle | plan banner only |
| plan mode + needs-you | plan banner only (no thinking bar) |

Light/dark: neon tokens already mix with `--vscode-foreground`.

## Assumptions

- Screenshot largest bar = `#plan-banner` (OCR: “Plan first — Grok drafts…”). Falsify: user meant composer or activity strip — then relocate, don’t add a second rainbow.
- Hide→reveal does **not** re-post `setBusy` for an in-flight turn; busy is reconstructed from the buffer. Falsify: if host later adds a `setBusy` after `endPanelReplay`, the formula still holds.
- `aria-label="Grok is working"` matches `showGrokking()` on Claude tabs too (composer already says “Ask Claude…”). Accept that consistency unless the user asks to backend-label both.
- Freeze-fix T3 remains; this does not change `addPlanNotice`.

## Disposition

| Existing | Disposition |
|---|---|
| `#plan-banner` | **COEXIST** — not replaced |
| Grokking / carousel | **COEXIST** |
| Status-bar HUD | **LEAVE** |
