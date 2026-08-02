# Paste screenshots into chat

| Field | Value |
|-------|--------|
| **Status** | Implementing / implemented (2026-08-02) |
| **Owner** | Lead (Grokbit) |
| **Date** | 2026-08-02 |
| **Surfaces** | Composer paste, attachment strip, ACP `session/prompt`, mid-turn send queue, panel `localResourceRoots`, per-backend capability gate |
| **Related** | `research/voice-input.md` (capability-gate pattern), `research/image-generation.md` (image *output* only), file-chip attachments |
| **Review** | Pass 1: `docs/plans/paste-screenshots.review.md` (Request Changes) |

## Goal

Users can **paste a screenshot** (or other clipboard image) into a session tab’s composer, see a **thumbnail attachment** before send, remove it if unwanted, and on Send have the image **reach the agent** so vision-capable backends can analyze it (UI bugs, mockups, error dialogs, etc.).

### Acceptance criteria (falsifiable)

1. **Paste capture.** With focus in the composer (`#input`), pasting an image from the clipboard (Win: `Win+Shift+S` → paste; macOS: screenshot to clipboard → paste) **does not** insert binary garbage into the textbox. A thumbnail appears in `#attachments`.
2. **Text preserved.** Pasting plain text (or rich text without an image) behaves as today. Pasting **text + image** (when the OS provides both) keeps the text and attaches the image.
3. **Remove.** Clicking × on the image attachment removes it; Send with no text, no visible chips, and **no pending images** is a no-op (same as empty composer today).
4. **Image-only send.** Send with **only** pending image(s) and empty text **succeeds** (idle and mid-turn). Today `sendOrStop` only checks `text` / chips (`media/chat.js` ~5275–5288) — that gate must include `state.pendingImages.length > 0`.
5. **Send → agent.** On Send, the image is included in `session/prompt` when the live agent advertises `promptCapabilities.image === true` (ACP image content block). When the agent does **not** advertise image input, the extension still stages the file, shows the **same image thumbnail** (not a second file-chip row), includes the staged path in the text context via the path-fallback branch of `buildSessionPromptBlocks`, and shows a one-line honest notice that this backend cannot view images.
6. **Claude path.** A Claude Code tab that advertises image support receives a real `{type:"image", mimeType, data}` block (or equivalent accepted by the adapter). Verified by a **research probe** (not CI) + unit tests for the content-block builder.
7. **Grok path (capability-gated).** Grok currently advertises `promptCapabilities.image: false` (`research/voice-input.md`, `research/image-generation.md`). The feature **must not** send a rejected image block that fails the turn with `-32602`. Path fallback + notice is the shipped Grok behavior until a probe shows `image: true`.
8. **Bubble UI + in-tab replay.** After send, the user bubble shows a small thumbnail for each attached image, not a raw base64 dump. `Session.buffer` stores **durable** image fields (`id`, `absPath`, `fileName`, `mimeType`) — **never** a one-shot `asWebviewUri` string as the only source of truth. On `ready` / `replayInto`, the host re-resolves preview URIs from abs paths still on disk for that session.
9. **Limits (client + host).** Reject images over **8 MiB raw bytes** and more than **6** pending images per composer. **Webview rejects before `postMessage`** (byte length of the blob/array buffer); host re-checks as defense-in-depth. Muted error string; no throw.
10. **Tests.** Pure helpers + DOM tests green under `npm test`; no real CLI spawn in CI. Named edges listed in Testing strategy (including image-only send, mid-turn queue, co-render, client-side oversize).

## Non-goals

