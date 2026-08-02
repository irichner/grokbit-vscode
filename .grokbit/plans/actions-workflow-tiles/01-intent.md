# Intent — Grokbit Actions: workflows only, as readable tiles

## Problem

Grokbit Actions currently shows four stacked groups — the bundled Grokbit
workflow, the user's own Skills, Agents, and the CLI's own Commands — and every
entry is a one-line row whose description is clipped to a single line with an
ellipsis. The result is a long, noisy menu where the four things that actually
matter (plan → implement → test → document) are buried among plumbing, and where
none of the entries tell you what they do, because the description never has
room to be read. The user wants Grokbit Actions to show the workflows and
nothing else, rendered as tiles big enough that the description is actually
legible.

## Done criteria

Each item is checkable by a human performing an observable action.

- [ ] Opening a new Grokbit session tab shows a Grokbit Actions panel containing
      exactly one group — the Grokbit workflow — with four entries:
      grokbit-plan, grokbit-implement, grokbit-test, grokbit-document, in that
      order.
- [ ] Clicking the top-bar **Grokbit Actions** button shows the same four
      entries, and no Skills / Agents / Commands group.
- [ ] Each entry renders as a bordered tile, and its description wraps onto
      multiple lines rather than being cut off at one line with an ellipsis.
- [ ] Each of the four descriptions reads as one or more **complete sentences**
      — it never ends mid-word or mid-sentence with a "…".
- [ ] On a wide editor tab the tiles lay out in more than one column; on a
      narrow split-editor tab they collapse to a single column with no
      horizontal scrollbar.
- [ ] Clicking a tile still drops its slash form (e.g. `/grokbit-plan `) into
      the message box and sends nothing.
- [ ] The **Auto-accept** switch is still present at the top of the top-bar
      Actions popover.
- [ ] With no workflows provisioned (`grok.skills.provision: "off"`), the panel
      shows a single honest muted line rather than an empty box or a stale
      "No skills installed yet" message.
- [ ] `npm test` is green with no reduction in the test count.

## Non-goals

- Not removing skill/agent/command **discovery** — the host keeps scanning and
  keeps sending the full payload. Only what the UI renders changes.
- Not changing slash-command autocomplete in the composer (typing `/`), which is
  fed by a separate ACP path and is untouched.
- Not changing `grok.showCapabilities`, the Refresh affordance, the priming
  lock, or any of the four lifecycle anchors.
- Not adding a new setting to choose which kinds are shown.
- Not adding a `workflow` `CapabilityKind` or any new discovery source — the
  "workflows" in this request are the existing bundled `grokbit` group.
- Not rewriting the bundled skills' behaviour or their `SKILL.md` bodies.
- Not touching the Session Setup card, the welcome guide strip, or the history
  popover.

## Constraints

- **Stack:** plain ES5-ish webview JS (no build step for `media/**`),
  TypeScript for `src/**`, vitest + happy-dom for tests. Windows/PowerShell is
  the user's actual shell.
- **No `@media` queries in `chat.css`, ever** — `body { zoom }` makes
  breakpoints lie. Intrinsic sizing only (`auto-fit`, `minmax`, `min()`).
  A pixel floor inside `minmax()`/flex-basis must be wrapped in `min(100%, …)`
  or a narrow split editor overflows horizontally.
- **The renderer must not branch on kind strings** — a standing rule recorded in
  CLAUDE.md and guarded by existing tests. Any filtering must be data-driven.
- **Must not break:** the priming-window lock, the two `stopPropagation`
  popover guards, the popover scroll-position restore, the four lifecycle
  anchors, or the "welcome-canvas panel renders no switch" invariant.
- 1336 tests is the floor.
- The working tree already carries 15 uncommitted files from unrelated work; this
  change lands on top of them, not instead of them.

## Assumptions

Decided rather than asked. Each is a candidate finding for the Reviewer, and
each is surfaced as a question at the approval gate.

- `UNVERIFIED` "Workflows" means the existing bundled `grokbit` group
  (grokbit-plan / implement / test / document) — the group CLAUDE.md already
  calls "the bundled Grokbit workflow". No new discovery source is implied.
- ~~`UNVERIFIED`~~ **CONFIRMED at the gate.** "Only show workflows" applies to
  **both** mounts — the welcome canvas panel and the top-bar popover.
- `UNVERIFIED` The **Session controls / Auto-accept** switch in the popover is
  session state rather than a listed capability, so it stays. Removing it would
  silently drop the popover's only in-place control.
- `UNVERIFIED` Skills / Agents / Commands disappearing from this menu is
  acceptable to the user because they remain reachable by typing `/` in the
  composer. **This is the one assumption with real product risk** — see the gate
  question, and see `assumptions.md` for the unverified part (whether every
  disk-discovered skill also surfaces in the CLI's ACP command list).
- `UNVERIFIED` "Enough room to read what they do" is satisfied by wrapping the
  description over ~3–4 lines in a tile, not by rendering the full 500–700
  character frontmatter description, which is model-routing prose ("Use this
  skill whenever…") rather than a human blurb.

## Questions asked

Not asked as a blocking batch — the plan is built on the defaults above and the
three questions are put at the approval gate instead, so a plain "go" produces a
complete plan and any other answer is a scoped revision rather than a restart.

1. Q: Workflow-only in **both** mounts, or only the welcome canvas? →
   **A: Both.** Confirms the default; no task changed.
2. Q: Do Skills / Agents / Commands disappear from Grokbit Actions entirely, or
   stay behind a "Show everything else" link at the bottom? →
   **A: Disappear entirely.** Confirms the default; no fallback door, no task
   changed. Prompted a code-level breakdown of what is actually lost — see
   `assumptions.md` § From grounding: Commands lose nothing (a command row
   exists only because the CLI registered it, `src/capabilities.ts:706`),
   Agents lose no invocation (never invocable, `src/capabilities.ts:399`),
   home-tier grok skills stay in `/` autocomplete
   (`docs/SLASH-COMMANDS.md:5`). Only workspace-tier skills carry residual risk.
3. Q: Tile copy — derive it from the existing frontmatter description
   (sentence-aware trim, no new data), or add a short human-written blurb field
   to the four bundled skills? →
   **A: not answered — proceeding on the default: derive it.** The trim was
   measured and produces clean complete sentences for all four. Option 3 in
   `03-design.md` (a `short-description` frontmatter key) is purely additive on
   top of this, so the choice stays cheap to revisit.
