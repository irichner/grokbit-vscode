# Baseline — thinner-thinking-bar

Captured BEFORE implementation at commit `8a77565` (Rebuild v2026.8.37) on 2026-08-22.

Records what the system does TODAY. Not what it should do.

Working tree at capture: plan artifacts only (`?? .grokbit/plans/thinner-thinking-bar/`, `?? docs/plans/thinner-thinking-bar.md`, reviews). **Product files `media/chat.css` and `test/chat-layout.dom.test.ts` match HEAD.**

## Captured behaviors

### B1 — Thinking-bar height is 4px (task T1 baseline field)

Path exercised: read `media/chat.css` `.thinking-bar {` (lines 3098–3110).

Input: stylesheet as of `8a77565`.

Observed output:

```
.thinking-bar {
  height: 4px;
  flex-shrink: 0;
  background: linear-gradient(
    90deg,
    var(--neon-cyan-ink),
    var(--neon-magenta-ink),
    var(--neon-green-ink),
    var(--neon-cyan-ink)
  );
  background-size: 300% 100%;
  animation: thinking-bar-shift 0.6s linear infinite;
}
```

Characterization: recorded here (no separate generated spec). After T1 this declaration must read `height: 2px`; classify that delta `INTENDED` citing `03-design.md` Option A / `height: 4px` → `2px`.

### B2 — Motion source-check does not pin height

Path exercised: `npx vitest run test/chat-layout.dom.test.ts test/thinking-bar.dom.test.ts`

Observed: 2 files, **30 passed**, 0 failed, duration ~704ms (exit 0).

`describe("thinking-bar motion (source check)")` asserts animation / 0.6s / ink tokens / no hue-rotate / `[hidden]` / reduced-motion / `@media` count 2. **Does not mention `height`.**

### B3 — Visibility suite green (JS untouched)

Path exercised: same vitest command; `test/thinking-bar.dom.test.ts` (11 tests).

Observed: all 11 passed (markup slot, priming, busy, lock, historyReplay, panel replay, permission, plan-history negative, plan-banner coexistence).

### B4 — Mic equalizer is 4px with no test pin

Path exercised: read `media/chat.css` `.mic-waves i {` (1670–1676) and `@keyframes mic-bar` (1680–1683).

Observed:

```
.mic-waves i {
  width: 2px;
  height: 4px;
  ...
}
@keyframes mic-bar {
  0%, 100% { height: 4px; }
  50%      { height: 14px; }
}
```

`test/` has **no** `height: 4px` assertion on this rule today. A global 4px→2px replace would still pass B2/B3.

## Visual captures

None. No headless browser / screenshot slot (`NO UI TOOLING`). Thickness is source-text, not a pixel screenshot.

| View | Width | File |
|---|---|---|
| (none) | — | — |

## NOT CAPTURED

- Computed on-screen px of `#thinking-bar` at 100% / 60% zoom — happy-dom has no layout engine; no Playwright.
- Reduced-motion OS rendering — CSS source-text only (`animation: none` in grokking `@media`).
- Live ACP session strip — would require a grok binary; `npm test` is grok-free.
