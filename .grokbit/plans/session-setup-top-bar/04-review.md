# Review log — session-setup-top-bar

## Round 1 — Plan Reviewer (adversarial)

**Verdict:** REQUEST CHANGES

### Findings

- [BLOCKER] Dual-anchor open of a single `#session-settings-popover` is geometrically incompatible with current positioners — design leaves a known-broken path as “verify at implement / optional re-parent.” Evidence: `positionPopover` always bottom-anchors relative to `popover.parentElement` and places the popover **above** the button (`top:auto`, `bottom: composerRect.bottom - btnRect.top + 4`) (`media/chat.js:1863–1877`); the node lives under `<footer class="composer">` (`src/sidebar.ts:4948`). A top-bar chip near the webview top therefore opens the popover **above** the top bar (off-canvas / clipped). Permanently re-parenting under `.top-bar` (design Shape fallback, `03-design.md` ~L49) breaks the bottom `#model-label` path, which still calls the same `openSessionSettingsPopover` → `positionPopover` (`media/chat.js:6054–6057`). `positionDropdownPopover` opens downward but always right-aligns to the panel edge (`media/chat.js:1879–1897`) — wrong for a **left** chip and wrong for the composer chip. **Resolve:** Mandate a dual-anchor strategy before implement, e.g. (1) open-time re-parent of the one popover to the anchor’s positioned ancestor + branch positioner (top→below/left-ish; bottom→existing `positionPopover`), or (2) viewport/fixed placement independent of parent for both anchors. Do not ship “call `openSessionSettingsPopover(topBarChip)` unchanged.”

- [MAJOR] Testing strategy does not meet edge/negative coverage for the new mount — intent requires “new coverage proves the top-of-tab mount appears after first send” (`01-intent.md` L21) but design only mentions harness BODY + that one proof (`03-design.md` L49, L57). Missing named cases: chip opens the same four-row popover (not gear); chip stays after `clearWelcome` while welcome card stays hidden (`test/session-setup.dom.test.ts:107–112` must not be “fixed” by undoing hide); locked controls while `setBusy:true`; Claude chip omits effort segment; onboarding hides/non-actionable chip. **Resolve:** Add an explicit DOM test list (new `session-setup-chip.dom.test.ts` or extend existing) covering at least one edge/negative beyond “visible after send.”

- [MAJOR] UI a11y / state inventory underspecified for a new always-on control (hard gate 8 / UI work). Design sets `title="Session setup"` on the shell button (`03-design.md` L41) but does not specify keyboard operability (native `<button>` is fine if not replaced), focus-visible treatment when open, live `aria-expanded` on the chip while the popover is open, or disabled/locked presentation of the **chip itself** vs only locking rows inside the popover. Unhappy path “Model not yet known → hidden” and “busy → show locked” conflict slightly (“prefer show locked while busy” vs hide until model known — order of gates unclear for priming before `session` event). **Resolve:** Freeze chip show/hide/lock truth table (onboarding / no model / busy / ready) and minimal a11y attrs (`title` + optional `aria-expanded`/`aria-haspopup`).

- [MINOR] Mode short words in the chip label are hand-waved as `Agent` / `Plan` / `Auto` (`03-design.md` L52) while existing short mode labels already live as `SETUP_MODE_OPTIONS`: Agent / Plan / **Auto accept** (`media/webview-helpers.js:476–479`). Using “Auto” invents a third string; “Auto accept” lengthens an already long summary. **Resolve:** Reuse `SETUP_MODE_OPTIONS` labels (or a pure chip helper mapping) so chip and segmented control cannot drift.

- [MINOR] Agent segment of the proposed chip text uses short “Grok” / “Claude” while Agent row options are “Grok Build” / “Claude Code” (`media/webview-helpers.js:468–470`). That matches `updateBackendLabel` (`media/chat.js:428–431`) if intentional — document that the chip mirrors the backend chip short form, not the setup-row full labels, so implementers don’t invent “Grok Build · Grok Build · …”.

- [MINOR] COEXIST dual door (top chip + bottom `#model-label`) is acceptable under intent/non-goals, but refresh paths can diverge: effort pick updates `updateModelLabel` optimistically (`media/chat.js:531`) while mode/backend rely on host round-trips + `refreshSessionSettingsMounts`. Design says extend `refreshSessionSettingsMounts` and mirror `updateModelLabel` call sites (`03-design.md` L54–56) — good; also require the optimistic effort path to refresh the top chip in the same tick (or only via extended `refreshSessionSettingsMounts` if that always runs after `updateModelLabel` on that path — today both run in `pickSessionSetting`). Obligation “document dual openers” is comment-only — fine for v1.

- [MINOR] Top-bar layout with `justify-content: flex-end` (`media/chat.css:81–84`) really does need the spacer / `margin-left: auto` on the first right control (`03-design.md` L37–46); without it the chip packs right with history/new/Docs/Actions. Design states this; implement must not “just insert first child.” Narrow panels: Docs + “Grokbit Actions” already consume width — max-width ~40–50% may still collide; prefer ch/max-width + ellipsis + full string in `title` (design L89) and keep “Grokbit Actions” text as-is (non-goal: full top-bar responsive redesign).

