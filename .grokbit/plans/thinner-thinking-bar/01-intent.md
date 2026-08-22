# Intent — Thinner thinking bar

**scope:** short (one-line CSS thickness + test pin; no JS/host)

## Problem

While the agent is working, a full-width neon strip under the chat top bar cycles color rapidly. That strip is currently **4px** tall. It reads as a thick, attention-grabbing band rather than a thin ambient “still thinking” cue. The user wants it **thinner**.

## Done criteria

Each item is checkable by a human or by a command.

- [ ] The `.thinking-bar {` rule in `media/chat.css` declares `height: 2px` and does **not** declare `height: 4px` (machine check for thickness).
- [ ] Lead UI verify (`NO UI TOOLING`): at 100% chat zoom on an unlocked busy turn the strip is a **2px** band (half of the shipped 4px); at 60% `--chat-zoom` it remains visible (~1.2px). Not a license to ship 1px.
- [ ] Motion is unchanged: 0.6s `background-position` slide, ink neon tokens (`--neon-cyan-ink` / `--neon-magenta-ink` / `--neon-green-ink`), no `hue-rotate`.
- [ ] Visibility policy is unchanged (hidden while priming / locked / history replay / panel replay / live needs-you cards; shown on unlocked busy; plan-history cards do not hide it).
- [ ] `[hidden]` still forces `display: none`. Reduced-motion still freezes the bar (`animation: none`) inside the existing grokking `@media` block. `@media` count in `chat.css` stays **2**.
- [ ] Unrelated 4px rules stay 4px: `ruleBlock` on `.mic-waves i {` still contains `height: 4px`, and `@keyframes mic-bar` still uses `4px` at rest.
- [ ] `npx vitest run test/chat-layout.dom.test.ts test/thinking-bar.dom.test.ts` is green.
- [ ] `npx tsc -p . --noEmit` and `npm test` are green.

## Non-goals

- Changing when the bar shows or hides (JS `updateThinkingBar`, host messages, card selectors).
- Changing animation duration, gradient tokens, or reduced-motion policy.
- Restyling the activity carousel strip, Grokking / Thinking… stand-in, status-bar HUD, or plan-mode banner.
- New settings, CSS custom properties, host protocol, or markup.
- Headless screenshot / Playwright visual regression (repo has none).

## Constraints

- Stack: webview CSS in `media/chat.css`; tests in vitest + happy-dom source-text checks. Windows PowerShell for verify commands.
- Must not break: bar slot (immediately under `.top-bar`, above `#plan-banner`); `aria-hidden="true"`; `[hidden]` display override; existing `@media` count of 2 (no new viewport breakpoints — `body` uses `zoom` for `grok.chatFontScale`).
- Thickness still scales with `zoom: var(--chat-zoom)` (a 2px declared height at 60% zoom is ~1.2px rendered; at 300% ~6px). That is accepted.
- No `@media` added anywhere in `chat.css`.

## Assumptions

- `UNVERIFIED` The requested surface is `#thinking-bar` (the 0.6s cycling neon strip), **not** the activity-carousel `.activity-strip` row and **not** the mic equalizer `.mic-waves` bars. “Rapidly changing AI thinking bar” matches the dedicated thinking strip.
- `UNVERIFIED` Target height is **2px** (half of the shipped 4px). Still a visible hairline at default 100% zoom and at the 60% font-scale floor. User can override to 1px or 3px at the approval gate; that is a one-token change in CSS + the test pin.
- `UNVERIFIED` happy-dom cannot assert computed pixel height; a CSS source-text pin in `test/chat-layout.dom.test.ts` is the machine check for thickness. Lead UI verify after implement names **2px** at 100% zoom and remaining visibility at 60% zoom (`NO UI TOOLING` for keyframes / layout).

## Questions asked

None. Height inferred as 2px rather than blocking the pipeline on a pixel question.
