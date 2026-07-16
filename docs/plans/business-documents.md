# Business documents (create / edit discovery + result cards)

| Field | Value |
|-------|--------|
| **Status** | Implemented (2026-07-15) — discover + document cards; `npm test` 748 green |
| **Owner** | Lead (Grokbit) |
| **Date** | 2026-07-15 |
| **Product decision** | Discover + complete (not a full Office editor) |
| **v1 formats** | All common business docs (phased detection; UI is format-agnostic) |

## Goal

Grokbit users can **discover** and **complete** create/edit workflows for common business documents without leaving the chat:

1. **Discover** — welcome starter + README / slash-command docs surface that Grok can create and edit Word, Excel, PowerPoint, PDF, CSV, Markdown reports, and similar deliverables (via installed Grok skills `/docx`, `/pptx`, `/xlsx` and ordinary file tools for text/PDF where available).
2. **Complete** — when a turn produces a business-document file path, the chat shows a **document result card** (filename, type label, actions: Copy path / Open / Reveal in OS) so the deliverable is one click away — analogous to generated media cards for `/imagine`.

**Success looks like:** a new user opens a session, sees a business-document starter, asks for a spreadsheet or report, and gets a tappable card for the resulting file; docs match reality; all new pure logic is unit-tested; `npm test` stays green.

### Acceptance criteria (falsifiable)

| # | Criterion | How verified |
|---|-----------|--------------|
| A1 | Welcome catalog includes a business-document starter that seeds a ready-to-edit prompt (not auto-send) | `welcomeStarters` unit test + friendly-ui DOM test |
| A2 | Pure helper classifies paths for: `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.csv`, `.md`/`.markdown`, and rejects unrelated exts (e.g. `.ts`, `.jpg`) | unit tests positive + negative |
| A3 | Pure extractor pulls absolute business-doc paths from tool-result text (JSON `path` and prose forms), de-dupes, ignores media-only paths | unit tests |
| A4 | Host emits a buffered webview message for each accepted path so replay after tab hide/show still shows the card | code path uses `emit` (not `postTo`); DOM test with replay if feasible, else unit + integration comment |
| A5 | Card actions: **Copy path**, **Open** (existing `openFile`), **Reveal in OS** (new host message) | DOM + host message handling tests |
| A6 | README Features + `docs/SLASH-COMMANDS.md` document the capability and skill entry points | manual checklist in verification |
| A7 | No regression: media cards, chips, plan cards unchanged; `npm test` exit 0 | `npm test` |

## Non-goals

- **Not** an in-webview Office suite (no WYSIWYG Word/Excel/PowerPoint editor).
- **Not** implementing or bundling the Grok `docx`/`pptx`/`xlsx` skills inside the extension (they live under `~/.grok/skills/`; CLI-owned).
- **Not** guaranteeing LibreOffice/pandoc/docx npm deps are installed on every machine (skills document their own deps).
- **Not** PDF page preview / spreadsheet grid preview in chat (card + open only).
- **Not** new slash commands owned by the extension (`/docx` etc. remain CLI skills via `available_commands_update`).
- **Not** changing plan-gate, ACP protocol, or media-gen pipeline except to share path-cleaning patterns if useful.
- **Not** auto-attaching produced files as chips.
- **Not** Marketplace rebrand or version bump (user-initiated).

## Assumptions

| Assumption | Falsifier |
|------------|-----------|
| Grok skills write real files and mention paths in tool results (JSON and/or prose), similar to media | Live probe: create a docx; inspect tool_call_update content |
| Absolute paths appear often enough for extraction; relative workspace paths are also useful | Probe + unit tests for both absolute and workspace-relative resolution in host |
| `openFile` already opens text docs; binaries may open poorly in VS Code but **Reveal in OS** / default open still helps | Manual check on Windows for `.docx` |
| Existing CSS tokens (tool rows, generated-media actions, permission cards) are enough to style a document card | Visual pass against UI standards |
| Coverage command remains NONE → waiver `docs/waivers/coverage-no-tool.md` applies | AGENTS.md Project Test Commands |

## Risks / blast radius