- [MINOR] Citations are largely accurate (see spot-checks). Survey “pure summary label builder DOES NOT EXIST” is correct; optional pure `sessionSetupChipLabel` is the right reuse direction. No undeclared supersession of welcome card or host protocol. Option C correctly rejected against top-of-tab done-criterion. Residual product choice (quiet bottom chip) deferred — OK.

### Spot-checks performed

- `01-intent.md`, `02-survey.md`, `03-design.md` (full read)
- `media/chat.js` — `updateModelLabel` (~413–423), `currentSessionSetupModel` / `pickSessionSetting` / builders (~500–681), `positionPopover` / `positionDropdownPopover` (~1863–1897), `closePopovers` (~1767–1776), `clearWelcome` (~2531–2538), `resetForNewSession` (~2735+), session/model/mode/backend/`setBusy` refresh sites (~5376, 5542–5590, 5925–5940), `modelLabel.onclick` (~6054–6057)
- `media/chat.css` — `.top-bar` (~81–96), `.toolbar-popover` (~100–110), `.model-label-btn` (~1682–1689), “TWO mounts” comment (~1901–1905), `.plan-banner` (~2523–2534)
- `src/sidebar.ts` — `getHtml` top-bar / plan-banner / session-setup-card / model-label / session-settings-popover (~4890–4951)
- `test/session-setup.dom.test.ts` — hide-on-first-send (~107–112)
- `test/webview-harness.ts` — `BODY` top-bar + popover host (~21–65)
- `test/model-chip.dom.test.ts` — bottom chip + popover open (partial)
- `media/webview-helpers.js` — `sessionSetupModel` / `SETUP_MODE_OPTIONS` / `SETUP_AGENT_OPTIONS` (~468–560)

### Coverage of done-criteria

| Criterion (intent) | Satisfied by design? |
|---|---|
| After first prompt, still open Agent/Model/Thinking/Mode without leaving tab | **Partial** — yes if popover open works; blocked by positioning finding |
| Access from **top** of session tab | Yes (Option A top-bar chip) once open works |
| Minimal vertical space (reuse top-bar / no multi-row card) | Yes (Option A; B rejected correctly) |
| Mid-session control behavior + lock-while-busy unchanged | Yes (reuse `sessionSetupModel` + `pickSessionSetting` + `locked: state.busy`); chip show/lock truth table needs freeze |
| Empty/new tabs still present Session setup clearly | Yes (LEAVE welcome card) |
| Existing tests green; new coverage after first send | **Partial** — harness + “appears after send” named; edge/negative list missing |

### Required changes (before Approve)

1. **Specify dual-anchor popover placement** so top-bar open and bottom model-chip open both work with one popover surface (re-parent-on-open + branched positioner, or parent-independent coords). Remove “verify later” as the sole plan for this risk.
2. **Name concrete DOM tests** for post-send chip visibility, open→four rows, at least one lock/Claude/onboarding edge.
3. **Freeze chip visibility/lock truth table** and short-label source (mode/backend strings).

---

## Round 2 — Plan Reviewer (re-review)

**Verdict:** APPROVE with nits

### Residual / new findings

None — Round 1 BLOCKER and MAJORs cleared.

Spot-check of revised `03-design.md` against live anchors:

| Round 1 finding | Cleared? | Evidence in revised design |
|---|---|---|
| [BLOCKER] Dual-anchor placement left as “verify later” | **Yes** | §2 mandates re-parent-on-open + branch: top-bar → append to `.top-bar` + new below-chip left-clamp positioner; `#model-label` → restore under `.composer` + existing `positionPopover`. Explicit ban on shipping top chip → unchanged `positionPopover` only. Spot-check confirms `positionPopover` still bottom-anchors to `parentElement` above the button (`media/chat.js:1863–1877`) and `openSessionSettingsPopover` still calls only that path (`:667–674`) — the plan correctly treats the branch as mandatory, not optional. |
| [MAJOR] Missing named edge/negative DOM tests | **Yes** | Named suite § “Named DOM / unit tests”: cases 1–8 (post-send visibility + card still hidden; open→four rows; dual-anchor parent/branch; bottom regression; busy rows locked / chip visible; Claude omits effort; onboarding hidden; pure label unit). |
| [MAJOR] Chip show/hide/lock + a11y underspecified | **Yes** | §4 frozen truth table (onboarding / no model / busy / ready / post-send / empty welcome) + a11y minimum (`button`, `aria-haspopup`, `aria-expanded`, focus-visible, full `title`). Busy locks **rows**, chip stays openable — resolves the prior “disable chip vs lock rows” ambiguity. |

**Nits only (non-blocking, do not re-open plan loop):**

- [NIT] Chip mode short form `Auto` vs setup row `Auto accept` is intentional (density + full label in `title`). Implement should keep the short map keyed by the same `SETUP_MODE_OPTIONS` **ids** in/near the pure helper so a future mode id rename cannot desync chip vs segmented control.
- [NIT] Case 3’s “assert `top` style / parent is top-bar” is the right dual-anchor proof; happy-dom may not give real layout geometry — parent re-parent (or which positioner branch ran) is the reliable assert; style geometry is optional.