- **Not** OCR / STT of the screenshot into text (voice already has a separate path).
- **Not** in-webview image editing (crop, annotate).
- **Not** making Grok “have vision” by calling a separate xAI vision HTTP API (out of thin-client design; revisit only if product later wants a Path-B like voice).
- **Not** attaching arbitrary non-image clipboard formats (PDF, HTML, files-as-bytes) beyond what paste already does for text / OS file URIs.
- **Not** changing `/imagine` output rendering or generated-media pipeline.
- **Not** full history fidelity of pasted images across **cold** session resume from CLI disk (CLI may not replay user image blocks). In-tab buffer replay **is** in scope; cold resume may show text only — documented known limit.
- **Not** Marketplace release / version bump (user-initiated rebuild).
- **Not** drag-drop of image *files* from Explorer as a separate epic — if `dataTransfer.files` image paste/drop is a one-line add-on in the same paste/drop handler, include it; otherwise follow-up.

## Context / constraints (verified in-repo)

| Fact | Source |
|------|--------|
| Composer has `#attachments` for explicit upload chips; no paste handler today | `media/chat.js` `renderChips`, drag-drop only `text/uri-list` |
| `renderChips()` clears `attachmentsEl.innerHTML = ""` then only file uploads | `media/chat.js` ~5038–5066 — **co-render required** |
| `sendOrStop` allows send only if text or non-hidden chip | `media/chat.js` ~5275–5288 — **must include pending images** |
| Mid-turn queue stores `{ text, finalPrompt: string, sentChips }` only | `src/session.ts` `pendingUserSends`; `queueFollowUpSend` in `sidebar.ts` |
| `AcpClient.prompt(text)` always sends `prompt: [{ type: "text", text }]` | `src/acp.ts` |
| Grok: `promptCapabilities.image: false` (input); image **generation** is separate | `research/image-generation.md`, `research/voice-input.md` |
| Session panel `localResourceRoots` | `media`, `resources`, and (session panels) `resolveGrokHome()` — **not** globalStorage / os.tmpdir by default (`sidebar.ts` bindPanel / openPanel) |
| ACP image block shape is standard base64 + mimeType | [ACP content](https://agentclientprotocol.com/protocol/v1/content) |
| File chips are path-only (`FileChip`); no image kind yet | `src/chips.ts` |

## Approach

### Decision: capability-aware multi-block prompts + staged files

1. **Stage on paste (host).** Webview validates mime + **raw byte length** → posts base64 only if under cap → host writes `screenshot-<timestamp>-<n>.png` under a **session-scoped staging dir that is also a webview `localResourceRoot`** (see Staging root below), records a `PendingImage` on `Session`.
2. **Preview.** Host `postTo`s `{type:"pendingImages", images:[…]}` with a **fresh** `previewUri` from `webview.asWebviewUri` each post. Webview mirrors into `state.pendingImages` and paints thumbnails via **one** attachments render path (co-render with file uploads).
3. **Send.** Pure `buildSessionPromptBlocks` builds the ACP content array:
   - Text block(s) from `buildPrompt(text, chips, …)` (and, when `!imageCapable`, path lines for each staged image’s `absPath`/`fileName` injected into that text context — **not** by converting into a second `FileChip` row in the strip).
   - If `imageCapable`: append `{type:"image", mimeType, data}` per image (read file → base64).
   - If `!imageCapable`: **no** image blocks (avoids `-32602`).
4. **Capability source of truth.** Parse `initialize` into `AcpClient.promptCapabilities` (`{ image, audio, embeddedContext }`, default false). Host posts `imagePromptSupported` on panel config / session live. Webview never hardcodes backend → vision.
5. **Probe (Step 0).** Document Grok + Claude `promptCapabilities` and optional 1×1 PNG round-trip in `research/paste-image-input.md`. Record whether ACP needs any **client** capability advertisement for image content (or only agent-side).

### Staging root (promoted from A4 — required)

**Chosen approach (b):** stage under  
`context.globalStorageUri/fsPath/paste-images/<sessionKey>/`  
and **add that directory** (or its parent `paste-images/`) to the session panel’s `localResourceRoots` wherever panel webview options are set (`openPanel` / `bindPanel` / serializer restore — every code path that assigns `localResourceRoots`).

- **Why not only grok home:** Claude tabs are first-class; staging under `~/.grok/...` for a Claude session is confusing and couples backends.
- **Why not bare `os.tmpdir()` alone:** must still be listed in `localResourceRoots`; globalStorage is extension-owned, survives restarts better for in-tab replay, and is the natural place for extension-private media.
- **Verify (Step 2):** after paste, thumb `<img src>` uses `asWebviewUri` under the new root and **loads without** data-URL fallback in the happy path.

### UX: single strip representation (review Q1)

- Pending images **always** render as **image tiles** (thumbnail + name + ×) in `#attachments`.
- Degraded (non-vision) backends: **same tiles** + muted notice; path is only added to the **wire text context** on send — **not** as a parallel file-chip row for the same image (no double representation).
- Explicit file chips (user pick/drop of a workspace file) remain file-icon rows as today.

### Lifecycle: keep staged files until session dispose (review Q2)

- On **successful send**, clear `session.pendingImages` and post empty list (composer), but **do not unlink** staged files used by that send until **session dispose** / empty-session recycle / explicit cap sweep.
- Reason: in-tab `Session.buffer` thumbs re-resolve from `absPath` after hide/reveal; early unlink blanks user-bubble images.
- Dispose / recycle: best-effort recursive delete of that session’s staging subdir.
- Cap sweep: if a session accumulates extreme volume (unlikely with max 6 pending), dispose still cleans.

### Mid-turn queue contract (frozen)

Today (`src/session.ts`):

```ts
pendingUserSends: { text: string; finalPrompt: string; sentChips: FileChip[] }[]
```

**Replace / extend to:**

```ts
pendingUserSends: {
  text: string;
  sentChips: FileChip[];
  sentImages: PendingImage[];   // snapshot at queue time
  // Prefer not to store a prebuilt string-only finalPrompt when images exist.
  // Either:
  //   (A) store sentImages + rebuild blocks in executeUserSend via buildSessionPromptBlocks, or
  //   (B) store promptBlocks: AcpContentBlock[] built at queue time.
  // **Decision: (A)** — single builder path for live + drained sends; text context
  // always rebuilt with the same pure function (chips + images + imageCapable).
}[]
```

`queueFollowUpSend(session, text, chips)` becomes aware of `session.pendingImages`:

1. Snapshot `sentImages = session.pendingImages.slice()`.
2. Snapshot `sentChips = chips.filter(!hidden)`.
3. Clear `session.chips` + `session.pendingImages`; `postChips` + `postPendingImages` (empty).
4. Push queue entry **without** requiring a string-only `finalPrompt` when images are present (builder runs at drain with live `client.promptCapabilities.image`).
5. Drain in `handleSend`’s while-loop calls `executeUserSend(…, { alreadyAcked: true, text, sentChips, sentImages })` which builds blocks and calls `client.prompt` overload.

**Idle send** clears pending images the same way chips are cleared today.

## Data model

```ts
// src/pending-images.ts — pure, no vscode
export interface PendingImage {
  id: string;           // paste:<uuid>
  absPath: string;      // staged file under paste-images/<sessionKey>/
  fileName: string;     // screenshot-….png
  mimeType: string;     // image/png | image/jpeg | image/webp | image/gif
  byteLength: number;
  createdAt: number;
}

/** Durable fields for Session.buffer userMessage.images (no previewUri). */
export interface BufferedUserImage {
  id: string;
  absPath: string;
  fileName: string;
  mimeType: string;
}

export const PASTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const PASTE_IMAGE_MAX_COUNT = 6;
export const PASTE_IMAGE_MIME = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
]);

export function canAcceptPasteImage(opts: {
  currentCount: number;
  byteLength: number;
  mimeType: string;
}): { ok: true } | { ok: false; reason: string };

export type AcpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

export function buildSessionPromptBlocks(opts: {
  text: string;
  chips: FileChip[];
  images: PendingImage[];
  imageCapable: boolean;
  readFile: (path: string) => string;       // utf8 for chip ranges
  readFileB64: (path: string) => string;    // base64 for images when capable
  extName: (path: string) => string;
}): AcpContentBlock[];
```

When `!imageCapable` and `images.length > 0`, `buildSessionPromptBlocks` appends path lines into the text context (same spirit as attached files — e.g. under the vscode-context envelope or a short “Attached image file(s):” section listing `absPath` or `fileName` + path), then returns **only** text block(s).

Webview pure helper (can live in `media/webview-helpers.js` for testability):

```js
function canAcceptPasteImageBytes(byteLength, max = PASTE_IMAGE_MAX_BYTES) { … }
```

## Wire / messages

| Direction | Message | Role |
|-----------|---------|------|
| webview → host | `{type:"pasteImage", mimeType, dataBase64, fileName?, byteLength}` | Stage one image (already size-checked client-side) |
| host → webview | `{type:"pendingImages", images:[{id,fileName,mimeType,previewUri,byteLength}]}` | Composer strip (ephemeral — `postTo`, not buffer) |
| webview → host | `{type:"removePendingImage", id}` | Drop one pending |
| webview → host | `{type:"send", text, chips}` | Unchanged; host merges **current** `session.pendingImages` |
| host → webview | `{type:"userMessage", text, chips, images?: BufferedUserImage[]}` | Buffered; previewUri **not** required on wire — webview may receive resolved previews only on live post via a parallel field or re-request; **preferred:** host includes `previewUri` on live emit **and** on replay re-resolution pass, always derived from `absPath` at post time |
| host → webview | `{type:"pasteImageError", message}` | Oversize / bad mime / cap / write fail |
| host → webview | `initialState` / session config: `imagePromptSupported: boolean` | Notice visibility |

**Replay rule:** `PanelRouter.replayInto` delivers buffered `userMessage` objects. Before or during replay, host maps each `images[].absPath` → current `asWebviewUri` (if file exists) so thumbs work after hide/reveal. Missing file → filename-only fallback in webview.

## UI / UX (hard gate 8)

### Design reference

- **Named pattern:** existing `.attachment` / `#attachments` strip, extended with **thumbnail tiles**.
- **Tokens only:** `--vscode-editorWidget-*`, `--vscode-foreground`, `--vscode-descriptionForeground`, toolbar hover.
- No new `@media` queries in `chat.css`.

### Co-render contract (frozen)

Single function path, e.g. `renderAttachments()` called from:

- chip updates (`chips` message → was `renderChips`);
- `pendingImages` message;
- busy lock transitions if remove buttons depend on busy.

**Algorithm:**

1. Clear `attachmentsEl` and `chipsEl` as today (or clear attachments once).
2. Append **file upload** rows from non-implicit, non-range chips.
3. Append **image** rows from `state.pendingImages` (thumbnail + label + remove).
4. Toolbar chips (implicit / selection) unchanged.

**Must not:** paint images only in a separate handler that runs before `renderChips` and gets wiped.

### State inventory

| State | Behavior |
|-------|----------|
| Empty | `#attachments:empty` → `display:none` |
| Pending image(s) | `.attachment.attachment-image`, thumb max-height ≤ 48px, filename / “Screenshot”, × |
| Oversize / cap / bad type | Muted error; image not added; **no** host post if client rejects |
| `!imagePromptSupported` | Notice: “This agent can’t view images — attached as a file path.” |
| Busy | Remove buttons disabled (composer controls parity) |
| Image-only ready to send | Send enabled / Enter works with empty text |
| Replay bubble | Compact thumb(s); broken preview → filename |
| Narrow tab | Flex-wrap; `min-width: 0` |

### A11y

- Remove: accessible name `Remove screenshot` / `Remove {fileName}`.
- Error/notice: text, not color-only.
- Focus-visible on remove buttons.

### Falsifiable design criteria

1. One pasted PNG → `.attachment.attachment-image` with `<img>` max box ≤ 48px height.
2. Remove last image → `#attachments:empty` hidden.
3. File chip + pending image coexist after both `chips` and `pendingImages` messages in either order.
4. No new `@media` in `chat.css`.

## Implementation steps (ordered + verification)

### Step 0 — Capability probe

- `research/paste-image-probe.cjs`: initialize → log `promptCapabilities` → optional 1×1 PNG image-block prompt for Grok and Claude adapter.
- `research/paste-image-input.md`: results + client-capability note.
- **Verify:** notes committed; product code uses live flag only.

### Step 1 — Pure policy + content-block builder

- `src/pending-images.ts` + tests.
- `AcpClient`: store capabilities; `prompt(string)` unchanged for primer/handoff; user path uses `promptBlocks(blocks)` or overload.
- **Verify:** `test/pending-images.test.ts` — mime/size/count; `imageCapable false` never emits image block but includes path text when images present; `true` emits image blocks; empty images → text only.

### Step 2 — Host staging, roots, session queue

- Staging dir under globalStorage `paste-images/<sessionKey>/`.
- **Extend `localResourceRoots`** on every session-panel options assignment.
- `Session.pendingImages`; handlers `pasteImage` / `removePendingImage` (host re-check size/mime).
- `postPendingImages` on change and on `ready`.
- Rewrite `queueFollowUpSend` + `pendingUserSends` + `executeUserSend` per frozen mid-turn contract.
- Emit buffered `userMessage` with `BufferedUserImage[]`; re-resolve previews on replay/`ready`.
- Dispose: delete session staging subdir (keep files after send until then).
- **Verify:** pure tests for queue snapshot shape if extracted; assert builder used for both live and alreadyAcked paths; manual or unit: `asWebviewUri` root includes staging (source-level test that openPanel roots list contains paste-images segment, mirroring other root guards in the suite).

### Step 3 — Webview paste, send gate, co-render

- Paste listener on composer: image items → client size check → `pasteImage`; `preventDefault` only when image consumed.
- `state.pendingImages` from host messages.
- **`sendOrStop` / mid-turn branch:** allow send when `state.pendingImages.length > 0` even if text empty and chips all hidden.
- On submit, clear optimistic `state.pendingImages` when host echoes empty list (or clear locally after post like chips if chips already clear locally — match existing chip clear timing; chips are host-driven via `chips` message after send).
- `renderAttachments` co-render contract.
- User bubble thumbs from `userMessage.images` + resolved preview if provided.
- Capability notice from `imagePromptSupported`.
- **Verify:** `test/paste-image.dom.test.ts`:
  - paste image → thumb;
  - text-only paste does not wrongly preventDefault;
  - image-only send posts `send`;
  - mid-turn busy + image-only still posts `send`;
  - file chip message + pending images → both rows;
  - oversize rejected without postMessage;
  - remove works.

### Step 4 — CSS + a11y

- `.attachment-image img` rules; focus on remove.
- **Verify:** class assertions; `NO UI TOOLING` + manual checklist OK.

### Step 5 — Docs

- USER_GUIDE / README: paste screenshots; non-vision backends get path + notice.
- **Verify:** copy matches capability gate.

## Testing strategy

| Layer | Cases |
|-------|--------|
| Unit | `canAcceptPasteImage`, `buildSessionPromptBlocks`, capability defaults |
| Edge / negative | oversize **client** + host; `image/svg+xml` reject; count cap; empty data; `imageCapable false` ⇒ no image block + path text; `true` + images ⇒ image blocks; imageCapable true + empty images ⇒ text-only |
| Queue / host pure | mid-turn snapshot includes `sentImages`; drain rebuilds blocks with images |
| DOM | paste → thumb; **image-only send**; **mid-turn image-only send**; **co-render** chips + images either order; text-only paste; client oversize no post; remove; busy disable remove |
| Integration (optional) | fake-CLI records `session/prompt` content array shape |
| Coverage | **NO COVERAGE TOOL** — named cases above are the gate |
| Live | probe before claiming Claude vision in release notes |

## Failure modes

| Failure | Handling |
|---------|----------|
| Agent rejects image block despite `image: true` | Error card; log; do not retry as image block automatically |
| Stage write fails | `pasteImageError`; no thumb |
| Client oversize | Local error; no `pasteImage` post |
| Host oversize (defense) | Same error path |
| Stale preview after hide/reveal | Re-resolve from absPath on ready/replay |
| Unlink too early | **Forbidden** until dispose (policy above) |
| Mid-turn queue drops images | Forbidden by contract + test |
| `renderChips` wipes thumbs | Forbidden by co-render + test |
| Missing localResourceRoot | Step 2 root add + source/DOM preview check |
| Plan mode | Attach/send allowed; plan gate unchanged |

## Risk / blast radius

| Area | Risk | Mitigation |
|------|------|------------|
| `AcpClient.prompt` | Primer/handoff break | Keep string overload |
| `pendingUserSends` shape | Mid-turn image loss | Frozen contract + test |
| `localResourceRoots` | Broken thumbs | Explicit root + verify |
| postMessage size | Dropped paste | Client byte check first |
| Grok UX | “Sees” expectation | Notice + path fallback |
| Disk growth | Staging left behind | Dispose cleanup + sessionKey subdirs |

## Observable verification (ship checklist)

1. `npm test` green (suite floor maintained).
2. `tsc -p . --noEmit` clean.
3. Manual Claude: paste → thumb → Send → agent describes image **if** probe said `image: true`.
4. Manual Grok: paste → thumb + notice → Send → no `-32602`; path in prompt text context.
5. Manual **image-only** send (empty text).
6. Manual mid-turn: while agent working, paste + Send → second user bubble includes image after drain.
7. Manual: remove thumb; text-only paste; file attach + image coexist.
8. Hide tab + reveal: composer pending thumbs and sent bubble thumbs still resolve.
9. Design criteria 1–4.

## Assumptions

| # | Assumption | Falsifier |
|---|------------|-----------|
| A1 | Webview clipboard paste exposes image items for OS screenshots | files fallback; else file-picker-only |
| A2 | Claude adapter accepts image blocks when models support vision | Probe → path-only for Claude |
| A3 | Grok remains `image: false` | Probe → enable image blocks |
| A4 | **Resolved:** globalStorage staging + add to `localResourceRoots` | If VS Code refuses root, fall back to data-URL previews for composer only (buffer still uses absPath); document in research |

## Dependencies / sequencing

1. Step 0 probe (parallel with Step 1).
2. Step 1 pure + AcpClient.
3. Step 2 host (roots, queue, staging) — **blocks** correct thumbs.
4. Step 3 webview (paste, send gate, co-render).
5. Step 4–5 polish + docs.

**Contract freeze:** `PendingImage`, `BufferedUserImage`, messages, `buildSessionPromptBlocks`, mid-turn queue entry shape, co-render rule, staging root policy — this document.

## Open questions (resolved)

| Q | Decision |
|---|----------|
| SVG? | **Reject** |
| Staging location? | **globalStorage `paste-images/<sessionKey>/` + localResourceRoots** |
| Grok hide paste? | **No** — tiles + notice + path text |
| Multi-image paste? | Up to `PASTE_IMAGE_MAX_COUNT` |
| Double file-chip + tile? | **No** — tiles only in strip; path only on wire when `!imageCapable` |
| Unlink when? | **Session dispose**, not on send |
| Client size check? | **Required** before postMessage |

## Handoff to `/implement`

- Do **not** implement until **Approve** from plan review pass 2 **and** user approval.
- Order: pure → host (roots + queue) → webview → docs.
- If neither backend accepts image blocks, still ship UI + path fallback + notice (AC 1–5, 7–10); mark AC 6 N/A in research notes.
