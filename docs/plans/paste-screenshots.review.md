# Review Report
- Target: plan
- Paths: `docs/plans/paste-screenshots.md`
- Pass: 1
- Overall: **Request Changes**
- Hard gates:
  - 1 Goal + acceptance criteria: **pass** (falsifiable AC 1–9; capability-gated Grok/Claude split is measurable)
  - 2 Non-goals: **pass** (OCR, in-webview edit, separate vision API, cold-resume fidelity, release bump, drag-drop epic all bounded)
  - 3 Risk / blast radius: **pass** (`AcpClient.prompt`, sidebar send path, webview attachments, staging FS; mitigations listed)
  - 4 Ordered steps + per-step verification: **fail** (Steps 0–5 exist, but host send/queue + webview empty-send + `#attachments` co-render + `localResourceRoots` are load-bearing and not specified as named changes with checks)
  - 5 Testing strategy: **fail** (good pure limits + capability-false cases + NO COVERAGE TOOL, but misses edge/negative for mid-turn queue, image-only send, and `renderChips` wiping thumbs)
  - 6 Failure modes: **pass** (reject, stage fail, dispose cleanup, reveal stale URI, plan mode)
  - 7 Observable verification: **pass** (`npm test`, `tsc`, manual Claude/Grok/remove/text-paste, design criteria 1–4)
  - 8 UI/UX design: **pass** (named `.attachment` pattern, token guidance, state inventory, a11y names/focus, falsifiable design criteria; no new `@media`)

- Required Changes:
  1. **[gap]** **Image-only send must be an explicit product + webview rule.** Today `sendOrStop` only sends when `text` is non-empty or a non-hidden **chip** exists (`media/chat.js`); host `pendingImages` are invisible to that gate. Empty composer + one pasted screenshot would no-op. Add AC (e.g. “Send with only pending image(s) and empty text succeeds”) and Step 3 work: mirror pending images in webview state (or query host), treat them like attachments in idle **and** mid-turn busy paths, clear optimistic UI on send the way chips do.
  2. **[gap]** **Specify mid-turn queue contract (`pendingUserSends`).** Queue path today snapshots `{ text, finalPrompt: string, sentChips }` and clears chips (`queueFollowUpSend` / `Session.pendingUserSends`). Multi-block prompts + `pendingImages` break that. Plan must freeze: snapshot `PendingImage[]` (or prebuilt content blocks) at queue time; clear `session.pendingImages` + post empty `pendingImages` like chips; extend the queue entry type; drain via the same block builder / `prompt` overload as live send (not string-only `finalPrompt`). Add a unit/DOM or pure-host test for “paste → Send while busy → image still in prompt params.”
  3. **[gap]** **Co-render contract for `#attachments`.** `renderChips()` does `attachmentsEl.innerHTML = ""` then only file uploads. Image tiles will vanish on any chip update unless one pure/shared render path re-draws **both** file attachments and pending images (or images are re-applied immediately after every `renderChips`). Name this in Step 3 + a DOM test: add file chip while image pending → both remain.
  4. **[gap]** **Buffer replay schema for `userMessage.images`.** With `retainContextWhenHidden: false`, replay must not depend on stale `asWebviewUri` strings in `Session.buffer`. Freeze wire: buffer stores durable fields (`id`, `absPath` or staging key, `fileName`, `mimeType`); on `ready` / `replayInto`, re-resolve preview URIs (same as re-post `pendingImages`). Step 2 “emit with image metadata” is too vague for this lifecycle.
  5. **[gap]** **Promote A4 into Step 2 (or pick a staging root that is already allowed).** Session panels’ `localResourceRoots` are only `media`, `resources`, and `resolveGrokHome()` — **not** `globalStorageUri` / `os.tmpdir()`. Preferring `asWebviewUri` under those locations **will** fail thumbs without an explicit root add in `openPanel` (and any path that rebinds panel options). Either: (a) stage under a directory already under grok home (document tradeoffs for Claude tabs), or (b) add the staging root to panel options and verify preview loads after paste without data-URL fallback. Step 2 verify should include that check.
  6. **[risk]** **Enforce size before webview→host postMessage.** Host max after receipt is necessary but late: an 8 MiB decoded image is larger as base64 and can stress/drop the message. Require webview (or pure helper used there) to reject by byte length **before** `pasteImage`, with the same muted error path; keep host re-check as defense-in-depth.
  7. **[gap]** **Testing strategy rows for the above.** Add named cases: image-only send allowed; text-only paste does not `preventDefault` incorrectly (already listed); mid-turn queue preserves images; `renderChips` coexists with pending images; capability false ⇒ path/text blocks only, never image block; oversize rejected client-side.

- Test/coverage gaps:
  - No case for **image-only** send (current UI gate).
  - No case for **mid-turn** `pendingUserSends` + images.
  - No case for **chip render clearing** image thumbs.
  - No case for **buffer/replay** image metadata shape (abs path → re-resolved URI).
  - Pure `buildSessionPromptBlocks` + mime/size tests as written are good; keep `image/svg+xml` reject.
  - Coverage: **NO COVERAGE TOOL** correctly noted; sufficient if named edges above land.

- Questions:
  1. For Grok degraded path, should staged paths become normal `FileChip`s (and show as file rows) or stay image tiles with “path only” semantics? Plan says both “thumbnail” and “path chips” — pick one strip UX to avoid double-representation.
  2. After successful send, if staged files are unlinked immediately, in-tab buffer thumbs for the user bubble break unless previews were copied or files kept until session dispose. Keep-until-dispose vs copy-to-session-buffer-dir?
  3. Optional probe: does ACP require any **client** capability advertisement for image content, or only agent `promptCapabilities`? Record in `research/paste-image-input.md`.

- Risk if implemented as-is:
  - Paste UI may look correct then **fail on Send** for screenshot-only messages.
  - Mid-turn follow-ups drop images or never multi-block prompt.
  - Thumbs disappear when chips re-render or after hide/reveal if URIs/roots are wrong.
  - Grok path may be safe (`no -32602`) while Claude vision path is under-tested if Step 0 is skipped casually (plan allows UI scaffolding first — OK if AC5 stays probe-gated).

- Next: **revise plan** (address Required Changes 1–7 in `docs/plans/paste-screenshots.md`) → **re-review** (pass 2). Do **not** implement until Approve (or durable waiver after pass 2).