### Checklist

- Dual-anchor strategy concrete? **y**
- Named tests cover edge/negative? **y**
- Truth table frozen? **y**
- Done-criteria all satisfiable? **y**

### Done-criteria recheck

| Criterion (intent) | Satisfied by design? |
|---|---|
| After first prompt, still open Agent/Model/Thinking/Mode without leaving tab | **Yes** (top chip + dual-anchor popover) |
| Access from **top** of session tab | **Yes** (left top-bar chip) |
| Minimal vertical space | **Yes** (Option A; no strip) |
| Mid-session behavior + lock-while-busy | **Yes** (reuse builders; rows locked while busy) |
| Empty/new tabs still present Session setup | **Yes** (LEAVE welcome card) |
| Existing tests green; new coverage after first send | **Yes** (named suite + existing stay green) |

**Plan is ready for `/implement`.** Do not rewrite the design; implement from revised `03-design.md`.

---

## Round — Plan-level pass (Loop 4)

**Verdict:** APPROVE with nits

### Findings

None blocking. Tasks faithfully carry `03-design.md` Option A + dual-anchor + truth table + named tests. Ordering and verify commands are implementable on this repo.

**Checklist (plan fidelity only — no redesign):**

| Check | Result |
|---|---|
| Every task has runnable verify (Windows / `npm test`) | **y** — T1–T4 use `npm test -- <paths>`; T5 is docs-only with explicit manual wording check + optional full suite |
| Verification matrix covers every done-criterion | **y** — all six intent criteria map to T1–T4 (+ design Option A for minimal height) |
| Disposition summary matches `03-design.md` | **y** with count nit (see below) — every design disposition has a handling task or explicit LEAVE |
| No task unverifiable / missing baseline / removes / rollback | **y** — all five tasks carry the full block fields |
| T1 before T3; T2 parallel with T1 | **y** — T3 `depends: T1, T2`; T1/T2 `depends: none`; T4/T5 after T3 |

**Task → design coverage**

| Task | Design load | Notes |
|---|---|---|
| T1 | §2 dual-anchor (BLOCKER) | Branch + `positionSessionSettingsFromTop`; verify holds bottom path (`model-chip.dom`) until chip exists |
| T2 | §3 pure `sessionSetupChipLabel` | Parallel-safe; unit omit rules (design test #8) |
| T3 | §1 shell, §4 truth table, §5 wire, §6 CSS, §7–8 LEAVE/COEXIST | Correctly waits on T1+T2; does not invent host/ACP messages |
| T4 | Named DOM tests 1–7 (+ notes 1–8) | New `session-setup-chip.dom.test.ts`; regressions on welcome hide + model chip |
| T5 | REPLACE docs | Terse mid-session top-bar mention |

**Disposition cross-walk**

| Design item | Disposition | Plan handling |
|---|---|---|
| Bottom `#model-label` | COEXIST | T1+T3 keep path; T4 regression — summary COEXIST=1 |
| `#backend-label` / `#mode-btn` | LEAVE | No task — summary LEAVE |
| Welcome `#session-setup-card` | LEAVE | T3 notes + existing hide test — summary LEAVE |
| CSS “TWO mounts” comment | REPLACE | T3 |
| CLAUDE/README mid-session line | REPLACE | T5 |
| `positionPopover` alone for top | REPLACE | T1 |

**Nits only (non-blocking, do not re-open plan loop):**

- [NIT] Disposition summary **REPLACE count = 2** while design lists **three** REPLACE rows (positioner behavior; CSS comment; docs). Handled correctly via T1 + T3 + T5; only the tally is under-counted (T3/T5 bundled as one).
- [NIT] Verification matrix row “Empty tabs still **clear** Session setup” is slightly ambiguous vs intent “still **present** clearly”; coverage is still correct via LEAVE welcome card + hide-on-first-send baselines.
- [NIT] T4 notes say “tests 1–8” but case 8 (pure label) is T2/`webview-helpers.test.ts`, not the new DOM file — fine if implement treats 8 as already owned by T2.
- [NIT] Minimal-vertical-space criterion is proven structurally (Option A + chip in existing top-bar), not by a hard assert that no second strip exists — acceptable for this UI shape.

### Done-criteria × matrix

| Criterion (intent) | Matrix / tasks | OK? |
|---|---|---|
| After first prompt, still open four controls | T3 + T4 cases 1–2 | y |
| Access from top of session tab | T3 shell + T4 chip click | y |
| Minimal vertical space | Option A; T3 CSS; optional T4 | y |
| Mid-session behavior + lock-while-busy | T1 pick path reuse; T4 busy | y |
| Empty tabs still present Session setup | T3/T4 + `session-setup.dom` | y |
| Existing green + new post-send coverage | T1/T2/T4 verifies (+ T3) | y |

**Plan is ready for `/implement`.** Do not rewrite design or task graph for these nits.
