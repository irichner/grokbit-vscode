# Review Report
- **Target:** plan  
- **Paths:** `docs/plans/paste-screenshots.md` (revised); continuity: `docs/plans/paste-screenshots.review.md`  
- **Pass:** 2  
- **Overall:** **Approve**  
- **Hard gates:**
  - **1 Goal + acceptance criteria:** **pass** — ACs 1–10 are falsifiable; AC 4 (image-only send), AC 8 (durable buffer + re-resolve), AC 9 (client-then-host size) close the pass-1 product holes.
  - **2 Non-goals:** **pass** — OCR, in-webview edit, separate vision API, cold-resume fidelity, release bump, drag-drop epic remain bounded.
  - **3 Risk / blast radius:** **pass** — `AcpClient.prompt`, `pendingUserSends`, `localResourceRoots`, postMessage size, Grok UX, staging disk; mitigations listed.
  - **4 Ordered steps + per-step verification:** **pass** — Steps 0–5 name load-bearing work (roots, queue contract, send gate, co-render) with per-step verify (tests / source-level root assert / probe notes).
  - **5 Testing strategy:** **pass** — Named unit / edge / queue / DOM rows include image-only, mid-turn, co-render, client oversize, capability-false; **NO COVERAGE TOOL** stated.
  - **6 Failure modes:** **pass** — Stage fail, oversize, stale URI, early unlink forbidden, mid-turn drop forbidden, root miss, plan mode.
  - **7 Observable verification:** **pass** — `npm test`, `tsc`, Claude/Grok manuals, image-only, mid-turn drain, hide+reveal, design criteria 1–4.
  - **8 UI/UX design:** **pass** — Named `.attachment` pattern, VS Code tokens, co-render contract, state inventory (empty/error/busy/notice/narrow), a11y remove names + focus-visible, falsifiable design criteria; no new `@media`.

### Pass-1 Required Changes — disposition

| # | Pass-1 item | Pass-2 status |
|---|-------------|---------------|
| 1 | Image-only send AC + `sendOrStop` gate | **Addressed** — AC 4; Step 3 idle + mid-turn; DOM cases |
| 2 | Mid-turn `pendingUserSends` + `sentImages` | **Addressed** — frozen type + Decision (A); `queueFollowUpSend` steps; queue tests |
| 3 | Co-render `#attachments` | **Addressed** — frozen `renderAttachments` algorithm; design criterion 3; DOM either-order |
| 4 | Buffer replay durable schema | **Addressed** — `BufferedUserImage` (no sole `previewUri`); AC 8; keep-until-dispose; re-resolve on ready/replay |
| 5 | Staging root + `localResourceRoots` | **Addressed** — A4 promoted: globalStorage `paste-images/<sessionKey>/` + every panel options path; Step 2 verify |
| 6 | Client size check before `postMessage` | **Addressed** — AC 9; webview helper; host defense; no-post on oversize |
| 7 | Testing strategy rows | **Addressed** — table covers the above |

Open Qs from pass 1 are **resolved** in-plan (tiles-only strip, dispose unlink, Step 0 client-capability note).

### Required Changes
*(empty — Approve)*

### Test/coverage gaps
*(non-blocking nits only)*
- Prefer one pure/host test that **buffered** `userMessage.images` is `BufferedUserImage`-shaped (absPath present; no requirement that buffer alone holds a live `previewUri`) and that the re-resolve map skips missing files — manual hide+reveal (checklist #8) already covers the happy path.
- Prefer an explicit unit case: **empty text + images only** → `buildSessionPromptBlocks` still returns valid blocks (DOM image-only send already implied).

### Questions
*(optional polish for implementers — not Approve blockers)*
1. Freeze **`sessionKey`** as e.g. `session.activeSessionId` (or `backend + id`) so staging paths and dispose cleanup are unambiguous across backends.
2. Path-fallback copy when `!imageCapable`: pick one placement (`Attached image file(s):` vs vscode-context envelope) in implement to avoid ad-hoc prompt-builder drift.
3. Confirm mid-turn **text-only** drain also goes through Decision (A) builder (no leftover string-only `finalPrompt` fork) for a single code path.

### Risk if implemented as-is
Low for the pass-1 failure modes (image-only no-op, mid-turn image loss, `renderChips` wipe, wrong roots, postMessage oversize). Residual product risk is mostly external: Claude vision depends on Step 0 probe; Grok stays path+notice until `image: true`. In-tab thumbs depend on dispose-time (not send-time) unlink — plan already forbids early unlink.

### Next
- Lead may treat this as **plan Approve** for hard gates.
- **Do not implement** until **user approval** of the plan (plan’s own handoff + project pipeline).
- On implement: pure → host (roots + queue + buffer) → webview (paste, send gate, co-render) → CSS/docs; keep `prompt(string)` for primer/handoff.
