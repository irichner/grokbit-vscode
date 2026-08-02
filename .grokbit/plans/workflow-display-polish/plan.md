# Plan — Workflow Display Polish

Strip the `grokbit-` prefix from workflow tile names and color them cyber
green.

---

## T1 — Add `--neon-green` CSS custom properties

**Intent:** Establish the cyber green accent color following the existing
`--neon-cyan`/`--neon-magenta` pattern.

**Files:** `media/chat.css`

**Changes:**
- Add to the `:root` block (after the existing neon variables):
  ```css
  --neon-green: #39ff14;
  --neon-green-ink: color-mix(in srgb, var(--neon-green) 55%, var(--vscode-foreground));
  ```

**verify:** `grep -- '--neon-green' media/chat.css` returns both lines.
**baseline:** none
**removes:** none
**rollback:** Delete the two lines.

---

## T2 — Strip `grokbit-` prefix in `capabilityGroupsView` label

**Intent:** The display label for grokbit workflow items should show
"Explore", "Plan", etc. — not the full skill name.

**Files:** `media/webview-helpers.js`

**Changes:**
- In `capabilityGroupsView`, where `label` is set (`label: raw.name || ""`),
  add a transform: if `raw.kind === "grokbit"` and the name starts with
  `"grokbit-"`, set `label` to the remainder with the first letter
  capitalized. Otherwise keep `label: raw.name || ""`.
- Stamp `kind: raw.kind` on the returned item (already done — verify it
  is present; it is at `media/webview-helpers.js:~820`).

**verify:** `npm test -- --grep "capabilityGroupsView"` — all passing
(after T5 updates the expected values).
**baseline:** `label` currently equals `name` for all items.
**removes:** none
**rollback:** Revert the label line to `label: raw.name || ""`.

---

## T3 — Add `data-kind` attribute to capability rows

**Intent:** Give CSS a hook to target rows by kind without the renderer
branching on kind strings in its logic.

**Files:** `media/chat.js`

**Changes:**
- In `buildCapabilityRow`, after the row element is created, add:
  `if (item.kind) row.dataset.kind = item.kind;`

**verify:** Rebuild + open a session tab → inspect a Grokbit Actions tile
→ the `.capability-row` element carries `data-kind="grokbit"`.
**baseline:** No `data-kind` attribute exists on capability rows today.
**removes:** none
**rollback:** Delete the one `dataset.kind` line.

---

## T4 — Apply cyber green to grokbit workflow names via CSS

**Intent:** Workflow tile names render in cyber green.

**Files:** `media/chat.css`

**Changes:**
- After the existing `.capability-row-name` rule block, add:
  ```css
  .capability-row[data-kind="grokbit"] .capability-row-name {
    color: var(--neon-green-ink);
  }
  ```

**verify:** `grep 'data-kind.*grokbit.*capability-row-name' media/chat.css`
returns the rule.
**baseline:** `.capability-row-name` uses `var(--vscode-foreground)`.
**removes:** none
**rollback:** Delete the added rule.

---

## T5 — Update tests

**Intent:** Existing tests that assert `label` values or
`.capability-row-name` textContent for grokbit items must reflect the
stripped names.

**Files:** `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts`

**Changes:**
- `test/webview-helpers.test.ts` — any `capabilityGroupsView` test
  asserting `label` for a grokbit item: update expected values from
  `"grokbit-explore"` to `"Explore"` (etc.). Verify `name` is still the
  raw `"grokbit-explore"`.
- `test/capabilities.dom.test.ts:111` — change expected
  `.capability-row-name` textContent from
  `["grokbit-explore", "grokbit-plan", ...]` to
  `["Explore", "Plan", "Implement", "Test", "Document"]`.
- Any other test asserting the raw name as the rendered text.

**verify:** `npm test` — full suite green, 1336+ tests.
**baseline:** Tests currently assert the raw `grokbit-*` names.
**removes:** none
**rollback:** Revert expected values.

---

## Summary

| Task | Files | Risk |
|------|-------|------|
| T1 | chat.css | None — additive CSS variable |
| T2 | webview-helpers.js | Low — label is display-only |
| T3 | chat.js | None — additive data attribute |
| T4 | chat.css | None — additive CSS rule |
| T5 | test/*.ts | None — test alignment |

Blast radius: 3 files changed (`media/chat.css`, `media/webview-helpers.js`,
`media/chat.js`), 2 test files updated. No new dependencies. No schema
changes. No host-side TypeScript changes.
