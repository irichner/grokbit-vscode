# Review log — Markdown document cards

Append-only. Newest round at the bottom.

---

## Round 1 — Plan Reviewer (adversarial)

**Artifacts read:** `01-intent.md`, `02-survey.md`, `03-design.md` only.

### Findings

1. **MAJOR — Scope of `text` kinds**  
   Intent done-criteria name MARKDOWN only. Design also drops `.txt`/`.rtf`. That may be correct but is not in done-criteria; Reviewer cannot verify “text” without an explicit criterion or a non-goal. Either add a done-criterion for text or keep text carding until justified.

2. **MAJOR — Contract of `extractBusinessDocumentPaths`**  
   Design filters inside extract. Call sites: only `emitToolBusinessDocs` (survey). If any future caller wants “all business paths including md,” silent filter breaks them. Prefer an explicit named gate `shouldEmitDocumentCard(kind)` used in extract *or* only in emit, with JSDoc update stating card policy. Not a BLOCKER if JSDoc + tests lock the contract.

3. **MINOR — Absolute-path always-surface**  
   Survey notes absolute paths still card even when missing. Out of intent scope; do not expand this plan to fix it.

4. **MINOR — Product question deferred**  
   Intent left Office retention as gate default. Fine if disposition table stays explicit at gate.

5. **No BLOCKER** on Option A vs B/C — Option A matches thin-client non-goals; Option B fails edit-noise.

### Verdict (Round 1)
- BLOCKER: 0  
- MAJOR: 2 (text scope; extract contract clarity)  
- MINOR: 2  

---

## Round 1 — Architect response

1. **MAJOR text:** Accept. **Decision:** drop `text` alongside `markdown` in the same card filter (same false-positive class: agent logs, notes, skill outputs). **Update intent done-criteria** to: no document card for markdown **or** plain-text kinds from tool results. Keep CSV (tabular business deliverable).

2. **MAJOR extract contract:** Accept. Implementation will:
   - Keep `businessDocKindForPath` unchanged.
   - Add `isBusinessDocumentCardKind(kind: BusinessDocKind): boolean` pure helper (card allowlist).
   - Call it from `extractBusinessDocumentPaths` `add()` so the extract function’s job remains “card candidates only,” and JSDoc will say so explicitly.
   - Unit-test the helper independently + extract negatives for `.md`/`.txt`.

3. Absolute-path / settings: out of scope — no change.

---

## Round 2 — Plan Reviewer

Re-read revised design decisions above (in this log + design file intent).

### Findings

1. ~~MAJOR text~~ **Resolved** if `01-intent.md` is patched with text kinds — Architect must update the intent file, not only this log.  
2. ~~MAJOR contract~~ **Resolved** by named `isBusinessDocumentCardKind` + JSDoc.  
3. **MINOR** — Confirm `workspace-docs` still lists `.md` after change (LEAVE disposition); add a one-line note in plan task verify that `businessDocKindForPath("x.md") === "markdown"` still holds.

### Verdict (Round 2)
- BLOCKER: 0  
- MAJOR: 0 (pending intent file patch as T0/doc in plan)  
- MINOR: 1 (workspace-docs regression check)

**Loop 3 exit:** zero BLOCKER / zero MAJOR outstanding once intent is synced.

---

## Scope change — human gate (2026-08-01)

User overruled Option A: **also stop carding Word / Excel / PowerPoint / PDF / CSV**.

- Design flipped to **Option C** (disable all tool-result document auto-cards).
- Intent / plan / assumptions rewritten in place under the same slug `markdown-document-cards`.
- No new Loop 3 BLOCKERs: narrowing further reduces false-positive surface; residual risk is loss of Office one-click cards (accepted by user).
- Reviewer note: ensure implement does **not** ship a partial allowlist leftover from Option A.