| Risk | Impact | Mitigation |
|------|--------|------------|
| False-positive cards (agent *mentions* an existing `.pdf` without creating it) | Noise | Extract only from **completed tool_call / tool_call_update content**, not free-form agent prose; optional host `fs.existsSync` gate; de-dupe per path per turn |
| Path regex too greedy (Windows `\\?\`, UNC, trailing punctuation) | Broken open | Reuse media path cleaning (`\\?\` strip); shared punctuation lookahead like `MEDIA_PATH_IN_TEXT_RE` |
| Double cards on multi-update tool streams | Spam | Set of emitted paths per toolCallId / turn |
| Binary open via `openTextDocument` fails or shows garbage | Bad UX | Card primary for binary kinds: prefer reveal / open with `vscode.env.openExternal(Uri.file)` for known binary kinds; text kinds use existing `openFile` |
| Welcome overcrowding | Cognitive load | **One** starter covering multi-format (not one card per format) |
| Docs promise more than CLI can do without deps | Support load | README: “requires Grok skills + any skill-listed tools (e.g. Node `docx`)” |

**Surfaces touched:**

- `src/acp-dispatch.ts` — pure classify + extract helpers
- `src/acp.ts` — track/emit document paths on completed tools (mirror mediaGenCallIds pattern only if needed; prefer extract-on-complete without tool-name allowlist so skill shell tools work)
- `src/sidebar.ts` — emit message; handle `revealInOs` / binary open
- `media/chat.js` — render document card; message type
- `media/chat.css` — card styles (VS Code CSS vars only)
- `media/webview-helpers.js` — welcome starter
- `test/*` — pure + DOM tests
- `README.md`, `docs/SLASH-COMMANDS.md` — discovery docs
- Optional light touch `CLAUDE.md` ACP surfaces / chat surfaces if behavior is architectural enough

## Exploration findings

- Extension is a **thin ACP client**; document *creation* is already possible when CLI skills (`~/.grok/skills/{docx,pptx,xlsx}`) run via agent tools. Gap is **discovery + result UX**, not generation engines.
- Media completion pattern (`isMediaGenToolCall` + `extractGeneratedMediaPaths` + `postGeneratedMedia` + webview `addGeneratedMedia`) is the right template, but office skills are **not** named `image_gen` — detection must be **extension-based on tool result text**, not media tool titles.
- File chips deliberately pass **paths not `@`-reads** so binaries do not force a full text read — attachments of office files already work as paths.
- Welcome starters live in pure `welcomeStarters()` in `media/webview-helpers.js` (tested in `test/friendly-ui.dom.test.ts`).
- `openFile` host path uses `openTextDocument` + `showTextDocument` — fine for `.md`/`.csv`; weak for `.docx`/`.xlsx`/`.pptx`/`.pdf` → need **Reveal in OS** and/or `openExternal` for binary kinds.
- Prior plans in `docs/plans/` do not cover this area.

## Phases

### Phase 1 — Pure classification + extraction

- [ ] Add `BusinessDocKind` union (frozen v1): `word` \| `excel` \| `powerpoint` \| `pdf` \| `csv` \| `markdown` \| `text`.
- [ ] `businessDocKindForPath(path): BusinessDocKind | null` by **frozen extension allowlist**:
  - `word`: `.docx` (not legacy `.doc` unless converted by skill — do not claim `.doc` support in UI label unless path is `.docx`)
  - `excel`: `.xlsx`
  - `powerpoint`: `.pptx`
  - `pdf`: `.pdf`
  - `csv`: `.csv`
  - `markdown`: `.md`, `.markdown`
  - `text`: `.txt`, `.rtf`
  - Explicitly **out** of extractor: `.doc`/`.xls`/`.ppt` (legacy), images/videos (media pipeline), source code.
- [ ] `extractBusinessDocumentPaths(payload): BusinessDocRef[]` from tool content blocks (JSON `path` + prose absolute/relative path scan with business exts only).
- [ ] Negative: media paths, source code, empty content, invalid JSON without path → `[]`.
- [ ] Unit tests in `test/acp-dispatch.test.ts` (or new `test/business-docs.test.ts`).

**Step verification:** `npx vitest run test/acp-dispatch.test.ts` (or dedicated file) — all new cases green.

### Phase 2 — Host emit + open/reveal actions

- [ ] On completed `tool_call` / `tool_call_update`, run extractor; for each ref, if file exists (best-effort), `emit(session, { type: "document", kind, path, name })` into buffer (replay-safe).
- [ ] De-dupe: same absolute path once per session buffer window / tool id (document chosen policy in code comments + tests).
- [ ] Webview → host: `revealInOs` → `vscode.commands.executeCommand("revealFileInOS", uri)` (or platform-safe equivalent already used elsewhere if any).
- [ ] Binary open policy: for word/excel/powerpoint/pdf, Open uses `vscode.env.openExternal(vscode.Uri.file(p))` so the OS default app launches; for markdown/csv use existing text open. Implement as pure `openStrategyForKind(kind)` + host branch so tests cover strategy without vscode.

**Step verification:** unit tests for strategy; manual or DOM posts for message shapes; `tsc -p . --noEmit` clean.

### Phase 3 — Webview document card + welcome starter

- [ ] `addDocumentCard(msg)` in `media/chat.js`: card with type label, basename, actions Copy / Open / Reveal; uses existing icon set or simple text labels; keyboard-focusable buttons with `aria-label`s.
- [ ] Styles in `media/chat.css` using `--vscode-*` tokens; hover/focus-visible; long filename ellipsis.
- [ ] Welcome starter e.g. id `business-doc`, title **Create a business document**, seeds multi-format prompt mentioning Word / Excel / PowerPoint / PDF / CSV / Markdown (action `insert`).
- [ ] Update `test/friendly-ui.dom.test.ts` catalog expectations; add DOM test file for document card actions (mirror `test/media-subagent.dom.test.ts`).

**Step verification:** targeted vitest DOM suites green; manual a11y: Tab to buttons, visible focus.

### Phase 4 — Docs

- [ ] README Features: short expandable (or paragraph) on business documents + skill note.
- [ ] `docs/SLASH-COMMANDS.md`: skills section note for `/docx`, `/pptx`, `/xlsx` + free-form create/edit.
- [ ] Optional one-line in CLAUDE.md Chat surfaces if we treat document cards as a first-class surface.

**Step verification:** checklist that wording matches non-goals (no “built-in Office editor” claim).

### Phase 5 — Full suite

- [ ] `npm test` green (floor preserved).
- [ ] `tsc -p . --noEmit` exit 0.
- [ ] Record coverage: **NO COVERAGE TOOL** + existing waiver.

## Testing strategy

| Layer | What |
|-------|------|
| Unit | `businessDocKindForPath`, `extractBusinessDocumentPaths`, `openStrategyForKind`, de-dupe helper |
| Edge/negative | Wrong ext; path in agent prose only (must **not** extract if we only scan tool payload); trailing `.` in prose; `\\?\` prefix; duplicate path twice in one result; media `.jpg` not classified as business doc |
| DOM | Starter present; card renders; three actions post correct messages |
| Regression | Full `npm test` |
| Live (optional pre-release) | Manual: “create a short Word doc summarizing X” → card appears → Reveal works |
| Coverage | NO COVERAGE TOOL → `docs/waivers/coverage-no-tool.md` |

## UI/UX design (hard gate 8)

**Design reference:** Generated-media hover actions + tool-group row chrome + welcome starter cards (existing patterns in `media/chat.css` / `chat.js`). Document card is a **compact artifact strip**, not a media preview.

**State inventory:**

| State | Behavior |
|-------|----------|
| Default | Card shows kind label + filename + 3 actions |
| Hover | Action buttons match media-btn hover contrast |
| Focus-visible | Keyboard focus ring on each button (VS Code focus border token) |
| Active/pressed | Standard button active style |
| Disabled | N/A (actions always available if card shown) |
| Loading | N/A (card only after path known) |
| Empty | No card if no paths |
| Error | Missing file: host skips emit (or card with muted “file not found” — prefer skip to avoid ghosts) |
| Overflow | Filename `text-overflow: ellipsis`; `title` attribute full path |

**a11y:**

- Buttons have accessible names: “Copy path”, “Open document”, “Reveal in file explorer”.
- Card container `role="group"` + `aria-label` including kind + filename.
- No color-only meaning: kind also shown as text (“Word”, “Excel”, …).

**Design acceptance:**

- D1: Card uses only VS Code CSS variables / existing component classes (no hardcoded brand hex for chrome).
- D2: All three actions keyboard-operable in DOM test or manual Tab order check.
- D3: Light/dark inherit from webview body classes (no separate palette).
- D4: Welcome starter matches existing starter card structure (title, desc, insert action).

## Failure modes

| Failure | User impact | Recovery |
|---------|-------------|----------|
| Extractor misses prose-only path shape | No card; file still on disk | User opens from Explorer; improve regex after live capture |
| Skill deps missing (no `docx` npm) | Grok fails tool; no card | Existing error tool UI; docs mention deps |
| False positive card for read-only path | Misleading “result” | Restrict to completed tool content + exists check; future: only after write tools |
| `revealFileInOS` unavailable | Button no-op | Catch + showInformationMessage with path |
| Partial ship (starter without card) | Discover without complete | Ship phases 1–3 together in one change set |

## How would this fail to ship?

1. Scope creeps into building an Office editor or bundling LibreOffice.
2. Extraction is wired to free-form agent messages → spam cards → feature reverted.
3. Binary “Open” only uses `openTextDocument` → looks broken on Windows for `.docx` → users conclude feature doesn’t work.
4. Tests only assert mocks of side effects without pure extract/classify coverage → regressions silent.
5. Docs claim “always works” without skill/deps caveat → support burden blocks release confidence.
6. Welcome gains 5 new cards → UI clutter blocks design gate.

## Out-of-scope (deferred)

- Inline PDF/page or xlsx grid preview
- Attach-from-card / auto chip
- Dedicated `/document` extension slash command
- Live suite assertions for office skills
- Google Docs / OneDrive remote URLs
- Email `.eml` / `.msg` specialists

## Observable verification (whole feature)

```text
1. npm test                          → exit 0
2. tsc -p . --noEmit                 → exit 0
3. Unit: business doc kind + extract → includes ≥1 negative per helper
4. DOM: starter id business-doc (or chosen id) present
5. DOM: document message → card + open/copy/reveal posts
6. README + SLASH-COMMANDS mention business docs / skills
7. Manual (Windows): create docx via chat → card → Reveal shows file
```

**Coverage ladder:** NO COVERAGE TOOL (waiver).

## Ordered implementation steps (summary)

1. Pure helpers + tests (Phase 1).
2. Host emit + open strategy + reveal (Phase 2) + tests.
3. Webview card + starter + CSS (Phase 3) + DOM tests.
4. Docs (Phase 4).
5. Full `npm test` + typecheck (Phase 5).

Each step’s verification is listed under Phases above.
