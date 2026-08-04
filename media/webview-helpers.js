(function (root) {
  const FILE_EXTS = new Set([
    "ts","tsx","js","jsx","mjs","cjs","json","md","mdx","toml","yml","yaml",
    "css","scss","sass","less","html","htm","xml","svg",
    "py","rb","go","rs","java","kt","kts","swift","c","cc","cpp","cxx","h","hh","hpp",
    "cs","php","lua","sh","bash","zsh","fish","ps1","bat","cmd",
    "txt","lock","env","ini","cfg","conf","gitignore","dockerignore",
    "vue","svelte","astro","sql","prisma","graphql","gql",
  ]);

  function looksLikeFileRef(s) {
    if (!s || s.length > 200) return false;
    const core = s.replace(/[:#].*$/, "");
    if (/[\s"'`<>|&;]/.test(core)) return false;
    const m = core.match(/\.([A-Za-z0-9]+)$/);
    if (!m) return false;
    return FILE_EXTS.has(m[1].toLowerCase());
  }

  /**
   * Safe href for chat markdown links (agent/user transcript → DOM).
   * Allows http(s), vscode / vscode-insiders, fragment-only (#…), and
   * scheme-less relative paths. Rejects javascript:, data:, vbscript:,
   * protocol-relative //…, control chars, and any other scheme.
   */
  function isSafeHref(url) {
    const u = String(url == null ? "" : url).trim();
    if (!u) return false;
    if (/[\u0000-\u001f\u007f]/.test(u)) return false;
    if (u.startsWith("//")) return false;
    if (u.startsWith("#")) return true;
    const m = u.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (!m) return true; // relative / path-like, no scheme
    const scheme = m[1].toLowerCase();
    return scheme === "http" || scheme === "https"
      || scheme === "vscode" || scheme === "vscode-insiders";
  }

  function formatRelativeTime(ts, now) {
    if (!ts) return "";
    const base = typeof now === "number" ? now : Date.now();
    const diff = base - ts;
    const sec = Math.round(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  // Resolve a model ID to its user-facing name (e.g. "grok-build" → "Grok Build")
  // using the availableModels list from session/new. Falls back to the ID when
  // the model isn't in the list or has no name, so the label is never blank.
  function modelDisplayName(modelId, availableModels) {
    if (!modelId) return "";
    const m = (availableModels || []).find((x) => x && x.modelId === modelId);
    return (m && m.name) || modelId;
  }

  // Mic button state machine for voice control:
  //   idle → (start) → connecting → [host ready] → listening → (stop) → transcribing → (transcript) → idle
  // "connecting" covers the ~½–1s while the stream (ws + ffmpeg) spins up, so the
  // blue "listening" waves only appear once it's actually ready to capture — the
  // host moves connecting→listening by posting voiceState "listening". Any failure
  // resolves back to idle ("error"/"reset"). Pure + here so it's unit-testable.
  const MIC_STATES = ["idle", "connecting", "listening", "transcribing"];
  function nextMicState(current, event) {
    switch (event) {
      case "start":
        // Begin connecting (not yet capturing). Don't interrupt a transcription.
        return current === "idle" ? "connecting" : current;
      case "stop":
        // Stoppable while connecting or listening.
        return current === "listening" || current === "connecting" ? "transcribing" : current;
      case "transcript":
      case "error":
      case "reset":
        return "idle";
      default:
        return current;
    }
  }

  // Locate a TRAILING send-phrase (e.g. "grok send", any capitalization) in the
  // composer text — the occurrence that actually acts as the submit command — so
  // the webview can highlight it. Tolerates a comma/whitespace between words and
  // trailing punctuation, mirroring the host's parseVoiceCommand. Returns the
  // {index, length} of the match, or null. An empty phrase disables it.
  // One phrase word, tolerating the "send" ⇄ "sent" STT confusion (kept in sync
  // with phraseWordPattern in src/voice.ts).
  function phraseWordPattern(word) {
    const lower = word.toLowerCase();
    if (lower === "send" || lower === "sent") return "sen[dt]";
    return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function trailingSendPhrase(text, phrase) {
    const t = text == null ? "" : String(text);
    const p = (phrase || "").trim();
    if (!p) return null;
    const words = p.split(/\s+/).map(phraseWordPattern);
    // Lookahead for trailing punctuation so the highlight covers only the phrase
    // words — the trailing "?"/"." stays part of the message and unhighlighted.
    const re = new RegExp("\\b" + words.join("[,\\s]+") + "\\b(?=[\\s.!?…]*$)", "i");
    const m = re.exec(t);
    if (!m) return null;
    return { index: m.index, length: m[0].length };
  }

  // Build the `answers` map for an ask_user_question response from the user's
  // per-question selections. `selections` is an array parallel to `questions`,
  // each entry the array of chosen option labels for that question. Returns the
  // map keyed by question text (multi-select labels joined with ", ", matching
  // grok's HashMap<String,String> contract) and `allAnswered` so the card knows
  // when Submit should be enabled.
  function buildQuestionAnswers(questions, selections) {
    const answers = {};
    let allAnswered = true;
    (questions || []).forEach((q, i) => {
      const picked = (selections && selections[i]) || [];
      if (picked.length === 0) allAnswered = false;
      answers[q.question] = picked.join(", ");
    });
    return { answers, allAnswered };
  }

  // Recognize a tool call that *spawns* a subagent, so the webview can give it a
  // distinct labeled card instead of burying it in the generic tool group.
  // grok's bundled docs describe a `spawn_subagent` tool with a `subagent_type`
  // parameter (general-purpose | explore | plan | custom), and we match that
  // shape (forward-compat; some builds may emit it). BUT the native-Windows
  // grok 0.2.x build does NOT actually emit `spawn_subagent` over ACP — it
  // delegates via a *background* `run_terminal_command` (`is_background:true`),
  // which we DO card, and then reads its output with
  // `get_command_or_subagent_output`. That output READER is not a delegation,
  // yet its name contains the substring "subagent", so it must be explicitly
  // excluded or it false-fires a card on the poller. See research/subagents.md
  // for the wire capture. Degrades gracefully (no match → the call stays in the
  // generic tool group).
  function isSubagentToolCall(call) {
    if (!call) return false;
    if (call.kind === "subagent" || call.kind === "agent") return true;
    const n = String(call.tool || call.name || call.title || "")
      .replace(/[_\s-]/g, "").toLowerCase();
    // grok's `get_command_or_subagent_output` polls a background task's output —
    // its name carries "subagent" but it is NOT a delegation, so never card it.
    if (/output$/.test(n) || n.startsWith("getcommand")) return false;
    if (/subagent|spawnagent|launchagent|dispatchagent|runagent|delegat/.test(n)) return true;
    if (n === "task" || n === "agent" || n === "agents") return true;
    const r = call.rawInput || call.input || {};
    if (r.subagent_type || r.subagentType || r.subagent ||
      r.agent_type || r.agentType || r.agent) return true;
    // grok 0.2.x has no spawn_subagent tool — it delegates by *backgrounding* a
    // run_terminal_command (rawInput.is_background:true, or a "[bg]" title) and
    // reads the result with the get_command_or_subagent_output poller (already
    // excluded above). Backgrounding IS grok's subagent mechanism on the native
    // build, so surface the spawn as a card. See research/subagents.md § Ground
    // truth. (A foreground command — is_background:false/absent — is untouched.)
    if (r.is_background === true || r.background === true) return true;
    if (/^\s*\[bg\]/i.test(String(call.title || ""))) return true;
    return false;
  }

  // Human label for a subagent card: the agent type grok delegated to
  // (`subagent_type`, e.g. "general-purpose"/"explore"/"plan"), or a description,
  // else a generic fallback.
  function subagentLabel(call) {
    const r = (call && (call.rawInput || call.input)) || {};
    // Prefer a named agent type; for a background-task delegation (no type) fall
    // back to the command being backgrounded, truncated for the card.
    const name = r.subagent_type || r.subagentType || r.agent_type || r.agentType ||
      r.subagent || r.agent || r.description || r.name || r.command;
    let s = name != null ? String(name).trim() : "";
    if (s.length > 48) s = s.slice(0, 47).replace(/\s+$/, "") + "…";
    if (s) return s;
    if (r.is_background === true || r.background === true) return "background task";
    return "Subagent";
  }

  // True when the scroll viewport is at (or within `threshold` px of) the
  // bottom. Drives the chat's "stick to bottom" auto-scroll: while the user is
  // pinned we follow streaming output, but once they scroll up to read history
  // we leave the view alone (#16). The threshold absorbs sub-pixel rounding and
  // lets a near-bottom position still count as pinned.
  function shouldStickToBottom(scrollTop, scrollHeight, clientHeight, threshold) {
    const t = typeof threshold === "number" ? threshold : 40;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    return distanceFromBottom <= t;
  }

  // Clamp a desired scrollTop into [0, maxScroll] for the current viewport.
  // Used when restoring a mid-history offset after a panel rebuild whose
  // content height may no longer match the saved metrics.
  function clampScrollTop(scrollTop, scrollHeight, clientHeight) {
    const max = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));
    const n = typeof scrollTop === "number" ? scrollTop : Number(scrollTop);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n > max ? max : n;
  }

  // Split a string into text/math segments so the markdown renderer can pull
  // LaTeX out before HTML-escaping (math is full of \ { } & < > * _, which the
  // inline-markdown pass would otherwise mangle). grok emits TeX with backslash
  // delimiters — `\(...\)` inline and `\[...\]` display (confirmed against the
  // CLI), plus the conventional `$$...$$` for display. Single `$...$` is NOT a
  // delimiter: too many false positives with prose currency ("$5 and $10").
  // Each math segment carries `display` (block vs inline). Non-greedy + requires
  // at least one char so empty `\(\)`/`$$$$` stays literal text. Pure so it's
  // unit-testable; the actual KaTeX render lives in chat.js (impure global).
  function splitMath(text) {
    const src = text == null ? "" : String(text);
    const segs = [];
    const re = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$/g;
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) segs.push({ type: "text", value: src.slice(last, m.index) });
      if (m[1] !== undefined) segs.push({ type: "math", value: m[1], display: true });
      else if (m[2] !== undefined) segs.push({ type: "math", value: m[2], display: false });
      else segs.push({ type: "math", value: m[3], display: true });
      last = re.lastIndex;
    }
    if (last < src.length) segs.push({ type: "text", value: src.slice(last) });
    return segs;
  }

  // Drop TeX macros KaTeX can't handle before rendering, so one unsupported
  // command doesn't paint a red error into an otherwise-fine equation. grok
  // emits `\label{...}` inside align/equation blocks for cross-referencing, but
  // KaTeX has no \ref/\eqref system so it renders \label as a red error token —
  // even though \label produces NO visible output in real LaTeX (it only sets a
  // reference target). Stripping it loses nothing visually and lets the
  // surrounding equation render. Pure so it's unit-testable.
  function stripUnsupportedTex(tex) {
    return (tex == null ? "" : String(tex)).replace(/\\label\s*\{[^}]*\}/g, "");
  }

  // Error text for a failed tool_call_update (status "failed"/"error"), else null.
  // grok reports the reason in rawOutput.message and/or a content[].content.text
  // blob (e.g. "Tool `image_to_video` failed: image reference not readable: …").
  // The extension never surfaced these, so a failed tool just looked like grok
  // giving up — this is what the chat renders on the row instead.
  function toolFailureText(call) {
    if (!call) return null;
    const status = String(call.status || "").toLowerCase();
    if (status !== "failed" && status !== "error") return null;
    const raw = call.rawOutput || {};
    if (typeof raw.message === "string" && raw.message.trim()) return raw.message.trim();
    const content = call.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        const t = (c && c.content && c.content.text) || (c && c.text);
        if (typeof t === "string" && t.trim()) return t.trim();
      }
    }
    if (typeof raw.error === "string" && raw.error.trim()) return raw.error.trim();
    return "Tool call failed.";
  }

  // Line diff of an edit's before/after text, for the inline diff the chat
  // renders itself (permission card + edit tool rows). Diffs render INSIDE the
  // chat tab by design — never a separate diff-editor tab: the old auto-opened
  // tab covered the chat webview in the same editor group, and because a hidden
  // webview is torn down (retainContextWhenHidden:false) every re-reveal
  // replayed the pending permission card and re-opened the tab — a focus-
  // stealing loop the user couldn't close out of.
  //
  // Returns rows [{ type: "same"|"add"|"del", text }] in unified order
  // (deletions before additions within a changed hunk). Common prefix/suffix
  // are trimmed first — grok's edits are usually a small patch in a big file —
  // and the LCS table over what remains is capped so a pathological full
  // rewrite degrades to one del-block + add-block instead of an O(n·m) stall.
  const DIFF_LCS_CELL_CAP = 250000; // ≈500×500 changed lines

  function computeLineDiff(oldText, newText) {
    const oldS = typeof oldText === "string" ? oldText : "";
    const newS = typeof newText === "string" ? newText : "";
    if (oldS === newS) return oldS.split("\n").map((text) => ({ type: "same", text }));
    if (oldS === "") return newS.split("\n").map((text) => ({ type: "add", text }));
    if (newS === "") return oldS.split("\n").map((text) => ({ type: "del", text }));
    const a = oldS.split("\n");
    const b = newS.split("\n");
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
      endA--;
      endB--;
    }
    const rows = [];
    for (let i = 0; i < start; i++) rows.push({ type: "same", text: a[i] });
    const m = endA - start;
    const n = endB - start;
    if (m * n > DIFF_LCS_CELL_CAP) {
      for (let i = start; i < endA; i++) rows.push({ type: "del", text: a[i] });
      for (let j = start; j < endB; j++) rows.push({ type: "add", text: b[j] });
    } else if (m || n) {
      // LCS lengths over the trimmed middle, then a backtrack. Preferring "add"
      // on ties while walking backwards yields dels-before-adds after reversal.
      const w = n + 1;
      const dp = new Uint32Array((m + 1) * w);
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i * w + j] =
            a[start + i - 1] === b[start + j - 1]
              ? dp[(i - 1) * w + j - 1] + 1
              : Math.max(dp[(i - 1) * w + j], dp[i * w + j - 1]);
        }
      }
      const mid = [];
      let i = m;
      let j = n;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[start + i - 1] === b[start + j - 1]) {
          mid.push({ type: "same", text: a[start + i - 1] });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i * w + j - 1] >= dp[(i - 1) * w + j])) {
          mid.push({ type: "add", text: b[start + j - 1] });
          j--;
        } else {
          mid.push({ type: "del", text: a[start + i - 1] });
          i--;
        }
      }
      for (let k = mid.length - 1; k >= 0; k--) rows.push(mid[k]);
    }
    for (let i = endA; i < a.length; i++) rows.push({ type: "same", text: a[i] });
    return rows;
  }

  // Parse the <vscode-context> envelope that prompt-builder.ts wraps around the
  // file-path context (attached files + the open-editor file). On session restore
  // grok replays the full prompt text; pulling the block back out lets us re-render
  // filename-only chips + the user's own text, instead of showing raw paths inline.
  // Must stay in sync with buildPrompt's format (src/prompt-builder.ts). Returns
  // { files: string[], body: string } — body is the prompt minus the block. When
  // there's no block (a plain message) files is empty and body is the input.
  function parseAttachmentContext(text) {
    if (typeof text !== "string") return { files: [], body: text || "" };
    const m = text.match(/<vscode-context[^>]*>\n?([\s\S]*?)\n?<\/vscode-context>\s*/);
    if (!m) return { files: [], body: text };
    const files = [];
    for (const raw of m[1].split("\n")) {
      const line = raw.trim();
      let mm;
      if ((mm = line.match(/^- (.+)$/))) files.push(mm[1]);
      else if ((mm = line.match(/^Attached file: (.+)$/))) files.push(mm[1]);
      else if ((mm = line.match(/^Currently open in the editor \(for context\): (.+)$/))) files.push(mm[1]);
    }
    const body = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
    return { files, body };
  }

  // Friendly mode labels + short helper text for non-technical users. Internal
  // mode ids stay agent/plan/yolo (protocol + host); only the chrome wording lives
  // here so tests and the mode picker can share one map.
  const MODE_DISPLAY = {
    agent: {
      label: "Agent",
      desc: "Grok can help right away. It may ask before editing files or running commands.",
    },
    plan: {
      label: "Plan first",
      desc: "Grok drafts a plan first. Nothing changes until you approve it.",
    },
    yolo: {
      label: "Auto accept",
      desc: "Grok makes changes without asking for permission each time.",
    },
  };
  function modeDisplayMeta(modeId) {
    return MODE_DISPLAY[modeId] || MODE_DISPLAY.agent;
  }

  // Map ACP permission option kinds to plain-language button labels. Protocol
  // optionId/kind stay unchanged — only the text the user sees is friendlier.
  // Falls back to the CLI-provided name when the kind is unknown.
  const PERMISSION_LABELS = {
    allow_once: "Allow this change",
    allow_always: "Allow always",
    reject_once: "Don't allow",
    reject_always: "Don't allow",
    deny_once: "Don't allow",
    deny_always: "Don't allow",
  };
  function permissionButtonLabel(opt) {
    if (!opt) return "Continue";
    const kind = String(opt.kind || "").toLowerCase();
    if (PERMISSION_LABELS[kind]) return PERMISSION_LABELS[kind];
    if (/^allow/.test(kind)) return kind.indexOf("always") >= 0 ? "Allow always" : "Allow this change";
    if (/^(reject|deny)/.test(kind)) return "Don't allow";
    return opt.name || "Continue";
  }

  // True when a permission option kind is a rejection (mirrors permissionOutcomeFor
  // in acp-dispatch: reject_* / deny_* → rejected). Used for button danger styling
  // and the collapsed-card verb/colour so deny_* never paints as green "Answered".
  function isRejectedPermissionKind(kind) {
    return /reject|deny/i.test(String(kind || ""));
  }
  function permissionCollapseVerb(kind) {
    if (isRejectedPermissionKind(kind)) return "Rejected";
    if (/allow/i.test(String(kind || ""))) return "Allowed";
    return "Answered";
  }

  // Claude's session/request_permission carries NO `toolCall.kind` at all — only
  // `{toolCallId, title, rawInput}` — unlike grok's, which always includes it
  // (verified: research/claude-code-backend.md § session/request_permission).
  // Resolve the best available kind: the payload's own `kind` (grok, always
  // present) → the kind already seen for this SAME toolCallId from a preceding
  // tool_call/tool_call_update (Claude emits `kind:"edit"` there before the
  // permission request) → inferred from `rawInput`'s shape (file_path+content =
  // Write, file_path+old_string+new_string = Edit) as a last resort, e.g. no
  // tool_call was ever recorded (replay gaps, out-of-order delivery). Pure so
  // the correlation logic is unit-testable without booting the webview.
  function inferPermissionKind(explicitKind, seenKind, rawInput) {
    if (explicitKind) return explicitKind;
    if (seenKind) return seenKind;
    const r = rawInput || {};
    if (typeof r.file_path === "string") {
      if (typeof r.old_string === "string" && typeof r.new_string === "string") return "edit";
      if (typeof r.content === "string") return "write";
    }
    return "";
  }

  // Synthesize a preview diff straight from a permission's rawInput when no
  // structured ACP diff content has arrived yet for this toolCallId. This is
  // the common case for Claude: its completed tool_call_update carries the real
  // diff hunks, but that update lands AFTER approval — so at permission-request
  // time there's nothing in the usual toolCallId→diff cache to render. Edit's
  // old_string/new_string IS already a genuine, if narrower, before/after,
  // rendered with the same computeLineDiff as everything else; Write has no
  // "before" available client-side, so it previews as an all-added file. Returns
  // null when `rawInput` doesn't match either shape (e.g. a command permission).
  function permissionDiffFromRawInput(rawInput, kind) {
    const r = rawInput || {};
    if (typeof r.file_path !== "string") return null;
    if (kind === "edit" && typeof r.old_string === "string" && typeof r.new_string === "string") {
      return { path: r.file_path, oldText: r.old_string, newText: r.new_string };
    }
    if (kind === "write" && typeof r.content === "string") {
      return { path: r.file_path, oldText: "", newText: r.content };
    }
    return null;
  }

  // Status-dot tooltips for chat history + activity-bar launcher (shared so the
  // two surfaces cannot drift). Keys match computeDot values.
  const SESSION_DOT_LABELS = {
    working: "Working on it",
    "needs-you": "Needs your OK",
    unread: "Done — not opened yet",
    error: "Finished with an error — not opened yet",
  };
  function sessionDotLabel(value) {
    return SESSION_DOT_LABELS[value] || "";
  }

  // Backend badge for a merged history row (grok + Claude Code sessions in one
  // list — see docs/plans/claude-code-backend.md § WP4). Labels BOTH backends
  // (docs/plans/capability-surfacing-and-history-ux.md § Thread 4) — a deliberate
  // reversal of the original "quiet for grok" idiom, for the history row ONLY:
  // once rows from both backends are interleaved by recency in one scrollable
  // list, every row needs per-row disambiguation, not just the secondary one.
  // `"grok"` and a missing/legacy `backend` field (a row from before the field
  // existed) both read "Grok" — never invent a label for a backend we don't
  // recognize. The status-bar HUD (src/status-bar.ts / computeStatusBar) is
  // NOT changed to match — it stays quiet for grok on purpose, since it's one
  // always-visible, width-constrained item describing a single open session
  // whose model is already named, not an interleaved list of many. Shared by
  // media/launcher.js and the chat history popover so the two can't drift.
  function backendBadgeLabel(backend) {
    if (backend === "claude") return "Claude";
    if (backend === "grok" || !backend) return "Grok";
    return "";
  }

  // Agent options for the setup-model's segmented Agent row. Only two backends
  // exist today, so this stays a tiny local list rather than importing
  // src/backends.ts (a TypeScript module the webview never loads).
  const SETUP_AGENT_OPTIONS = [
    { id: "grok", label: "Grok Build" },
    { id: "claude", label: "Claude Code" },
  ];

  // Mode options for the setup-model's segmented Mode row. Deliberately short
  // ("Plan", not MODE_DISPLAY.plan.label's "Plan first") — a segmented control
  // has no room for the mode popover's longer onboarding wording.
  const SETUP_MODE_OPTIONS = [
    { id: "agent", label: "Agent" },
    { id: "plan", label: "Plan" },
    { id: "yolo", label: "Auto accept" },
  ];

  function withSelected(list, selectedId) {
    return list.map((o) => ({ id: o.id, label: o.label, selected: o.id === selectedId }));
  }

  // "xhigh" -> "XHigh", everything else -> plain capitalize. Mirrors chat.js's
  // own `capitalize()` (kept local here rather than shared — see WP6's
  // precedent for a small intentional duplicate across the host/webview
  // boundary in docs/plans/claude-code-backend.md).
  function effortLevelLabel(id) {
    const s = id == null ? "" : String(id);
    if (s === "xhigh") return "XHigh";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * Pure view-model for the per-tab settings UI — Agent / Model / Thinking /
   * Mode — the single source of truth rendered by BOTH the new-tab welcome
   * "Session setup" card and the composer quick-settings popover (see
   * docs/plans/claude-code-backend.md § WP7 "UI: per-tab settings"). No DOM, no
   * vscode API — chat.js turns the returned rows into elements and wires the
   * message-posting click handlers.
   *
   * `effortLevels` is backend-specific (empty for Claude — CLAUDE_EFFORT_LEVELS
   * in src/backends.ts, since Claude has no reasoning-effort axis at all): the
   * Thinking row is OMITTED entirely (not rendered disabled/empty) whenever
   * `effortLevels` is empty, so `rows.length` also tells the caller which rows
   * apply for this backend.
   *
   * Each row carries `options: [{id, label, selected}]` plus a `selectedId`
   * echoing the input verbatim (even when it matches no option — e.g. a stale
   * or not-yet-loaded model id) so a caller can always show *something* without
   * the builder silently substituting a different value.
   */
  function sessionSetupModel(opts) {
    opts = opts || {};
    const backend = opts.backend === "claude" ? "claude" : "grok";
    const modelId = opts.modelId || "";
    const availableModels = Array.isArray(opts.availableModels) ? opts.availableModels : [];
    const effort = opts.effort || "";
    const effortLevels = Array.isArray(opts.effortLevels) ? opts.effortLevels : [];
    const modeId = opts.mode || "agent";
    const locked = !!opts.locked;

    const modelOptions = withSelected(
      availableModels
        .filter((m) => m && m.modelId)
        .map((m) => ({ id: m.modelId, label: m.name || m.modelId })),
      modelId,
    );

    const rows = [
      {
        id: "agent", kind: "segmented", label: "Agent", locked,
        selectedId: backend, options: withSelected(SETUP_AGENT_OPTIONS, backend),
      },
      {
        id: "model", kind: "dropdown", label: "Model", locked,
        selectedId: modelId, options: modelOptions,
      },
    ];

    if (effortLevels.length) {
      rows.push({
        id: "thinking", kind: "dots", label: "Thinking", locked,
        selectedId: effort, selectedIndex: effortLevels.indexOf(effort),
        options: withSelected(
          effortLevels.map((lvl) => ({ id: lvl, label: effortLevelLabel(lvl) })),
          effort,
        ),
      });
    }

    rows.push({
      id: "mode", kind: "segmented", label: "Mode", locked,
      selectedId: modeId, options: withSelected(SETUP_MODE_OPTIONS, modeId),
    });

    return { backend, rows };
  }

  // Short effort tokens for the top-bar Session setup chip — mirrors chat.js
  // shortEffort (kept local so the pure helper has no host dependency).
  function shortEffortForChip(e) {
    if (!e) return "";
    if (e === "minimal") return "min";
    if (e === "medium") return "med";
    if (e === "xhigh") return "xhi";
    return String(e).slice(0, 3);
  }

  /**
   * Pure one-line label for the top-bar Session setup chip
   * (session-setup-top-bar). Segments: Agent short · model · optional effort · mode short.
   * Agent shorts mirror updateBackendLabel (Grok/Claude), not full SETUP_AGENT_OPTIONS.
   * Mode shorts map SETUP_MODE_OPTIONS ids; yolo → "Auto" for density (full "Auto accept"
   * belongs in the chip title). Empty effort / Claude omits the thinking segment.
   * Returns { label, title } — title always has full mode + agent wording.
   */
  function sessionSetupChipLabel(opts) {
    opts = opts || {};
    const backend = opts.backend === "claude" ? "claude" : "grok";
    const agentShort = backend === "claude" ? "Claude" : "Grok";
    const agentFull = backend === "claude" ? "Claude Code" : "Grok Build";
    const modelName = (opts.modelName == null ? "" : String(opts.modelName)).trim() || "Model";
    const effort = opts.effort ? String(opts.effort) : "";
    const modeId = opts.modeId || "agent";
    const modeOpt = SETUP_MODE_OPTIONS.find((o) => o.id === modeId);
    const modeFull = modeOpt ? modeOpt.label : "Agent";
    const modeShort = modeId === "yolo" ? "Auto" : modeFull;

    const parts = [agentShort, modelName];
    if (effort) parts.push(shortEffortForChip(effort));
    parts.push(modeShort);
    const label = parts.join(" · ");

    const titleParts = [agentFull, modelName];
    if (effort) titleParts.push(effortLevelLabel(effort) + " effort");
    titleParts.push(modeFull);
    const title = "Session setup — click to change · " + titleParts.join(" · ");

    return { label, title, agentShort, modeShort, modeFull };
  }

  /**
   * Pure view-model for the toggle-shaped rows the Actions popover shows above
   * the discovered capabilities — session state the user can flip in place,
   * rather than something to drop into the composer.
   *
   * Shaped exactly like a `capabilityGroupsView` group so the renderer needs no
   * special case beyond one branch on `item.control` — deliberately NOT on
   * `item.kind`, preserving the standing rule that the renderer never branches
   * on kind strings (docs/plans/capability-surfacing-and-dynamic-capabilities).
   *
   * The host never produces this group: it is built at render time from the
   * webview's own `state.currentModeId` and posts the existing `setMode`
   * message, so it holds no state of its own and cannot drift from the mode
   * button, the Session Setup card's Mode row, or the quick-settings popover.
   *
   * Auto-accept is one value of a TRI-state mode (agent / plan / yolo), so a
   * two-state switch has to name its OFF target explicitly:
   *   yolo  -> on,  turning it off returns to `agent`
   *   agent -> off, turning it on selects `yolo`
   *   plan  -> off, turning it on selects `yolo` AND leaves Plan mode — allowed
   *            (the host's setMode already drops planActive, and the Mode
   *            segmented control permits the same transition), so the
   *            description says so rather than the row being disabled.
   */
  function sessionToggleGroup(opts) {
    opts = opts || {};
    const modeId = opts.modeId || "agent";
    const locked = !!opts.locked;
    const on = modeId === "yolo";
    const description = modeId === "plan"
      ? "Apply edits and run commands without asking. Turning this on leaves Plan mode."
      : "Apply edits and run commands without asking.";
    return {
      kind: "toggle",
      title: "Session controls",
      items: [{
        toggleId: "autoAccept",
        control: "switch",
        label: "Auto-accept",
        description,
        on,
        offModeId: "agent",
        onModeId: "yolo",
        locked,
      }],
      total: 1,
      remaining: 0,
    };
  }

  // Mirrors src/capabilities.ts's CAPABILITY_KIND_LABELS (kept in sync manually
  // — the same small intentional cross-boundary duplicate as shortEffort above).
  // Only ever used as a fallback: the host already stamps each CapabilityGroup's
  // own `title` from this same map, so this exists for a group missing one.
  const CAPABILITY_KIND_LABELS = {
    command: "Commands",
    skill: "Skills",
    agent: "Agents",
    // Empty on purpose — panel heading is already "Grokbit Workflows" (mirrors host).
    grokbit: "",
    workflow: "User Workflows",
  };

  // Longer than this and a row's description is clamped. Primarily a guard on
  // ACP-only "command" rows (grok's own builtins), whose description comes
  // straight from the CLI with no server-side cap — disk skills/agents are
  // already capped at CAPABILITY_DESCRIPTION_MAX_CHARS (280) in
  // src/capabilities.ts, which must stay ≥ this value so the host does not
  // hard-clip before this sentence-aware trim runs. Prefer a sentence boundary
  // (". " / "? " / "! ") at or after half the cap; otherwise hard-clip + "…".
  const CAPABILITY_ROW_DESCRIPTION_MAX = 260;
  function truncateCapabilityDescription(desc) {
    const s = (desc == null ? "" : String(desc)).trim();
    const max = CAPABILITY_ROW_DESCRIPTION_MAX;
    if (s.length <= max) return s;
    const half = Math.floor(max / 2);
    let cut = -1;
    for (const sep of [". ", "? ", "! "]) {
      const i = s.lastIndexOf(sep, max - 1);
      if (i >= half) cut = Math.max(cut, i + 1); // include the terminator, drop the space
    }
    if (cut >= half) return s.slice(0, cut);
    return s.slice(0, max - 1).trimEnd() + "…";
  }

  // Featured subset per CapabilityKind, shown by default with the rest behind
  // an expand link (docs/plans/actions-panel-featured-capabilities.md). Data,
  // not logic — a later kind needs one map entry here, not a renderer change,
  // the same data-driven rule as CAPABILITY_KIND_ORDER (src/capabilities.ts).
  // Matching is case-insensitive on item.name (see partitionFeatured below),
  // so "Plan" / "plan" / "Workflow" / "workflow" all land.
  //
  // Every named item is listed under EVERY kind it could plausibly discover
  // as (never just the one the operator had in mind), for the same "costs one
  // array entry and cannot be wrong" reason `alawys-approve` is listed beside
  // `always-approve` below: `mergeAcpCommands` keeps the DISK kind on a name
  // collision, and disk roots only ever yield `skill`/`agent`, never
  // `command` (src/capabilities.ts) — so an install where e.g. `docx`/`pptx`
  // ship as real skill directories would otherwise land in Skills (matching
  // neither `plan` nor `implement`) while Commands matches nothing at all and
  // silently degrades to plain first-N truncation, with no warning that the
  // feature stopped doing its job. The dual-listed command names ride in the
  // Skills list for that reason. Same reasoning for agents: `explore` is
  // grok's built-in agent type, `explorer` is `.claude/agents/explorer.md` in
  // this very repo — one intent, two spellings.
  //
  // `grokbit` lists the whole bundled suite, in the pipeline order
  // SUITE_SKILL_NAMES (src/skill-suite.ts) declares — partitionFeatured
  // reorders matched items into THIS array's order, which is the only thing
  // that sorts that group, so the two arrays must stay in the same order.
  // Listing every member also means featuredCount === items.length, so the
  // group renders no "Show all" expander: a five-item pipeline that hides its
  // last steps behind a link would be teaching the workflow wrong.
  //
  // The old agentic-team `plan`/`implement` skills are deliberately NOT
  // featured here any more — they were this repo's own `.grok/skills` suite,
  // which the bundled Grokbit suite replaces (docs/plans/
  // grokbit-actions-and-bundled-skill-suite.md § D4). A user who still has
  // them installed keeps them; they just no longer outrank their own skills.
  const CAPABILITY_FEATURED = {
    // Keep in pipeline order with SUITE_SKILL_NAMES (src/skill-suite.ts).
    // Ship is the orchestrator tile (Ultimate /ship pattern); phase tiles coexist.
    grokbit: ["grokbit-explore", "grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document", "grokbit-ship"],
    skill: [
      "cold-review", "init-repo", "docx", "pptx", "pdf", "create-workflow",
      "workflow", "deep-research", "always-approve", "alawys-approve",
    ],
    agent: ["explore", "explorer"],
    // The operator's request misspelled "always-approve" as "alawys-approve" —
    // both spellings are kept so the feature works regardless of which one an
    // install actually ships; it costs one array entry and cannot be wrong.
    command: [
      "cold-review", "init-repo", "docx", "pptx", "pdf", "create-workflow",
      "workflow", "deep-research", "always-approve", "alawys-approve",
    ],
    // No featured list for workflow: withCreateWorkflowTile already prepends
    // create-workflow, and the FALLBACK first-N path keeps saved scripts visible
    // without burying them behind "Show all" (a featured-only create pin would).
  };

  // Default allowlist for Grokbit Actions: bundled suite + backend-native User
  // Workflows. When the host posts actionsScope "all", every kind shows.
  const CAPABILITY_VISIBLE_KINDS = ["grokbit", "workflow"];
  /** Suite skill basenames that may appear as workspace forks (local overrides). */
  const SUITE_SKILL_NAMES_LC = [
    "grokbit-explore", "grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document", "grokbit-ship",
  ];

  /**
   * Pure filter for Actions mounts.
   * @param {unknown} groups
   * @param {{ scope?: "workflow" | "all" }} [opts]
   *   scope "workflow" (default) → CAPABILITY_VISIBLE_KINDS only
   *   scope "all" → every group with items (skills/agents/commands too)
   */
  function visibleCapabilityGroups(groups, opts) {
    if (!Array.isArray(groups)) return [];
    const scope = opts && opts.scope === "all" ? "all" : "workflow";
    if (scope === "all") {
      return groups.filter((g) => g).slice();
    }
    const allow = new Set(CAPABILITY_VISIBLE_KINDS);
    return groups.filter((g) => g && allow.has(g.kind));
  }

  /**
   * Empty-state model for the User Workflows section when discovery found no
   * tiles (or none are visible). Backend-specific copy — never "Claude can't".
   * On Grok, `withCreateWorkflowTile` always injects a Create workflow row, so
   * this empty path is mainly Claude (and a defensive fallback if the inject
   * helper is absent).
   * @param {{ backend?: string, hasWorkflowItems?: boolean }} opts
   * @returns {{ showEmpty: boolean, title: string, message: string } | null}
   */
  function userWorkflowsPanelState(opts) {
    opts = opts || {};
    if (opts.hasWorkflowItems) return null;
    const backend = opts.backend === "claude" ? "claude" : "grok";
    const title = "User Workflows";
    if (backend === "claude") {
      return {
        showEmpty: true,
        title,
        message:
          "No saved Claude workflows yet — save a script under .claude/workflows/ (export const meta = { name, description }) and click Refresh.",
      };
    }
    return {
      showEmpty: true,
      title,
      message:
        "No saved Grok workflows yet — create one with /create-workflow or drop a .rhai under .grok/workflows/, then Refresh.",
    };
  }

  /**
   * Synthetic Create-workflow tile for the User Workflows section (Grok only).
   * `/create-workflow` is a Grok Build skill; Claude has no equivalent, so its
   * empty copy still points at saving a script under `.claude/workflows/`.
   * Pure — never mutates `groups`.
   * @param {unknown} groups
   * @param {{ backend?: string }} [opts]
   * @returns {unknown[]}
   */
  function withCreateWorkflowTile(groups, opts) {
    opts = opts || {};
    const list = Array.isArray(groups) ? groups.map((g) => {
      if (!g || typeof g !== "object") return g;
      const items = Array.isArray(g.items) ? g.items.slice() : g.items;
      return { ...g, items };
    }) : [];
    if (opts.backend === "claude") return list;

    const tile = {
      kind: "workflow",
      name: "create-workflow",
      description:
        "Describe a goal — the AI designs agents, phases, and saves a runnable workflow under .grok/workflows/.",
      invoke: "/create-workflow ",
      source: "Built in",
      origin: "synthetic",
      // Opens the Workflow Builder overlay instead of only seeding the composer.
      openWorkflowBuilder: true,
    };

    const idx = list.findIndex((g) => g && g.kind === "workflow");
    if (idx >= 0) {
      const group = list[idx];
      const items = Array.isArray(group.items) ? group.items : [];
      if (items.some((i) => i && String(i.name || "").toLowerCase() === "create-workflow")) {
        return list;
      }
      const nextItems = [tile, ...items];
      const prevTotal = typeof group.total === "number" ? group.total : items.length;
      list[idx] = {
        ...group,
        items: nextItems,
        total: Math.max(prevTotal + 1, nextItems.length),
      };
      return list;
    }

    list.push({
      kind: "workflow",
      title: "User Workflows",
      total: 1,
      items: [tile],
    });
    return list;
  }

  /**
   * Tag workspace-tier suite name collisions as local overrides (not Grokbit-badged).
   * Returns a new groups array; does not mutate input.
   */
  function markLocalSuiteOverrides(groups) {
    if (!Array.isArray(groups)) return [];
    const suite = new Set(SUITE_SKILL_NAMES_LC);
    return groups.map((g) => {
      if (!g || !Array.isArray(g.items)) return g;
      const items = g.items.map((item) => {
        if (!item) return item;
        const name = (item.name || "").toLowerCase();
        if (!suite.has(name)) return item;
        if (item.kind === "grokbit") return item;
        const src = String(item.source || "");
        if (!/^project/i.test(src) && !/workspace/i.test(src)) return item;
        return {
          ...item,
          sourceBadge: "Local override",
          source: item.source || "Project",
        };
      });
      return { ...g, items };
    });
  }

  // No configured list for a kind, or none of its named items are installed
  // on this machine: still collapse to the first N items rather than showing
  // every row, so the panel is compact for everyone, not only on the
  // operator's own machine. Never collapses to zero rows.
  const CAPABILITY_FEATURED_FALLBACK = 5;

  /**
   * Pure partition of one group's (already-shaped) items into featured-first
   * order plus how many of the front are "featured" — the caller slices on
   * `featuredCount`, this never re-sorts on its behalf. Featured items move
   * to the front IN THE CONFIGURED ORDER from CAPABILITY_FEATURED, not the
   * host's order; every other item keeps its original relative order behind
   * them. Falls back to the first CAPABILITY_FEATURED_FALLBACK items when the
   * kind has no configured list, or the configured names match nothing in
   * this install.
   */
  function partitionFeatured(items, kind) {
    const list = Array.isArray(items) ? items : [];
    const names = CAPABILITY_FEATURED[kind];
    if (Array.isArray(names) && names.length) {
      const order = names.map((n) => n.toLowerCase());
      const rank = new Map(order.map((n, i) => [n, i]));
      const matched = list.filter((item) => rank.has((item.name || "").toLowerCase()));
      if (matched.length) {
        matched.sort((a, b) => rank.get(a.name.toLowerCase()) - rank.get(b.name.toLowerCase()));
        const matchedSet = new Set(matched);
        const rest = list.filter((item) => !matchedSet.has(item));
        return { items: [...matched, ...rest], featuredCount: matched.length };
      }
    }
    // .slice() — a fresh array, matching the matched branch above, not the
    // caller's own array by reference (this function is documented pure).
    return { items: list.slice(), featuredCount: Math.min(list.length, CAPABILITY_FEATURED_FALLBACK) };
  }

  /**
   * Pure view-model for the capability browser (slash commands, skills,
   * subagents/agents) — rendered into BOTH the new-tab welcome canvas
   * (#capabilities-panel) and the top-bar Skills popover (#capabilities-popover)
   * from this ONE builder, mirroring the sessionSetupModel idiom above. Iterates
   * the supplied `groups` ARRAY in the order given — no fixed keys, no
   * three-kind branching — so a later kind (should workflows ever stop being
   * deferred — see docs/plans/capability-surfacing-and-history-ux.md § Non-goals)
   * needs no renderer change, only a new discovery source plus an entry in
   * CAPABILITY_KIND_ORDER/_LABELS (src/capabilities.ts).
   *
   * Each returned item carries a ready-to-render `action`:
   *   "invoke" — seed the composer with `invoke` and never auto-send
   *   "open"   — open `path` in an editor tab
   *   "inert"  — neither `invoke` nor `path` (e.g. grok's built-in agent types);
   *              render non-interactive, no click handler, no pointer cursor
   * A group with no items is dropped; `remaining` is `total - items.length`,
   * the "+N more" count the host's per-group cap leaves behind.
   *
   * `label` is always the PLAIN NAME — not the slash token — so a
   * non-technical user reads "adr — Record an architecture decision" and
   * *learns* `/adr` by seeing it beside the name, rather than needing to know
   * it first (docs/plans/session-tab-ux-overhaul.md § Approach B). The slash
   * form, when the item is invocable, rides separately as `invokeLabel`
   * (`"/adr"`, trimmed of its trailing composer-seed space) for the renderer
   * to show as a small chip beside the name. `hint` (frontmatter
   * `argument-hint` / the ACP command's `input.hint`) is untrusted workspace
   * text, truncated here exactly like `description` — the source
   * (`src/capabilities.ts`) does not truncate it.
   *
   * `workspaceSource` flags a workspace-tier item (`source` starts with
   * "Project" — the convention every `CAPABILITY_ROOTS` entry uses, see
   * src/capabilities.ts § Root spec) so the renderer can call it out visibly:
   * `dedupeByPriority` is workspace-first, so a repo-authored skill silently
   * shadows a same-named one under `~/.grok`/`~/.claude` — without this a
   * checked-in `code-review` skill is indistinguishable from the user's own.
   *
   * Each group's `items` are reordered featured-first by `partitionFeatured`
   * (docs/plans/actions-panel-featured-capabilities.md), and the group
   * carries the resulting `featuredCount` — the renderer slices on it, it
   * does not re-sort. `sessionToggleGroup`'s group never passes through here,
   * so it carries no `featuredCount` and the renderer's fallback treats it as
   * "show everything."
   */
  /**
   * Display label for a capability row. Display-only — `name` stays the identity key.
   * - grokbit: strip `grokbit-` prefix, capitalize remainder (Explore, Plan, …)
   * - workflow: kebab-case → Title Case (create-workflow → Create Workflow)
   * - other kinds: raw name
   */
  function capabilityDisplayLabel(kind, name) {
    const n = name == null ? "" : String(name);
    if (kind === "grokbit" && n.startsWith("grokbit-")) {
      return n.slice(8).charAt(0).toUpperCase() + n.slice(9);
    }
    if (kind === "workflow" && n) {
      return n.split("-").filter(Boolean).map((seg) =>
        seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
      ).join(" ");
    }
    return n;
  }

  /**
   * Slash teaching chip — first token of the first line only, so multi-line
   * craft seeds never pollute the single-line chip UI.
   */
  function capabilityInvokeLabel(invoke) {
    if (typeof invoke !== "string" || !invoke) return undefined;
    const firstLine = invoke.split(/\r?\n/, 1)[0].trim();
    const token = firstLine.split(/\s+/, 1)[0];
    return token || undefined;
  }

  /** Caps for the Workflow Builder canvas (a11y list, not freeform infinite graph). */
  const WORKFLOW_BUILDER_MAX_PHASES = 12;
  const WORKFLOW_BUILDER_MAX_AGENTS_PER_PHASE = 8;

  /**
   * Default pipeline when the user opens the builder with an empty graph.
   * @returns {{ title: string, agents: { label: string, capabilityMode: string }[] }[]}
   */
  function defaultWorkflowGraphFromGoal(goal) {
    const g = (goal == null ? "" : String(goal)).trim();
    const suffix = g ? " for this goal" : "";
    return [
      {
        title: "Plan",
        agents: [{ label: "planner" + suffix, capabilityMode: "read-only" }],
      },
      {
        title: "Implement",
        agents: [{ label: "implementer" + suffix, capabilityMode: "read-write" }],
      },
      {
        title: "Verify",
        agents: [{ label: "verifier" + suffix, capabilityMode: "read-only" }],
      },
    ];
  }

  /**
   * @param {{ goal?: string, name?: string, scope?: string, constraints?: string, phases?: unknown[] }} draft
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateWorkflowBuilderDraft(draft) {
    draft = draft || {};
    const errors = [];
    const goal = (draft.goal == null ? "" : String(draft.goal)).trim();
    if (!goal) errors.push("Goal is required.");
    const name = (draft.name == null ? "" : String(draft.name)).trim();
    if (name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      errors.push("Name must be lowercase letters, digits, and hyphens (e.g. review-changes).");
    }
    const phases = Array.isArray(draft.phases) ? draft.phases : [];
    if (phases.length > WORKFLOW_BUILDER_MAX_PHASES) {
      errors.push("At most " + WORKFLOW_BUILDER_MAX_PHASES + " phases.");
    }
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i] || {};
      const agents = Array.isArray(p.agents) ? p.agents : [];
      if (agents.length > WORKFLOW_BUILDER_MAX_AGENTS_PER_PHASE) {
        errors.push("Phase " + (i + 1) + ": at most " + WORKFLOW_BUILDER_MAX_AGENTS_PER_PHASE + " agents.");
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /**
   * Structured brief for /create-workflow (seed-only; never auto-sends).
   * @param {{ goal?: string, name?: string, scope?: string, constraints?: string, phases?: { title?: string, agents?: { label?: string, capabilityMode?: string }[] }[] }} draft
   * @returns {string}
   */
  function buildWorkflowCraftBrief(draft) {
    draft = draft || {};
    const goal = (draft.goal == null ? "" : String(draft.goal)).trim();
    const name = (draft.name == null ? "" : String(draft.name)).trim();
    const scope = draft.scope === "user" ? "user" : "project";
    const constraints = (draft.constraints == null ? "" : String(draft.constraints)).trim();
    const phases = Array.isArray(draft.phases) ? draft.phases : [];
    const scopePath = scope === "user"
      ? "~/.grok/workflows/"
      : "<repo>/.grok/workflows/";
    const lines = [
      "/create-workflow",
      "",
      "Please author a multi-agent workflow from this brief. Gather any missing details, then write a smoke-checked .rhai under " + scopePath + (name || "<name>") + ".rhai.",
      "",
      "## Goal",
      goal || "(not provided)",
    ];
    if (name) {
      lines.push("", "## Suggested name", name);
    }
    lines.push("", "## Scope", scope === "user" ? "User home (~/.grok/workflows/)" : "Project (.grok/workflows/)");
    if (constraints) {
      lines.push("", "## Constraints", constraints);
    }
    if (phases.length) {
      lines.push("", "## Pipeline structure (from the visual builder)");
      phases.forEach((p, i) => {
        const title = (p && p.title) ? String(p.title).trim() : ("Phase " + (i + 1));
        lines.push((i + 1) + ". **" + title + "**");
        const agents = p && Array.isArray(p.agents) ? p.agents : [];
        if (!agents.length) {
          lines.push("   - (no agents listed — invent appropriate ones)");
        } else {
          agents.forEach((a) => {
            const label = (a && a.label) ? String(a.label).trim() : "agent";
            const mode = (a && a.capabilityMode) ? String(a.capabilityMode).trim() : "read-only";
            lines.push("   - agent `" + label + "` (capability_mode: " + mode + ")");
          });
        }
      });
    }
    lines.push(
      "",
      "Design agents, phases, and verification as needed. Prefer project scope unless I said otherwise. After save, tell me how to run it.",
    );
    return lines.join("\n");
  }

  function capabilityGroupsView(opts) {
    opts = opts || {};
    const groups = Array.isArray(opts.groups) ? opts.groups : [];
    const out = [];
    for (const g of groups) {
      if (!g || !Array.isArray(g.items) || !g.items.length) continue;
      const items = g.items.map((raw) => {
        raw = raw || {};
        const invoke = typeof raw.invoke === "string" && raw.invoke ? raw.invoke : undefined;
        const path = typeof raw.path === "string" && raw.path ? raw.path : undefined;
        const openWorkflowBuilder = !!raw.openWorkflowBuilder;
        const action = openWorkflowBuilder
          ? "builder"
          : (invoke ? "invoke" : (path ? "open" : "inert"));
        const source = raw.source || "";
        const hint = typeof raw.hint === "string" && raw.hint.trim() ? truncateCapabilityDescription(raw.hint) : undefined;
        const sourceBadge = typeof raw.sourceBadge === "string" && raw.sourceBadge.trim()
          ? raw.sourceBadge.trim()
          : undefined;
        const hasDetail = !!raw.hasDetail;
        const detailPath = typeof raw.detailPath === "string" && raw.detailPath
          ? raw.detailPath
          : undefined;
        return {
          kind: raw.kind,
          name: raw.name || "",
          label: capabilityDisplayLabel(raw.kind, raw.name || ""),
          invokeLabel: capabilityInvokeLabel(invoke),
          description: truncateCapabilityDescription(raw.description),
          hint,
          invoke,
          path,
          source,
          sourceBadge,
          workspaceSource: source.startsWith("Project") || !!sourceBadge,
          action,
          openWorkflowBuilder,
          inert: action === "inert",
          hasDetail,
          detailPath: hasDetail ? detailPath : undefined,
        };
      });
      const total = typeof g.total === "number" && g.total >= items.length ? g.total : items.length;
      const { items: ordered, featuredCount } = partitionFeatured(items, g.kind);
      // Honor an explicit non-empty host title; otherwise use the kind label
      // (which may be "" for grokbit — no section header under the panel heading).
      // Never fall through empty → kind id, or the suite would reappear as "grokbit".
      // Also drop a host title that only restates the panel heading (legacy payloads).
      const hostTitle = typeof g.title === "string" ? g.title.trim() : "";
      const kindLabel = CAPABILITY_KIND_LABELS[g.kind];
      let title = hostTitle || (kindLabel !== undefined ? kindLabel : g.kind) || "";
      if (/^grokbit workflows?$/i.test(title)) title = "";
      out.push({
        kind: g.kind,
        title,
        items: ordered,
        total,
        remaining: total - items.length,
        featuredCount,
      });
    }
    return out;
  }

  // Starter action cards for the empty-session welcome screen. Pure so unit tests
  // can assert the catalog without booting the webview. `voiceConfigured` swaps
  // the dictate card for a setup hint when the STT key is missing.
  function welcomeStarters(opts) {
    opts = opts || {};
    const voiceConfigured = opts.voiceConfigured !== false;
    const cards = [
      {
        id: "explain",
        title: "Explain this project",
        desc: "A plain-English overview of what you're looking at",
        prompt: "Explain this project to me in plain English — what it does, how it's organized, and where I should start.",
        action: "insert",
      },
      {
        id: "write-fix",
        title: "Write or fix something",
        desc: "Describe a change and Grok will help implement it",
        prompt: "Help me write or fix something: ",
        action: "insert",
      },
      {
        id: "plan",
        title: "Plan a change safely",
        desc: "Draft a plan first — nothing changes until you approve",
        prompt: "Help me plan a change carefully before making any edits: ",
        action: "plan",
      },
      {
        id: "imagine",
        title: "Create an image",
        desc: "Generate a picture from a description",
        prompt: "/imagine ",
        action: "insert",
      },
    ];
    if (voiceConfigured) {
      cards.push({
        id: "voice",
        title: "Dictate instead of type",
        desc: "Click the microphone and speak your request",
        prompt: "",
        action: "focus-mic",
      });
    } else {
      cards.push({
        id: "voice-setup",
        title: "Dictate instead of type",
        desc: "Voice needs a free setup step (API key + ffmpeg)",
        prompt: "",
        action: "voice-hint",
      });
    }
    return cards;
  }

  /**
   * Office / business document type chips (activity-bar launcher).
   * Each icon click opens a session and inserts `Create <label>: ` into the
   * composer (user finishes the prompt). Pure catalog so unit tests can assert
   * labels + prompts without the webview.
   */
  function businessDocTypeStarters() {
    return [
      { id: "word", label: "Word", prompt: "Create Word document: " },
      { id: "excel", label: "Excel", prompt: "Create Excel spreadsheet: " },
      { id: "powerpoint", label: "PowerPoint", prompt: "Create PowerPoint presentation: " },
      { id: "pdf", label: "PDF", prompt: "Create PDF: " },
      { id: "csv", label: "CSV", prompt: "Create CSV: " },
      { id: "markdown", label: "Markdown", prompt: "Create Markdown document: " },
    ];
  }

  /**
   * Composer seed insert policy (Studio E1/E2/E4): empty/whitespace → set;
   * non-empty → append seed on a new line; empty seed is a no-op.
   * Optional `opts.mode === "replace"` always returns the seed (used by
   * Grokbit Actions / capability rows so only the last workflow stays).
   * Default mode remains "append". Never auto-sends — caller only mutates
   * composer text.
   */
  function applyComposerSeed(currentText, seedText, opts) {
    const seed = seedText == null ? "" : String(seedText);
    if (!seed.length) return currentText == null ? "" : String(currentText);
    if (opts && opts.mode === "replace") return seed;
    const cur = currentText == null ? "" : String(currentText);
    if (!cur.trim()) return seed;
    return cur.replace(/\s+$/, "") + "\n" + seed;
  }

  /**
   * Task quick-actions for the empty-session welcome row (Studio E1).
   * Task intent only — not the six format icons (those stay on the launcher).
   */
  function taskQuickActions() {
    return [
      {
        id: "invoice",
        label: "New invoice",
        prompt:
          "Create a professional invoice as a Word document (.docx). Include seller/buyer fields, line items, tax, and totals. Ask me for any missing details: ",
      },
      {
        id: "receipt",
        label: "Analyze receipt",
        prompt:
          "Analyze this receipt (image or file I attach or describe) and extract vendor, date, line items, tax, and total. Summarize clearly and offer a CSV or spreadsheet if useful: ",
      },
      {
        id: "weekly-report",
        label: "Weekly report",
        prompt:
          "Build a weekly status report (Markdown or Word) covering goals, progress, blockers, and next week. Fill with placeholders where I have not given details: ",
      },
      {
        id: "pitch",
        label: "Pitch deck",
        prompt:
          "Generate a pitch deck as PowerPoint (.pptx): problem, solution, market, product, traction, team, and ask. Use a clean business structure; ask for company specifics: ",
      },
      {
        id: "approval",
        label: "Approval workflow",
        prompt:
          "Draft an approval workflow document (Markdown or Word) with stages, roles, SLAs, and escalation. Tailor it for: ",
      },
    ];
  }

  /**
   * Business template gallery catalog (Studio E4) — ~14 fill-ready seeds.
   * Use only seeds the composer; generation stays in CLI skills.
   */
  function businessTemplates() {
    return [
      {
        id: "sales-proposal",
        title: "Sales proposal",
        tags: ["sales", "word", "proposal"],
        prompt:
          "Create a client sales proposal as a Word document: executive summary, scope, pricing, timeline, and next steps. Company/product: ",
      },
      {
        id: "invoice-standard",
        title: "Standard invoice",
        tags: ["finance", "word", "invoice"],
        prompt:
          "Create a standard invoice (.docx) with company header, bill-to, line items, tax, and payment terms. Details: ",
      },
      {
        id: "quote-estimate",
        title: "Quote / estimate",
        tags: ["sales", "finance", "word"],
        prompt:
          "Create a formal quote/estimate (.docx) with itemized pricing and validity period. Project: ",
      },
      {
        id: "financial-model",
        title: "Simple financial model",
        tags: ["finance", "excel"],
        prompt:
          "Create an Excel financial model with assumptions, monthly projections, and a summary sheet. Business: ",
      },
      {
        id: "budget-tracker",
        title: "Budget tracker",
        tags: ["finance", "excel", "ops"],
        prompt:
          "Create an Excel budget tracker (categories, planned vs actual, variance). Context: ",
      },
      {
        id: "pitch-seed",
        title: "Investor pitch deck",
        tags: ["sales", "powerpoint", "pitch"],
        prompt:
          "Create an investor pitch deck (.pptx) with problem, solution, market, product, traction, team, ask. Startup: ",
      },
      {
        id: "status-report",
        title: "Project status report",
        tags: ["ops", "markdown", "report"],
        prompt:
          "Write a project status report in Markdown: summary, progress, risks, decisions needed. Project: ",
      },
      {
        id: "meeting-notes",
        title: "Meeting notes",
        tags: ["ops", "markdown"],
        prompt:
          "Create structured meeting notes (Markdown) with attendees, agenda, decisions, and action items. Meeting: ",
      },
      {
        id: "job-description",
        title: "Job description",
        tags: ["hr", "word"],
        prompt:
          "Write a job description (.docx or Markdown): role summary, responsibilities, requirements, nice-to-haves. Role: ",
      },
      {
        id: "offer-letter",
        title: "Offer letter outline",
        tags: ["hr", "word", "legal"],
        prompt:
          "Draft an employment offer letter outline (.docx) with role, compensation placeholders, start date, and conditions. Candidate role: ",
      },
      {
        id: "sop",
        title: "Standard operating procedure",
        tags: ["ops", "markdown"],
        prompt:
          "Write an SOP (Markdown) with purpose, scope, steps, owners, and exceptions. Process: ",
      },
      {
        id: "nda-outline",
        title: "NDA outline",
        tags: ["legal", "word"],
        prompt:
          "Draft a mutual NDA outline (.docx) with parties, definitions, obligations, term, and exclusions (not legal advice). Context: ",
      },
      {
        id: "marketing-one-pager",
        title: "Marketing one-pager",
        tags: ["marketing", "word", "pdf"],
        prompt:
          "Create a marketing one-pager (Word or PDF-ready Markdown) with value prop, audience, features, and CTA. Product: ",
      },
      {
        id: "csv-data-clean",
        title: "CSV data cleanup plan",
        tags: ["ops", "csv", "excel"],
        prompt:
          "Help clean or reshape a CSV/spreadsheet: profile columns, fix types, and output a cleaned file. Describe the data: ",
      },
    ];
  }

  /** Case-insensitive filter of templates by title + tags. Empty query → full list. */
  function filterTemplates(list, query) {
    const items = Array.isArray(list) ? list : [];
    const q = (query == null ? "" : String(query)).trim().toLowerCase();
    if (!q) return items.slice();
    return items.filter((t) => {
      if (!t) return false;
      const title = String(t.title || "").toLowerCase();
      const tags = Array.isArray(t.tags) ? t.tags.join(" ") : String(t.tags || "");
      return title.includes(q) || tags.toLowerCase().includes(q) || String(t.id || "").toLowerCase().includes(q);
    });
  }

  /** Compact stroke SVG glyphs for each businessDocTypeStarters id (currentColor). */
  function docTypeIcons() {
    return {
      word: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 13 1.5 5L12 15l1.5 3L15 13"/></svg>',
      excel: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 13v4"/><path d="M14 13v4"/></svg>',
      powerpoint: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8"/><path d="M12 18v4"/><path d="M8 9h4a2 2 0 0 1 0 4H8V9z"/></svg>',
      pdf: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M10 12h1a2 2 0 0 1 0 4h-1v-4z"/><path d="M14 16v-4h1.5a1.5 1.5 0 0 1 0 3H14"/><path d="M17 12v4"/></svg>',
      csv: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M3 14h18"/><path d="M9 4v16"/><path d="M15 4v16"/></svg>',
      markdown: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 16V11l2 2 2-2v5"/><path d="M15 13v3"/><path d="m14 15 1 1 1-1"/></svg>',
    };
  }

  /**
   * Compact token count for launcher meta / tooltips.
   * Always one decimal for K/M/B units ("12.5K", "1.0K", "1.5M", "1.2B");
   * plain integers below 1K. The B tier exists because the development-token
   * figure crossed 10^9 — four digits of millions ("1183.1M") reads as noise.
   */
  function formatTokenCount(n) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "";
    if (n < 1000) return String(Math.round(n));
    if (n < 1_000_000) return (n / 1000).toFixed(1) + "K";
    if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1) + "M";
    return (n / 1_000_000_000).toFixed(1) + "B";
  }

  /**
   * Launcher header line above "New session": extension version + the
   * development cost of Grokbit itself when known. Pure so unit tests pin the
   * format without the webview.
   * e.g. "v2.0.2 · 12.5K tokens" or just "v2.0.2" when no constant shipped.
   */
  function formatLauncherMeta(opts) {
    opts = opts || {};
    const raw = String(opts.extVersion || "").trim();
    const verLabel = raw ? (raw.charAt(0) === "v" || raw.charAt(0) === "V" ? raw : "v" + raw) : "";
    const tokens =
      typeof opts.totalTokens === "number" && Number.isFinite(opts.totalTokens)
        ? formatTokenCount(opts.totalTokens) + " tokens"
        : "";
    return [verLabel, tokens].filter(Boolean).join(" · ");
  }

  /**
   * Tooltip for that same line. The compact label has no room to say WHOSE
   * tokens these are, and the entire risk of this figure is a user reading it
   * as their own usage — so the tooltip says so in words, names the scope (all
   * maintainers, all sessions) and dates it, since the number is baked in at
   * package time and therefore lags live development by up to one release.
   * `generatedAt` is the ISO stamp from the generated constant; an absent or
   * unparseable one just drops the "as of" clause. Falls back to the bare
   * version when no token constant shipped. Pure.
   */
  function formatLauncherMetaTooltip(opts) {
    opts = opts || {};
    const raw = String(opts.extVersion || "").trim();
    const verLabel = raw ? (raw.charAt(0) === "v" || raw.charAt(0) === "V" ? raw : "v" + raw) : "";
    if (typeof opts.totalTokens !== "number" || !Number.isFinite(opts.totalTokens)) {
      return verLabel ? "Extension " + verLabel : "";
    }
    const stamp = new Date(String(opts.generatedAt || ""));
    const asOf = Number.isNaN(stamp.getTime()) ? "" : ", as of " + stamp.toISOString().slice(0, 10);
    return (
      ["Grokbit", verLabel].filter(Boolean).join(" ") +
      " — " +
      Math.round(opts.totalTokens).toLocaleString() +
      " tokens spent developing this extension (all maintainers, all sessions" +
      asOf +
      "). This is not your usage."
    );
  }

  /**
   * Activity-carousel peek navigation (pure). The strip shows one step at a time;
   * `view` is the index being shown, with -1 meaning "live" (follow the latest
   * step as it streams). Stepping forward past the newest step returns to live,
   * stepping back clamps at the first step, and a 0/1-step carousel has nothing
   * to peek at.
   */
  function activityPeek(view, count, dir) {
    if (typeof count !== "number" || count <= 1) return -1;
    const cur = view === -1 || view == null ? count - 1 : Math.min(Math.max(view, 0), count - 1);
    const next = Math.max(0, Math.min(count - 1, cur + (dir || 0)));
    return next >= count - 1 ? -1 : next;
  }

  /**
   * Step-counter text for the carousel strip: live shows the running total
   * ("12"), a peek shows position ("3/12"), an empty carousel shows nothing.
   */
  function activityPosText(view, count) {
    if (typeof count !== "number" || count <= 0) return "";
    if (view === -1 || view == null) return String(count);
    return `${Math.min(Math.max(view, 0), count - 1) + 1}/${count}`;
  }

  // Clipboard paste screenshots (docs/plans/paste-screenshots.md) — raw byte
  // gate before postMessage. Keep in sync with src/pending-images.ts.
  const PASTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
  const PASTE_IMAGE_MAX_COUNT = 6;
  const PASTE_IMAGE_MIME = new Set([
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  ]);

  function canAcceptPasteImageBytes(byteLength, maxBytes) {
    const max = typeof maxBytes === "number" ? maxBytes : PASTE_IMAGE_MAX_BYTES;
    return Number.isFinite(byteLength) && byteLength > 0 && byteLength <= max;
  }

  function isAllowedPasteImageMime(mimeType) {
    const m = String(mimeType || "").toLowerCase().trim();
    if (!m || m.includes("svg")) return false;
    return PASTE_IMAGE_MIME.has(m);
  }

  /**
   * Whether a user prompt should show one-line collapse chrome in the chat bubble.
   * Deterministic (no layout measurement) so happy-dom tests stay reliable.
   * Multi-line (any newline after trim) or longer than USER_PROMPT_COLLAPSE_MIN_CHARS.
   * Layout measurement in the webview may only *add* collapse cases later — never
   * remove ones this function marks true.
   */
  const USER_PROMPT_COLLAPSE_MIN_CHARS = 120;

  function userPromptShouldCollapse(text) {
    const s = String(text == null ? "" : text).trim();
    if (!s) return false;
    if (s.includes("\n")) return true;
    return s.length > USER_PROMPT_COLLAPSE_MIN_CHARS;
  }

  const api = {
    FILE_EXTS, looksLikeFileRef, isSafeHref, formatRelativeTime, modelDisplayName,
    MIC_STATES, nextMicState, trailingSendPhrase, buildQuestionAnswers,
    isSubagentToolCall, subagentLabel, shouldStickToBottom, clampScrollTop, splitMath,
    stripUnsupportedTex, toolFailureText, computeLineDiff, parseAttachmentContext,
    MODE_DISPLAY, modeDisplayMeta, permissionButtonLabel, welcomeStarters,
    businessDocTypeStarters, docTypeIcons, formatTokenCount, formatLauncherMeta,
    formatLauncherMetaTooltip,
    applyComposerSeed, taskQuickActions, businessTemplates, filterTemplates,
    isRejectedPermissionKind, permissionCollapseVerb,
    SESSION_DOT_LABELS, sessionDotLabel, backendBadgeLabel,
    activityPeek, activityPosText,
    inferPermissionKind, permissionDiffFromRawInput,
    sessionSetupModel, sessionSetupChipLabel,
    CAPABILITY_KIND_LABELS, capabilityGroupsView, sessionToggleGroup,
    CAPABILITY_FEATURED, CAPABILITY_FEATURED_FALLBACK,
    CAPABILITY_VISIBLE_KINDS, visibleCapabilityGroups, markLocalSuiteOverrides,
    userWorkflowsPanelState, withCreateWorkflowTile,
    capabilityDisplayLabel, capabilityInvokeLabel,
    WORKFLOW_BUILDER_MAX_PHASES, WORKFLOW_BUILDER_MAX_AGENTS_PER_PHASE,
    defaultWorkflowGraphFromGoal, validateWorkflowBuilderDraft, buildWorkflowCraftBrief,
    CAPABILITY_ROW_DESCRIPTION_MAX, truncateCapabilityDescription,
    PASTE_IMAGE_MAX_BYTES, PASTE_IMAGE_MAX_COUNT, PASTE_IMAGE_MIME,
    canAcceptPasteImageBytes, isAllowedPasteImageMime,
    USER_PROMPT_COLLAPSE_MIN_CHARS, userPromptShouldCollapse,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.GrokWebviewHelpers = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
