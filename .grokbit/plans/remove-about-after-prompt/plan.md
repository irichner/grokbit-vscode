# Plan — Stop showing About Grokbit after a prompt is submitted

Slug: `remove-about-after-prompt` · Approach: add `.welcome[hidden]{display:none}` · Blast radius: ~2–3 files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Honor `[hidden]` on the welcome canvas
- **intent:** After first send, `#welcome` (including About Grokbit and the Grokbit heading) does not paint; empty sessions still show welcome when not hidden.
- **files:** `media/chat.css`, `test/welcome-canvas.dom.test.ts` (and/or a small DOM test addition in that file or `test/session-setup.dom.test.ts`)
- **cwd:** none
- **depends:** none
- **verify:** From repo root on Windows: `npm test -- test/welcome-canvas.dom.test.ts test/session-setup.dom.test.ts test/primer-only-restore.dom.test.ts` (or full `npm test` if preferred). Must include: (1) CSS source contains `.welcome[hidden]` with `display: none`; (2) after a first-user-message path that clears welcome, `#welcome.hidden === true` and, if happy-dom reports it, `getComputedStyle(#welcome).display === "none"`; (3) existing primer-only restore still keeps welcome when appropriate.
- **removes:** none (behavior only; no product surface deleted)
- **baseline:** Empty-session welcome chrome; first-send clear of session-setup/capabilities; primer-only restore keeps welcome; gear About still openable from gear menu
- **rollback:** Revert the CSS rule and test assertions
- **state-after:** working
- **notes:** Root cause: `.welcome { display: flex }` (`media/chat.css:265-272`) beats UA `[hidden]`; `clearWelcome` already sets `hidden` (`media/chat.js:2462`). Peer pattern: `media/chat.css:109-111`. Do not remove empty-canvas About unless gate chooses Option B.

### T2 — (optional, gate-only) Remove About byline from empty welcome
- **intent:** Product cleanup: no About Grokbit link on empty canvas either; About only via gear → Version & about.
- **files:** `src/sidebar.ts`, `test/webview-harness.ts`, `media/chat.js` (click wiring + optional `openAboutPanel` if only used by welcome link), `media/chat.css` (`.welcome-byline` if unused), `test/welcome-canvas.dom.test.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/welcome-canvas.dom.test.ts` — no `#welcome-about-link`; gear About path still covered by existing gear tests if any, else manual: gear → Version & about opens
- **removes:** `#welcome-about-link` markup, `.welcome-byline` if orphaned, welcome-only click handler; dead CSS if unused
- **baseline:** same as T1 empty-canvas About visibility
- **rollback:** restore markup/handler/tests
- **state-after:** working
- **notes:** **Skip unless human explicitly wants empty-canvas removal.** Prior plan `welcome-chrome-simplify` intentionally kept About below cards. Grep `openAboutPanel` before deleting — may still be used only from welcome link (`media/chat.js:2128`, `5861-5862`).

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Empty session can still show welcome chrome | T1 verify (reset/onboarding/primer paths) |
| After first prompt, About Grokbit not visible | T1 verify + human visual |
| After first prompt, Grokbit heading not visible | T1 verify (whole `#welcome` hidden) |
| Session Setup / Actions stay gone after send | T1 + existing session-setup/capabilities tests |
| New/reset empty session shows welcome again | T1 baseline / primer-only / reset paths |
| Onboarding still displays | existing onboarding tests + no change to showOnboarding logic |
| Gear → Version & about still works | T1 baseline (no gear change); T2 if taken |
| `npm test` green | T1 (and T2 if taken) |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 1 | T1 — broken UA-only hide for `#welcome` |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 1 | empty-canvas About link (default); T2 only if human opts in |

Net lines: roughly +5 CSS/comment, +10–30 test lines / −0 product HTML (default). Not an all-additive feature plan — it closes a visibility bug.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` Empty-canvas About stays unless human opts into T2.
- `UNVERIFIED` Primary user pain is post-submit leftover chrome, fixed by T1.

## Approval
- [x] Human approved — 2026-08-01 (user: /grokbit-implement this plan)
