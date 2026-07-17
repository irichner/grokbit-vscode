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
   * Never auto-sends — caller only mutates composer text.
   */
  function applyComposerSeed(currentText, seedText) {
    const seed = seedText == null ? "" : String(seedText);
    if (!seed.length) return currentText == null ? "" : String(currentText);
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
   * Always one decimal for K/M units ("12.5K", "1.0K", "1.5M"); plain integers below 1K.
   */
  function formatTokenCount(n) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "";
    if (n < 1000) return String(Math.round(n));
    if (n < 1_000_000) return (n / 1000).toFixed(1) + "K";
    return (n / 1_000_000).toFixed(1) + "M";
  }

  /**
   * Launcher header line above "New session": extension version + project
   * lifetime token estimate when known. Pure so unit tests pin the format
   * without the webview.
   * e.g. "v2.0.2 · 12.5K tokens" or just "v2.0.2" when no session tokens yet.
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

  const api = {
    FILE_EXTS, looksLikeFileRef, formatRelativeTime, modelDisplayName,
    MIC_STATES, nextMicState, trailingSendPhrase, buildQuestionAnswers,
    isSubagentToolCall, subagentLabel, shouldStickToBottom, splitMath,
    stripUnsupportedTex, toolFailureText, computeLineDiff, parseAttachmentContext,
    MODE_DISPLAY, modeDisplayMeta, permissionButtonLabel, welcomeStarters,
    businessDocTypeStarters, docTypeIcons, formatTokenCount, formatLauncherMeta,
    applyComposerSeed, taskQuickActions, businessTemplates, filterTemplates,
    isRejectedPermissionKind, permissionCollapseVerb,
    SESSION_DOT_LABELS, sessionDotLabel,
    activityPeek, activityPosText,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.GrokWebviewHelpers = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
