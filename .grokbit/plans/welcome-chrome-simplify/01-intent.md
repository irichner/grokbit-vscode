# Intent — Simplify session-tab welcome chrome

## Problem
On a new session tab, the empty canvas above Session Setup and Grokbit Actions is crowded: logo, product title, marketing tagline, status line, and a three-line guide. The user wants that strip reduced to the word **Grokbit** only (no logo), so the useful controls (Session Setup and Grokbit Actions) sit closer to the top with less chrome.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] On a new empty session tab (welcome visible, not onboarding), the only content **above** the Session Setup card / Grokbit Actions panel is the text **Grokbit** (as a heading).
- [ ] The black-hole / logo mark is **not** shown on the session-tab welcome canvas.
- [ ] The marketing tagline paragraph is **not** shown on the session-tab welcome canvas.
- [ ] The three-line welcome guide strip is **not** shown on the session-tab welcome canvas.
- [ ] The transient "Starting" / "Updating…" status line **above** the cards is **not** shown on a normal ready welcome (CLI version remains available via gear → About if that path still exists).
- [ ] Session Setup and Grokbit Actions still appear and work as today on a ready empty session (locked while busy, clickable when ready).
- [ ] Onboarding flows (missing CLI, auth required, Claude adapter/auth) still show a usable install/sign-in card and still hide Session Setup / Actions while onboarding is active.
- [ ] Existing automated suite stays green (`npm test` from repo root).

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Changing the activity-bar **launcher** layout (including the logo on **New session**).
- Redesigning Session Setup or Grokbit Actions cards themselves (layout, tiles, featured lists).
- Changing the top bar (History, Docs, Grokbit Actions button, etc.).
- Changing composer chrome, mode banner, or About panel content (gear path).
- Removing the **About Grokbit** link below the cards (it is not above the cards).
- Rewriting product docs beyond what implement needs for accuracy (optional follow-up).
- New settings, new host messages, or backend/ACP changes.

## Constraints
- Stack / version limits: VS Code webview only (`media/chat.{js,css}`, `src/sidebar.ts` `getHtml`, pure helpers + DOM tests). No new dependencies.
- Must not break: panel replay / welcome lifecycle (`clearWelcome`, `resetForNewSession`, onboarding branches); DOM test harness must mirror markup or chat.js null-guards stay safe.
- Deadline or sequencing: none; pure UI simplification.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` "On the tabs" means **session editor tabs** (`WebviewPanel` welcome canvas), not the activity-bar launcher.
- `UNVERIFIED` Elements **below** Session Setup / Grokbit Actions (onboarding mount, About byline) stay; only the strip **above** the cards is stripped to the title.
- `UNVERIFIED` Removing `#welcome-version` is acceptable because after priming the line already hides, and onboarding copy lives primarily in the onboarding card headings; any status that currently only appears on the version line can move into the onboarding card or be dropped if redundant.
- `UNVERIFIED` The pure `welcomeGuide()` helper may be deleted with its mount, or left as dead export until a cleanup task removes it — plan should prefer **REPLACE** (remove dead surface) rather than leave orphan UI code.

## Questions asked
Max 3, one batch. Record the answers.

None — answers would not change a materially different plan given the non-goals and the above assumptions.
