(function () {
  const vscode = acquireVsCodeApi();

  const $ = (id) => document.getElementById(id);
  const messagesEl = $("messages");
  const input = $("input");
  const sendBtn = $("send-btn");
  const micBtn = $("mic-btn");
  const inputHighlight = $("input-highlight");
  const newBtn = $("new-btn");
  const historyBtn = $("history-btn");
  const docsBtn = $("docs-btn");
  const capabilitiesBtn = $("capabilities-btn");
  const modeBtn = $("mode-btn");
  const modelLabel = $("model-label");
  const backendLabelBtn = $("backend-label");
  const gearBtn = $("gear-btn");
  const addBtn = $("add-btn");
  const chipsEl = $("chips");
  const attachmentsEl = $("attachments");
  const donutArc = $("donut-arc");
  const donutLabel = $("donut-label");
  const slashPopover = $("slash-popover");
  const modePopover = $("mode-popover");
  const backendPopover = $("backend-popover");
  const sessionSettingsPopover = $("session-settings-popover");
  const gearPopover = $("gear-popover");
  const addPopover = $("add-popover");
  const historyPopover = $("history-popover");
  const docsPopover = $("docs-popover");
  const capabilitiesPopover = $("capabilities-popover");
  const scrollBottomBtn = $("scroll-bottom-btn");
  const changedFilesEl = $("changed-files");
  const planBanner = $("plan-banner");

  // grok's accepted reasoning-effort values, lowest → highest (matches the CLI;
  // `max` is not a real grok level and is intentionally excluded — see #3/#4).
  const EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh"];
  const EFFORT_TOOLTIPS = {
    none: "None — no extra reasoning",
    minimal: "Minimal — least reasoning",
    low: "Low — fast, lightweight reasoning",
    medium: "Medium — balanced",
    high: "High — deeper reasoning",
    xhigh: "XHigh — deepest reasoning, slowest",
  };

  const state = {
    welcomeVisible: true,
    currentModelId: null,
    availableModels: [],
    currentModeId: "agent",
    effort: "",
    // Agent backend for THIS tab (see docs/plans/claude-code-backend.md § WP3).
    // Defaults to grok — the host's backendChanged (sent on every ready/replay
    // via replayInto, plus once more if a Claude account check lands late)
    // overwrites this almost immediately for every real session.
    backend: "grok",
    backendLabel: "",
    claudeAccount: null,
    // Which backend the currently-shown onboarding card (if any) is for — lets
    // the recheck button reopen on the same backend. "" = grok's cards (which
    // carry no backend field) or no card showing.
    onboardingBackend: "",
    cwd: "",
    contextWindow: 200000,
    usedTokens: 0,
    useCtrlEnter: false,
    commands: [],
    chips: [],
    // Studio E2 workspace-docs popover state (ephemeral — not buffered).
    workspaceDocs: { entries: [], loading: false, error: null, total: 0, capped: false },
    // Capability browser (slash commands, skills, agents) — ephemeral, not
    // buffered (see docs/plans/capability-surfacing-and-history-ux.md § Message
    // contract). Null until the host's first "capabilities" reply lands.
    capabilities: null,
    // Which capability groups the user has expanded past their featured set
    // ({[kind]: true}, docs/plans/actions-panel-featured-capabilities.md).
    // Shared by both mounts (welcome canvas + popover) by design — they are
    // two views of one list — and survives any re-render (setBusy lock/
    // unlock, modeChanged reopening the popover, a Refresh); cleared only on
    // a session switch (resetForNewSession).
    capabilitiesExpanded: {},
    // Pending in-panel how-it-works expand (name + DOM node to fill).
    pendingCapabilityDetail: null,
    // grok.showCapabilities — arrives on every initialState (see the handler);
    // true is the config default, kept here so the request-from-initialState
    // gate has a sane value even before the first initialState lands.
    showCapabilities: true,
    // grok.actionsScope — workflow (default) vs all capability kinds (Phase B).
    actionsScope: "workflow",
    // Phase E: best-effort MCP server count from config.toml (honest, not a browser).
    mcpServerCount: 0,
    // @-mention autocomplete (Phase B).
    atHits: [],
    atQuery: null,
    atActive: 0,
    // Start busy+locked: opening the view immediately spins up a session
    // (ready → startSession), so the send button shows the spinner from the
    // first paint until the host posts setBusy:false once the session is live.
    busy: true,
    // Voice-input button: "idle" | "listening" | "transcribing" (see nextMicState).
    mic: "idle",
    // Whether the host found a voice API key. Optimistic until the host says
    // otherwise; drives the mic button's "needs setup" hint.
    voiceConfigured: true,
    // Streaming dictation: text typed before the mic started ("base"), and
    // whether live partials have begun replacing the tail.
    voiceBase: "",
    voiceLive: false,
    // The configured send phrase (for highlighting it in the composer).
    voiceSendPhrase: "grok send",
    // Messages dictated while Grok was busy, flushed when the turn ends.
    voiceQueue: [],
    activeAgentEl: null,
    activeAgentRaw: "",
    activeUserEl: null,
    activeUserRaw: "",
    activeThoughtEl: null,
    activeThoughtHdrEl: null,
    thoughtStartTime: null,
    activeToolGroupEl: null,
    // Live activity-carousel block (one per turn segment): collects tool groups,
    // thinking, and step narration while grok works so the transcript stays one
    // row. Destroyed (not frozen) when the segment ends or the turn seals.
    // Null when no block is live (incl. classic mode — see state.compactActivity).
    activeActivityEl: null,
    // Active Q&A turn container (`.turn.active`). User prompts, live activity,
    // interactive cards, and the final answer nest under it. Null when no turn
    // is open (welcome, or content that arrived before any user bubble).
    activeTurnEl: null,
    slashFiltered: [],
    slashActive: 0,
    pendingDiffByToolCallId: new Map(),
    toolItemsByToolCallId: new Map(),
    toolFailuresById: new Map(), // toolCallId → error text, so a single-call group carries it onto the flat
    // Applied edits in the CURRENT turn, keyed by toolCallId so a failed/plan-blocked
    // write can drop just that edit. The strip UI aggregates by path (sum +/−, one chip
    // per path) so re-editing the same file does not list it twice. Cleared on the next
    // user send; replayed history never populates it.
    changedFiles: new Map(),

    agentRenderScheduled: false,
    thoughtBuffer: "",
    thoughtRenderScheduled: false,
    sessions: [],
    activeSessionId: null,
    // Dashboard dot per grok-session id (id → "working"|"needs-you"|"unread"|
    // "error"|"none"). The host computes the value (live status + persisted unread
    // badge); the webview just paints it. Sent in full on each `sessions` message
    // and patched incrementally by `sessionDot`.
    dots: {},
    sessionSearch: "",
    renamingSessionId: null,
    // History pagination: the host sends one page at a time (newest-first by last
    // activity) so the popover stays fast with thousands of sessions. `sessionTotal`
    // is the full count (or matched count when searching); `sessionHasMore` drives the
    // scroll-to-load; `sessionLoading` guards against firing overlapping load-more
    // requests; `sessionQuery` is the query the loaded page belongs to (so a stale
    // page from a previous keystroke is ignored). `sessionNextOffset` is the host's
    // own authoritative load-more cursor (offset + disk rows actually read) — NOT
    // state.sessions.length, which a host-injected synthesized live row would make
    // overshoot (see the list.onscroll comment above).
    sessionTotal: 0,
    sessionHasMore: false,
    sessionLoading: false,
    sessionQuery: "",
    sessionNextOffset: 0,
    replaying: false,
    // Panel reveal rebuild (hide→ready→replay), NOT session/load historyReplay.
    // While true, auto-scroll and scrollState posts are suppressed so mid-scroll
    // can be restored after buffer replay without yanking to the bottom.
    panelReplaying: false,
    // Stashed by beginPanelReplay; applied on endPanelReplay.
    pendingRestore: null,
    // Suppress host scrollState posts while applying restore (and through the
    // authoritative end post) so apply-induced scroll events cannot corrupt host memory.
    scrollStateSuppress: false,
    // Live ask_user_question tool calls (toolCallId → {questions, fromReplay}).
    // grok emits a tool_call alongside the live x.ai/ask_user_question request; we
    // stash it to suppress the generic tool chip (the interactive card from
    // `questionRequest` stands in).
    questionToolCalls: new Map(),
    // Restored question cards on resume (toolCallId → card element). On replay grok
    // sends a tool_call per question (with rawInput.questions); we render the card
    // immediately and fill the answer in whenever it arrives — on the tool_call
    // snapshot or a later update with the same toolCallId.
    restoredCardsByToolCallId: new Map(),
    // Saved plan cards waiting to be rendered inline as the conversation replays.
    // Each entry has { text, verdict, afterUserMessage? }. We drain entries whose
    // afterUserMessage matches the current userMsgCount as user messages stream
    // in, and dump anything left (legacy plans w/o position, or plans after the
    // last replayed user msg) at the end of replay.
    planHistoryQueue: [],
    // Answered permission cards from a resumed session, drained inline like plans
    // (each { title, outcome, afterUserMessage? }). The CLI doesn't replay the
    // request, so the host persists + re-queues these.
    permissionHistoryQueue: [],
    userMsgCount: 0,
    // Element rendered below a resolved plan card while the host is waiting on
    // grok's response to the verdict (or its comment). Visible only between
    // the verdict click and the first incoming agent chunk; cleared by any
    // arriving content or by reset.
    planProcessingEl: null,
    // The "Grokking…" placeholder shown while a user-initiated turn is waiting on
    // grok — from the moment the user sends (agentStart) until the first real
    // content arrives (a thought, message, tool card, …), which replaces it in
    // place. Same font + animated dots as the Thinking header, minus the expand
    // chevron. Covers the held-behind-primer gap too: the message shows as sent,
    // this spins, then the real Thinking block takes over. Never shown for the
    // silent primer turn (which emits no agentStart). One at a time with
    // planProcessing (each hides the other).
    grokkingEl: null,
    // When true, the busy state is "locked" (e.g. session-start priming): the
    // send button shows a spinner and is disabled. When false, busy is
    // "stoppable" (regular prompts, verdict afterTurn) and the send button
    // shows a stop icon that the user can click to cancel grok mid-stream.
    // Starts true so the very first paint is the disabled spinner (see `busy`).
    busyLocked: true,
    // grok CLI version from the ACP `initialized` handshake — shown in gear → About.
    cliVersion: "",
    // Extension version (from initialState) — shown in the gear → About panel.
    extVersion: "",
    // Which gear-popover view is showing ("main"|"model"|"about"|"config"), so an
    // async grokUpdateStatus only re-renders About when it's the visible view.
    gearView: "main",
    // Latest `grok update --check` result for the About panel: { checking } while
    // in flight, then { current, latest, updateAvailable, error }.
    grokUpdate: null,
    // While replaying, suppress everything from the start of the current user
    // message (a primer turn) through the end of grok's response to it — until
    // the next user message starts. Keeps the chat clean of our session-start
    // priming when the user resumes a session.
    suppressReplayTurn: false,
    // While replaying, suppress just the user bubble for a marker-only verdict
    // message ([Plan cancelled] with no comment) — grok's response to it still
    // renders. Distinct from suppressReplayTurn (which hides the whole turn).
    skipUserBubble: false,
    // Whether the chat is "pinned" to the bottom. A scroll listener flips this
    // off the moment the user scrolls up to read earlier messages; while it's
    // off, streaming thought/agent chunks no longer yank the view back down
    // (#16). Interactive activity (permission/question cards, the user's own
    // sent message) re-pins via forceScrollToBottom().
    stickToBottom: true,
    // grok.showThinking (#26). Thinking traces are hidden by default; when hidden
    // a lightweight "Thinking…" indicator stands in while grok reasons (and no
    // tool/Grokking indicator is already showing). Toggle lives in gear → Config
    // & debug. The host posts the real value on init and on config change.
    showThinking: false,
    thinkingIndicatorEl: null,
    // grok.compactActivity — roll each turn's working activity (tools, thinking,
    // step narration) into one carousel block instead of a scrolling stream of
    // rows. On by default; the setting and the gear → Config & debug switch flip
    // it live (new turns only — already-rendered DOM is never restructured).
    compactActivity: true,
  };

  // Matches any version of the extension's primer (v1, v2, …). Used during
  // session replay to detect and hide the primer + grok's ack from the
  // restored conversation.
  const PRIMER_PATTERN = /^\s*\[grok-build-vscode primer v\d+\]/;

  // The CLI feeds background-task notices (and similar plumbing) back to the
  // agent as a user_message_chunk wrapped in <system-reminder>…</system-reminder>.
  // It's agent-facing context the user never typed — keep it out of the chat
  // on replay (the host surfaces task completion as a one-shot notification).
  const SYSTEM_REMINDER_PATTERN = /^\s*<system-reminder>/;

  // The host prepends a plan-verdict protocol marker ([Plan approved|rejected|
  // cancelled]) to the wire-level prompt so grok can recognize the verdict. It's
  // grok-only plumbing — never shown live. On replay grok echoes the raw prompt,
  // so strip the marker here to keep the restored view consistent with live.
  const PLAN_MARKER_PATTERN = /^\s*\[Plan (approved|rejected|cancelled)\]\s*/i;
  function stripPlanMarker(text) {
    const m = PLAN_MARKER_PATTERN.exec(text || "");
    if (!m) return { matched: false, rest: text };
    return { matched: true, rest: (text || "").slice(m[0].length) };
  }

  // ---------- icons ----------

  const ICON = {
    eye: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`,
    file: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
    folderOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`,
    cpu: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    squarePen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`,
    arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
    arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`,
    grok: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M 15.04 5.47 A 7.2 7.2 0 0 0 5.47 15.04"/><path d="M 8.96 18.53 A 7.2 7.2 0 0 0 18.53 8.96"/><path d="M 4.6 19.4 L 19.4 4.6"/></svg>`,
    orbit: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.341 6.484A10 10 0 0 1 10.266 21.85"/><path d="M3.659 17.516A10 10 0 0 1 13.74 2.152"/><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/></svg>`,
    square: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`,
    spinner: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    gear: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    shield: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
    bot: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,
    listTree: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/></svg>`,
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    clock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
    upload: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
    pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`,
    mic: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
    // Animated equalizer bars shown while listening (CSS drives the bounce).
    micWaves: `<span class="mic-waves" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`,
  };

  // Plain-language mode chrome. Labels/descs come from the pure helper so unit
  // tests can assert them without booting the webview; icons stay local.
  const _modeDisplay = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.MODE_DISPLAY) || {
    agent: { label: "Agent", desc: "Grok can help right away. It may ask before editing files or running commands." },
    plan: { label: "Plan first", desc: "Grok drafts a plan first. Nothing changes until you approve it." },
    yolo: { label: "Auto accept", desc: "Grok makes changes without asking for permission each time." },
  };
  const MODE_META = {
    agent: { icon: ICON.bot, label: _modeDisplay.agent.label, desc: _modeDisplay.agent.desc },
    plan: { icon: ICON.listTree, label: _modeDisplay.plan.label, desc: _modeDisplay.plan.desc },
    yolo: { icon: ICON.zap, label: _modeDisplay.yolo.label, desc: _modeDisplay.yolo.desc },
  };
  const permissionButtonLabel = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.permissionButtonLabel)
    || function (opt) { return (opt && opt.name) || "Continue"; };
  const applyComposerSeed = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.applyComposerSeed)
    ? window.GrokWebviewHelpers.applyComposerSeed
    : function (cur, seed, opts) {
        if (!seed) return cur || "";
        if (opts && opts.mode === "replace") return seed;
        if (!(cur || "").trim()) return seed;
        return String(cur).replace(/\s+$/, "") + "\n" + seed;
      };
  const activityPeek = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.activityPeek)
    || function (view, count, dir) {
        if (!count || count <= 1) return -1;
        const cur = view === -1 ? count - 1 : Math.min(Math.max(view, 0), count - 1);
        const next = Math.max(0, Math.min(count - 1, cur + dir));
        return next >= count - 1 ? -1 : next;
      };
  const activityPosText = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.activityPosText)
    || function (view, count) {
        if (!count) return "";
        return view === -1 ? String(count) : `${view + 1}/${count}`;
      };
  // Per-tab settings view-model (Agent / Model / Thinking / Mode) shared by the
  // welcome "Session setup" card + the composer quick-settings popover — see
  // docs/plans/claude-code-backend.md § WP7.
  const sessionSetupModel = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.sessionSetupModel)
    || function () { return { backend: "grok", rows: [] }; };

  // Three blinking dots — the tool rows' in-progress animation, reused by every
  // progress indicator (Grokking / Thinking) so they all pulse the same way
  // instead of the old morphing "…" ellipsis (#26 follow-up).
  const BLINK_DOTS = `<span class="blink-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>`;

  // ---------- helpers ----------

  function capitalize(s) {
    if (!s) return "";
    if (s === "xhigh") return "XHigh";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function toK(n) {
    return Math.round(n / 1000) + "K";
  }

  function truncate(s, max) {
    return s.length > max ? s.slice(0, max) + "…" : s;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatTime(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  function updateModeBtn(modeId) {
    const meta = MODE_META[modeId] || MODE_META.agent;
    modeBtn.innerHTML = `${meta.icon}<span class="btn-label">${escapeHtml(meta.label)}</span>`;
    modeBtn.title = state.busy
      ? "Mode — available once the session is ready"
      : `${meta.label} — ${meta.desc}`;
    modeBtn.classList.toggle("plan-active", modeId === "plan");
    modeBtn.classList.toggle("yolo-active", modeId === "yolo");
    // Full-width plan-mode banner — the tinted mode button is easy to miss; this
    // makes the write/command gate unmissable while planning.
    if (planBanner) {
      planBanner.hidden = modeId !== "plan";
      const label = planBanner.querySelector(".plan-banner-text");
      if (label) {
        label.textContent = "Plan first — Grok drafts a plan; files and commands stay blocked until you approve.";
      }
    }
  }

  // Compact model + effort chip in the composer toolbar. Both settings live two
  // clicks deep in the gear menu; this surfaces the current values always-visible
  // and opens the gear (model + effort controls) on click. Hidden until a model
  // is known (the initial `session` event).
  function updateModelLabel() {
    if (!modelLabel) return;
    const name = modelDisplayName(state.currentModelId, state.availableModels) || "";
    if (!name && !state.currentModelId) { modelLabel.hidden = true; return; }
    const short = truncate(name || "Grok", 14);
    const eff = state.effort ? ` · ${shortEffort(state.effort)}` : "";
    modelLabel.innerHTML = `<span class="btn-label">${escapeHtml(short + eff)}</span>`;
    const full = name || "Model";
    modelLabel.title = `${full}${state.effort ? " (" + capitalize(state.effort) + " effort)" : ""} — click to change`;
    modelLabel.hidden = false;
  }

  // Backend chip beside the model chip — which agent (Grok Build / Claude Code)
  // this tab runs. Always shown once known (unlike the model chip, the backend
  // is never "not yet known": the host sends it on the very first ready/replay).
  function updateBackendLabel() {
    if (!backendLabelBtn) return;
    const isClaude = state.backend === "claude";
    backendLabelBtn.innerHTML = `<span class="btn-label">${escapeHtml(isClaude ? "Claude" : "Grok")}</span>`;
    backendLabelBtn.classList.toggle("backend-claude", isClaude);
    const label = state.backendLabel || (isClaude ? "Claude Code" : "Grok Build");
    let title = `${label} — click to switch agent`;
    if (isClaude && state.claudeAccount) {
      const acct = state.claudeAccount;
      if (acct.email) {
        const plan = acct.subscriptionType ? ` (${acct.subscriptionType})` : "";
        // Disclosure over silence: authMethod/apiProvider (from `claude auth
        // status --json`) make it visible whether the subscription or
        // something else (an API key, a gateway) is actually being billed.
        const via = acct.authMethod || acct.apiProvider
          ? ` via ${[acct.authMethod, acct.apiProvider].filter(Boolean).join("/")}`
          : "";
        title = `${label} — signed in as ${acct.email}${plan}${via} — click to switch agent`;
      }
      // Names only, never values — see detectClaudeCredentialOverrides
      // (claude-locator.ts). Appended regardless of whether email is known,
      // so a broken/misconfigured gateway still surfaces the override.
      if (acct.overrides && acct.overrides.length) {
        title += ` — env overrides in effect: ${acct.overrides.join(", ")}`;
      }
    }
    backendLabelBtn.title = title;
    backendLabelBtn.hidden = false;
  }

  // The other backend's id/label — the popover only ever needs to offer ONE
  // alternative (there are exactly two backends today).
  const BACKEND_META = {
    grok: { label: "Grok Build", desc: "xAI's coding agent" },
    claude: { label: "Claude Code", desc: "Anthropic's coding agent" },
  };
  function openBackendPopover() {
    if (!backendPopover || !backendLabelBtn) return;
    if (!backendPopover.hidden) { closePopovers(); return; }
    if (state.busy) return; // settings lock while priming/mid-turn, same as model/effort
    closePopovers();
    backendPopover.innerHTML = "";
    for (const id of Object.keys(BACKEND_META)) {
      const meta = BACKEND_META[id];
      const active = id === state.backend;
      const el = document.createElement("div");
      el.className = "toolbar-popover-item mode-popover-item" + (active ? " active" : "");
      el.innerHTML =
        `<span class="mode-item-body">` +
          `<span class="mode-item-label">${escapeHtml(meta.label)}</span>` +
          `<span class="mode-item-desc">${escapeHtml(meta.desc)}</span>` +
        `</span>` +
        (active ? '<span class="popover-check">✓</span>' : "");
      el.onclick = (e) => {
        e.stopPropagation();
        if (active) { closePopovers(); return; }
        vscode.postMessage({ type: "switchBackend", backend: id });
        closePopovers();
      };
      backendPopover.appendChild(el);
    }
    positionPopover(backendPopover, backendLabelBtn);
    backendPopover.hidden = false;
  }

  // ---------- per-tab session settings (Agent / Model / Thinking / Mode) ----------
  // One render path shared by the new-tab "Session setup" card and this chip's
  // quick-settings popover, both built from the same sessionSetupModel()
  // view-model (media/webview-helpers.js) — one implementation, one set of
  // tests (docs/plans/claude-code-backend.md § WP7).

  function currentSessionSetupModel() {
    // Claude has no reasoning-effort axis at all (CLAUDE_EFFORT_LEVELS is empty
    // in src/backends.ts) — the Thinking row is omitted by the builder whenever
    // effortLevels is empty, not just disabled.
    const effortLevels = state.backend === "claude" ? [] : EFFORT_LEVELS;
    return sessionSetupModel({
      backend: state.backend,
      modelId: state.currentModelId,
      availableModels: state.availableModels,
      effort: state.effort,
      effortLevels,
      mode: state.currentModeId,
      locked: state.busy,
    });
  }

  // Apply a pick from any of the four rows. Agent/Model/Mode changes are
  // acknowledged asynchronously by the host (backendChanged/modelChanged/
  // modeChanged post back and re-render both mounts), so only the redundant
  // no-op case is short-circuited here; Thinking has no ack message at all
  // (mirrors the gear popover's own effort dots), so it updates state.effort
  // optimistically.
  function pickSessionSetting(rowId, value) {
    if (rowId === "agent") {
      if (value === state.backend) return;
      vscode.postMessage({ type: "switchBackend", backend: value });
    } else if (rowId === "model") {
      if (value === state.currentModelId) return;
      vscode.postMessage({ type: "setModel", modelId: value });
    } else if (rowId === "thinking") {
      state.effort = value;
      vscode.postMessage({ type: "setEffort", level: value });
      updateModelLabel(); // reflect the new effort on the composer chip immediately
    } else if (rowId === "mode") {
      vscode.postMessage({ type: "setMode", modeId: value });
    }
    refreshSessionSettingsMounts();
  }

  // Build one row's DOM from its view-model — shared between the card and the
  // popover, which just append these into different containers.
  function buildSessionSettingsRow(row) {
    const wrap = document.createElement("div");
    wrap.className = "session-settings-row";
    const label = document.createElement("span");
    label.className = "session-settings-label";
    label.textContent = row.label;
    wrap.appendChild(label);

    const control = document.createElement("div");
    control.className = "session-settings-control";
    // Matches the gear popover's model/effort lock tooltip exactly (renderGearMain).
    const lockedTitle = "Available once the session is ready";

    if (row.kind === "segmented") {
      const seg = document.createElement("div");
      seg.className = "segmented" + (row.locked ? " disabled" : "");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", row.label);
      for (const opt of row.options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "segmented-btn" + (opt.selected ? " active" : "") + (row.locked ? " disabled" : "");
        btn.textContent = opt.label;
        btn.setAttribute("aria-pressed", String(!!opt.selected));
        btn.disabled = row.locked;
        btn.title = row.locked ? lockedTitle : opt.label;
        if (!row.locked) {
          btn.onclick = (e) => { e.stopPropagation(); pickSessionSetting(row.id, opt.id); };
        }
        seg.appendChild(btn);
      }
      control.appendChild(seg);
    } else if (row.kind === "dropdown") {
      const select = document.createElement("select");
      select.className = "session-settings-select" + (row.locked ? " disabled" : "");
      select.disabled = row.locked;
      select.setAttribute("aria-label", row.label);
      select.title = row.locked ? lockedTitle : "Change model";
      for (const opt of row.options) {
        const o = document.createElement("option");
        o.value = opt.id;
        o.textContent = opt.label;
        if (opt.selected) o.selected = true;
        select.appendChild(o);
      }
      select.onclick = (e) => e.stopPropagation();
      if (!row.locked) {
        select.onchange = (e) => { e.stopPropagation(); pickSessionSetting(row.id, select.value); };
      }
      control.appendChild(select);
    } else if (row.kind === "dots") {
      const dotsEl = document.createElement("span");
      dotsEl.className = "effort-dots" + (row.locked ? " disabled" : "");
      row.options.forEach((opt, i) => {
        const dot = document.createElement("span");
        dot.className = "effort-dot" + (i <= row.selectedIndex ? " active" : "") + (row.locked ? " disabled" : "");
        dot.title = row.locked ? lockedTitle : opt.label;
        if (!row.locked) {
          dot.onclick = (e) => {
            e.stopPropagation();
            // Toggle off when re-picking the active level — mirrors renderGearMain's dots.
            pickSessionSetting(row.id, row.selectedId === opt.id ? "" : opt.id);
          };
        }
        dotsEl.appendChild(dot);
      });
      control.appendChild(dotsEl);
    }

    wrap.appendChild(control);
    return wrap;
  }

  function buildSessionSettingsRows(model) {
    const rows = document.createElement("div");
    rows.className = "session-settings-rows";
    for (const row of model.rows) rows.appendChild(buildSessionSettingsRow(row));
    return rows;
  }

  function hideSessionSetupCard() {
    const el = $("session-setup-card");
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }

  // New-tab welcome-screen card: Agent / Model / Thinking / Mode.
  // Model/effort/backend changes normally restart the session, but a brand-new
  // tab has no history, so the restart is free and invisible — the footer says
  // so. Hidden during onboarding and once the chat begins; renders LOCKED (not
  // hidden) during startup/priming — currentSessionSetupModel() already keys
  // `locked` off state.busy, which is true for the whole spawn+primer window,
  // so no extra gating is needed here to reflect that (docs/plans/
  // session-tab-ux-overhaul.md § Approach C — the canvas is populated from the
  // first frame instead of blank while the session starts).
  function renderSessionSetupCard() {
    const el = $("session-setup-card");
    if (!el) return;
    const onb = $("welcome-onboarding");
    const onboardingActive = !!(onb && onb.innerHTML && onb.innerHTML.trim());
    if (!state.welcomeVisible || onboardingActive) {
      hideSessionSetupCard();
      return;
    }
    el.innerHTML = "";
    const heading = document.createElement("p");
    heading.className = "session-setup-heading";
    heading.textContent = "Session setup";
    el.appendChild(heading);
    el.appendChild(buildSessionSettingsRows(currentSessionSetupModel()));
    const footer = document.createElement("p");
    footer.className = "session-setup-footer";
    footer.textContent = "Free to change here — this tab hasn't sent a message yet, so nothing restarts.";
    el.appendChild(footer);
    el.hidden = false;
  }

  // Composer quick-settings popover — the SAME four controls as the setup card
  // above, opened from the model/effort chip (see modelLabel.onclick below).
  // Unlike the single-purpose backend/mode popovers it does NOT close on a
  // pick, since the whole point of bundling four controls together is
  // adjusting more than one without reopening.
  function renderSessionSettingsPopover() {
    if (!sessionSettingsPopover) return;
    sessionSettingsPopover.innerHTML = "";
    sessionSettingsPopover.appendChild(buildSessionSettingsRows(currentSessionSetupModel()));
  }

  function openSessionSettingsPopover(anchorBtn) {
    if (!sessionSettingsPopover || !anchorBtn) return;
    if (!sessionSettingsPopover.hidden) { closePopovers(); return; }
    closePopovers();
    renderSessionSettingsPopover();
    positionPopover(sessionSettingsPopover, anchorBtn);
    sessionSettingsPopover.hidden = false;
  }

  // Re-render whichever of the two mounts is currently live — after a pick, or
  // whenever a session/model/mode/backend/busy update arrives from the host.
  function refreshSessionSettingsMounts() {
    renderSessionSetupCard();
    if (sessionSettingsPopover && !sessionSettingsPopover.hidden) renderSessionSettingsPopover();
  }

  // ---------- capability browser (slash commands, skills, agents) ----------
  // Two mounts, one pure builder (capabilityGroupsView in webview-helpers.js) —
  // the new-tab welcome canvas (#capabilities-panel) and the top-bar Actions
  // popover (#capabilities-popover). See
  // docs/plans/session-tab-ux-overhaul.md § Approach B.

  // Plain-language heading shared by both mounts (see § Approach B bullets 4-5) —
  // the same word the top-bar door and the composer's add-popover door use, so
  // the three surfaces read as one consistent feature rather than three names
  // for the same thing.
  const CAPABILITIES_HEADING = "Grokbit Actions";
  const CAPABILITIES_EXPLAINER = "Click anything to drop it into the message box. Nothing is sent until you press Send.";

  // `locked` (default false) renders the row like an inert one — no click
  // handler at all, mirroring .inert's no-pointer/no-hover pair — during the
  // welcome canvas's priming window (docs/plans/session-tab-ux-overhaul.md §
  // Approach C). It is display-only: an item's own `inert`/`action` still
  // decide what a click DOES once unlocked; `locked` only decides whether a
  // handler is installed at all right now. Never used by the top-bar Actions
  // popover, which has no priming gate of its own (locked stays undefined there).
  // Flips the session state a toggle row represents. Mirrors
  // pickSessionSetting's rowId→message mapping: the row holds no state of its
  // own, it just posts the mode the switch's next position stands for and waits
  // for the host's modeChanged to re-render it.
  function applyCapabilityToggle(item) {
    vscode.postMessage({ type: "setMode", modeId: item.on ? item.offModeId : item.onModeId });
  }

  // A toggle row (sessionToggleGroup in webview-helpers.js) is flipped in place
  // rather than dropped into the composer, so it reuses the gear popover's
  // switch markup instead of the name/chip/description stack. Locked behaves
  // exactly as it does for every other row: no handler installed at all.
  function buildCapabilityToggleRow(item) {
    const row = document.createElement("div");
    row.className = "capability-row capability-row-toggle" + (item.locked ? " locked" : "");
    const head = document.createElement("div");
    head.className = "capability-row-head";
    const name = document.createElement("span");
    name.className = "capability-row-name";
    name.textContent = item.label;
    head.appendChild(name);
    const sw = document.createElement("span");
    sw.className = "popover-switch" + (item.on ? " on" : "");
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(!!item.on));
    const knob = document.createElement("span");
    knob.className = "popover-switch-knob";
    sw.appendChild(knob);
    head.appendChild(sw);
    row.appendChild(head);
    if (item.description) {
      const desc = document.createElement("span");
      desc.className = "capability-row-desc";
      desc.textContent = item.description;
      row.appendChild(desc);
    }
    if (!item.locked) {
      row.onclick = (e) => { e.stopPropagation(); applyCapabilityToggle(item); };
    }
    return row;
  }

  function buildCapabilityRow(item, locked) {
    // Branch on the row's CONTROL, never on its kind — the renderer iterating
    // the host's groups without knowing the kind strings is what lets a new
    // capability kind ship without touching this function.
    if (item.control === "switch") return buildCapabilityToggleRow(item);
    const row = document.createElement("div");
    row.className = "capability-row" + (item.inert ? " inert" : "") + (locked ? " locked" : "");
    if (item.kind) row.dataset.kind = item.kind;
    if (item.description || item.source) {
      row.title = [item.description, item.source].filter(Boolean).join("\n");
    }
    // Plain name first — the primary text a non-technical user reads — with
    // the slash form beside it as a small teaching chip, never the other way
    // around (docs/plans/session-tab-ux-overhaul.md § Approach B bullet 2).
    const head = document.createElement("div");
    head.className = "capability-row-head";
    const name = document.createElement("span");
    name.className = "capability-row-name";
    name.textContent = item.label;
    head.appendChild(name);
    if (item.invokeLabel) {
      const cmd = document.createElement("span");
      cmd.className = "capability-row-cmd";
      cmd.textContent = item.invokeLabel;
      head.appendChild(cmd);
    }
    row.appendChild(head);
    if (item.workspaceSource || item.sourceBadge) {
      // Visible provenance for a workspace-tier item — dedupeByPriority is
      // workspace-first, so a repo-authored skill silently shadows a
      // same-named one under the user's home dir; the tooltip alone (above)
      // isn't enough to tell them apart at a glance. Suite name forks also
      // carry sourceBadge "Local override" (Phase B).
      const source = document.createElement("span");
      source.className = "capability-row-source";
      source.textContent = item.sourceBadge || item.source;
      row.appendChild(source);
    }
    if (item.description) {
      const desc = document.createElement("span");
      desc.className = "capability-row-desc";
      desc.textContent = item.description;
      row.appendChild(desc);
    }
    if (item.hint) {
      // Argument hint (frontmatter argument-hint / the ACP command's
      // input.hint) — without this a click seeds a bare "/adr " and leaves
      // the user staring at an empty token with no idea what to type next.
      const hint = document.createElement("span");
      hint.className = "capability-row-hint";
      hint.textContent = item.hint;
      row.appendChild(hint);
    }
    // Data-driven detail (hasDetail) — not a kind-string branch. Host stamps
    // suite how-it-works guides; renderer only cares about the flag.
    let detailBody = null;
    if (item.hasDetail) {
      const detailWrap = document.createElement("div");
      detailWrap.className = "capability-row-detail-wrap";
      const detailBtn = document.createElement("button");
      detailBtn.type = "button";
      detailBtn.className = "capability-row-details";
      detailBtn.textContent = "Details";
      detailBtn.title = "How this workflow works (roles, loops, caps)";
      detailBody = document.createElement("div");
      detailBody.className = "capability-row-detail-body";
      detailBody.hidden = true;
      if (!locked) {
        detailBtn.onclick = (e) => {
          e.stopPropagation();
          const open = detailBody.hidden;
          if (open) {
            detailBody.hidden = false;
            detailBody.textContent = "Loading…";
            detailBtn.setAttribute("aria-expanded", "true");
            vscode.postMessage({ type: "getCapabilityDetail", name: item.name });
            // Cache pending target so capabilityDetail handler can fill this node.
            state.pendingCapabilityDetail = { name: item.name, body: detailBody, path: item.detailPath };
          } else {
            detailBody.hidden = true;
            detailBody.textContent = "";
            detailBtn.setAttribute("aria-expanded", "false");
            if (state.pendingCapabilityDetail && state.pendingCapabilityDetail.name === item.name) {
              state.pendingCapabilityDetail = null;
            }
          }
        };
      } else {
        detailBtn.disabled = true;
      }
      detailWrap.appendChild(detailBtn);
      if (item.detailPath && !locked) {
        const openEd = document.createElement("button");
        openEd.type = "button";
        openEd.className = "capability-row-details secondary";
        openEd.textContent = "Open in editor";
        openEd.title = "Open the full how-it-works guide as a file";
        openEd.onclick = (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "openFile", path: item.detailPath });
        };
        detailWrap.appendChild(openEd);
      }
      detailWrap.appendChild(detailBody);
      row.appendChild(detailWrap);
    }
    if (locked) {
      // No click handler at all — same treatment as .inert. A hover
      // affordance on something that can't be clicked yet is the bug.
    } else if (item.action === "invoke") {
      // Replace, don't append — only the last workflow/skill click should remain
      // in the composer (stacked /cmd1\n/cmd2 is never useful for Actions).
      row.onclick = (e) => {
        e.stopPropagation();
        insertComposerPrompt(item.invoke, { mode: "replace" });
        closePopovers();
      };
    } else if (item.action === "open") {
      row.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ type: "openFile", path: item.path }); closePopovers(); };
    }
    return row;
  }

  // Heading + one-line explainer, prepended once above the first group — the
  // single highest-value sentence for a user who doesn't already know a click
  // only seeds the composer (docs/plans/session-tab-ux-overhaul.md § Approach
  // B bullet 4). Shared by the welcome-canvas panel; the popover's own head
  // (renderCapabilitiesPopover) uses the same heading text without the
  // explainer — popovers are compact, and the explainer's audience is the
  // first-run welcome canvas.
  // Re-posts the request that produced state.capabilities in the first place.
  // The host re-scans the user's own disk every time and is already gated on
  // grok.showCapabilities, so this needs no new message and no new host method.
  function buildCapabilitiesRefreshButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "capabilities-refresh";
    btn.textContent = "Refresh";
    btn.title = "Re-scan for skills, commands, and agents";
    btn.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ type: "listCapabilities" }); };
    return btn;
  }

  // `locked` suppresses the Refresh button for the same reason it suppresses a
  // row's click handler: during the priming window nothing here is actionable
  // yet, and an enabled-looking control that does nothing is the bug.
  function appendCapabilitiesHeading(container, locked) {
    const head = document.createElement("div");
    head.className = "capabilities-head";
    const heading = document.createElement("p");
    heading.className = "capabilities-heading";
    heading.textContent = CAPABILITIES_HEADING;
    head.appendChild(heading);
    if (!locked) head.appendChild(buildCapabilitiesRefreshButton());
    container.appendChild(head);
  }

  function appendCapabilitiesExplainer(container) {
    const p = document.createElement("p");
    p.className = "capabilities-explainer muted";
    p.textContent = CAPABILITIES_EXPLAINER;
    container.appendChild(p);
  }

  // `featuredCount` comes only from capabilityGroupsView's groups
  // (docs/plans/actions-panel-featured-capabilities.md); sessionToggleGroup's
  // group never sets it, so its one item falls back to "show everything" and
  // the group gets no expand link — a structural consequence of the data
  // shape, not a branch on group.kind.
  function appendCapabilityGroups(container, viewGroups, locked) {
    for (const group of viewGroups) {
      const groupEl = document.createElement("div");
      groupEl.className = "capability-group";
      const title = document.createElement("p");
      title.className = "capability-group-title";
      title.textContent = group.title;
      groupEl.appendChild(title);
      const itemsEl = document.createElement("div");
      itemsEl.className = "capability-group-items";
      const featuredCount = typeof group.featuredCount === "number" ? group.featuredCount : group.items.length;
      const expanded = !!(state.capabilitiesExpanded && state.capabilitiesExpanded[group.kind]);
      const visible = expanded ? group.items : group.items.slice(0, featuredCount);
      for (const item of visible) itemsEl.appendChild(buildCapabilityRow(item, locked));
      // Host-cap overflow ("+N more") is a dead end about items the host never
      // sent at all — distinct from the expand link below it, and shown only
      // once expanded so the collapsed view doesn't carry two competing
      // "there's more" signals.
      if (group.remaining > 0 && expanded) {
        const more = document.createElement("p");
        more.className = "capability-more muted";
        more.textContent = `+${group.remaining} more`;
        itemsEl.appendChild(more);
      }
      groupEl.appendChild(itemsEl);
      if (group.items.length > featuredCount) {
        // Appended AFTER itemsEl, never inside it — itemsEl is an auto-fit
        // grid, so a link inside it would render as a stray grid cell.
        const expandBtn = document.createElement("button");
        expandBtn.type = "button";
        expandBtn.className = "capability-expand";
        expandBtn.textContent = expanded ? "Show less" : `Show all ${group.items.length}`;
        expandBtn.setAttribute("aria-expanded", String(expanded));
        // Pure local display, unlike Refresh (a host round-trip) and row
        // clicks (a composer seed) — expanding is never gated on `locked`.
        expandBtn.onclick = (e) => {
          e.stopPropagation();
          // Capture `!expanded` at render time rather than toggling the live
          // state value — both mounts below re-render off the SAME state, so
          // a stale flip in one after the other already flipped it would undo
          // the click. The welcome canvas and the Actions popover can be on
          // screen at once (the popover overlays the canvas), so the group
          // left behind in the mount that wasn't clicked must expand too, or
          // it silently pops open later on an unrelated setBusy/modeChanged.
          state.capabilitiesExpanded[group.kind] = !expanded;
          renderCapabilitiesPanel();
          if (capabilitiesPopover && !capabilitiesPopover.hidden) renderCapabilitiesPopoverBody();
        };
        groupEl.appendChild(expandBtn);
      }
      container.appendChild(groupEl);
    }
  }

  function hideCapabilitiesPanel() {
    const el = $("capabilities-panel");
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }

  // New-tab welcome-screen capability browser. Copies BOTH halves of
  // renderSessionSetupCard's behaviour: its gate (welcomeVisible / onboarding)
  // AND every call site that hides or re-renders it (see the "capabilities"
  // and lifecycle-anchor message handlers below) — a gate with only one of
  // those renders once during priming, while the gate is shut, and never
  // again. Renders FROM state.capabilities, never re-requesting: the payload
  // usually arrives mid-priming, and must survive a re-render once setBusy:false
  // unlocks the rows. During the startup/priming window the panel renders
  // LOCKED rather than hidden — state.busy is true for that whole window (see
  // the "initialized"/"setBusy" handlers below) — so the canvas is populated
  // from the first frame instead of blank (docs/plans/
  // session-tab-ux-overhaul.md § Approach C).
  function renderCapabilitiesPanel() {
    const el = $("capabilities-panel");
    if (!el) return;
    // grok.showCapabilities: false — never render, regardless of what already
    // arrived in state.capabilities (e.g. a commandsUpdate-triggered re-post
    // that raced ahead of this gate). Checked here, not just at the request
    // site, since this is the ONLY place a payload that arrived during priming
    // gets shown (see the setBusy anchor below).
    if (!state.showCapabilities) {
      hideCapabilitiesPanel();
      return;
    }
    const onb = $("welcome-onboarding");
    const onboardingActive = !!(onb && onb.innerHTML && onb.innerHTML.trim());
    if (!state.welcomeVisible || onboardingActive) {
      hideCapabilitiesPanel();
      return;
    }
    const cap = state.capabilities;
    if (!cap) { hideCapabilitiesPanel(); return; }
    const locked = !!state.busy;
    el.innerHTML = "";
    appendCapabilitiesHeading(el, locked);
    if (cap.error) {
      const p = document.createElement("p");
      p.className = "capabilities-empty muted";
      p.textContent = "Couldn't load skills & commands.";
      el.appendChild(p);
      el.hidden = false;
      return;
    }
    const viewGroups = capabilityGroupsView({
      groups: (markLocalSuiteOverrides || ((g) => g))(
        visibleCapabilityGroups(cap.groups, { scope: state.actionsScope }),
      ),
      backend: cap.backend,
    });
    if (!viewGroups.length) {
      // Not onboarding (already gated above) and genuinely nothing discovered:
      // an honest empty state, not a vanished panel — hiding here is what makes
      // the feature look broken to a user who has nothing installed yet. Shown
      // regardless of `locked` — the line makes no clickability claim.
      // Post-filter: non-grokbit groups never render, so this also fires when
      // the suite is absent (provision off / failed copy) and only Skills/
      // Agents/Commands would have been present.
      const p = document.createElement("p");
      p.className = "capabilities-empty muted";
      p.textContent = state.actionsScope === "all"
        ? "No skills or workflows available yet — just describe what you want in the message box."
        : "No workflows available yet — just describe what you want in the message box.";
      el.appendChild(p);
      el.hidden = false;
      return;
    }
    appendCapabilitiesExplainer(el);
    appendCapabilityGroups(el, viewGroups, locked);
    if (typeof state.mcpServerCount === "number" && state.mcpServerCount > 0) {
      const mcp = document.createElement("p");
      mcp.className = "capabilities-mcp muted";
      mcp.textContent = state.mcpServerCount === 1
        ? "1 MCP server configured (in CLI config — not browsable here)."
        : state.mcpServerCount + " MCP servers configured (in CLI config — not browsable here).";
      el.appendChild(mcp);
    }
    el.hidden = false;
  }

  function renderCapabilitiesPopoverBody() {
    if (!capabilitiesPopover) return;
    const body = capabilitiesPopover.querySelector(".studio-popover-body");
    if (!body) return;
    // Preserve scroll position across the rebuild — the body is a bounded
    // scroll container (.studio-popover-body max-height:280px /
    // .history-list max-height:340px, both overflow-y:auto), and a lower
    // group's expand link is below the fold by construction: a naive rebuild
    // snaps scrollTop back to 0 and strands the rows the click just revealed
    // off-screen. try/finally covers every early return below.
    const scrollTop = body.scrollTop;
    try {
      body.innerHTML = "";
      // Session controls come from the webview's own state, not from
      // discovery, so they render on every path below — "Scanning…", a scan
      // error, and an empty disk each used to return early and would
      // otherwise suppress them.
      appendCapabilityGroups(body, [sessionToggleGroup({ modeId: state.currentModeId, locked: !!state.busy })]);
      const cap = state.capabilities;
      if (!cap) {
        const p = document.createElement("p");
        p.className = "studio-popover-empty muted";
        p.textContent = "Scanning…";
        body.appendChild(p);
        return;
      }
      if (cap.error) {
        const p = document.createElement("p");
        p.className = "studio-popover-empty muted";
        p.textContent = "Couldn't load skills & commands.";
        body.appendChild(p);
        return;
      }
      const viewGroups = capabilityGroupsView({
        groups: (markLocalSuiteOverrides || ((g) => g))(
          visibleCapabilityGroups(cap.groups, { scope: state.actionsScope }),
        ),
        backend: cap.backend,
      });
      if (!viewGroups.length) {
        const p = document.createElement("p");
        p.className = "studio-popover-empty muted";
        p.textContent = "No workflows available.";
        body.appendChild(p);
        return;
      }
      appendCapabilityGroups(body, viewGroups);
      if (typeof state.mcpServerCount === "number" && state.mcpServerCount > 0) {
        const mcp = document.createElement("p");
        mcp.className = "studio-popover-empty muted";
        mcp.textContent = state.mcpServerCount + " MCP server(s) in CLI config (not browsable here).";
        body.appendChild(mcp);
      }
    } finally {
      body.scrollTop = scrollTop;
    }
  }

  function renderCapabilitiesPopover() {
    if (!capabilitiesPopover) return;
    capabilitiesPopover.innerHTML = "";
    const head = document.createElement("div");
    head.className = "studio-popover-head with-action";
    const headLabel = document.createElement("span");
    headLabel.textContent = CAPABILITIES_HEADING; // matches the welcome-canvas panel's own heading
    head.appendChild(headLabel);
    // The popover already re-requests on every open, so this is for the case
    // where it is ALREADY open when the skill lands. stopPropagation (inside
    // the handler) is what keeps the click from bubbling to closePopovers().
    head.appendChild(buildCapabilitiesRefreshButton());
    capabilitiesPopover.appendChild(head);
    const body = document.createElement("div");
    body.className = "studio-popover-body history-list";
    capabilitiesPopover.appendChild(body);
    renderCapabilitiesPopoverBody();
  }

  function openCapabilitiesPopover() {
    // grok.showCapabilities: false — the button is hidden in this state (see the
    // initialState/showCapabilities handlers), but guard the open path itself
    // too (defense-in-depth, e.g. a click already in flight when the toggle
    // flips off).
    if (!capabilitiesPopover || !capabilitiesBtn || !state.showCapabilities) return;
    if (!capabilitiesPopover.hidden) { closePopovers(); return; }
    closePopovers();
    renderCapabilitiesPopover();
    positionDropdownPopover(capabilitiesPopover, capabilitiesBtn);
    capabilitiesPopover.hidden = false;
    vscode.postMessage({ type: "listCapabilities" });
  }

  function shortEffort(e) {
    if (!e) return "";
    if (e === "minimal") return "min";
    if (e === "medium") return "med";
    if (e === "xhigh") return "xhi";
    return e.slice(0, 3);
  }

  // Platform-aware modifier label, for the shortcuts panel + composer placeholder.
  const IS_MAC = /Mac|iPhone|iPad/.test((typeof navigator !== "undefined" && navigator.platform) || "");
  const MOD = IS_MAC ? "Cmd" : "Ctrl";

  // Teach the send key in the composer placeholder — it only shows while the input
  // is empty, so the hint costs no persistent clutter. Tracks the useCtrlEnter
  // setting AND state.backend — it used to hardcode "Ask Grok…" on a Claude tab.
  function updateComposerPlaceholder() {
    if (!input) return;
    const agentName = state.backend === "claude" ? "Claude" : "Grok";
    input.placeholder = state.useCtrlEnter
      ? `Ask ${agentName} anything…   ${MOD}+Enter to send`
      : `Ask ${agentName} anything…   Enter to send · Shift+Enter for newline`;
  }

  newBtn.innerHTML = ICON.squarePen;
  historyBtn.innerHTML = ICON.clock;
  updateSendButton(); // spinner by default — session is starting up (busy+locked)
  gearBtn.innerHTML = ICON.gear;
  addBtn.innerHTML = ICON.plus;
  scrollBottomBtn.innerHTML = `${ICON.arrowDown}<span class="scroll-bottom-label">Scroll to bottom</span>`;
  updateModeBtn("agent");

  // ---------- markdown ----------

  const { looksLikeFileRef, formatRelativeTime, modelDisplayName, nextMicState, trailingSendPhrase, buildQuestionAnswers, isSubagentToolCall, subagentLabel, shouldStickToBottom, splitMath, stripUnsupportedTex, toolFailureText, computeLineDiff, parseAttachmentContext, backendBadgeLabel, capabilityGroupsView, visibleCapabilityGroups, markLocalSuiteOverrides, sessionToggleGroup } = globalThis.GrokWebviewHelpers;

  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Hover-overlay markup shared by display math and rendered mermaid diagrams:
  // Copy the source, Download as PNG/SVG, or Open as PNG. The host element carries
  // the source in data-export-src and the kind in data-export-kind; clicks are
  // handled by delegation (see the .expr-btn branch in the click listener), so this
  // can be plain HTML re-created on every streaming frame without leaking handlers.
  function exprActionsHtml(kind) {
    const label = kind === "mermaid" ? "diagram" : "LaTeX";
    return (
      `<span class="expr-actions" contenteditable="false">` +
        `<button class="expr-btn" type="button" data-expr-act="copy" title="Copy ${label}">${ICON.copy}</button>` +
        `<button class="expr-btn" type="button" data-expr-act="download" title="Download as PNG / SVG">${ICON.download}</button>` +
        `<button class="expr-btn" type="button" data-expr-act="open" title="Open as PNG">${ICON.file}</button>` +
      `</span>`
    );
  }

  // Render one LaTeX span to an SVG string via the vendored MathJax (loaded
  // before this script as a global). MathJax outputs self-contained SVG, which
  // lets us export equations later; on a parse error it renders an <merror> node
  // rather than throwing, so one bad expression never blanks the message. Until
  // MathJax's async startup completes — or if it never loads (happy-dom unit
  // tests) — fall back to the escaped raw TeX so the text is at least readable.
  let mathReady = false;

  function initMathJax() {
    const MJ = globalThis.MathJax;
    if (!MJ) return;
    if (typeof MJ.tex2svg === "function") { mathReady = true; return; }
    // tex2svg is wired up by MathJax's startup; gate on its promise, then upgrade
    // any math that already rendered as a raw fallback before startup finished.
    const p = MJ.startup && MJ.startup.promise;
    if (p && typeof p.then === "function") {
      p.then(() => { mathReady = true; upgradeMathInDom(); }).catch(() => {});
    }
  }

  function rawMath(src, display) {
    const esc = escapeHtml(src);
    return display
      ? `<span class="math-raw math-display">${esc}</span>`
      : `<span class="math-raw">${esc}</span>`;
  }

  function renderMath(latex, display) {
    const orig = (latex == null ? "" : String(latex)).trim();
    const src = stripUnsupportedTex(orig);
    const MJ = globalThis.MathJax;
    let inner = null;
    if (mathReady && MJ && typeof MJ.tex2svg === "function") {
      try {
        const node = MJ.tex2svg(src, { display: !!display });
        if (node && node.outerHTML) inner = node.outerHTML;
      } catch (_) {
        // fall through to the raw fallback
      }
    }
    if (inner == null) inner = rawMath(src, display);
    // Inline math flows in the text with no chrome. Display math becomes an export
    // host carrying the original TeX (for Copy) and the hover actions. The dm block
    // branch in renderMarkdown emits the placeholder, and .math-export is block.
    if (!display) return inner;
    return `<span class="math-export" data-export-kind="latex" data-export-src="${escapeAttr(orig)}">` +
      inner + exprActionsHtml("latex") + `</span>`;
  }

  // MathJax startup is async, so math rendered during page boot (welcome screen,
  // a restored session) may have landed as raw fallback. Once startup resolves,
  // re-typeset those in place: display math from its host's stored TeX (replacing
  // the whole .math-export host so we don't double-wrap), inline from its text.
  function upgradeMathInDom() {
    document.querySelectorAll(".math-raw").forEach((span) => {
      const display = span.classList.contains("math-display");
      // Display fallbacks live inside a .math-export host — replace the host (and
      // re-render from its faithful, un-stripped TeX), not just the inner span.
      const host = display ? (span.closest(".math-export") || span) : span;
      const srcAttr = host.getAttribute && host.getAttribute("data-export-src");
      const src = (display && srcAttr != null) ? srcAttr : span.textContent;
      const tmp = document.createElement("div");
      tmp.innerHTML = renderMath(src, display);
      const node = tmp.firstChild;
      if (node && host.parentNode) host.parentNode.replaceChild(node, host);
    });
  }

  // ---------- mermaid diagrams ----------
  // Grok emits ```mermaid fenced blocks. renderMarkdown turns each into a
  // .mermaid-block placeholder (showing the source as a fallback code block);
  // this pass renders it to SVG with the vendored mermaid lib. mermaid.render is
  // async and needs the live DOM (it measures text), so unlike the synchronous
  // math render we can't do it inline in renderMarkdown — we post-process the
  // inserted element instead.
  //
  // The streaming agent bubble re-runs renderMarkdown (and rebuilds the DOM) on
  // every animation frame, so the SVG is destroyed and the placeholder recreated
  // each frame. Two module-level caches keyed by the diagram source keep that
  // flicker-free and cheap: `mermaidSvgCache` lets a re-render re-apply the SVG
  // synchronously in the same frame (cache hit → no flash), and `mermaidInFlight`
  // stops the same diagram being rendered dozens of times before the first async
  // render resolves. A failed render caches null and leaves the readable source.
  const mermaidSvgCache = new Map(); // src -> svg string, or null if render failed
  const mermaidInFlight = new Set(); // src currently being rendered
  let mermaidIdSeq = 0;
  let mermaidReady = false;

  function initMermaid() {
    const m = globalThis.mermaid;
    if (!m || typeof m.initialize !== "function") return;
    const light = document.body.classList.contains("vscode-light");
    try {
      m.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: light ? "default" : "dark",
        fontFamily: "var(--vscode-font-family, sans-serif)",
      });
      mermaidReady = true;
    } catch (_) {
      mermaidReady = false;
    }
  }

  function mermaidSourceOf(block) {
    const codeEl = block.querySelector(".mermaid-src code") || block.querySelector(".mermaid-src");
    return (codeEl ? codeEl.textContent : "").trim();
  }

  // Swap the rendered SVG into a mermaid block and turn it into an export host:
  // retain the source (for Copy) and add the Copy/Download/Open hover actions. The
  // streaming re-render rebuilds the block (with its .mermaid-src fallback) each
  // frame, so this re-runs per frame from the cache — keep it idempotent.
  function decorateMermaid(block, svg, src) {
    block.innerHTML = svg + exprActionsHtml("mermaid");
    block.setAttribute("data-export-kind", "mermaid");
    block.setAttribute("data-export-src", src);
    block.setAttribute("data-mermaid-state", "done");
  }

  // Replace every still-unrendered placeholder whose source matches `src` with the
  // cached SVG. Scans the live document because the streaming re-render may have
  // swapped out the element that originally kicked off the render.
  function applyCachedMermaid(src) {
    const svg = mermaidSvgCache.get(src);
    if (!svg) return;
    document.querySelectorAll(".mermaid-block").forEach((block) => {
      if (block.getAttribute("data-mermaid-state") === "done") return;
      if (mermaidSourceOf(block) === src) {
        decorateMermaid(block, svg, src);
      }
    });
  }

  function renderMermaidIn(root) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    const blocks = root.querySelectorAll(".mermaid-block");
    if (!blocks.length) return;
    const m = globalThis.mermaid;
    if (!mermaidReady || !m || typeof m.render !== "function") return; // not loaded → readable fallback stays
    blocks.forEach((block) => {
      if (block.getAttribute("data-mermaid-state") === "done") return;
      const src = mermaidSourceOf(block);
      if (!src) return;
      if (mermaidSvgCache.has(src)) {
        const svg = mermaidSvgCache.get(src);
        if (svg) decorateMermaid(block, svg, src);
        return; // null → render failed earlier; keep the source fallback
      }
      if (mermaidInFlight.has(src)) return; // already rendering; the cache will fill in shortly
      mermaidInFlight.add(src);
      const id = "grok-mmd-" + (mermaidIdSeq++);
      Promise.resolve()
        .then(() => m.render(id, src))
        .then((res) => { mermaidSvgCache.set(src, (res && res.svg) || null); })
        .catch(() => { mermaidSvgCache.set(src, null); })
        .then(() => {
          mermaidInFlight.delete(src);
          applyCachedMermaid(src);
        });
    });
  }

  // ---------- math / diagram export ----------
  // Display math and rendered mermaid both end up as a self-contained <svg> in an
  // export host (.math-export / .mermaid-block) carrying the source. From the hover
  // actions we Copy that source, or render the SVG to a file: SVG verbatim, or a
  // PNG rasterized via canvas. Exports match the VS Code theme (sidebar background +
  // foreground) so a saved image looks like what's on screen — a dark diagram stays
  // dark — and so math (currentColor) resolves to the theme text color rather than
  // rasterizing as the default black on a transparent background.

  function canRasterize() {
    try { return !!document.createElement("canvas").getContext("2d"); } catch (_) { return false; }
  }

  function themeVar(name, fallback) {
    try {
      const v = getComputedStyle(document.body).getPropertyValue(name).trim();
      return v || fallback;
    } catch (_) { return fallback; }
  }

  // The on-screen surface colors, so exports are WYSIWYG. The chat sits on
  // --vscode-sideBar-background with --vscode-foreground text (see chat.css).
  function exportColors() {
    return {
      bg: themeVar("--vscode-sideBar-background", "#1e1e1e"),
      fg: themeVar("--vscode-foreground", "#cccccc"),
    };
  }

  // Clone the on-screen SVG into a standalone one. `color` resolves the math
  // currentColor (pass null to leave mermaid's own palette alone); `bg` paints a
  // solid background, or null/"" for transparent (reusable on any surface).
  function themedSvg(svgEl, color, bg) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    let style = clone.getAttribute("style") || "";
    if (color) style += `;color:${color}`;
    if (bg) style += `;background:${bg}`;
    clone.setAttribute("style", style);
    return new XMLSerializer().serializeToString(clone);
  }

  // Re-render a mermaid diagram with a specific built-in theme for export, so a
  // "for light background" file gets mermaid's light palette instead of the
  // on-screen dark one. The %%{init}%% directive themes just this render without
  // touching the global config. Transparent bg; falls back to the on-screen SVG.
  async function mermaidThemedSvg(src, theme, fallbackEl) {
    const m = globalThis.mermaid;
    if (m && typeof m.render === "function" && src) {
      try {
        const id = "grok-mmd-exp-" + (mermaidIdSeq++);
        const res = await m.render(id, `%%{init: {'theme':'${theme}'}}%%\n` + src);
        if (res && res.svg) {
          const tmp = document.createElement("div");
          tmp.innerHTML = res.svg;
          const el = tmp.querySelector("svg");
          if (el) return themedSvg(el, null, null);
        }
      } catch (_) { /* fall back to the on-screen render */ }
    }
    return fallbackEl ? themedSvg(fallbackEl, null, null) : "";
  }

  // Rasterize an SVG string to a PNG data URL via an offscreen canvas (theme bg).
  function svgToPng(svgStr, w, h, scale, bg) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
    });
  }

  function copyExprSource(src, btn) {
    navigator.clipboard.writeText(src || "").then(() => {
      const prev = btn.innerHTML;
      btn.innerHTML = ICON.check;
      btn.classList.add("copied");
      setTimeout(() => { btn.innerHTML = prev; btn.classList.remove("copied"); }, 1500);
    });
  }

  // Build the export payload and hand it to the host. "open" → a WYSIWYG PNG (VS
  // Code theme background, like on screen). "download" → that same PNG plus two
  // transparent SVGs (light-ink for dark backgrounds, dark-ink for light ones);
  // the host quick-picks which to save. Math recolors via currentColor; mermaid is
  // re-rendered in each theme since its palette is baked into the SVG.
  async function exportExpr(host, action) {
    const svgEl = host.querySelector("svg");
    if (!svgEl) return;
    const kind = host.getAttribute("data-export-kind") || "latex";
    const colors = exportColors();
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width || 320, h = rect.height || 100;

    // PNG always keeps the VS Code theme background — what you see in the sidebar.
    const wysiwyg = themedSvg(svgEl, colors.fg, colors.bg);
    let png = null;
    if (canRasterize()) {
      try { png = await svgToPng(wysiwyg, w, h, 3, colors.bg); } catch (_) { png = null; }
    }

    if (action === "open") {
      vscode.postMessage({ type: "exportExpr", action, kind, svg: wysiwyg, png });
      return;
    }

    // Download: also produce transparent SVGs for dark and light backgrounds.
    let svgDark, svgLight;
    if (kind === "mermaid") {
      const src = host.getAttribute("data-export-src") || "";
      svgDark = await mermaidThemedSvg(src, "dark", svgEl);
      svgLight = await mermaidThemedSvg(src, "default", svgEl);
    } else {
      svgDark = themedSvg(svgEl, "#e8e8e8", null);  // light ink for a dark surface
      svgLight = themedSvg(svgEl, "#1f1f1f", null); // dark ink for a light surface
    }
    const current = document.body.classList.contains("vscode-light") ? "light" : "dark";
    vscode.postMessage({ type: "exportExpr", action, kind, png, svgDark, svgLight, current });
  }

  function renderDiffCode(code) {
    const lines = code.replace(/\n+$/, "").split("\n");
    const body = lines.map((ln) => {
      let cls = "diff-line";
      if (/^@@/.test(ln)) cls += " diff-hunk";
      else if (/^(\+\+\+|---|diff |index )/.test(ln)) cls += " diff-meta";
      else if (ln[0] === "+") cls += " diff-add";
      else if (ln[0] === "-") cls += " diff-del";
      return `<span class="${cls}">${escapeHtml(ln) || "&nbsp;"}</span>`;
    }).join("");
    return `<code class="diff-code">${body}</code>`;
  }

  function renderMarkdown(raw) {
    const codeBlocks = [];
    // Fence is 3+ backticks; the closing fence must be the SAME length (\1
    // backreference). This lets an outer block fenced by 4/5 backticks wrap an
    // inner ``` block — the shorter inner fences can't close the longer outer one
    // (CommonMark nested code blocks, issue #20). A plain ``` block is the N=3 case.
    let s = raw.replace(/(`{3,})(\w*)\n?([\s\S]*?)\1`*/g, (_, _fence, lang, code) => {
      const i = codeBlocks.length;
      // Mermaid: keep the source as a normal-looking code block (so it shows as
      // readable text if mermaid never loads or the diagram is malformed), but
      // tag it so the post-render pass can swap in the rendered SVG. The closing
      // ``` is required by this regex, so a half-streamed diagram never reaches
      // mermaid — it stays raw text until the block completes.
      if (lang === "mermaid") {
        codeBlocks.push(
          `<div class="code-block mermaid-block">` +
            `<button class="code-copy-btn" type="button" title="Copy code">` +
              `<span class="code-copy-glyph">${ICON.copy}</span>` +
              `<span class="code-copy-label">Copy code</span>` +
            `</button>` +
            `<pre class="mermaid-src"><code>${escapeHtml(code).trimEnd()}</code></pre>` +
          `</div>`
        );
        return `\x00B${i}\x00`;
      }
      const isDiff = lang === "diff";
      const inner = isDiff
        ? renderDiffCode(code)
        : `<code>${escapeHtml(code).trimEnd()}</code>`;
      codeBlocks.push(
        `<div class="code-block${isDiff ? " diff" : ""}">` +
          `<button class="code-copy-btn" type="button" title="Copy code">` +
            `<span class="code-copy-glyph">${ICON.copy}</span>` +
            `<span class="code-copy-label">Copy code</span>` +
          `</button>` +
          `<pre>${inner}</pre>` +
        `</div>`
      );
      return `\x00B${i}\x00`;
    });

    // Pull LaTeX out before any HTML-escaping or inline-markdown — math is full
    // of \ { } & < > * _ that the inline() pass would mangle. Display math gets a
    // \x00D placeholder (handled as its own block, like tables); inline math gets
    // \x00M. Both restore from the same mathHtml array at the end. Runs after
    // code-block extraction so a \( inside a fenced block stays literal.
    const mathHtml = [];
    s = splitMath(s).map((seg) => {
      if (seg.type !== "math") return seg.value;
      const i = mathHtml.length;
      mathHtml.push(renderMath(seg.value, seg.display));
      return seg.display ? `\x00D${i}\x00` : `\x00M${i}\x00`;
    }).join("");

    function inline(t) {
      return t
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/`([^`\n]+)`/g, (_, code) => {
          if (looksLikeFileRef(code)) {
            const safe = code.replace(/"/g, "&quot;");
            return `<a href="${safe}" class="file-ref-link"><code>${code}</code></a>`;
          }
          return `<code>${code}</code>`;
        })
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
          const safe = url.replace(/"/g, "&quot;");
          return `<a href="${safe}">${text}</a>`;
        })
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    }

    // GFM tables: header row | separator row (|---|---|) | data rows
    const tables = [];
    {
      const isTableRow = (l) => /^\s*\|.+\|\s*$/.test(l);
      const isSep = (l) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(l);
      const splitRow = (l) =>
        l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const srcLines = s.split('\n');
      const kept = [];
      let i = 0;
      while (i < srcLines.length) {
        if (i + 1 < srcLines.length && isTableRow(srcLines[i]) && isSep(srcLines[i + 1])) {
          const headers = splitRow(srcLines[i]);
          const sepCells = splitRow(srcLines[i + 1]);
          if (headers.length === sepCells.length) {
            const aligns = sepCells.map(c => {
              const L = c.startsWith(':'), R = c.endsWith(':');
              return L && R ? 'center' : R ? 'right' : L ? 'left' : '';
            });
            const rows = [];
            let j = i + 2;
            while (j < srcLines.length && isTableRow(srcLines[j])) {
              const cells = splitRow(srcLines[j]);
              while (cells.length < headers.length) cells.push('');
              rows.push(cells.slice(0, headers.length));
              j++;
            }
            const styleFor = (k) => aligns[k] ? ` style="text-align:${aligns[k]}"` : '';
            let html = '<div class="md-table-wrap"><table><thead><tr>';
            headers.forEach((h, k) => { html += `<th${styleFor(k)}>${inline(h)}</th>`; });
            html += '</tr></thead><tbody>';
            for (const row of rows) {
              html += '<tr>';
              row.forEach((c, k) => { html += `<td${styleFor(k)}>${inline(c)}</td>`; });
              html += '</tr>';
            }
            html += '</tbody></table></div>';
            const idx = tables.length;
            tables.push(html);
            kept.push(`\x00T${idx}\x00`);
            i = j;
            continue;
          }
        }
        kept.push(srcLines[i]);
        i++;
      }
      s = kept.join('\n');
    }

    // Expand inline numbered lists: "1. A 2. B 3. C" on one line → separate lines
    function expandInline(line) {
      if (!/^\s*\d+\. /.test(line)) return [line];
      const indent = line.match(/^(\s*)/)[1];
      const parts = line.trim().split(/(?<=\S)\s+(?=\d+\. )/);
      if (parts.length <= 1) return [line];
      const nums = parts.map(p => parseInt(p.match(/^(\d+)\./)?.[1] ?? '0'));
      const sequential = nums.every((n, i) => n === i + 1);
      return sequential ? parts.map(p => indent + p) : [line];
    }

    const rawLines = s.split('\n');
    const lines = [];
    for (const ln of rawLines) lines.push(...expandInline(ln));

    let out = '';
    // stack: { tag:'ul'|'ol', indent:number, liOpen:boolean }[]
    let stack = [];
    let pendingBreak = false;
    let lastWasBlock = false;
    let lastPara = false;

    function closeLiAt(i) {
      if (stack[i].liOpen) { out += '</li>'; stack[i].liOpen = false; }
    }
    function closeFrom(depth) {
      for (let i = stack.length - 1; i >= depth; i--) {
        closeLiAt(i);
        out += `</${stack[i].tag}>`;
      }
      stack = stack.slice(0, depth);
    }

    for (const line of lines) {
      if (!line.trim()) {
        if (stack.length === 0 && !lastWasBlock) pendingBreak = true;
        lastPara = false;
        continue;
      }
      lastWasBlock = false;

      const tm = line.trim().match(/^\x00T(\d+)\x00$/);
      if (tm) {
        closeFrom(0);
        out += `\x00T${tm[1]}\x00`;
        lastWasBlock = true;
        lastPara = false;
        pendingBreak = false;
        continue;
      }

      // Display math alone on a line → emit as its own block (no paragraph wrap).
      const dm = line.trim().match(/^\x00D(\d+)\x00$/);
      if (dm) {
        closeFrom(0);
        out += `\x00D${dm[1]}\x00`;
        lastWasBlock = true;
        lastPara = false;
        pendingBreak = false;
        continue;
      }

      // Fenced code block alone on a line → emit as its own block. Without this it
      // falls through to the paragraph path and gets wrapped in <br><br> before and
      // after; on top of the .code-block div's own 8px margin that reads as TWO
      // blank lines around a code block (the model only sent one). Mirrors the
      // table/math branches above so spacing is just the div's margin.
      const bm = line.trim().match(/^\x00B(\d+)\x00$/);
      if (bm) {
        closeFrom(0);
        out += `\x00B${bm[1]}\x00`;
        lastWasBlock = true;
        lastPara = false;
        pendingBreak = false;
        continue;
      }

      const hm = line.match(/^(#{1,3}) (.+)$/);
      if (hm) {
        closeFrom(0);
        out += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`;
        lastWasBlock = true;
        lastPara = false;
        pendingBreak = false;
        continue;
      }

      const lm = line.match(/^( *)([-*]|\d+\.) (.+)$/);
      if (lm) {
        const indent = lm[1].length;
        const isOl = /\d/.test(lm[2][0]);
        const tag = isOl ? 'ol' : 'ul';
        const content = lm[3];

        while (stack.length > 0 && stack[stack.length - 1].indent > indent) {
          closeLiAt(stack.length - 1);
          out += `</${stack[stack.length - 1].tag}>`;
          stack.pop();
        }

        if (stack.length === 0 || stack[stack.length - 1].indent < indent) {
          out += `<${tag}>`;
          stack.push({ tag, indent, liOpen: false });
        } else {
          closeLiAt(stack.length - 1);
          if (stack[stack.length - 1].tag !== tag) {
            out += `</${stack[stack.length - 1].tag}><${tag}>`;
            stack[stack.length - 1].tag = tag;
          }
        }

        out += `<li>${inline(content)}`;
        stack[stack.length - 1].liOpen = true;
        lastPara = false;
        pendingBreak = false;
        continue;
      }

      closeFrom(0);
      if (pendingBreak) { out += '<br><br>'; pendingBreak = false; }
      else if (lastPara) out += '<br>';
      out += inline(line);
      lastPara = true;
    }

    closeFrom(0);
    return out
      .replace(/\x00B(\d+)\x00/g, (_, i) => codeBlocks[+i])
      .replace(/\x00T(\d+)\x00/g, (_, i) => tables[+i])
      .replace(/\x00D(\d+)\x00/g, (_, i) => mathHtml[+i])
      .replace(/\x00M(\d+)\x00/g, (_, i) => mathHtml[+i]);
  }

  // ---------- popovers ----------

  function closePopovers() {
    modePopover.hidden = true;
    if (backendPopover) backendPopover.hidden = true;
    if (sessionSettingsPopover) sessionSettingsPopover.hidden = true;
    gearPopover.hidden = true;
    addPopover.hidden = true;
    historyPopover.hidden = true;
    if (docsPopover) docsPopover.hidden = true;
    if (capabilitiesPopover) capabilitiesPopover.hidden = true;
  }

  function renderDocsPopover() {
    if (!docsPopover) return;
    docsPopover.innerHTML = "";
    const head = document.createElement("div");
    head.className = "studio-popover-head";
    head.textContent = "Workspace documents";
    docsPopover.appendChild(head);
    const body = document.createElement("div");
    body.className = "studio-popover-body history-list";
    const wd = state.workspaceDocs || {};
    if (wd.loading) {
      const p = document.createElement("p");
      p.className = "studio-popover-empty muted";
      p.textContent = "Scanning…";
      body.appendChild(p);
    } else if (wd.error === "no-workspace") {
      const p = document.createElement("p");
      p.className = "studio-popover-empty muted";
      p.textContent = "Open a folder to browse business documents.";
      body.appendChild(p);
    } else if (wd.error) {
      const p = document.createElement("p");
      p.className = "studio-popover-empty muted";
      p.textContent = "Couldn't scan workspace";
      body.appendChild(p);
    } else if (!wd.entries || !wd.entries.length) {
      const p = document.createElement("p");
      p.className = "studio-popover-empty muted";
      p.textContent = "No business documents found in this workspace.";
      body.appendChild(p);
    } else {
      for (const entry of wd.entries) {
        const row = document.createElement("div");
        row.className = "studio-doc-row";
        const title = document.createElement("button");
        title.type = "button";
        title.className = "studio-doc-name toolbar-popover-item";
        title.textContent = entry.name || entry.path;
        title.title = entry.path;
        title.onclick = (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: "openFile", path: entry.path });
        };
        row.appendChild(title);
        const actions = document.createElement("div");
        actions.className = "studio-doc-actions";
        const mkAct = (label, fn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "studio-doc-act";
          b.textContent = label;
          b.onclick = (e) => { e.stopPropagation(); fn(); };
          actions.appendChild(b);
        };
        mkAct("Open", () => vscode.postMessage({ type: "openFile", path: entry.path }));
        mkAct("Reveal", () => vscode.postMessage({ type: "revealInOs", path: entry.path }));
        mkAct("Attach", () => vscode.postMessage({ type: "dropFile", path: entry.path, shift: false }));
        mkAct("Use", () => {
          insertComposerPrompt("Use this document in our work: " + entry.path + "\n\n");
          closePopovers();
        });
        row.appendChild(actions);
        body.appendChild(row);
      }
      if (wd.capped) {
        const note = document.createElement("p");
        note.className = "studio-popover-empty muted";
        note.textContent = "Showing newest " + (wd.entries.length) + " of " + (wd.total || wd.entries.length);
        body.appendChild(note);
      }
    }
    docsPopover.appendChild(body);
  }

  function openDocsPopover() {
    if (!docsPopover || !docsBtn) return;
    if (!docsPopover.hidden) { closePopovers(); return; }
    closePopovers();
    state.workspaceDocs = { entries: [], loading: true, error: null, total: 0, capped: false };
    renderDocsPopover();
    positionDropdownPopover(docsPopover, docsBtn);
    docsPopover.hidden = false;
    vscode.postMessage({ type: "listWorkspaceDocs" });
  }

  function positionPopover(popover, btn) {
    const composerRect = popover.parentElement.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    popover.style.top = "auto";
    popover.style.bottom = (composerRect.bottom - btnRect.top + 4) + "px";
    popover.style.left = (btnRect.left - composerRect.left) + "px";
    popover.style.right = "auto";
    requestAnimationFrame(() => {
      const pw = popover.getBoundingClientRect().width;
      const leftOffset = btnRect.left - composerRect.left;
      if (leftOffset + pw > composerRect.width) {
        popover.style.left = Math.max(0, composerRect.width - pw) + "px";
      }
    });
  }

  function positionDropdownPopover(popover, btn) {
    const parentRect = popover.parentElement.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const EDGE = 6; // gap kept from the panel's right edge (and minimum gap on the left)
    popover.style.bottom = "auto";
    popover.style.top = (btnRect.bottom - parentRect.top + 4) + "px";
    // Right-align to the panel edge (respecting padding) and grow leftward. The width
    // isn't settled when it opens — session rows stream in asynchronously (requestSessions
    // → "sessions" message → render) and widen it from min-width toward max-width — so a
    // left-anchor + one-shot overflow clamp (measured before those rows arrived) spilled
    // off the right edge and only looked right on reopen. Right-anchoring is width-
    // independent: no measurement, no reflow jump. We also cap the width to the panel
    // (overriding the CSS min/max) so a long session name ellipsizes instead of
    // overflowing the LEFT edge in a narrow panel — common-case sizing, not extreme.
    popover.style.left = "auto";
    popover.style.right = EDGE + "px";
    const available = Math.max(0, parentRect.width - EDGE * 2);
    popover.style.maxWidth = Math.min(360, available) + "px";
    popover.style.minWidth = Math.min(280, available) + "px";
  }

  // ---------- gear popover ----------

  function addSection(label) {
    const el = document.createElement("div");
    el.className = "popover-section";
    el.textContent = label;
    gearPopover.appendChild(el);
  }

  function addGearItem(labelHtml, onclick) {
    const el = document.createElement("div");
    el.className = "toolbar-popover-item";
    el.innerHTML = labelHtml;
    el.onclick = (e) => { e.stopPropagation(); onclick(); };
    gearPopover.appendChild(el);
  }

  // A non-clickable, muted info row (e.g. version lines in the About panel).
  function addGearInfo(labelHtml) {
    const el = document.createElement("div");
    el.className = "popover-info";
    el.innerHTML = labelHtml;
    gearPopover.appendChild(el);
  }

  // A thin horizontal divider between sections of a popover panel.
  function addGearSep() {
    const el = document.createElement("div");
    el.className = "popover-sep";
    gearPopover.appendChild(el);
  }

  function renderGearMain() {
    state.gearView = "main";
    gearPopover.innerHTML = "";

    // ── Model + effort header ─────────────────────────────────────────────
    const modelEffortSection = document.createElement("div");
    modelEffortSection.className = "popover-section popover-section-first";
    modelEffortSection.textContent = "Model & thinking depth";
    gearPopover.appendChild(modelEffortSection);

    // ── Model + effort row ────────────────────────────────────────────────
    const row = document.createElement("div");
    row.className = "model-effort-row";

    // Model + effort both restart or race the session, so they're locked while
    // a turn is in flight or the session is still priming (the hidden primer) —
    // the same `busy` signal that disables send/submit.
    const settingsLocked = state.busy;

    const nameBtn = document.createElement("button");
    nameBtn.className = "toolbar-btn model-name-btn" + (settingsLocked ? " disabled" : "");
    const modelName = modelDisplayName(state.currentModelId, state.availableModels) || "Grok Build";
    nameBtn.innerHTML = `<span class="btn-label">${escapeHtml(truncate(modelName, 16))}</span>`;
    nameBtn.disabled = settingsLocked;
    nameBtn.title = settingsLocked
      ? `${modelName} — available once the session is ready`
      : `${modelName} — click to change`;
    if (!settingsLocked) nameBtn.onclick = (e) => { e.stopPropagation(); renderModelPicker(); };
    row.appendChild(nameBtn);

    // Claude has no reasoning-effort axis at all (CLAUDE_EFFORT_LEVELS is empty
    // in src/backends.ts) — omit the whole dots row rather than rendering an
    // empty/meaningless one.
    if (state.backend !== "claude") {
      const dotsEl = document.createElement("span");
      dotsEl.className = "effort-dots" + (settingsLocked ? " disabled" : "");
      const currentIdx = EFFORT_LEVELS.indexOf(state.effort);
      EFFORT_LEVELS.forEach((id, i) => {
        const dot = document.createElement("span");
        dot.className = "effort-dot" + (i <= currentIdx ? " active" : "") + (settingsLocked ? " disabled" : "");
        // Render the dot as a CSS-shaped span (see chat.css). Avoids the classic
        // ● vs ○ Unicode size mismatch where the empty glyph is visibly larger.
        dot.title = settingsLocked
          ? "Available once the session is ready"
          : (EFFORT_TOOLTIPS[id] || capitalize(id));
        if (!settingsLocked) dot.onclick = (e) => {
          e.stopPropagation();
          state.effort = state.effort === id ? "" : id;
          vscode.postMessage({ type: "setEffort", level: state.effort });
          renderGearMain();
          gearPopover.hidden = false;
          updateModelLabel(); // reflect the new effort on the composer chip
        };
        dotsEl.appendChild(dot);
      });
      row.appendChild(dotsEl);
    }
    gearPopover.appendChild(row);

    // ── Session ───────────────────────────────────────────────────────────
    addSection("Session");
    addGearItem("<span>Compact conversation</span>", () => {
      vscode.postMessage({ type: "send", text: "/compact", chips: [] });
      closePopovers();
    });

    // ── Other ─────────────────────────────────────────────────────────────
    // Collapses the former Config / Account / Debug sections into sub-views
    // (mirrors the Model picker), keeping the main menu short.
    addSection("Other");
    addGearItem('<span>Keyboard shortcuts</span><span class="popover-chevron">›</span>', () => renderShortcutsPanel());
    addGearItem('<span>Version &amp; about</span><span class="popover-chevron">›</span>', () => renderAboutPanel(true));
    addGearItem('<span>Config &amp; debug</span><span class="popover-chevron">›</span>', () => renderConfigDebugPanel());
    // Signs out of THIS tab's own backend (docs/plans/claude-code-backend.md §
    // WP5) — the host infers it from the session, but the label says so too so
    // it's clear a Claude tab's "Log out" won't sign the user out of grok.
    addGearItem(`<span>Log out of ${state.backend === "claude" ? "Claude" : "Grok"}</span>`, () => {
      vscode.postMessage({ type: "logout" });
      closePopovers();
    });
  }

  // About: extension + Grok Build versions, update availability, and an action to
  // update the CLI on demand. `check` triggers a fresh `grok update --check`; the
  // async grokUpdateStatus reply re-renders this view (check=false) to fill it in.
  function renderAboutPanel(check) {
    state.gearView = "about";
    if (check) {
      state.grokUpdate = { checking: true };
      vscode.postMessage({ type: "checkGrokUpdate" });
    }
    const u = state.grokUpdate || {};
    gearPopover.innerHTML = "";
    addGearItem('<span class="popover-back">← Version &amp; about</span>', renderGearMain);

    // Updates can be paused for compatibility (issue #22): the host blocks moving
    // the CLI onto an unsupported build on Windows.
    const blocked = u.policy && u.policy.allow === false;

    // ── Compatibility note (top) ─────────────────────────────────────────
    if (blocked) {
      addGearInfo(`<span class="popover-warn">${escapeHtml(u.policy.note || "Updates are paused for compatibility.")}</span>`);
      addGearSep();
    }

    // ── Versions + update status ─────────────────────────────────────────
    addGearInfo(`<span>This extension</span><span class="popover-ver">v${escapeHtml(state.extVersion || "?")}</span>`);
    // The CLI version comes from the ACP `initialize` handshake, but the native
    // Windows build doesn't report one there — so fall back to the version the
    // update check returns (its `currentVersion`), which is always populated.
    const cliVer = state.cliVersion || u.current || "";
    addGearInfo(`<span>Grok Build CLI</span><span class="popover-ver">${cliVer ? "v" + escapeHtml(cliVer) : "—"}</span>`);

    let statusHtml, canUpdate = false;
    if (u.checking) {
      statusHtml = '<span class="loading-dots">Checking for updates</span>';
    } else if (blocked) {
      statusHtml = '<span class="popover-ver">On the supported version</span>';
    } else if (u.error) {
      statusHtml = '<span class="popover-warn">Couldn’t check — try updating anyway</span>';
      canUpdate = true;
    } else if (u.updateAvailable) {
      statusHtml = `<span class="popover-update-avail">Update available · v${escapeHtml(u.latest || "")}</span>`;
      canUpdate = true;
    } else if (u.current || u.latest) {
      statusHtml = '<span class="popover-ver">CLI is up to date</span>';
    } else {
      statusHtml = '<span class="popover-ver">—</span>';
    }
    addGearInfo(statusHtml);

    if (blocked) {
      // Disabled action — the reason note is shown at the top.
      const btn = document.createElement("div");
      btn.className = "toolbar-popover-item popover-action disabled";
      btn.setAttribute("aria-disabled", "true");
      btn.innerHTML = "<span>Update Grok Build CLI</span>";
      gearPopover.appendChild(btn);
    } else if (canUpdate) {
      // The update action only appears when there's actually something to do —
      // when the CLI is up to date the grayed status line above says so on its own.
      const btn = document.createElement("div");
      btn.className = "toolbar-popover-item popover-action";
      btn.innerHTML = "<span>Update Grok Build CLI</span>";
      btn.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ type: "updateGrok" }); closePopovers(); };
      gearPopover.appendChild(btn);
    }

    // ── Unofficial + trademark fine print ────────────────────────────────
    addGearSep();
    const fine = document.createElement("div");
    fine.className = "popover-fineprint";
    fine.textContent =
      "Grokbit · unofficial · MIT | " +
      "A VS Code UI for xAI’s Grok Build CLI - not affiliated with or endorsed by xAI. " +
      "Grok, Grok Build, and xAI are trademarks of xAI; this project uses those names only to describe what it’s compatible with. " +
      "Based on phuryn/grok-build-vscode by Paweł Huryn (MIT).";
    gearPopover.appendChild(fine);

    // ── Repository link (bottom) ─────────────────────────────────────────
    addGearSep();
    const ghIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="vertical-align:-2px"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
    addGearItem(
      `<span class="popover-gh">${ghIcon} irichner/grokbit-vscode</span><span class="popover-external">↗</span>`,
      () => { vscode.postMessage({ type: "openUrl", url: "https://github.com/irichner/grokbit-vscode" }); closePopovers(); },
    );
  }

  // Config & debug: the former Config + Debug items behind one sub-view.
  function renderConfigDebugPanel() {
    state.gearView = "config";
    gearPopover.innerHTML = "";
    addGearItem('<span class="popover-back">← Config &amp; debug</span>', renderGearMain);
    // Show thinking traces (#26) — a switcher; off by default keeps grok's
    // reasoning out of the way, on reveals it (incl. on already-loaded sessions).
    addGearItem(
      `<span>Show thinking details</span><span class="popover-switch${state.showThinking ? " on" : ""}" role="switch" aria-checked="${state.showThinking}"><span class="popover-switch-knob"></span></span>`,
      () => {
        state.showThinking = !state.showThinking;
        applyThinkingVisibility();
        vscode.postMessage({ type: "setShowThinking", value: state.showThinking });
        renderConfigDebugPanel(); // re-render so the switch reflects the new state
      },
    );
    addGearInfo('<span class="popover-hint">When off, you only see a short “Thinking…” line while Grok works.</span>');
    // Compact activity carousel — one strip per turn instead of a scrolling
    // stream of tool/thinking rows. Applies to new turns; setting-backed.
    addGearItem(
      `<span>Compact activity view</span><span class="popover-switch${state.compactActivity ? " on" : ""}" role="switch" aria-checked="${state.compactActivity}"><span class="popover-switch-knob"></span></span>`,
      () => {
        state.compactActivity = !state.compactActivity;
        if (!state.compactActivity) finalizeActivity();
        vscode.postMessage({ type: "setCompactActivity", value: state.compactActivity });
        renderConfigDebugPanel(); // re-render so the switch reflects the new state
      },
    );
    addGearInfo('<span class="popover-hint">Rolls each turn’s tool activity into one compact strip you can expand, instead of a scrolling list.</span>');
    addGearSep();
    addGearItem('<span>Open global settings file</span><span class="popover-external">↗</span>', () => {
      vscode.postMessage({ type: "openGlobalConfig" });
      closePopovers();
    });
    addGearItem('<span>Open project settings file</span><span class="popover-external">↗</span>', () => {
      vscode.postMessage({ type: "openProjectConfig" });
      closePopovers();
    });
    addGearItem('<span>Connected tools (MCP)</span><span class="popover-external">↗</span>', () => {
      vscode.postMessage({ type: "runMcpList" });
      closePopovers();
    });
    addGearItem("<span>Show troubleshooting logs</span>", () => {
      vscode.postMessage({ type: "showLogs" });
      closePopovers();
    });
  }

  // Keyboard-shortcuts reference. The commands + keybindings exist (package.json),
  // but nothing in the chat advertised them. The send/newline rows track the
  // useCtrlEnter setting so they always describe THIS user's keys. Descriptions
  // stay plain-English for non-technical users.
  function renderShortcutsPanel() {
    state.gearView = "shortcuts";
    gearPopover.innerHTML = "";
    addGearItem('<span class="popover-back">← Keyboard shortcuts</span>', renderGearMain);
    const rows = state.useCtrlEnter
      ? [[`${MOD}+Enter`, "Send your message"], ["Enter", "Start a new line"]]
      : [["Enter", "Send your message"], ["Shift+Enter", "Start a new line"]];
    rows.push([`${MOD}+;`, "Open Grokbit sidebar"]);
    rows.push(["Alt+G", "Attach the current file as context"]);
    for (const [keys, desc] of rows) {
      addGearInfo(`<span>${escapeHtml(desc)}</span><span class="popover-kbd">${escapeHtml(keys)}</span>`);
    }
    addGearSep();
    addGearInfo('<span class="popover-hint">Tip: type <code>/</code> in the box for built-in commands like image generation.</span>');
  }

  function renderModelPicker() {
    state.gearView = "model";
    gearPopover.innerHTML = "";
    addGearItem('<span class="popover-back">← Model</span>', renderGearMain);
    const models = state.availableModels.length
      ? state.availableModels
      : [{ modelId: state.currentModelId || "grok-build", name: state.currentModelId || "grok-build" }];
    for (const m of models) {
      const el = document.createElement("div");
      const active = m.modelId === state.currentModelId;
      el.className = "toolbar-popover-item" + (active ? " active" : "");
      el.innerHTML = `<span>${escapeHtml(truncate(m.name || m.modelId, 28))}</span>${active ? '<span class="popover-check">✓</span>' : ""}`;
      el.title = m.modelId;
      el.onclick = (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: "setModel", modelId: m.modelId });
        closePopovers();
      };
      gearPopover.appendChild(el);
    }
  }

  function openGearPopover() {
    if (!gearPopover.hidden) { closePopovers(); return; }
    closePopovers();
    renderGearMain();
    positionPopover(gearPopover, gearBtn);
    gearPopover.hidden = false;
  }

  // Open the gear popover straight to the Version & about panel (used by the
  // welcome screen's "about" link). No-op if it's already showing About.
  function openAboutPanel() {
    if (!gearPopover.hidden && state.gearView === "about") return;
    closePopovers();
    renderAboutPanel(true);
    positionPopover(gearPopover, gearBtn);
    gearPopover.hidden = false;
  }

  function openModePopover() {
    if (!modePopover.hidden) { closePopovers(); return; }
    modePopover.innerHTML = "";
    for (const [id, meta] of Object.entries(MODE_META)) {
      const el = document.createElement("div");
      const active = id === state.currentModeId;
      el.className = "toolbar-popover-item mode-popover-item" +
        (active ? " active" : "") +
        (meta.disabled ? " disabled" : "");
      el.innerHTML =
        `<span class="mode-item-icon">${meta.icon}</span>` +
        `<span class="mode-item-body">` +
          `<span class="mode-item-label">${escapeHtml(meta.label)}</span>` +
          `<span class="mode-item-desc">${escapeHtml(meta.desc)}</span>` +
          (meta.disabledNote ? `<span class="mode-item-disabled-note">${escapeHtml(meta.disabledNote)}</span>` : "") +
        `</span>` +
        (active ? '<span class="popover-check">✓</span>' : "");
      el.onclick = (e) => {
        e.stopPropagation();
        if (meta.disabled) return;
        vscode.postMessage({ type: "setMode", modeId: id });
        closePopovers();
      };
      modePopover.appendChild(el);
    }
    positionPopover(modePopover, modeBtn);
    modePopover.hidden = false;
  }

  function openAddPopover() {
    if (!addPopover.hidden) { closePopovers(); return; }
    closePopovers();
    addPopover.innerHTML = "";
    const item = document.createElement("div");
    item.className = "toolbar-popover-item";
    item.innerHTML = `<span class="add-item-icon">${ICON.upload}</span><span>Upload from computer</span>`;
    item.onclick = (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: "pickFile" });
      closePopovers();
    };
    addPopover.appendChild(item);
    // A second, plainly-labelled door back to the capability browser once the
    // welcome screen (and its own door) is gone — this is where a user who has
    // already started chatting is actually looking (docs/plans/
    // session-tab-ux-overhaul.md § Approach B bullet 5). Omitted, not just
    // inert, when grok.showCapabilities is off — matches the top-bar button's
    // own hidden-not-disabled treatment.
    if (capabilitiesPopover && capabilitiesBtn && state.showCapabilities) {
      const capItem = document.createElement("div");
      capItem.className = "toolbar-popover-item";
      capItem.innerHTML = `<span class="add-item-icon">${ICON.cpu}</span><span>Browse Grokbit Actions…</span>`;
      capItem.onclick = (e) => {
        e.stopPropagation();
        // openCapabilitiesPopover() itself calls closePopovers() (hiding this
        // add-popover) before showing the capabilities popover — closing here
        // too would immediately hide the one we just opened.
        openCapabilitiesPopover();
      };
      addPopover.appendChild(capItem);
    }
    positionPopover(addPopover, addBtn);
    addPopover.hidden = false;
  }

  // Dashboard dot in the history dropdown. Gray (the `none` default) at rest; the
  // labels double as the dot's tooltip (none → no tooltip). Shared with launcher
  // via GrokWebviewHelpers.SESSION_DOT_LABELS so the two surfaces cannot drift.
  const DOT_LABEL = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.SESSION_DOT_LABELS) || {
    working: "Working on it",
    "needs-you": "Needs your OK",
    unread: "Done — not opened yet",
    error: "Finished with an error — not opened yet",
  };

  function applySessionDot(dot, value) {
    const v = DOT_LABEL[value] ? value : "none";
    dot.className = "history-row-dot dot-" + v;
    dot.title = DOT_LABEL[value] || "";
  }

  // Cheap incremental update for a single dot when a `sessionDot` arrives while the
  // popover is open — no full re-render.
  function patchSessionDot(id) {
    const sel = "[data-session-dot=\"" + (window.CSS && CSS.escape ? CSS.escape(id) : id) + "\"]";
    const dot = historyPopover.querySelector(sel);
    if (dot) applySessionDot(dot, state.dots[id]);
  }

  // Live references to the popover's list + footer, so a `sessions` message can repaint
  // just the rows (without rebuilding the search input, which would drop focus mid-type).
  let historyListEl = null;
  let historyFooterEl = null;
  let sessionSearchTimer = null;

  // Ask the host for a page of history. offset 0 = fresh list/search (host replaces);
  // offset > 0 = load-more (host appends). The query rides along so search runs
  // server-side across ALL sessions on disk, not just the page already loaded.
  function requestSessions(offset) {
    state.sessionLoading = true;
    vscode.postMessage({ type: "listSessions", offset, query: state.sessionSearch });
  }

  function renderHistoryList() {
    historyPopover.innerHTML = "";

    const searchWrap = document.createElement("div");
    searchWrap.className = "history-search-wrap";
    const search = document.createElement("input");
    search.type = "text";
    search.className = "history-search";
    search.placeholder = "Search sessions…";
    search.value = state.sessionSearch;
    search.oninput = () => {
      state.sessionSearch = search.value;
      if (sessionSearchTimer) clearTimeout(sessionSearchTimer);
      // Debounce so each keystroke doesn't fan out a host read pass; the host filters
      // by display name across every session and returns the first matching page.
      sessionSearchTimer = setTimeout(() => requestSessions(0), 180);
    };
    search.onkeydown = (e) => { e.stopPropagation(); };
    search.onclick = (e) => e.stopPropagation();
    searchWrap.appendChild(search);
    historyPopover.appendChild(searchWrap);

    const list = document.createElement("div");
    list.className = "history-list";
    // Auto-load the next page as the user nears the bottom. The loading/hasMore guards
    // keep it to one request per page boundary. Cursor is the host's own authoritative
    // state.sessionNextOffset (offset + disk rows actually read), NOT state.sessions.length
    // — the host prepends a synthesized live row for a not-yet-flushed session, so paging
    // off the rendered row count overshoots by that row's count and permanently skips a
    // real session at every page boundary (docs/plans/capability-surfacing-and-history-ux.md
    // § Thread 3 — the same latent bug the launcher was rewritten to avoid).
    list.onscroll = () => {
      if (!state.sessionHasMore || state.sessionLoading) return;
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 48) {
        requestSessions(state.sessionNextOffset);
      }
    };
    historyPopover.appendChild(list);
    historyListEl = list;

    // Footer "Clear all" — shown whenever a non-active session exists (loaded or on a
    // later page). The active session can't be deleted (grok re-persists it); the host
    // shows a modal confirm with the real count and handles the empty case.
    const footer = document.createElement("div");
    footer.className = "history-footer";
    footer.hidden = true;
    const clearBtn = document.createElement("button");
    clearBtn.className = "history-clear-all";
    clearBtn.innerHTML = ICON.trash + "<span>Clear all history</span>";
    clearBtn.title = "Delete all sessions in this workspace's history";
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: "clearAllSessions" });
      closePopovers();
    };
    footer.appendChild(clearBtn);
    historyPopover.appendChild(footer);
    historyFooterEl = footer;

    renderSessionRows();
  }

  function updateHistoryFooter() {
    if (!historyFooterEl) return;
    // A non-active session exists if a loaded row isn't the active one, or there are
    // still-unloaded later pages (which sort after the active session, so they're all
    // non-active by construction).
    const loadedClearable = state.sessions.some((s) => s.id !== state.activeSessionId);
    const moreUnloaded = state.sessionTotal > state.sessions.length;
    historyFooterEl.hidden = !(loadedClearable || moreUnloaded);
  }

  function renderSessionRows() {
    const list = historyListEl;
    if (!list) return;
    list.innerHTML = "";
    if (state.sessions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = state.sessionSearch.trim() ? "No matches." : "No sessions yet.";
      list.appendChild(empty);
    } else {
      for (const s of state.sessions) list.appendChild(renderSessionRow(s));
      if (state.sessionHasMore) {
        const more = document.createElement("div");
        more.className = "history-more";
        more.textContent = state.sessionLoading ? "Loading…" : "Scroll for more";
        list.appendChild(more);
      }
    }
    updateHistoryFooter();
  }

  function renderSessionRow(s) {
      const row = document.createElement("div");
      const active = s.id === state.activeSessionId;
      row.className = "history-row" + (active ? " active" : "");

      const dot = document.createElement("span");
      dot.setAttribute("data-session-dot", s.id);
      applySessionDot(dot, state.dots[s.id]);
      row.appendChild(dot);

      const main = document.createElement("div");
      main.className = "history-row-main";

      if (state.renamingSessionId === s.id) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "history-rename";
        inp.value = s.displayName;
        inp.onclick = (e) => e.stopPropagation();
        inp.onkeydown = (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            vscode.postMessage({ type: "renameSession", id: s.id, name: inp.value });
            state.renamingSessionId = null;
          } else if (e.key === "Escape") {
            state.renamingSessionId = null;
            renderSessionRows();
          }
        };
        inp.onblur = () => {
          if (state.renamingSessionId === s.id) {
            vscode.postMessage({ type: "renameSession", id: s.id, name: inp.value });
            state.renamingSessionId = null;
          }
        };
        main.appendChild(inp);
        setTimeout(() => { inp.focus(); inp.select(); }, 0);
      } else {
        const titleRow = document.createElement("div");
        titleRow.className = "history-row-title";

        const badgeLabel = backendBadgeLabel ? backendBadgeLabel(s.backend) : "";
        if (badgeLabel) {
          const badge = document.createElement("span");
          badge.className = "history-row-backend";
          badge.textContent = badgeLabel;
          titleRow.appendChild(badge);
        }

        const name = document.createElement("div");
        name.className = "history-row-name";
        name.textContent = s.displayName || "Untitled";
        name.title = s.rawSummary || s.displayName || "";
        titleRow.appendChild(name);
        main.appendChild(titleRow);

        const meta = document.createElement("div");
        meta.className = "history-row-meta";
        const parts = [];
        if (s.numMessages) parts.push(`${s.numMessages} msg`);
        parts.push(formatRelativeTime(s.updatedAt));
        meta.textContent = parts.join(" · ");
        main.appendChild(meta);

        // Whole row is the click target; the rename/delete buttons below
        // stopPropagation so they don't also trigger a resume. Carry the row's
        // own backend so the host starts the right agent
        // (docs/plans/claude-code-backend.md § WP5) — omitted for a legacy/grok
        // row, mirroring the delete button below.
        row.onclick = () => {
          if (active) { closePopovers(); return; }
          const msg = { type: "resumeSession", id: s.id };
          if (s.backend) msg.backend = s.backend;
          vscode.postMessage(msg);
          closePopovers();
        };
      }

      row.appendChild(main);

      const actions = document.createElement("div");
      actions.className = "history-row-actions";
      const renameBtn = document.createElement("button");
      renameBtn.className = "history-action-btn";
      renameBtn.innerHTML = ICON.pencil;
      renameBtn.title = "Rename";
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        state.renamingSessionId = s.id;
        renderSessionRows();
      };
      actions.appendChild(renameBtn);
      // No delete for the active session: it's the live conversation and the CLI
      // re-persists it, so a delete wouldn't stick. Rename is still fine.
      if (!active) {
        const delBtn = document.createElement("button");
        delBtn.className = "history-action-btn history-action-danger";
        delBtn.innerHTML = ICON.trash;
        delBtn.title = "Delete";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          const msg = { type: "deleteSession", id: s.id, name: s.displayName };
          if (s.backend) msg.backend = s.backend;
          vscode.postMessage(msg);
        };
        actions.appendChild(delBtn);
      }
      row.appendChild(actions);

      return row;
  }

  function openHistoryPopover() {
    if (!historyPopover.hidden) { closePopovers(); return; }
    closePopovers();
    state.sessionSearch = "";
    state.renamingSessionId = null;
    state.sessionLoading = false;
    state.sessionHasMore = false;
    renderHistoryList();
    positionDropdownPopover(historyPopover, historyBtn);
    historyPopover.hidden = false;
    requestSessions(0);
  }

  // ---------- messages ----------

  function clearWelcome() {
    if (!state.welcomeVisible) return;
    const welcome = $("welcome");
    if (welcome) welcome.hidden = true;
    state.welcomeVisible = false;
    hideSessionSetupCard();
    hideCapabilitiesPanel();
  }

  // ---------- turn containers (sticky prompt + collapsible Q&A stack) ----------
  // Each user send opens a `.turn` that owns the prompt, ephemeral activity,
  // interactive cards, and final answer. Prior turns collapse to a header;
  // intermediate tool/thinking chrome is destroyed on seal (not frozen).

  function turnBody(turn) {
    return turn && turn.querySelector(".turn-body");
  }

  function turnActivityRegion(turn) {
    return (turn && turn.querySelector(".turn-activity")) || null;
  }

  function turnAnswerRegion(turn) {
    return (turn && turn.querySelector(".turn-answer")) || null;
  }

  function turnPromptRegion(turn) {
    return (turn && turn.querySelector(".turn-prompt")) || null;
  }

  /** Parent for live tools/thinking/carousel — active turn's activity zone, else #messages. */
  function activityParent() {
    const reg = turnActivityRegion(state.activeTurnEl);
    return reg || messagesEl;
  }

  /** Parent for final agent answer bubble. */
  function answerParent() {
    const reg = turnAnswerRegion(state.activeTurnEl);
    return reg || messagesEl;
  }

  /**
   * Parent for interactive cards / deliverables / errors that belong to the
   * turn but must not sit inside ephemeral activity (insert before answer).
   */
  function turnSurfaceParent() {
    const body = turnBody(state.activeTurnEl);
    if (!body) return messagesEl;
    return body;
  }

  function appendOnTurnSurface(el) {
    // Prefer the answer region so cards interleave with agent bubbles in
    // chronological order (plan/permission history drains between turns and
    // must sit after the prior answer text but before any later agent reply).
    const ans = turnAnswerRegion(state.activeTurnEl);
    if (ans) {
      ans.appendChild(el);
      return;
    }
    const body = turnBody(state.activeTurnEl);
    if (body) {
      body.appendChild(el);
      return;
    }
    messagesEl.appendChild(el);
  }

  function setTurnSummary(turn, text) {
    const el = turn && turn.querySelector(".turn-summary");
    if (!el) return;
    const one = String(text || "").replace(/\s+/g, " ").trim();
    el.textContent = one ? truncate(one, 80) : "Message";
    el.title = one || "";
  }

  function expandTurn(turn) {
    if (!turn || turn.classList.contains("active")) return;
    turn.classList.remove("collapsed");
    const body = turnBody(turn);
    if (body) body.hidden = false;
    const hdr = turn.querySelector(".turn-header");
    if (hdr) hdr.setAttribute("aria-expanded", "true");
  }

  function collapseTurn(turn) {
    if (!turn) return;
    turn.classList.remove("active");
    turn.classList.add("collapsed");
    destroyTurnIntermediate(turn);
    const body = turnBody(turn);
    if (body) body.hidden = true;
    const hdr = turn.querySelector(".turn-header");
    if (hdr) hdr.setAttribute("aria-expanded", "false");
  }

  /** Drop tool-map entries whose DOM rows live under `root`. */
  function clearToolMapsUnder(root) {
    if (!root) return;
    for (const [id, item] of [...state.toolItemsByToolCallId.entries()]) {
      if (item && root.contains(item)) {
        state.toolItemsByToolCallId.delete(id);
        state.toolFailuresById.delete(id);
        state.pendingDiffByToolCallId.delete(id);
      }
    }
  }

  /**
   * Remove ephemeral intermediate chrome from a turn (activity, tools, thinking,
   * grokking/thinking indicators). Keeps prompt + answer + interactive cards
   * (resolved or not — collapsed permission/question lines are history) and
   * deliverables (document/media).
   */
  function destroyTurnIntermediate(turn) {
    if (!turn) return;
    const act = turnActivityRegion(turn);
    if (act) {
      clearToolMapsUnder(act);
      act.innerHTML = "";
    }
    // Stray tool/thinking rows that landed outside activity (classic mode / races).
    // Never remove .card / deliverables — those are the durable turn surface.
    for (const n of [...turn.querySelectorAll(".activity-carousel, .tool-group, .tool-flat, .msg.thinking, .thinking-indicator, .grokking")]) {
      if (n.closest(".turn-answer") || n.closest(".turn-prompt")) continue;
      if (n.closest(".card")) continue;
      clearToolMapsUnder(n);
      n.remove();
    }
  }

  function openTurn(promptText) {
    if (state.activeTurnEl) {
      // Seal any leftover intermediate before collapsing the prior turn.
      if (state.activeActivityEl || state.activeToolGroupEl) {
        closeToolGroup();
        finalizeActivity();
      }
      destroyTurnIntermediate(state.activeTurnEl);
      collapseTurn(state.activeTurnEl);
      state.activeTurnEl = null;
    }
    clearWelcome();
    const turn = document.createElement("div");
    turn.className = "turn active";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "turn-header";
    header.setAttribute("aria-expanded", "true");
    header.innerHTML =
      `<span class="turn-chevron" aria-hidden="true">›</span>` +
      `<span class="turn-summary"></span>`;
    header.addEventListener("click", () => {
      // Active turn stays open (sticky working surface). Prior turns toggle.
      if (turn.classList.contains("active")) return;
      if (turn.classList.contains("collapsed")) expandTurn(turn);
      else collapseTurn(turn);
    });

    const body = document.createElement("div");
    body.className = "turn-body";
    const prompt = document.createElement("div");
    prompt.className = "turn-prompt";
    const activity = document.createElement("div");
    activity.className = "turn-activity";
    const answer = document.createElement("div");
    answer.className = "turn-answer";
    body.appendChild(prompt);
    body.appendChild(activity);
    body.appendChild(answer);
    turn.appendChild(header);
    turn.appendChild(body);
    messagesEl.appendChild(turn);
    state.activeTurnEl = turn;
    setTurnSummary(turn, promptText || "");
    return turn;
  }

  /** Ensure an active turn exists (tests/tools may emit before a user bubble). */
  function ensureActiveTurn(promptText) {
    if (state.activeTurnEl) return state.activeTurnEl;
    return openTurn(promptText || "");
  }

  /**
   * Seed the composer with a ready-to-edit prompt and place the caret at the end.
   * @param {string} prompt
   * @param {{ mode?: "append" | "replace" }} [opts] — default append (Studio);
   *   capability/workflow rows pass `{ mode: "replace" }` so only the last pick remains.
   */
  function insertComposerPrompt(prompt, opts) {
    if (typeof prompt !== "string" || !prompt.length) return;
    input.value = applyComposerSeed(input.value, prompt, opts);
    input.focus();
    try {
      const len = input.value.length;
      input.setSelectionRange(len, len);
    } catch { /* happy-dom / older hosts may not implement setSelectionRange */ }
    if (typeof updateSlash === "function") updateSlash();
    if (typeof renderInputHighlight === "function") renderInputHighlight();
  }

  function resetForNewSession() {
    for (const child of Array.from(messagesEl.children)) {
      if (child.id !== "welcome") child.remove();
    }
    const welcome = $("welcome");
    if (welcome) {
      welcome.hidden = false;
      const onb = $("welcome-onboarding");
      if (onb) onb.innerHTML = "";
      hideSessionSetupCard();
      hideCapabilitiesPanel();
    }
    state.welcomeVisible = true;
    state.pendingDiffByToolCallId.clear();
    state.toolItemsByToolCallId.clear();
    state.toolFailuresById.clear();
    state.capabilitiesExpanded = {}; // new session — the old expansion choice doesn't belong to it
    state.pendingCapabilityDetail = null;
    clearChangedFiles(); // switching sessions — the strip belongs to the old view
    state.activeAgentEl = null;
    state.activeAgentRaw = "";
    state.activeUserEl = null;
    state.activeUserRaw = "";
    state.activeThoughtEl = null;
    state.activeThoughtHdrEl = null;
    state.thoughtBuffer = "";
    state.activeToolGroupEl = null;
    state.activeActivityEl = null;
    state.activeTurnEl = null;
    state.replaying = false;
    state.planHistoryQueue = [];
    state.permissionHistoryQueue = [];
    state.userMsgCount = 0;
    state.suppressReplayTurn = false;
    state.skipUserBubble = false;
    // Reveal rebuild (panelReplaying) must not re-pin — endPanelReplay applies
    // the host restore. Intentional clears (new session without begin) still pin.
    if (!state.panelReplaying) {
      state.stickToBottom = true; // a fresh/loaded session starts pinned
    }
    updateScrollBtn();
    hidePlanProcessing();
    hideGrokking();
    hideThinkingIndicator();
  }

  function showOnboarding(mode, info) {
    info = info || {};
    // The recheck button's data-act handler (below) needs to know which
    // backend a Claude-flavored card is for, so "Re-check connection" opens a
    // fresh tab on the SAME backend that failed — not always Grok.
    state.onboardingBackend = info.backend || "";
    const welcome = $("welcome");
    if (welcome) welcome.hidden = false;
    state.welcomeVisible = true;
    const onb = $("welcome-onboarding");
    if (!onb) return;
    if (mode === "missing-cli") {
      hideSessionSetupCard(); // install flow replaces the setup card
      hideCapabilitiesPanel();
      const installCmd = info.platform === "win32"
        ? "irm https://x.ai/cli/install.ps1 | iex"
        : "curl -fsSL https://x.ai/cli/install.sh | bash";
      onb.innerHTML =
        `<div class="onb">` +
          `<p class="onb-heading">Install the Grok CLI</p>` +
          `<div class="onb-cmd">` +
            `<code>${installCmd}</code>` +
            `<button class="onb-copy" type="button" title="Copy" data-cmd="${installCmd}">${ICON.copy}</button>` +
          `</div>` +
          `<button class="onb-action" type="button" data-act="runInstall">Open terminal &amp; run</button>` +
          `<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>` +
        `</div>`;
    } else if (mode === "auth-required") {
      hideSessionSetupCard();
      hideCapabilitiesPanel();
      onb.innerHTML =
        `<div class="onb">` +
          `<p class="onb-heading">Sign in to continue</p>` +
          `<p class="onb-desc"><strong>SuperGrok or X Premium+ subscription</strong> &mdash; either unlocks the <em>Grok Build</em> entitlement.</p>` +
          `<button class="onb-action" type="button" data-act="runLogin">Open terminal &amp; run <code>grok /login</code></button>` +
          `<p class="onb-or">or</p>` +
          `<p class="onb-desc"><strong>API key</strong> &mdash; pay per token; unlocks additional models (grok-4.20, grok-4.3, grok-imagine). Get a key at <a href="https://console.x.ai" class="onb-link">console.x.ai</a>, then add to your shell or a workspace <code>.env</code>:</p>` +
          `<div class="onb-cmd">` +
            `<code>XAI_API_KEY=your-key-here</code>` +
            `<button class="onb-copy" type="button" title="Copy" data-cmd="XAI_API_KEY=">${ICON.copy}</button>` +
          `</div>` +
          `<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>` +
        `</div>`;
    } else if (mode === "missing-claude-adapter") {
      hideSessionSetupCard();
      hideCapabilitiesPanel();
      onb.innerHTML =
        `<div class="onb">` +
          `<p class="onb-heading">Install the Claude Code adapter</p>` +
          `<p class="onb-desc">Grokbit drives Claude Code through a small adapter ` +
          `(<code>@zed-industries/claude-code-acp</code>) that isn't bundled with the extension — ` +
          `it's about <strong>120&nbsp;MB</strong> and is downloaded once, straight from npm. ` +
          `VS Code may be briefly unresponsive while it installs.</p>` +
          `<button class="onb-action" type="button" data-act="installClaude">Install adapter (~120 MB, one time)</button>` +
          `<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>` +
        `</div>`;
    } else if (mode === "claude-auth-required") {
      hideSessionSetupCard();
      hideCapabilitiesPanel();
      onb.innerHTML =
        `<div class="onb">` +
          `<p class="onb-heading">Sign in to Claude Code</p>` +
          `<p class="onb-desc">Uses your existing <strong>Claude subscription</strong> &mdash; the same login as the ` +
          `<code>claude</code> CLI, no separate billing and no API key needed.</p>` +
          `<button class="onb-action" type="button" data-act="runClaudeLogin">Open terminal &amp; run <code>claude auth login</code></button>` +
          `<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>` +
        `</div>`;
    } else {
      onb.innerHTML = "";
      renderSessionSetupCard();
    }
  }

  function makeCollapsible(el, container) {
    el.classList.add("collapsible");
    const expandBtn = document.createElement("button");
    expandBtn.className = "msg-expand-btn";
    expandBtn.textContent = "Show more";
    container.appendChild(expandBtn);
    expandBtn.onclick = () => {
      el.classList.remove("collapsible");
      expandBtn.style.display = "none";
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "msg-collapse-btn";
      collapseBtn.textContent = "Show less";
      container.appendChild(collapseBtn);
      collapseBtn.onclick = () => {
        el.classList.add("collapsible");
        expandBtn.style.display = "";
        collapseBtn.remove();
      };
    };
  }

  // A file chip for a user message bubble: basename only (split on both separators
  // so a file outside the workspace shows its name, not its full Windows path),
  // with the full path on the tooltip. Shared by the live bubble (addMessage) and
  // the restore path (appendUserChunk, reconstructed from the parsed prompt).
  function makeMsgChipTag(pathStr) {
    const tag = document.createElement("span");
    tag.className = "msg-chip";
    const fileName = pathStr.split(/[\\/]/).pop() || pathStr;
    tag.innerHTML = ICON.file + `<span>${escapeHtml(truncate(fileName, 20))}</span>`;
    tag.title = pathStr;
    return tag;
  }

  function addMessage(role, text, chips) {
    clearWelcome();
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el._copyText = text || "";

    let contentParent = el;
    if (role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "msg-bubble";
      el.appendChild(bubble);
      contentParent = bubble;
    }

    const body = document.createElement("div");
    body.className = "body";
    if (text) { body.innerHTML = renderMarkdown(text); renderMermaidIn(body); }
    contentParent.appendChild(body);

    if (role === "user" && chips && chips.length > 0) {
      const chipsRow = document.createElement("div");
      chipsRow.className = "msg-chips";
      for (const chip of chips) chipsRow.appendChild(makeMsgChipTag(chip.relPath));
      contentParent.appendChild(chipsRow);
    }

    if (role === "user" || role === "agent") {
      const actions = document.createElement("div");
      actions.className = "msg-actions";
      const copyBtn = document.createElement("button");
      copyBtn.className = "msg-action-btn msg-copy-btn";
      copyBtn.type = "button";
      copyBtn.title = "Copy message";
      copyBtn.innerHTML = `<span class="msg-action-glyph">${ICON.copy}</span>`;
      const ts = document.createElement("span");
      ts.className = "msg-timestamp";
      ts.textContent = formatTime(Date.now());
      actions.appendChild(copyBtn);
      actions.appendChild(ts);
      el.appendChild(actions);
    }

    if (role === "user") {
      // One addMessage("user") per bubble (live userMessage or first replay chunk)
      // → one turn container. Summary tracks the prompt text.
      const turn = openTurn(text || "");
      const promptReg = turnPromptRegion(turn);
      (promptReg || messagesEl).appendChild(el);
      if (text) setTurnSummary(turn, text);
    } else if (role === "agent") {
      answerParent().appendChild(el);
    } else {
      messagesEl.appendChild(el);
    }
    scrollToBottom();
    // Long prompt overflow: only inside an expanded prompt body — the turn
    // header owns expand/collapse of prior Q&A, so we skip makeCollapsible when
    // the prompt is already summarized in the turn header (always, for turns).
    return body;
  }

  const TOOL_VERB = {
    read_file: "Read", file_read: "Read",
    write_file: "Write", file_write: "Write", write: "Write",
    bash: "Run", execute: "Run", run_command: "Run", run_terminal_command: "Run",
    shell: "Run", run_bash: "Run",
    list_dir: "List", list_directory: "List",
    search_files: "Search", grep: "Search", ripgrep: "Search",
    search_replace: "Edit", edit_file: "Edit", str_replace: "Edit",
    web_search: "Web search", search_web: "Web search",
    web_fetch: "Fetch", webfetch: "Fetch",
  };

  // Verb by ACP kind — the fallback when the tool name isn't in TOOL_VERB (a tool
  // we didn't predict still gets a sensible verb from its kind).
  const KIND_VERB = {
    read: "Read", search: "Search", edit: "Edit", write: "Write",
    delete: "Delete", execute: "Run", fetch: "Generate",
  };

  function toolName(call) {
    return call.tool || call.name || call.title || "";
  }
  function toolFilePath(call) {
    const r = call.rawInput || call.input || {};
    // `target_directory` is list_dir's path field (verified against real sessions);
    // without it, "List" rendered with no target.
    return r.target_file || r.filePath || r.file_path || r.path ||
      r.target_directory || r.directory || r.dir ||
      (Array.isArray(r.paths) ? r.paths[0] : "");
  }
  function prettyPath(p) {
    if (!p) return "";
    if (p === "." || p === "./") return "root folder";
    return p.split("/").pop() || p;
  }
  // Directory target for a list_dir call. Unlike prettyPath (basename only, right
  // for files), a folder reads better as its full *relative* path with a trailing
  // slash — "docs/screenshots/" not "screenshots". grok passes list_dir paths
  // relative to cwd, so we can show them whole; an absolute path (rare — the
  // webview can't know the workspace root) falls back to its leaf so we never
  // render a long machine path.
  function prettyDir(p) {
    if (!p) return "";
    let s = String(p).replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\.\//, "");
    if (s === "" || s === ".") return "root folder";
    const isAbs = s.startsWith("/") || /^[A-Za-z]:\//.test(s);
    if (isAbs) s = s.split("/").pop();
    return s + "/";
  }
  // grok finalizes a tool call's kind over an update, but the *initial* tool_call
  // (and the persisted replay form) often arrives with `kind` missing and only a
  // leading-verb title ("Shell", "Grep", "Glob", "Read", "Write", "Delete").
  // Recover the ACP kind from that title so categorization/labels don't fall
  // through to the "command" catch-all.
  function titleKind(call) {
    const t = (call.title || "").trim().toLowerCase();
    if (/^read\b/.test(t)) return "read";
    if (/^(grep|glob|search|ripgrep)\b/.test(t)) return "search";
    if (/^(shell|execute|run|bash)\b/.test(t)) return "execute";
    if (/^(write|create)\b/.test(t)) return "write";
    if (/^edit\b/.test(t)) return "edit";
    if (/^delete\b/.test(t)) return "delete";
    if (/^generate/.test(t)) return "fetch";
    return "";
  }
  function toolKind(call) {
    return call.kind || titleKind(call);
  }
  // Coarse bucket for the rollup summary, driven by the ACP kind (then the title,
  // then the legacy name map). Reads and searches (grep/glob) are both read-only
  // "exploration"; edits/writes are file changes; delete and execute stand alone.
  // This is the fix for "ran 5 commands" when grok actually read 5 files / ran 5
  // globs — those are `read`/`search`, not `execute`.
  function categorize(call) {
    const n = toolName(call);
    // Web search/fetch first: grok ships these with a "Web search: …" title and no
    // `kind`, so they'd otherwise fall through to the command catch-all (the exact
    // "ran N commands" miscount the user saw).
    if (/web.?search|web.?fetch|search_web/i.test(n)) return "web";
    switch (toolKind(call)) {
      case "read": case "search": return "explore";
      case "edit": case "write": return "edit";
      case "delete": return "delete";
      case "fetch": return "generate";
      case "execute": return "command";
    }
    const v = TOOL_VERB[n];
    if (v === "Read" || v === "List" || v === "Search") return "explore";
    if (v === "Edit" || v === "Write") return "edit";
    if (v === "Web search" || v === "Fetch") return "web";
    return "command";
  }
  function summarizeTools(calls) {
    const n = { explore: 0, edit: 0, delete: 0, generate: 0, web: 0, command: 0 };
    for (const c of calls) n[categorize(c)]++;
    const parts = [];
    if (n.explore) parts.push(`explored ${n.explore} item${n.explore === 1 ? "" : "s"}`);
    if (n.edit) parts.push(`edited ${n.edit} file${n.edit === 1 ? "" : "s"}`);
    if (n.delete) parts.push(`deleted ${n.delete} file${n.delete === 1 ? "" : "s"}`);
    if (n.generate) parts.push(`generated ${n.generate} item${n.generate === 1 ? "" : "s"}`);
    if (n.web) parts.push("searched web");
    if (n.command) parts.push(`ran ${n.command} command${n.command === 1 ? "" : "s"}`);
    return parts.length ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : "Tool calls";
  }

  function inProgressLabel(call) {
    const name = toolName(call);
    const kind = toolKind(call);
    const filePath = toolFilePath(call);
    if (/^(list_dir|list_directory)$/.test(name)) {
      return filePath ? `Listing ${prettyDir(filePath)}` : "Listing files";
    }
    if (/^(read_file|file_read)$/.test(name) || kind === "read") {
      return filePath ? `Reading ${prettyPath(filePath)}` : "Reading file";
    }
    if (/^(web_search|search_web)$/.test(name)) return "Searching web";
    if (/^(web_fetch|webfetch)$/.test(name)) return "Fetching page";
    if (/^(grep|ripgrep|search_files)$/.test(name) || kind === "search") return "Searching";
    if (/^(write_file|file_write|write|edit_file|search_replace|str_replace)$/.test(name) || kind === "edit" || kind === "write") {
      return filePath ? `Editing ${prettyPath(filePath)}` : "Editing file";
    }
    if (kind === "delete") return filePath ? `Deleting ${prettyPath(filePath)}` : "Deleting file";
    if (kind === "fetch") return "Generating";
    if (/^(bash|execute|run_command|run_terminal_command|shell|run_bash)$/.test(name) || kind === "execute") {
      return "Running command";
    }
    // A tool we didn't predict still shows — but never echo a long title verbatim.
    return name && name.length < 30 ? `Running ${name}` : "Running tool";
  }

  function toolLabel(call) {
    const name = toolName(call);
    const kind = toolKind(call);
    const verb = TOOL_VERB[name] || KIND_VERB[kind] || null;
    const r = call.rawInput || call.input || {};
    const filePath = toolFilePath(call);
    const command = r.command || r.cmd;
    const pattern = r.glob_pattern || r.pattern || r.query || r.regex || r.search;
    const url = r.url || r.uri;
    const clamp = (s) => (s && s.length > 40 ? s.slice(0, 40) + "…" : s);
    // A search tool's *pattern* is the useful target — prefer it over the path it
    // searched (grep ships both `pattern` and `path:"."`, which would otherwise
    // render the unhelpful "root folder"). Match by kind OR name so it still wins
    // when the first tool_call arrives before grok finalizes `kind`.
    const isSearch =
      kind === "search" || /\b(grep|glob|ripgrep|search_files|web_search|search_web)\b/i.test(name);

    let target = "";
    if (isSearch && pattern) {
      target = clamp(pattern);
    } else if (url) {
      target = clamp(url.replace(/^https?:\/\//i, ""));
    } else if (filePath) {
      const isList = /^(list_dir|list_directory)$/.test(name) || verb === "List";
      const isRead = name === "read_file" || name === "file_read" || kind === "read";
      if (isList) {
        target = prettyDir(filePath);
      } else if (isRead && r.offset != null && r.limit != null) {
        const end = Number(r.offset) + Number(r.limit) - 1;
        target = `${prettyPath(filePath)} lines ${r.offset}-${end}`;
      } else {
        target = prettyPath(filePath);
      }
    } else if (command) {
      target = clamp(command);
    } else if (pattern) {
      target = clamp(pattern);
    }
    // Deliberately NO scrape of arbitrary rawInput values: that leaked raw regexes
    // and globs (e.g. "image_edit|/imagine") as bare labels. For a tool we didn't
    // predict, fall back to grok's own already-formatted title, which is safe and
    // human-readable, so the call still shows — just without a synthesized target.

    if (verb && target) return `${verb} ${target}`;
    if (verb) return verb;
    const title = (call.title || "").trim();
    if (title) return title.length > 50 ? title.slice(0, 47) + "…" : title;
    return name || "tool";
  }

  // Category icon for a tool row (lucide outline; sized + colored by CSS via
  // currentColor). One icon per row/group, picked by the strongest action present:
  // square-terminal (command/delete/generate/other) > pencil (edit/write) >
  // folder-search (search) > file (read) — so a Read+Generate batch reads as a
  // terminal action. Mirrors `toolKind`, the same signal the summary uses.
  const TOOL_ICON = {
    file: `<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    search: `<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v3.5"/><circle cx="16.5" cy="16.5" r="2.5"/><path d="M21 21l-1.6-1.6"/></svg>`,
    pencil: `<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="M15 5l4 4"/></svg>`,
    terminal: `<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7 11 2-2-2-2"/><path d="M11 13h4"/></svg>`,
  };
  function toolIconRank(call) {
    const k = toolKind(call);
    if (k === "execute" || k === "delete" || k === "fetch") return 4;
    if (k === "edit" || k === "write") return 3;
    if (k === "search") return 2;
    if (k === "read") return 1;
    if (/web.?search|web.?fetch|search_web/i.test(toolName(call))) return 2;
    return 4; // unpredicted tool → square-terminal catch-all
  }
  const TOOL_ICON_BY_RANK = { 1: TOOL_ICON.file, 2: TOOL_ICON.search, 3: TOOL_ICON.pencil, 4: TOOL_ICON.terminal };
  function toolIconFor(calls) {
    let rank = 1;
    for (const c of calls) rank = Math.max(rank, toolIconRank(c));
    return TOOL_ICON_BY_RANK[rank];
  }

  // ---------- activity carousel ----------
  // One compact block per turn segment collects tool groups, thinking, and step
  // narration into a single live strip under the active turn's `.turn-activity`.
  // Live: CURRENT action + dots + step counter, ‹ › peek, chevron for detail.
  // On segment break or turn seal (finalizeActivity) the block is DESTROYED —
  // intermediate work is ephemeral; only the turn's prompt + final answer remain.
  // Interactive cards / deliverables never enter the block; they call
  // finalizeActivity first. Gated by grok.compactActivity (default on): when off,
  // ensureActivityBlock returns null and tools render classic under activityParent.

  function activityBody(el) {
    return el.querySelector(".activity-body");
  }

  function ensureActivityBlock() {
    if (!state.compactActivity) return null;
    if (state.activeActivityEl) return state.activeActivityEl;
    clearWelcome();
    // Prefer nesting under an open turn; tools without a user bubble (tests /
    // edge paths) still mount on #messages via activityParent().
    if (!state.activeTurnEl) {
      // Keep a lightweight turn so sticky/collapse still have a home when the
      // first content is agent-side after a live userMessage race.
    }
    const el = document.createElement("div");
    el.className = "activity-carousel live";
    el._steps = [];
    el._allCalls = [];
    el._view = -1; // -1 = live (strip follows the latest step)
    const strip = document.createElement("div");
    strip.className = "activity-strip";
    strip.innerHTML =
      `<span class="activity-icon">${ICON.grok}</span>` +
      `<span class="activity-label"></span>` +
      `<span class="tool-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>` +
      `<span class="activity-nav">` +
      `<button class="activity-nav-btn activity-prev" type="button" title="Previous step" aria-label="Previous step">‹</button>` +
      `<span class="activity-pos"></span>` +
      `<button class="activity-nav-btn activity-next" type="button" title="Next step" aria-label="Next step">›</button>` +
      `</span>` +
      `<span class="tool-chevron" aria-hidden="true">›</span>`;
    const body = document.createElement("div");
    body.className = "activity-body";
    // Opted-in thinking traces stream visibly: start expanded so the detail
    // scrolls inside the bounded body instead of hiding behind a click.
    body.hidden = !state.showThinking;
    el.classList.toggle("expanded", !body.hidden);
    el.appendChild(strip);
    el.appendChild(body);
    strip.onclick = () => {
      body.hidden = !body.hidden;
      el.classList.toggle("expanded", !body.hidden);
      if (!body.hidden) body.scrollTop = body.scrollHeight;
    };
    strip.querySelector(".activity-prev").onclick = (e) => { e.stopPropagation(); stepActivityView(el, -1); };
    strip.querySelector(".activity-next").onclick = (e) => { e.stopPropagation(); stepActivityView(el, 1); };
    activityParent().appendChild(el);
    state.activeActivityEl = el;
    renderActivityStrip(el, false);
    scrollToBottom();
    return el;
  }

  function stepActivityView(el, dir) {
    el._view = activityPeek(el._view, el._steps.length, dir);
    renderActivityStrip(el, false);
  }

  function renderActivityStrip(el, animate) {
    const steps = el._steps || [];
    const labelEl = el.querySelector(".activity-label");
    const iconEl = el.querySelector(".activity-icon");
    const posEl = el.querySelector(".activity-pos");
    const idx = el._view === -1 ? steps.length - 1 : el._view;
    const cur = steps[idx];
    labelEl.textContent = cur ? cur.label : "Working";
    iconEl.innerHTML = (cur && cur.icon) || ICON.grok;
    if (posEl) posEl.textContent = activityPosText(el._view, steps.length);
    el.classList.toggle("peeking", el._view !== -1);
    if (animate && !state.replaying) {
      labelEl.classList.remove("activity-label-anim");
      void labelEl.offsetWidth; // restart the slide-in
      labelEl.classList.add("activity-label-anim");
    }
  }

  // Record one carousel step (a tool call, a thought starting, or a narration
  // bubble folding in) and refresh the strip — following the newest step unless
  // the user is peeking back through earlier ones.
  function activityStep(label, iconHtml) {
    const el = state.activeActivityEl;
    if (!el) return;
    el._steps.push({ label, icon: iconHtml });
    renderActivityStrip(el, el._view === -1);
    const body = activityBody(el);
    if (!body.hidden) body.scrollTop = body.scrollHeight; // follow while expanded
  }

  // Destroy the live activity block at a boundary (turn seal, interactive card,
  // deliverable, error, classic-mode flip). Intermediate work is ephemeral —
  // never freeze a permanent `.done` summary into the transcript. Classic mode
  // has no carousel; closeToolGroup still runs so open groups don't leak.
  function finalizeActivity() {
    const el = state.activeActivityEl;
    closeToolGroup(); // an open group can't outlive its block / segment
    if (!el) return;
    state.activeActivityEl = null;
    clearToolMapsUnder(el);
    el.remove();
  }

  function closeToolGroup() {
    if (!state.activeToolGroupEl) return;
    const el = state.activeToolGroupEl;
    const calls = el._calls || [];

    // A lone edit/write is NOT flattened to a `.tool-flat` (icon + label only). That
    // flat row has no chevron and no body, so the diff preview ("N → M lines" +
    // "open diff →") — which attachDiffPreviewToToolItem appends to the tool-item in
    // the body — would be discarded and the message couldn't be expanded to review
    // the change (#30). On restore it's worse: renderRestoredPermissionForTool closes
    // the group BEFORE the toolCallUpdate carrying the diff arrives, so the preview
    // would attach to an orphaned node. Keeping the group (chevron + body) makes a
    // single edit behave exactly like a multi-tool batch, which already works, in both
    // the live and replay orderings.
    //
    // Same reasoning for a lone command that produced scrollback: its "show output"
    // toggle lives on the tool-item, so flattening would drop it. Keep those as a
    // group too (a command with no output still flattens to a clean single row).
    const lone = calls[0];
    const loneItem = calls.length === 1 && lone.toolCallId && state.toolItemsByToolCallId.get(lone.toolCallId);
    const loneHasOutput = loneItem && loneItem.querySelector(".tool-output-toggle");
    if (calls.length === 1 && categorize(lone) !== "edit" && !loneHasOutput) {
      const flat = document.createElement("div");
      flat.className = "tool-flat";
      flat.innerHTML = toolIconFor(calls); // icon first
      const lbl = document.createElement("span");
      lbl.className = "tool-label";
      lbl.textContent = toolLabel(calls[0]);
      flat.appendChild(lbl);
      el.replaceWith(flat);
      const fail = calls[0].toolCallId && state.toolFailuresById.get(calls[0].toolCallId);
      if (fail) applyToolFailure(flat, fail); // a single tool that failed carries its error
    } else {
      el.classList.remove("in-progress");
      const hdr = el.querySelector(".tool-group-header");
      hdr.querySelector(".tool-group-label").textContent = summarizeTools(calls);
    }
    state.activeToolGroupEl = null;
  }

  function addToToolGroup(call) {
    clearWelcome();
    hideGrokking(); // a tool card is the first content of this turn
    hideThinkingIndicator(); // a running tool now conveys the activity
    if (!state.activeToolGroupEl) {
      // Starting a fresh batch of tools after some agent narration: detach the
      // active agent bubble so the NEXT narration opens a new bubble *below* this
      // group, rather than coalescing back into the bubble above it. grok narrates
      // each step then runs its tools (narrate → tools → narrate → tools …); this
      // keeps that order so each summary sits under the sentence that introduced it
      // instead of all narration piling above N consecutive summaries. Flush first
      // — agent rendering is deferred to a rAF, so detaching without flushing would
      // discard the buffered narration (leaving an empty bubble).
      flushAgent();
      // Carousel mode: the narration bubble that introduced this batch folds
      // INTO the block as a step. It's step-by-step commentary, not the final
      // answer — the answer is never followed by tools, so it's never pulled.
      const act = state.compactActivity ? ensureActivityBlock() : null;
      if (act && state.activeAgentEl) {
        const narration = (state.activeAgentEl.textContent || "").trim();
        const bubble = state.activeAgentEl.closest(".msg");
        // Narration may live under .turn-answer (or legacy #messages).
        const bubbleParent = bubble && bubble.parentElement;
        const inAnswer = bubbleParent && (
          bubbleParent === messagesEl ||
          bubbleParent.classList.contains("turn-answer")
        );
        if (bubble && inAnswer) {
          // A whitespace-only bubble is moved too (tucked away beats an empty
          // transcript row) but records no step.
          activityBody(act).appendChild(bubble);
          if (narration) activityStep(truncate(narration, 60), ICON.grok);
        }
      }
      state.activeAgentEl = null;
      state.activeAgentRaw = "";
      const el = document.createElement("div");
      el.className = "tool-group in-progress";
      el._calls = [];
      const hdr = document.createElement("div");
      hdr.className = "tool-group-header";
      const body = document.createElement("div");
      body.className = "tool-group-body";
      body.hidden = true;
      el.appendChild(hdr);
      el.appendChild(body);
      (act ? activityBody(act) : activityParent()).appendChild(el);
      state.activeToolGroupEl = el;
    }

    const el = state.activeToolGroupEl;
    el._calls.push(call);
    const hdr = el.querySelector(".tool-group-header");
    const body = el.querySelector(".tool-group-body");

    const item = document.createElement("div");
    item.className = "tool-item";
    item.textContent = toolLabel(call);
    // Stamp the category from the tool_call (which carries kind/title). A later
    // tool_call_update often has neither, so re-categorizing the update would
    // wrongly bucket everything as "command"; readers key off this instead.
    item.dataset.toolCategory = categorize(call);
    // The exact ACP kind (not the coarser category above) — a permission
    // request for this SAME toolCallId carries no `kind` of its own for
    // Claude (see addPermissionCard's inferPermissionKind correlation).
    item.dataset.toolKind = toolKind(call);
    body.appendChild(item);
    if (call.toolCallId) state.toolItemsByToolCallId.set(call.toolCallId, item);

    // Carousel: every call is a step; the strip mirrors the newest action.
    if (state.activeActivityEl) {
      state.activeActivityEl._allCalls.push(call);
      activityStep(inProgressLabel(call), TOOL_ICON_BY_RANK[toolIconRank(call)]);
    }

    hdr.innerHTML =
      toolIconFor(el._calls) +
      `<span class="tool-group-label">${escapeHtml(inProgressLabel(call))}</span>` +
      `<span class="tool-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>` +
      `<span class="tool-chevron" aria-hidden="true">›</span>`;
    hdr.onclick = () => {
      const expanded = !body.hidden;
      body.hidden = expanded;
      el.classList.toggle("expanded", !expanded);
    };
    scrollToBottom();
  }

  // ---------- inline diff (rendered in the chat, never a separate editor tab) ----------
  // A diff must never open its own editor tab: the auto-opened tab covered the
  // chat webview, whose reveal-replay re-rendered the pending permission card
  // and re-opened the tab — a focus-stealing loop (closing the diff revealed
  // the chat, which replayed, which reopened the diff). Rendering the diff
  // inside the chat tab has no host side effect, so replay is harmless.

  const DIFF_CONTEXT_LINES = 3; // unchanged lines kept visible around each hunk
  const DIFF_MAX_RENDERED = 800; // hard cap on rendered rows per diff

  function diffLineEl(row) {
    const line = document.createElement("div");
    line.className = "diff-line " + row.type;
    line.textContent = row.text || " "; // a space keeps empty lines from collapsing
    return line;
  }

  // Build the scrollable diff block from an edit's { path, oldText, newText }.
  // Long unchanged runs collapse to a clickable "N unchanged lines" gap.
  function renderInlineDiff(diff) {
    const rows = computeLineDiff(diff.oldText, diff.newText);
    const wrap = document.createElement("div");
    wrap.className = "inline-diff";
    let rendered = 0;
    let truncated = 0;
    const pushRow = (row) => {
      if (rendered >= DIFF_MAX_RENDERED) {
        truncated++;
        return;
      }
      rendered++;
      wrap.appendChild(diffLineEl(row));
    };
    const pushGap = (hiddenRows) => {
      const gap = document.createElement("button");
      gap.className = "diff-gap";
      gap.textContent = `⋯ ${hiddenRows.length} unchanged lines ⋯`;
      gap.onclick = (e) => {
        e.stopPropagation(); // don't toggle the enclosing tool group
        const frag = document.createDocumentFragment();
        for (const r of hiddenRows) frag.appendChild(diffLineEl(r));
        gap.replaceWith(frag);
      };
      wrap.appendChild(gap);
    };
    let i = 0;
    while (i < rows.length) {
      if (rows[i].type !== "same") {
        pushRow(rows[i]);
        i++;
        continue;
      }
      let j = i;
      while (j < rows.length && rows[j].type === "same") j++;
      const run = rows.slice(i, j);
      // Context is only useful next to a change: the leading run needs no head,
      // the trailing run no tail.
      const head = i === 0 ? 0 : DIFF_CONTEXT_LINES;
      const tail = j === rows.length ? 0 : DIFF_CONTEXT_LINES;
      if (run.length > head + tail + 1) {
        run.slice(0, head).forEach(pushRow);
        pushGap(run.slice(head, run.length - tail));
        run.slice(run.length - tail).forEach(pushRow);
      } else {
        run.forEach(pushRow);
      }
      i = j;
    }
    if (truncated > 0) {
      const note = document.createElement("div");
      note.className = "diff-gap diff-truncated";
      note.textContent = `… ${truncated} more lines (diff truncated)`;
      wrap.appendChild(note);
    }
    return wrap;
  }

  function attachDiffPreviewToToolItem(toolCallId, diff) {
    const item = state.toolItemsByToolCallId.get(toolCallId);
    if (!item || item.querySelector(".preview-link")) return; // already attached
    const oldLines = (diff.oldText || "").split("\n").length;
    const newLines = (diff.newText || "").split("\n").length;
    const sub = document.createElement("div");
    sub.className = "tool-item-subtitle";
    sub.textContent = `${oldLines} → ${newLines} lines`;
    item.appendChild(sub);
    const preview = document.createElement("button");
    preview.className = "preview-link";
    preview.textContent = "view diff";
    let diffEl = null; // built lazily on first view
    preview.onclick = (e) => {
      e.stopPropagation(); // don't toggle the tool-group expand/collapse
      if (!diffEl) {
        diffEl = renderInlineDiff(diff);
        diffEl.classList.add("tool-item-diff");
        item.appendChild(diffEl);
      } else {
        diffEl.hidden = !diffEl.hidden;
      }
      preview.textContent = diffEl.hidden ? "view diff" : "hide diff";
    };
    item.appendChild(preview);
    scrollToBottom();
  }

  // Extract any `type:"diff"` blocks from a tool call's `content` and attach the
  // "N → M lines" + "open diff →" preview. grok delivers the diff differently by
  // path: LIVE it rides a `tool_call_update` (the `tool_call` is a bare
  // "StrReplace" with no content), but on session/load REPLAY the whole edit
  // collapses into a single completed `tool_call` that carries the diff itself —
  // there is no separate update. So this must run for BOTH message kinds, else a
  // restored edit shows an expandable group with no diff inside it (#30).
  function applyToolDiffs(call) {
    const c = call?.content;
    if (!Array.isArray(c)) return;
    for (const item of c) {
      if (item?.type === "diff") {
        const diff = { path: item.path, oldText: item.oldText ?? "", newText: item.newText ?? "" };
        state.pendingDiffByToolCallId.set(call.toolCallId, diff);
        attachDiffPreviewToToolItem(call.toolCallId, diff);
        recordChangedFile(call.toolCallId, diff);
      }
    }
  }

  // ---------- changed-files strip (this turn's applied edits, above the composer) ----------
  // A scannable "N files changed" chip row so you can see a turn's impact without
  // scrolling the chat. It reflects APPLIED edits only: grok emits the diff when it
  // performs the write, so a file lands here from applyToolDiffs; a plan-gate-blocked
  // write later fails (markToolFailed → forgetChangedFile), so it never sticks.
  // Skipped during replay (restored history isn't "this turn"); cleared on the next
  // user message. The inline per-file diffs stay the source of truth — this is a
  // summary, so the chip just opens the file.
  function baseNameOf(p) {
    return String(p || "").split(/[\\/]/).filter(Boolean).pop() || String(p || "");
  }

  function countDiffLines(diff) {
    let adds = 0, dels = 0;
    for (const row of computeLineDiff(diff.oldText || "", diff.newText || "")) {
      if (row.type === "add") adds++;
      else if (row.type === "del") dels++;
    }
    return { adds, dels };
  }

  function recordChangedFile(toolCallId, diff) {
    if (!toolCallId || state.replaying || !diff || !diff.path) return;
    const { adds, dels } = countDiffLines(diff);
    state.changedFiles.set(toolCallId, { path: diff.path, adds, dels });
    renderChangedFilesStrip();
  }

  function forgetChangedFile(toolCallId) {
    if (toolCallId && state.changedFiles.delete(toolCallId)) renderChangedFilesStrip();
  }

  function clearChangedFiles() {
    if (!state.changedFiles.size) return;
    state.changedFiles.clear();
    renderChangedFilesStrip();
  }

  function renderChangedFilesStrip() {
    if (!changedFilesEl) return;
    // Storage is per toolCallId (for fail/forget). Display is one chip per path with
    // summed metrics so multi-edit of the same file does not repeat the name.
    const byPath = new Map();
    for (const entry of state.changedFiles.values()) {
      const prev = byPath.get(entry.path);
      if (prev) {
        prev.adds += entry.adds;
        prev.dels += entry.dels;
      } else {
        byPath.set(entry.path, { path: entry.path, adds: entry.adds, dels: entry.dels });
      }
    }
    const files = [...byPath.values()];
    if (!files.length) { changedFilesEl.hidden = true; changedFilesEl.innerHTML = ""; return; }
    changedFilesEl.innerHTML = "";
    const label = document.createElement("span");
    label.className = "changed-files-label";
    label.textContent = files.length === 1 ? "1 file changed" : `${files.length} files changed`;
    changedFilesEl.appendChild(label);
    for (const f of files) {
      const chip = document.createElement("button");
      chip.className = "changed-file-chip";
      chip.type = "button";
      chip.title = `${f.path} — open`;
      const name = document.createElement("span");
      name.className = "changed-file-name";
      name.textContent = baseNameOf(f.path);
      chip.appendChild(name);
      if (f.adds) {
        const a = document.createElement("span");
        a.className = "changed-file-add";
        a.textContent = `+${f.adds}`;
        chip.appendChild(a);
      }
      if (f.dels) {
        const d = document.createElement("span");
        d.className = "changed-file-del";
        d.textContent = `−${f.dels}`;
        chip.appendChild(d);
      }
      chip.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ type: "openFile", path: f.path }); };
      changedFilesEl.appendChild(chip);
    }
    changedFilesEl.hidden = false;
  }

  // Command tool rows summarize as "Ran `npm test`" but drop the stdout/stderr —
  // when the group is collapsed you approved a command and never saw what it
  // printed. Attach a lazy "show output" toggle (+ copy) with a scrollable
  // monospace scrollback so the "what did it actually print?" gap closes without
  // cluttering the default view. Only for command/execute rows: reads show their
  // filename (open the file for content) and edits already get a diff preview.
  const TOOL_OUTPUT_MAX_CHARS = 40000; // hard cap on rendered scrollback per row

  function attachOutputToToolItem(toolCallId, output) {
    if (!toolCallId) return;
    const item = state.toolItemsByToolCallId.get(toolCallId);
    if (!item || item.querySelector(".tool-output-toggle")) return; // once per row
    const text = String(output == null ? "" : output);
    if (!text.trim()) return;

    const toggle = document.createElement("button");
    toggle.className = "preview-link tool-output-toggle";
    toggle.textContent = "show output";

    const copyBtn = document.createElement("button");
    copyBtn.className = "preview-link tool-output-copy";
    copyBtn.textContent = "copy";
    copyBtn.hidden = true; // revealed with the output
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = "copied";
        setTimeout(() => { copyBtn.textContent = "copy"; }, 1500);
      });
    };

    let pre = null; // built lazily on first reveal
    toggle.onclick = (e) => {
      e.stopPropagation(); // don't toggle the surrounding tool-group
      if (!pre) {
        pre = document.createElement("pre");
        pre.className = "tool-output";
        pre.textContent = text.length > TOOL_OUTPUT_MAX_CHARS
          ? text.slice(0, TOOL_OUTPUT_MAX_CHARS) + "\n… (output truncated — use copy for the full text)"
          : text;
        item.appendChild(pre);
      } else {
        pre.hidden = !pre.hidden;
      }
      const open = !pre.hidden;
      toggle.textContent = open ? "hide output" : "show output";
      copyBtn.hidden = !open;
      if (open) scrollToBottom();
    };
    item.appendChild(toggle);
    item.appendChild(copyBtn);
  }

  // Attach the command scrollback from a (live or replayed) tool call's text
  // content. Runs for both `tool_call` and `tool_call_update` — like applyToolDiffs,
  // grok delivers command output on the update LIVE but folds it into a single
  // completed `tool_call` on session/load replay. Category comes from the row's
  // stored tool_call kind (the update usually has none), so only true execute rows
  // get an output panel — a read's completion content is its file, not scrollback.
  function applyToolOutput(call) {
    if (!call || !call.toolCallId) return;
    const item = state.toolItemsByToolCallId.get(call.toolCallId);
    if (!item || item.dataset.toolCategory !== "command") return;
    const out = toolUpdateText(call);
    if (out) attachOutputToToolItem(call.toolCallId, out);
  }

  // Render a tool failure on its row: the row goes error-colored and the reason
  // (grok's "image reference not readable: …" etc.) shows beneath it. Idempotent.
  function applyToolFailure(rowEl, message) {
    if (!rowEl || rowEl.classList.contains("tool-failed")) return;
    rowEl.classList.add("tool-failed");
    const err = document.createElement("div");
    err.className = "tool-error";
    err.textContent = message;
    rowEl.appendChild(err);
  }

  function markToolFailed(toolCallId, message) {
    if (!toolCallId) return;
    forgetChangedFile(toolCallId); // a blocked/failed write didn't land — drop it from the strip
    state.toolFailuresById.set(toolCallId, message); // so a single-call group carries it onto the flat
    const item = state.toolItemsByToolCallId.get(toolCallId);
    if (item) {
      applyToolFailure(item, message);
      const group = item.closest && item.closest(".tool-group");
      if (group) group.classList.add("has-error"); // collapsed group still signals the failure
      const act = item.closest && item.closest(".activity-carousel");
      if (act) act.classList.add("has-error"); // strip tints too — visible while collapsed
      scrollToBottom();
    }
  }

  function addSessionContextBanner() {
    finalizeActivity(); // compaction boundary — freeze any live block first
    clearWelcome();
    const existing = document.getElementById("summarizing-indicator");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.className = "session-context-banner";
    el.textContent = "Context from previous session applied";
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function addError(text) {
    finalizeActivity(); // errors land below the work that led to them
    clearWelcome();
    const el = document.createElement("div");
    el.className = "msg error";
    el.textContent = text;
    appendOnTurnSurface(el);
    scrollToBottom();
  }

  // Hover actions for an inlined image/video, anchored top-right like the
  // code-block copy button: copy the on-disk path, or open it in VS Code. Both
  // are the only way to reach a *video's* file (its click drives playback
  // controls, so the click-to-open we give images can't apply there).
  function buildMediaActions(path) {
    const actions = document.createElement("div");
    actions.className = "generated-media-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "generated-media-btn";
    copyBtn.title = "Copy path";
    copyBtn.innerHTML = ICON.copy;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(path).then(() => {
        copyBtn.innerHTML = ICON.check;
        copyBtn.classList.add("copied");
        setTimeout(() => { copyBtn.innerHTML = ICON.copy; copyBtn.classList.remove("copied"); }, 1500);
      });
    };

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "generated-media-btn";
    openBtn.title = "Open in VS Code";
    openBtn.innerHTML = ICON.file;
    openBtn.onclick = (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: "openFile", path });
    };

    actions.appendChild(copyBtn);
    actions.appendChild(openBtn);
    return actions;
  }

  // Labels for business-document result cards (host sends pure kind strings).
  const BUSINESS_DOC_LABELS = {
    word: "Word",
    excel: "Excel",
    powerpoint: "PowerPoint",
    pdf: "PDF",
    csv: "CSV",
    markdown: "Markdown",
    text: "Text",
  };

  /**
   * Result card when Grok produces a business/office file (.docx, .xlsx, …).
   * Not a preview — filename + kind + Copy / Open / Reveal actions (mirrors
   * media action affordances, tool-row chrome). Buffered via host `emit`.
   */
  function addDocumentCard(msg) {
    if (state.suppressReplayTurn) return;
    closeToolGroup();
    finalizeActivity(); // a deliverable stays visible — break the segment
    clearWelcome();
    hideGrokking();
    const kind = msg.kind || "text";
    const label = BUSINESS_DOC_LABELS[kind] || "Document";
    const name = msg.name || (msg.path ? String(msg.path).replace(/^.*[\\/]/, "") : "document");
    const filePath = msg.path || "";

    const el = document.createElement("div");
    el.className = "document-card";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", `${label} document ${name}`);
    el.title = filePath;

    const kindEl = document.createElement("span");
    kindEl.className = "document-card-kind";
    kindEl.textContent = label;

    const nameEl = document.createElement("span");
    nameEl.className = "document-card-name";
    nameEl.textContent = name;

    const actions = document.createElement("div");
    actions.className = "document-card-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "document-card-btn";
    copyBtn.setAttribute("aria-label", "Copy path");
    copyBtn.title = "Copy path";
    copyBtn.innerHTML = ICON.copy;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      if (!filePath) return;
      navigator.clipboard.writeText(filePath).then(() => {
        copyBtn.innerHTML = ICON.check;
        copyBtn.classList.add("copied");
        setTimeout(() => { copyBtn.innerHTML = ICON.copy; copyBtn.classList.remove("copied"); }, 1500);
      });
    };

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "document-card-btn";
    openBtn.setAttribute("aria-label", "Open document");
    openBtn.title = "Open";
    openBtn.innerHTML = ICON.file;
    openBtn.onclick = (e) => {
      e.stopPropagation();
      if (filePath) vscode.postMessage({ type: "openFile", path: filePath });
    };

    const revealBtn = document.createElement("button");
    revealBtn.type = "button";
    revealBtn.className = "document-card-btn";
    revealBtn.setAttribute("aria-label", "Reveal in file explorer");
    revealBtn.title = "Reveal in file explorer";
    revealBtn.innerHTML = ICON.folderOpen;
    revealBtn.onclick = (e) => {
      e.stopPropagation();
      if (filePath) vscode.postMessage({ type: "revealInOs", path: filePath });
    };

    actions.appendChild(copyBtn);
    actions.appendChild(openBtn);
    actions.appendChild(revealBtn);

    el.appendChild(kindEl);
    el.appendChild(nameEl);
    el.appendChild(actions);
    // Deliverable — part of the final answer surface, not ephemeral activity.
    answerParent().appendChild(el);
    scrollToBottom();
  }

  // Render generated media (grok `/imagine` image or `/imagine-video` video).
  // `src` is a renderable source the host resolved for a generated file — a
  // webview URI streamed from disk (big videos) or a base64 data: URI; `url` is
  // a remote link we open externally. Clicking an image opens its source file in
  // VS Code; video gets native <video> controls. Both expose hover icons (copy
  // path / open in VS Code) over the top-right corner.
  function addGeneratedMedia(msg) {
    if (state.suppressReplayTurn) return;
    const isVideo = msg.media === "video";
    closeToolGroup();
    finalizeActivity(); // a deliverable stays visible — break the segment
    clearWelcome();
    hideGrokking();
    const el = document.createElement("div");
    el.className = "generated-image" + (isVideo ? " generated-video" : "");
    if (msg.src) {
      if (isVideo) {
        const video = document.createElement("video");
        video.src = msg.src;
        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;
        el.appendChild(video);
      } else {
        const img = document.createElement("img");
        img.src = msg.src;
        img.alt = "Generated image";
        img.loading = "lazy";
        if (msg.path) {
          img.title = "Open " + msg.path;
          img.style.cursor = "pointer";
          img.onclick = () => vscode.postMessage({ type: "openFile", path: msg.path });
        }
        el.appendChild(img);
      }
      if (msg.path) el.appendChild(buildMediaActions(msg.path));
    } else if (msg.url) {
      const link = document.createElement("button");
      link.className = "preview-link";
      link.textContent = isVideo ? "open generated video ↗" : "open generated image ↗";
      link.onclick = () => vscode.postMessage({ type: "openUrl", url: msg.url });
      el.appendChild(link);
    }
    answerParent().appendChild(el);
    scrollToBottom();
  }

  // Distinct card for a subagent tool call (grok's parallel-subagent feature),
  // so delegated work reads as "Subagent: <type>" instead of disappearing into
  // the generic tool group. Collapsed scaffold — child-call nesting awaits a
  // probe of the live subagent wire shape (research/subagents.md).
  function addSubagentCard(call) {
    closeToolGroup();
    finalizeActivity(); // the delegation card stays visible — break the segment
    clearWelcome();
    hideGrokking();
    const el = document.createElement("div");
    el.className = "subagent-card";
    const label = escapeHtml(subagentLabel(call));
    el.innerHTML =
      `<span class="subagent-badge">${ICON.listTree || "🤖"}</span>` +
      `<span class="subagent-label">Subagent: ${label}</span>`;
    appendOnTurnSurface(el);
    scrollToBottom();
  }

  function addPlanNotice(text) {
    finalizeActivity(); // the notice must land below the work it interrupts
    clearWelcome();
    hideGrokking();
    const el = document.createElement("div");
    el.className = "plan-notice";
    el.innerHTML = `${ICON.listTree}<span>${escapeHtml(text)}</span>`;
    appendOnTurnSurface(el);
    scrollToBottom();
  }

  function appendThought(text) {
    if (state.suppressReplayTurn) return; // thinking inside the primer turn
    hidePlanProcessing(); // thought streaming → indicator obsolete
    hideGrokking(); // real content arrived — the Thinking block takes over
    // Traces hidden (the default): stand in with a "Thinking…" row — except in
    // carousel mode, where the block's strip IS the indicator (the thought below
    // creates the block, whose strip shows "Thinking" + dots).
    if (!state.compactActivity && !state.showThinking && !state.replaying) showThinkingIndicator();
    state.activeUserEl = null;
    state.skipUserBubble = false; // marker-only verdict turn is over
    clearWelcome();
    if (!state.activeThoughtEl) {
      if (!state.thoughtStartTime) state.thoughtStartTime = Date.now();
      state.thoughtBuffer = "";
      const el = document.createElement("div");
      el.className = "msg thinking";
      const hdr = document.createElement("div");
      hdr.className = "thinking-header";
      // Chevron on the RIGHT (after the label), same glyph as tool groups; expand
      // state is driven by the `.expanded` class (CSS rotates it), like tools.
      hdr.innerHTML = `<span class="thinking-icon">${ICON.grok}</span><span class="thinking-label">Thinking</span>${BLINK_DOTS}<span class="thinking-chevron" aria-hidden="true">›</span>`;
      const body = document.createElement("div");
      body.className = "thinking-body";
      body.hidden = true;
      hdr.onclick = () => {
        body.hidden = !body.hidden;
        el.classList.toggle("expanded", !body.hidden);
      };
      el.appendChild(hdr);
      el.appendChild(body);
      const act = state.compactActivity ? ensureActivityBlock() : null;
      (act ? activityBody(act) : activityParent()).appendChild(el);
      if (act) activityStep("Thinking", ICON.grok);
      state.activeThoughtEl = body;
      state.activeThoughtHdrEl = hdr;
    }
    state.thoughtBuffer += text;
    if (!state.thoughtRenderScheduled) {
      state.thoughtRenderScheduled = true;
      requestAnimationFrame(flushThought);
    }
  }

  function flushThought() {
    state.thoughtRenderScheduled = false;
    if (!state.activeThoughtEl) return;
    state.activeThoughtEl.textContent = state.thoughtBuffer;
    scrollToBottom();
  }

  function appendAgent(text) {
    if (state.suppressReplayTurn) return; // grok's response to the primer
    hidePlanProcessing(); // agent output started — clear the indicator
    hideGrokking(); // real content arrived — the message bubble takes over
    hideThinkingIndicator(); // a real message replaces the "Thinking…" stand-in
    state.activeUserEl = null;
    state.skipUserBubble = false; // marker-only verdict turn is over
    closeToolGroup();
    clearWelcome();
    if (!state.activeAgentEl) {
      state.activeAgentEl = addMessage("agent", "");
      state.activeAgentRaw = "";
    }
    state.activeAgentRaw += text;
    if (!state.agentRenderScheduled) {
      state.agentRenderScheduled = true;
      requestAnimationFrame(flushAgent);
    }
  }

  function flushAgent() {
    state.agentRenderScheduled = false;
    if (!state.activeAgentEl) return;
    state.activeAgentEl.innerHTML = renderMarkdown(state.activeAgentRaw);
    renderMermaidIn(state.activeAgentEl);
    const wrapper = state.activeAgentEl.parentElement;
    if (wrapper) wrapper._copyText = state.activeAgentRaw;
    scrollToBottom();
  }

  // Finalize the current agent turn (flush buffers, destroy intermediate
  // activity) and clear active-element handles so the next chunk starts a
  // fresh bubble. Used on promptComplete and at the user-message boundary
  // while replaying. Leaves the turn container open (prompt + answer); the
  // next userMessage collapses it via openTurn.
  function commitAgentTurn() {
    flushAgent();
    flushThought();
    if (state.thoughtStartTime && state.activeThoughtHdrEl) {
      // Drop the blink-dots once the reasoning settles, and label it. Replayed
      // turns have no real elapsed time, so they omit the seconds.
      const dots = state.activeThoughtHdrEl.querySelector(".blink-dots");
      if (dots) dots.remove();
      const label = state.activeThoughtHdrEl.querySelector(".thinking-label");
      if (label) {
        label.textContent = state.replaying
          ? "Thought"
          : `Thought for ${Math.round((Date.now() - state.thoughtStartTime) / 1000)}s`;
      }
      state.thoughtStartTime = null;
    }
    closeToolGroup();
    // Classic mode: tools sit under activityParent without a carousel — strip them.
    if (!state.compactActivity) {
      const actReg = turnActivityRegion(state.activeTurnEl);
      if (actReg) {
        clearToolMapsUnder(actReg);
        actReg.innerHTML = "";
      } else {
        // No turn open (edge/tests): drop classic tool rows from the root stream.
        for (const n of [...messagesEl.querySelectorAll(":scope > .tool-group, :scope > .tool-flat, :scope > .msg.thinking, :scope > .thinking-indicator")]) {
          clearToolMapsUnder(n);
          n.remove();
        }
      }
    }
    finalizeActivity(); // destroy live carousel / intermediate
    if (state.activeTurnEl) destroyTurnIntermediate(state.activeTurnEl);
    hideThinkingIndicator();
    hideGrokking();
    state.activeAgentEl = null;
    state.activeAgentRaw = "";
    state.activeThoughtEl = null;
    state.activeThoughtHdrEl = null;
  }

  // Replayed user prompts (session/load) arrive as user_message_chunk updates.
  // Commit any in-flight agent turn first, then accumulate into one user bubble.
  function appendUserChunk(text) {
    // Replay-only: live user bubbles come from the optimistic `userMessage`
    // post. grok ≥0.2.33 echoes the live prompt back as a user_message_chunk;
    // the host already drops those, but guard here too so a stray live echo
    // can never double the bubble.
    if (!state.replaying) return;
    if (state.activeAgentEl || state.activeThoughtEl || state.activeToolGroupEl || state.activeActivityEl) {
      commitAgentTurn();
    }
    // No clearWelcome() here — the bubble path's addMessage() clears it. The
    // suppressed paths below (primer turn, system-reminder) must leave the
    // welcome up: a primer-only session's replay renders nothing, and hiding
    // the welcome for it left a completely blank chat. With the welcome kept,
    // an empty resumed session looks like a fresh one.
    if (!state.activeUserEl && !state.skipUserBubble) {
      // A new user message is starting. If we're replaying and this message is
      // the extension's primer, suppress it AND grok's response to it — both
      // are extension plumbing the user never typed, and we don't want them
      // surfacing as fake user bubbles on every session restore.
      if (state.replaying && PRIMER_PATTERN.test(text)) {
        state.suppressReplayTurn = true;
        return;
      }
      // Background-task notices the CLI injects as <system-reminder> user turns
      // are agent plumbing, not user content — never bubble them on restore.
      // Grok's reply to them still renders. (Live ones are already dropped by
      // the !replaying guard above; this covers the replayed copy.)
      if (SYSTEM_REMINDER_PATTERN.test(text)) {
        state.skipUserBubble = true;
        return;
      }
      state.suppressReplayTurn = false;
      // Drain saved plan cards that should appear BEFORE this user message — the
      // verdict message that resolved a plan is the boundary, so drain first even
      // for a marker-only verdict that itself renders no bubble.
      drainPlanHistory(state.userMsgCount);
      drainPermissionHistory(state.userMsgCount);
      if (state.replaying) {
        const mk = stripPlanMarker(text);
        if (mk.matched) {
          // A plan-verdict protocol message. Live never counted or showed a
          // marker-only verdict (e.g. plain "[Plan cancelled]"), so skip it here
          // too — both to hide the grok-only marker and to keep userMsgCount
          // aligned with the afterUserMessage positions the host persisted.
          if (!mk.rest.trim()) {
            state.skipUserBubble = true;
            return;
          }
          // Marker + comment: drop the marker, keep the user's words. Live
          // counted this (the comment), so we count it here too.
          text = mk.rest;
        }
      }
      state.userMsgCount += 1;
      state.activeUserEl = addMessage("user", "");
      state.activeUserRaw = "";
    }
    if (state.skipUserBubble) return; // marker-only verdict: no user bubble
    if (state.suppressReplayTurn) return; // still inside the primer's user message
    state.activeUserRaw += text;
    // The replayed prompt carries the <vscode-context> envelope we sent; strip it
    // back out so the bubble shows the user's own words + filename-only chips (with
    // the full path on hover), matching the live send — not the raw paths inline.
    const parsed = parseAttachmentContext(state.activeUserRaw);
    state.activeUserEl.innerHTML = renderMarkdown(parsed.body);
    if (parsed.files.length) {
      const chipsRow = document.createElement("div");
      chipsRow.className = "msg-chips";
      for (const f of parsed.files) chipsRow.appendChild(makeMsgChipTag(f));
      state.activeUserEl.appendChild(chipsRow);
    }
    if (state.activeTurnEl) setTurnSummary(state.activeTurnEl, parsed.body);
    scrollToBottom();
  }

  // Render and dequeue every saved plan whose `afterUserMessage` <= cutoff.
  // Plans without a saved position never drain here — they fall out at the end
  // of replay when we flush the rest of the queue.
  function drainPlanHistory(cutoff) {
    if (!state.planHistoryQueue.length) return;
    state.planHistoryQueue = state.planHistoryQueue.filter((p) => {
      if (typeof p.afterUserMessage === "number" && p.afterUserMessage <= cutoff) {
        addPlanHistoryCard(p.text, p.verdict, p.planPath, p.planName);
        return false;
      }
      return true;
    });
  }

  function flushPlanHistory() {
    if (!state.planHistoryQueue.length) return;
    for (const p of state.planHistoryQueue) addPlanHistoryCard(p.text, p.verdict, p.planPath, p.planName);
    state.planHistoryQueue = [];
  }

  // Render a restored permission card collapsed (no buttons) — the answer is
  // history. Reuses the live collapsed representation.
  function addRestoredPermissionCard(title, outcome) {
    clearWelcome();
    const el = document.createElement("div");
    collapsePermissionCard(el, outcome === "rejected" ? "reject_once" : "allow_once", title);
    appendOnTurnSurface(el);
    scrollToBottom();
  }

  // Render a restored permission card at the exact tool it gated, the moment that
  // tool replays — so it lands where it was answered, not at the turn boundary.
  // Matches by toolCallId when we have it, else by exact title (the card title IS
  // the tool's title, so an older entry saved without an id still anchors). The
  // real title arrives on the tool_call_update (the tool_call is often a generic
  // "Shell"/"Grep"), so this is called from both. Closing the open tool group
  // first mirrors the live commitAgentTurn.
  function renderRestoredPermissionForTool(toolCallId, title) {
    if (!state.permissionHistoryQueue.length) return;
    const matches = state.permissionHistoryQueue.filter((p) =>
      (toolCallId && p.toolCallId === toolCallId) ||
      (!p.toolCallId && title && p.title === title));
    if (!matches.length) return;
    const matched = new Set(matches);
    state.permissionHistoryQueue = state.permissionHistoryQueue.filter((p) => !matched.has(p));
    closeToolGroup();
    // Do not destroy the activity strip here — the restored card should sit
    // next to the tool it gated mid-replay. commitAgentTurn still seals and
    // removes intermediate tools when the turn ends.
    for (const p of matches) addRestoredPermissionCard(p.title, p.outcome);
  }

  // Fallback for entries WITHOUT a toolCallId (legacy/unmatchable): position by
  // user-message boundary like plans. Tool-anchored entries are handled inline.
  function drainPermissionHistory(cutoff) {
    if (!state.permissionHistoryQueue.length) return;
    state.permissionHistoryQueue = state.permissionHistoryQueue.filter((p) => {
      if (!p.toolCallId && typeof p.afterUserMessage === "number" && p.afterUserMessage <= cutoff) {
        addRestoredPermissionCard(p.title, p.outcome);
        return false;
      }
      return true;
    });
  }

  function flushPermissionHistory() {
    if (!state.permissionHistoryQueue.length) return;
    for (const p of state.permissionHistoryQueue) addRestoredPermissionCard(p.title, p.outcome);
    state.permissionHistoryQueue = [];
  }

  function showPlanProcessing() {
    hidePlanProcessing(); // dedupe
    hideGrokking(); // one waiting indicator at a time
    hideThinkingIndicator();
    clearWelcome();
    const el = document.createElement("div");
    el.className = "plan-processing";
    el.innerHTML = '<span class="plan-processing-dots"><span></span><span></span><span></span></span>';
    el.setAttribute("aria-label", "Grok is processing");
    messagesEl.appendChild(el);
    state.planProcessingEl = el;
    scrollToBottom();
  }

  function hidePlanProcessing() {
    if (state.planProcessingEl && state.planProcessingEl.parentElement) {
      state.planProcessingEl.parentElement.removeChild(state.planProcessingEl);
    }
    state.planProcessingEl = null;
  }

  // "Grokking…" — the generic waiting indicator shown on every user-initiated
  // turn from agentStart until grok produces its first content (thought /
  // message / tool / card), which removes it and renders in its place. Mirrors
  // the Thinking header's look (loading-dots ellipsis, same muted font) without
  // the chevron, and is not expandable. Mutually exclusive with planProcessing.
  function showGrokking() {
    hideGrokking(); // dedupe
    hidePlanProcessing(); // one waiting indicator at a time
    hideThinkingIndicator();
    clearWelcome();
    const el = document.createElement("div");
    el.className = "grokking";
    // No blink-dots here — the spinning orbit icon is Grokking's "waiting" motion
    // (Thinking / tools use the dots for discrete progress instead).
    el.innerHTML = `<span class="grokking-icon">${ICON.orbit}</span><span class="grokking-label">Grokking</span>`;
    el.setAttribute("aria-label", "Grok is working");
    activityParent().appendChild(el);
    state.grokkingEl = el;
    scrollToBottom();
  }

  function hideGrokking() {
    if (state.grokkingEl && state.grokkingEl.parentElement) {
      state.grokkingEl.parentElement.removeChild(state.grokkingEl);
    }
    state.grokkingEl = null;
  }

  // "Thinking…" — the stand-in shown while thinking traces are hidden (#26, the
  // default). grok's thought stream is suppressed from view, so this lightweight
  // row signals it's reasoning — but only when nothing else already conveys work
  // (no running tool group, no Grokking). Styled like a tool row: Grok icon +
  // muted label + animated loading-dots. Stable while thoughts stream; removed
  // the moment a tool, agent message, or turn-end takes over.
  function showThinkingIndicator() {
    if (state.thinkingIndicatorEl) return; // already up — keep it stable
    if (state.activeToolGroupEl) return; // a running tool already indicates work
    hideGrokking();
    hidePlanProcessing();
    clearWelcome();
    const el = document.createElement("div");
    el.className = "thinking-indicator";
    el.innerHTML = `<span class="thinking-indicator-icon">${ICON.grok}</span><span class="thinking-indicator-label">Thinking</span>${BLINK_DOTS}`;
    el.setAttribute("aria-label", "Grok is thinking");
    activityParent().appendChild(el);
    state.thinkingIndicatorEl = el;
    scrollToBottom();
  }

  function hideThinkingIndicator() {
    if (state.thinkingIndicatorEl && state.thinkingIndicatorEl.parentElement) {
      state.thinkingIndicatorEl.parentElement.removeChild(state.thinkingIndicatorEl);
    }
    state.thinkingIndicatorEl = null;
  }

  // Apply the show/hide-thinking setting. A single body class hides every
  // `.msg.thinking` block at once — so it covers replayed/old sessions too and
  // toggling is instant with no reload — and turning traces back on drops the
  // stand-in indicator.
  function applyThinkingVisibility() {
    document.body.classList.toggle("thinking-hidden", !state.showThinking);
    if (state.showThinking) hideThinkingIndicator();
  }

  // True when *something* already tells the user grok is mid-work or awaiting
  // them: a waiting indicator, a running tool group, streaming agent text, a
  // visible thinking block (only counts when traces are shown — hidden ones are
  // display:none), or an open permission/question/plan card.
  function turnHasVisibleActivity() {
    return !!(
      state.grokkingEl ||
      state.thinkingIndicatorEl ||
      state.planProcessingEl ||
      state.activeToolGroupEl ||
      state.activeActivityEl || // live carousel strip (dots + current action)
      (state.activeAgentEl && (state.activeAgentRaw || "").trim()) ||
      (state.showThinking && state.activeThoughtEl) ||
      messagesEl.querySelector(".card:not(.resolved)")
    );
  }

  // Guarantee a live turn never looks idle: while the user's turn is in flight
  // (busy, not the locked priming window, not replaying), at least one progress
  // affordance — Grokking / Tools / Thinking — must be on screen. If a step left
  // nothing visible, stand in with the generic "Grokking…"; the next real chunk
  // replaces it. Called after each mid-turn event the agent emits.
  function ensureActivityIndicator() {
    if (!state.busy || state.busyLocked || state.replaying) return;
    if (turnHasVisibleActivity()) return;
    showGrokking();
  }

  const clampScrollTop = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.clampScrollTop)
    || function (scrollTop, scrollHeight, clientHeight) {
      const max = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));
      const n = typeof scrollTop === "number" ? scrollTop : Number(scrollTop);
      if (!Number.isFinite(n) || n < 0) return 0;
      return n > max ? max : n;
    };

  // Report #messages pin + offset to the host so hide→reveal can restore.
  // Debounced while live; immediate flush on hide / force pin.
  let scrollStateTimer = null;
  function postScrollState(immediate) {
    if (state.panelReplaying || state.scrollStateSuppress) return;
    const send = () => {
      scrollStateTimer = null;
      if (state.panelReplaying || state.scrollStateSuppress) return;
      vscode.postMessage({
        type: "scrollState",
        stickToBottom: !!state.stickToBottom,
        scrollTop: messagesEl.scrollTop || 0,
      });
    };
    if (immediate) {
      if (scrollStateTimer) { clearTimeout(scrollStateTimer); scrollStateTimer = null; }
      send();
      return;
    }
    if (scrollStateTimer) clearTimeout(scrollStateTimer);
    scrollStateTimer = setTimeout(send, 80);
  }

  // Follow streaming output only while the user is pinned to the bottom. Once
  // they scroll up (the listener below clears state.stickToBottom) this becomes
  // a no-op, so they can read history while grok keeps thinking (#16).
  // Also a no-op during panel reveal rebuild so buffer replay cannot yank mid-scroll.
  function scrollToBottom() {
    if (state.panelReplaying) return;
    if (state.stickToBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // The floating "Scroll to bottom" button (#28) shows exactly when we've stopped
  // following the bottom — same threshold that gates auto-scroll, so it appears
  // the instant streaming output runs off-screen. It lives inside `.composer`
  // (position:absolute over the input), so it rides the chat's `--chat-zoom`
  // scale and stays pinned above the input area at any font scale.
  function updateScrollBtn() {
    scrollBottomBtn.classList.toggle("visible", !state.stickToBottom);
  }

  // Always pull the view to the bottom and re-pin. For interactive activity the
  // user needs to see regardless of where they've scrolled: permission/question
  // cards and their own just-sent message. Suppressed during panel rebuild —
  // buffered userMessage/permission cards must not re-pin before end restore.
  function forceScrollToBottom() {
    if (state.panelReplaying) return;
    state.stickToBottom = true;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    updateScrollBtn();
    postScrollState(true);
  }

  // While a click-triggered smooth scroll is animating, the intermediate scroll
  // events would briefly re-show the button; suppress recompute until we land.
  let autoScrolling = false;
  messagesEl.addEventListener("scroll", () => {
    if (autoScrolling) {
      if (messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 4) {
        autoScrolling = false;
      } else {
        return;
      }
    }
    if (state.panelReplaying || state.scrollStateSuppress) return;
    state.stickToBottom = shouldStickToBottom(
      messagesEl.scrollTop, messagesEl.scrollHeight, messagesEl.clientHeight);
    updateScrollBtn();
    postScrollState(false);
  });

  scrollBottomBtn.onclick = () => {
    autoScrolling = true;
    state.stickToBottom = true;
    updateScrollBtn();
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
    postScrollState(true);
  };

  function beginPanelReplay(restore) {
    state.panelReplaying = true;
    state.pendingRestore = restore === undefined ? null : restore;
    state.scrollStateSuppress = true;
  }

  function endPanelReplay() {
    const restore = state.pendingRestore;
    state.pendingRestore = null;
    // Apply restore while still panelReplaying so force/scroll paths stay gated.
    state.scrollStateSuppress = true;
    try {
      if (restore == null || restore.stickToBottom === true) {
        state.stickToBottom = true;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else {
        const top = clampScrollTop(
          restore.scrollTop,
          messagesEl.scrollHeight,
          messagesEl.clientHeight,
        );
        messagesEl.scrollTop = top;
        state.stickToBottom = shouldStickToBottom(
          messagesEl.scrollTop, messagesEl.scrollHeight, messagesEl.clientHeight);
      }
      updateScrollBtn();
    } finally {
      state.panelReplaying = false;
      // One authoritative host update after apply; then allow live posts again.
      state.scrollStateSuppress = false;
      postScrollState(true);
    }
  }

  // ---------- permission card ----------

  // Collapse verb/class — shared pure helpers so deny_* / reject_always match
  // reject_once (red "Rejected"), not green "Answered".
  const isRejectedPermissionKind = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.isRejectedPermissionKind)
    || function (kind) { return /reject|deny/i.test(String(kind || "")); };
  const permissionCollapseVerb = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.permissionCollapseVerb)
    || function (kind) {
      if (isRejectedPermissionKind(kind)) return "Rejected";
      if (/allow/i.test(String(kind || ""))) return "Allowed";
      return "Answered";
    };

  // Replace a permission card with a single muted, non-interactive line once the
  // user answers — same minimized treatment as a resolved question/plan card.
  // `kind` drives the colour; `title` says what it applied to.
  function collapsePermissionCard(el, kind, title) {
    el.className = "card permission resolved perm-resolved";
    el.innerHTML = "";
    const line = document.createElement("div");
    const rejected = isRejectedPermissionKind(kind);
    line.className = "perm-resolved-line perm-" + (rejected ? "rejected" : "allowed");
    const verb = document.createElement("span");
    verb.className = "perm-resolved-verb";
    verb.textContent = permissionCollapseVerb(kind);
    line.appendChild(verb);
    const what = document.createElement("span");
    what.className = "perm-resolved-what";
    what.textContent = title || "";
    line.appendChild(what);
    el.appendChild(line);
  }

  const inferPermissionKind = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.inferPermissionKind)
    || function (explicitKind) { return explicitKind || ""; };
  const permissionDiffFromRawInput = (window.GrokWebviewHelpers && window.GrokWebviewHelpers.permissionDiffFromRawInput)
    || function () { return null; };

  function addPermissionCard(req) {
    clearWelcome();
    hideGrokking();
    // Mirror the plan card: finalize any in-flight agent/thinking/tool turn so
    // grok's continuation after the answer renders BELOW this card, not appended
    // to the bubble that was streaming above it.
    commitAgentTurn();
    const toolCallId = req.toolCall?.toolCallId;
    // Claude's permission payload carries no `toolCall.kind` at all (only
    // {toolCallId, title, rawInput}) — correlate it from the tool_call this
    // same toolCallId already produced (item.dataset.toolKind, stamped by
    // addToToolGroup), falling back to inferring it from rawInput's shape.
    // See docs/plans/claude-code-backend.md § WP3.
    const seenItem = toolCallId && state.toolItemsByToolCallId.get(toolCallId);
    const seenKind = seenItem ? seenItem.dataset.toolKind : "";
    const kind = inferPermissionKind(req.toolCall?.kind, seenKind, req.toolCall?.rawInput);
    const cardTitle = req.toolCall?.title || `permission: ${kind || "tool"}`;
    const el = document.createElement("div");
    el.className = "card permission";
    // Tag the card so a buffered `permissionResolved` (replayed when this session
    // is re-focused) can find it and collapse it — the live collapse is a DOM-only
    // mutation that isn't in the session buffer, so without this an already-answered
    // card replays as active on every re-focus.
    el.dataset.permReqId = String(req.id);
    el._permOptions = req.options || [];
    el._permTitle = cardTitle;
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = cardTitle;
    el.appendChild(title);

    // Prefer a genuine structured diff already seen for this toolCallId (grok's
    // pending tool_call_update always carries one before the permission request
    // arrives); Claude's real diff hunks land on the COMPLETED update, which is
    // AFTER approval — so at this point there's usually nothing there for it.
    // Synthesize a preview from rawInput instead so the card isn't diff-less.
    const structuredDiff = toolCallId ? state.pendingDiffByToolCallId.get(toolCallId) : null;
    const syntheticDiff = structuredDiff ? null : permissionDiffFromRawInput(req.toolCall?.rawInput, kind);
    const diff = structuredDiff || syntheticDiff;
    if (diff) {
      const subtitle = document.createElement("div");
      subtitle.className = "card-subtitle";
      const oldLines = (diff.oldText || "").split("\n").length;
      const newLines = (diff.newText || "").split("\n").length;
      subtitle.textContent = `${diff.path} — ${oldLines} → ${newLines} lines`;
      el.appendChild(subtitle);
      // Phase A: label synthesized previews so users know this is agent input,
      // not a structured ACP diff (source-of-truth is synth path, not backend).
      if (syntheticDiff && !structuredDiff) {
        const note = document.createElement("div");
        note.className = "card-subtitle perm-preview-note";
        note.textContent = "Preview from agent input";
        el.appendChild(note);
      }

      // The diff renders inline in the card — reviewing an edit is one glance +
      // one click on the decision (#21) — and stays in this tab: an editor-tab
      // preview covered the chat webview and its reveal-replay reopened the tab
      // in a loop, so no host-side diff tab, ever.
      el.appendChild(renderInlineDiff(diff));
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";
    for (const opt of req.options || []) {
      const btn = document.createElement("button");
      // Plain-language labels for non-engineers; optionId/kind stay protocol-true.
      btn.textContent = permissionButtonLabel(opt);
      if (opt.kind === "allow_once") btn.classList.add("primary");
      if (opt.kind === "reject_once" || opt.kind === "reject_always" || /^deny/.test(String(opt.kind || ""))) {
        btn.classList.add("danger");
      }
      btn.onclick = () => {
        vscode.postMessage({
          type: "permissionAnswer",
          requestId: req.id,
          optionId: opt.optionId,
        });
        // Collapse to one muted line and show the working indicator — grok
        // resumes the turn after the answer.
        collapsePermissionCard(el, opt.kind, cardTitle);
        showGrokking();
      };
      actions.appendChild(btn);
    }
    el.appendChild(actions);
    appendOnTurnSurface(el);
    forceScrollToBottom(); // a pending permission must be visible (#16)
  }

  // ---------- question card (ask_user_question) ----------

  // A "Grok is asking" label + the question text, prominent. Shared by the live
  // and restored cards so they look identical.
  function buildQuestionHead(el, headingText) {
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = headingText;
    el.appendChild(title);
    return title;
  }

  // The green "✓ <labels>" line shown once a question is answered (or "(skipped)").
  function answerLineEl(labels) {
    const ans = document.createElement("div");
    ans.className = "question-answer";
    ans.textContent = labels ? "✓ " + labels : "(skipped)";
    return ans;
  }

  // Inline card for grok's x.ai/ask_user_question. Renders each question with
  // its options; single-select with one question resolves on click (like the
  // permission card), otherwise the user picks across questions and submits.
  // The host replies with { outcome: "accepted", answers } — keyed by question
  // text — which unblocks grok's tool mid-turn. On answer the card COLLAPSES to
  // the question + a clear green "✓ <chosen>" so it's obvious grok received it
  // (the bare grey-out gave no such signal).
  function addQuestionCard(req) {
    finalizeActivity(); // the interactive card breaks the segment
    clearWelcome();
    hideGrokking();
    const questions = Array.isArray(req.questions) ? req.questions : [];
    const el = document.createElement("div");
    el.className = "card question";

    const title = buildQuestionHead(el, "Grok is asking");

    // selections[i] = array of chosen labels for question i.
    const selections = questions.map(() => []);
    const oneClick = questions.length === 1 && !questions[0].multiSelect;

    let submitBtn;
    let skip;
    // Collapse the card to its answered/skipped representation: drop the option
    // buttons + Submit + Skip, retitle, and append the chosen answer per block.
    const collapse = (skipped) => {
      el.classList.add("resolved");
      title.textContent = skipped ? "Skipped" : "You answered";
      const actions = el.querySelector(".card-actions");
      if (actions) actions.remove();
      if (skip) skip.remove();
      [...el.querySelectorAll(".question-block")].forEach((block, qi) => {
        const opts = block.querySelector(".question-options");
        if (opts) opts.remove();
        block.appendChild(answerLineEl(skipped ? "" : (selections[qi] || []).join(", ")));
      });
    };
    const submit = () => {
      const { answers } = buildQuestionAnswers(questions, selections);
      vscode.postMessage({ type: "questionAnswer", requestId: req.id, answers, annotations: {} });
      collapse(false);
    };

    questions.forEach((q, qi) => {
      const block = document.createElement("div");
      block.className = "question-block";
      const qText = document.createElement("div");
      qText.className = "question-text";
      qText.textContent = questionText(q);
      block.appendChild(qText);

      const opts = document.createElement("div");
      opts.className = "question-options";
      for (const opt of q.options || []) {
        const btn = document.createElement("button");
        btn.className = "question-option";
        const lbl = document.createElement("span");
        lbl.className = "question-option-label";
        lbl.textContent = opt.label || "";
        btn.appendChild(lbl);
        if (opt.description) {
          const desc = document.createElement("span");
          desc.className = "question-option-desc";
          desc.textContent = opt.description;
          btn.appendChild(desc);
        }
        btn.onclick = () => {
          if (oneClick) {
            selections[qi] = [opt.label];
            submit();
            return;
          }
          if (q.multiSelect) {
            const i = selections[qi].indexOf(opt.label);
            if (i >= 0) { selections[qi].splice(i, 1); btn.classList.remove("selected"); }
            else { selections[qi].push(opt.label); btn.classList.add("selected"); }
          } else {
            selections[qi] = [opt.label];
            for (const sib of opts.querySelectorAll(".question-option")) sib.classList.remove("selected");
            btn.classList.add("selected");
          }
          if (submitBtn) {
            submitBtn.disabled = !buildQuestionAnswers(questions, selections).allAnswered;
          }
        };
        opts.appendChild(btn);
      }
      block.appendChild(opts);
      el.appendChild(block);
    });

    if (!oneClick) {
      const actions = document.createElement("div");
      actions.className = "card-actions";
      submitBtn = document.createElement("button");
      submitBtn.className = "primary";
      submitBtn.textContent = "Submit";
      submitBtn.disabled = true;
      submitBtn.onclick = submit;
      actions.appendChild(submitBtn);
      el.appendChild(actions);
    }

    skip = document.createElement("button");
    skip.className = "question-skip";
    skip.textContent = "Skip";
    skip.onclick = () => {
      vscode.postMessage({ type: "questionCancel", requestId: req.id });
      collapse(true);
    };
    el.appendChild(skip);

    appendOnTurnSurface(el);
    forceScrollToBottom(); // a pending question must be visible (#16)
  }

  // Extract the text payload from a tool_call_update's content array
  // (`[{ type:"content", content:{ type:"text", text } }]`, with a flatter
  // `{ text }` fallback).
  function toolUpdateText(call) {
    const c = call && call.content;
    if (Array.isArray(c)) {
      for (const item of c) {
        const t = (item && item.content && item.content.text) ?? (item && item.text);
        if (typeof t === "string") return t;
      }
    }
    return "";
  }

  // The ask_user_question tool is named differently per agent (grok-build:
  // `ask_user_question`, cursor/composer: `AskQuestion`), and on session REPLAY
  // grok relabels the tool_call's title to the display form "Ask: <question>".
  // So we detect by title OR by the presence of `rawInput.questions`.
  function isQuestionToolTitle(title) {
    const t = String(title || "").replace(/[_\s]/g, "").toLowerCase();
    return t === "askuserquestion" || t === "askquestion";
  }
  // Pull the question list from a (possibly replayed) ask tool_call. Falls back to
  // synthesizing one question from an "Ask: <question>" display title when the
  // structured rawInput.questions didn't survive the replay.
  function questionsFromCall(call) {
    const q = call && call.rawInput && call.rawInput.questions;
    if (Array.isArray(q) && q.length) return q;
    const title = String((call && call.title) || "");
    if (/^ask[:\s]/i.test(title)) return [{ question: title.replace(/^ask[:\s]+/i, "").trim() }];
    return null;
  }
  function isQuestionTool(call) {
    return isQuestionToolTitle(call && call.title) || questionsFromCall(call) != null;
  }

  // A question's display text (grok-build uses `question`, cursor uses `prompt`).
  function questionText(q) {
    return (q && (q.question || q.prompt)) || "";
  }

  // Resolve the chosen labels per question from grok's replayed tool result.
  // Two formats exist (the agents differ):
  //   grok-build: `User has answered your questions: "<question>"="<labels>", …`
  //   cursor:     `User questions responses:\nQuestion <qid>: Selected option(s) <oid>, <oid>`
  // Returns an array of label strings parallel to `questions` (empty = unmatched).
  function restoredLabelsByQuestion(questions, answerText) {
    const text = String(answerText || "");
    const out = questions.map(() => "");
    let m, matched = false;
    // Format A — quoted "question"="labels".
    const reA = /"([^"]+)"\s*=\s*"([^"]*)"/g;
    while ((m = reA.exec(text))) {
      const qi = questions.findIndex((q) => questionText(q) === m[1]);
      if (qi >= 0) { out[qi] = m[2]; matched = true; }
    }
    if (matched) return out;
    // Format B — option ids per question id; map ids back to labels.
    const reB = /Question\s+([^\s:]+)\s*:\s*Selected option\(s\)\s*([^\n]*)/gi;
    while ((m = reB.exec(text))) {
      const qid = m[1].trim();
      const qi = questions.findIndex((q) => String(q && q.id) === qid);
      if (qi < 0) continue;
      const opts = questions[qi].options || [];
      out[qi] = m[2].split(",").map((s) => s.trim()).filter(Boolean).map((id) => {
        const o = opts.find((x) => String(x && x.id) === id || (x && x.label) === id);
        return o ? o.label : id;
      }).join(", ");
    }
    return out;
  }

  function cleanAnswerText(text) {
    return String(text || "")
      .replace(/^User has answered your questions:\s*/i, "")
      .replace(/^User questions responses:\s*/i, "")
      .replace(/\s*You can now continue.*$/is, "")
      .trim();
  }

  // Read-only "You answered" card rebuilt during session resume. The questions
  // render immediately (they're always on the replayed tool_call); the answer is
  // filled in by `fillRestoredAnswer` when it lands (on the tool_call snapshot or
  // a later update). Handles both the grok-build and cursor/composer schemas.
  // Returns the card element so the update path can fill its answer later.
  function addRestoredQuestionCard(questions, answerText) {
    finalizeActivity(); // restored card breaks the replayed segment, like live
    clearWelcome();
    const qs = Array.isArray(questions) ? questions : [];
    const el = document.createElement("div");
    el.className = "card question resolved";
    el._questions = qs;
    buildQuestionHead(el, "You answered");
    qs.forEach((q) => {
      const block = document.createElement("div");
      block.className = "question-block";
      const qText = document.createElement("div");
      qText.className = "question-text";
      qText.textContent = questionText(q);
      block.appendChild(qText);
      el.appendChild(block);
    });
    appendOnTurnSurface(el);
    if (answerText) fillRestoredAnswer(el, answerText);
    scrollToBottom();
    return el;
  }

  // Append the chosen answer(s) to a restored card once the result text is known.
  // Idempotent — the answer often arrives both on the tool_call and in an update.
  function fillRestoredAnswer(el, answerText) {
    if (!el || el._answered || !answerText) return;
    const qs = el._questions || [];
    const labels = restoredLabelsByQuestion(qs, answerText);
    const anyLabel = labels.some((l) => l);
    if (qs.length && anyLabel) {
      [...el.querySelectorAll(".question-block")].forEach((block, qi) => {
        if (!block.querySelector(".question-answer")) block.appendChild(answerLineEl(labels[qi]));
      });
    } else {
      const clean = cleanAnswerText(answerText);
      if (clean) el.appendChild(answerLineEl(clean));
    }
    el._answered = true;
  }

  // ---------- plan card ----------

  const VERDICT_LABEL = {
    approved: "Approved",
    rejected: "Rejected",
    abandoned: "Cancelled",
  };

  function pathBaseName(p) {
    return String(p || "").split(/[\\/]/).filter(Boolean).pop() || "plan.md";
  }

  function addPlanFileLink(el, planPath, planName) {
    if (!planPath) return;
    const planTools = document.createElement("div");
    planTools.className = "plan-tools";
    const link = document.createElement("a");
    link.className = "file-ref-link plan-file-link";
    link.href = planPath;
    link.title = planPath;
    const code = document.createElement("code");
    code.textContent = planName || pathBaseName(planPath);
    link.appendChild(code);
    planTools.appendChild(link);
    el.appendChild(planTools);
  }

  function addPlanCard(req) {
    clearWelcome();
    hideGrokking();
    // Finalize any in-flight Thinking / agent / tool group so it doesn't sit
    // above the plan card showing "Thinking..." forever. Stamps "Thought for Ns"
    // on the header and closes the tool group.
    commitAgentTurn();
    const el = document.createElement("div");
    el.className = "card plan";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = "Plan ready for review";
    el.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "card-subtitle";
    sub.textContent = "Nothing has been written yet. Approve, reject with feedback, or cancel to leave plan mode.";
    el.appendChild(sub);

    const planText = req.plan || "";
    addPlanFileLink(el, req.planPath, req.planName);

    const body = document.createElement("div");
    body.className = "plan-body";
    body.innerHTML = planText ? renderMarkdown(planText) : "(empty plan)";
    renderMermaidIn(body);
    el.appendChild(body);

    const feedback = document.createElement("textarea");
    feedback.className = "plan-feedback";
    feedback.rows = 2;
    feedback.placeholder = "Optional comment — Grok decides what to do with it";
    el.appendChild(feedback);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const mk = (label, cls, verdict, withComment) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (cls) b.classList.add(cls);
      b.dataset.verdict = verdict;
      b.onclick = () => {
        const comment = withComment ? feedback.value.trim() : "";
        vscode.postMessage({
          type: "exitPlanAnswer",
          requestId: req.id,
          verdict,
          ...(comment ? { comment } : {}),
        });
        el.classList.add("resolved");
        // Collapse to the same clean representation as a restored history card:
        // drop the buttons + comment box and show one colored verdict label.
        // (The comment, if any, lands as its own user bubble below.)
        actions.remove();
        feedback.remove();
        const status = document.createElement("div");
        status.className = "plan-verdict-label plan-verdict-" + verdict;
        status.textContent = VERDICT_LABEL[verdict] ?? "Resolved";
        el.appendChild(status);
      };
      return b;
    };
    actions.appendChild(mk("Approve & implement", "primary", "approved", true));
    actions.appendChild(mk("Reject", "", "rejected", true));
    actions.appendChild(mk("Cancel", "secondary", "abandoned", true));
    el.appendChild(actions);
    appendOnTurnSurface(el);
    scrollToBottom();
  }

  // Read-only plan card for resumed sessions. The original exit_plan_mode request
  // is long gone, so there's nothing to respond to — we just show the plan text
  // grok wrote during that session, recovered from ~/.grok/sessions/.../plan.md,
  // and the verdict the user gave it (persisted in globalState).
  function addPlanHistoryCard(text, verdict, planPath, planName) {
    finalizeActivity(); // restored plan card breaks the replayed segment
    clearWelcome();
    const el = document.createElement("div");
    el.className = "card plan plan-history";
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = "Plan from this session";
    el.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "card-subtitle";
    const verdictLabel = VERDICT_LABEL[verdict];
    sub.textContent = verdictLabel
      ? `Restored from the previous session — you ${verdictLabel.toLowerCase()} this plan.`
      : "Restored from the previous session.";
    el.appendChild(sub);

    addPlanFileLink(el, planPath, planName);

    // Restored plans are reference material, not something to act on — keep them
    // collapsed by default so a resumed session isn't a wall of old plan text.
    // The body stays in the DOM (just hidden) behind a toggle.
    const body = document.createElement("div");
    body.className = "plan-body";
    body.hidden = true;
    body.innerHTML = text ? renderMarkdown(text) : "(empty plan)";
    renderMermaidIn(body);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "plan-toggle";
    const setToggle = () => { toggle.textContent = body.hidden ? "Show plan" : "Hide plan"; };
    setToggle();
    toggle.onclick = () => { body.hidden = !body.hidden; setToggle(); };
    el.appendChild(toggle);
    el.appendChild(body);

    if (verdictLabel) {
      const status = document.createElement("div");
      status.className = "plan-verdict-label plan-verdict-" + verdict;
      status.textContent = verdictLabel;
      el.appendChild(status);
    }

    appendOnTurnSurface(el);
    scrollToBottom();
  }

  // ---------- chips ----------

  function renderChips() {
    chipsEl.innerHTML = "";
    attachmentsEl.innerHTML = "";
    for (const chip of state.chips) {
      // Split on both separators — a file outside the workspace has an absolute
      // relPath (Windows backslashes), so split("/") alone would show the whole
      // path instead of just the name. The full path stays on the tooltip below.
      const fileName = (chip.relPath.split(/[\\/]/).pop() || chip.relPath);
      // A file the user explicitly uploaded (explicit chip, no selection range) gets
      // its own removable row at the top. The active-editor file (implicit) and
      // selection snippets stay in the toolbar with the hide/eye toggle.
      const isUpload = !chip.id.startsWith("implicit:") && !chip.selectionStart;
      if (isUpload) {
        const el = document.createElement("div");
        el.className = "attachment";
        el.title = chip.path;
        el.innerHTML = ICON.file;
        const label = document.createElement("span");
        label.textContent = fileName;
        el.appendChild(label);
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "attachment-remove";
        rm.title = "Remove";
        rm.textContent = "×";
        rm.onclick = () => vscode.postMessage({ type: "removeChip", id: chip.id });
        el.appendChild(rm);
        attachmentsEl.appendChild(el);
        continue;
      }
      const el = document.createElement("div");
      el.className = "chip" + (chip.hidden ? " chip-hidden" : "");
      const isImplicit = chip.id.startsWith("implicit:");
      // Phase B: make attached vs currently-open context obvious.
      el.title = (isImplicit ? "Open in editor: " : "Attached: ") + chip.path;
      const prefix = isImplicit ? "Open · " : "";
      el.innerHTML = (chip.hidden ? ICON.eyeOff : ICON.file) +
        `<span>${prefix}${truncate(fileName, isImplicit ? 8 : 10)}</span>`;
      el.onclick = () => vscode.postMessage({ type: "toggleChip", id: chip.id });
      chipsEl.appendChild(el);
    }
  }

  // ---------- donut ----------

  function updateDonut(used) {
    // Remember the last usage so a later redraw (e.g. the context window changing
    // when the model switches) keeps the same "used" and just rescales the max.
    if (used != null) state.usedTokens = used;
    used = state.usedTokens || 0;
    const max = state.contextWindow;
    const pct = Math.min(100, Math.round((used / max) * 100));
    const circumference = 2 * Math.PI * 5;
    const arc = (pct / 100) * circumference;
    donutArc.setAttribute("stroke-dasharray", `${arc} ${circumference}`);
    let color = "var(--vscode-charts-green, #4ec9b0)";
    if (pct > 90) color = "var(--vscode-charts-red, #f48771)";
    else if (pct > 70) color = "var(--vscode-charts-yellow, #d7ba7d)";
    donutArc.setAttribute("stroke", color);
    donutLabel.textContent = `${toK(used)}/${toK(max)}`;
    donutLabel.title = `${used.toLocaleString()} / ${max.toLocaleString()} tokens`;
  }

  // ---------- slash autocomplete ----------

  function updateSlash() {
    const m = (input.value.slice(0, input.selectionStart || 0)).match(/(?:^|\n)\/(\S*)$/);
    if (!m) {
      state.slashFiltered = [];
      updateAtMention();
      return;
    }
    state.atQuery = null;
    state.atHits = [];
    const q = m[1].toLowerCase();
    state.slashFiltered = state.commands.filter((c) => c.name.toLowerCase().startsWith(q));
    if (!state.slashFiltered.length) { slashPopover.hidden = true; return; }
    state.slashActive = 0;
    renderSlash();
    slashPopover.hidden = false;
  }

  /** Composer @-mention → file chip (Phase B). Host ranks workspace paths. */
  function updateAtMention() {
    if (state.slashFiltered.length) return;
    const before = input.value.slice(0, input.selectionStart || 0);
    const m = before.match(/(?:^|[\s\n])@([^\s@]*)$/);
    if (!m) {
      state.atQuery = null;
      state.atHits = [];
      if (!state.slashFiltered.length) slashPopover.hidden = true;
      return;
    }
    state.atQuery = m[1];
    state.atActive = 0;
    vscode.postMessage({ type: "searchWorkspaceFiles", query: m[1] });
  }

  function renderAtHits() {
    slashPopover.innerHTML = "";
    if (!state.atHits.length) {
      slashPopover.hidden = true;
      return;
    }
    let activeEl = null;
    state.atHits.forEach((file, i) => {
      const el = document.createElement("div");
      el.className = `slash-item${i === state.atActive ? " active" : ""}`;
      if (i === state.atActive) activeEl = el;
      const name = document.createElement("div");
      name.className = "slash-name";
      name.textContent = file;
      el.appendChild(name);
      el.onclick = () => pickAtFile(file);
      slashPopover.appendChild(el);
    });
    slashPopover.hidden = false;
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  function pickAtFile(relPath) {
    // Strip the @query token from the composer; file becomes a chip, never @path.
    input.value = input.value.replace(/(?:^|[\s\n])@([^\s@]*)$/, (full) =>
      full.startsWith("\n") ? "\n" : (full.startsWith(" ") || full.startsWith("\t") ? full[0] : ""),
    );
    state.atQuery = null;
    state.atHits = [];
    slashPopover.hidden = true;
    // Host resolves relative → absolute under workspace and adds explicit chip.
    vscode.postMessage({ type: "attachWorkspaceFile", path: relPath });
    input.focus();
  }

  function renderSlash() {
    slashPopover.innerHTML = "";
    let activeEl = null;
    state.slashFiltered.forEach((cmd, i) => {
      const el = document.createElement("div");
      el.className = `slash-item${i === state.slashActive ? " active" : ""}`;
      if (i === state.slashActive) activeEl = el;
      const name = document.createElement("div");
      name.className = "slash-name";
      name.textContent = `/${cmd.name}`;
      el.appendChild(name);
      if (cmd.description) {
        const d = document.createElement("div");
        d.className = "slash-desc";
        d.textContent = cmd.description;
        el.appendChild(d);
      }
      el.onclick = () => pickSlash(cmd);
      slashPopover.appendChild(el);
    });
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  function pickSlash(cmd) {
    input.value = input.value.replace(/(?:^|\n)\/(\S*)$/, (full) =>
      full.startsWith("\n") ? `\n/${cmd.name} ` : `/${cmd.name} `,
    );
    slashPopover.hidden = true;
    input.focus();
  }

  // ---------- send ----------

  function updateSendButton() {
    // Three states:
    //  - idle (!busy): send icon, enabled, click → send the typed message.
    //  - busy + locked: spinner icon, disabled, no click action. Used for
    //    session-start priming and other flows the user shouldn't interrupt.
    //  - busy + stoppable: stop icon, enabled, click → cancel grok mid-stream.
    //    Used for regular prompts and the verdict afterTurn flow.
    sendBtn.classList.remove("stop", "initializing");
    // The mode switch (Agent/Plan/Auto-accept) restarts the gate and calls the CLI,
    // so it's locked whenever busy — like the model/effort controls. Crucially this
    // covers the session-start window (busy is true through spawn → session/new),
    // where a setMode would otherwise throw "no session". Unlike a separate
    // readiness flag, `busy` always clears, so the control can never get stuck.
    modeBtn.disabled = state.busy;
    modeBtn.classList.toggle("disabled", state.busy);
    // Prefer the mode's plain-language title when idle; busy gets a short ready-hint.
    if (state.busy) {
      modeBtn.title = "Mode — available once the session is ready";
    } else {
      const meta = MODE_META[state.currentModeId] || MODE_META.agent;
      modeBtn.title = `${meta.label} — ${meta.desc}`;
    }
    if (!state.busy) {
      sendBtn.innerHTML = ICON.arrowUp;
      sendBtn.title = "Send";
      sendBtn.disabled = false;
    } else if (state.busyLocked) {
      sendBtn.innerHTML = ICON.spinner;
      sendBtn.title = "Initializing…";
      sendBtn.classList.add("initializing");
      sendBtn.disabled = true;
    } else {
      sendBtn.innerHTML = ICON.square;
      sendBtn.title = "Stop";
      sendBtn.classList.add("stop");
      sendBtn.disabled = false;
    }
  }

  /**
   * Submit a user message to the host. Works while idle *or* mid-turn: a
   * follow-up while busy is posted as send (host queues FIFO without cancelling
   * the in-flight turn; UI ack is deferred until that turn runs). Mid-turn
   * submit does not seal the streaming agent reply — it keeps painting until
   * the current turn finishes. Stop still posts cancel only.
   */
  function submitMessage(text) {
    const wasBusy = state.busy;
    state.busy = true;
    state.busyLocked = false; // a real send is always stoppable
    updateSendButton();
    // Idle send: seal any residual agent UI so the next stream is clean.
    // Mid-turn queue: leave the active stream alone (host does not cancel).
    if (!wasBusy) {
      if (state.activeAgentEl || state.activeThoughtEl || state.activeToolGroupEl) {
        commitAgentTurn();
      } else {
        state.activeAgentEl = null;
        state.activeAgentRaw = "";
        state.activeThoughtEl = null;
        state.activeThoughtHdrEl = null;
        state.thoughtStartTime = null;
        state.activeToolGroupEl = null;
      }
    }
    vscode.postMessage({ type: "send", text, chips: state.chips });
    input.value = "";
    renderInputHighlight();
    slashPopover.hidden = true;
  }

  function sendOrStop() {
    if (state.busy) {
      // Mid-turn Enter with content → follow-up send (host keeps busy continuous).
      // Empty Enter while busy is a no-op; the Stop button handles cancel.
      const text = input.value.trim();
      if (text || state.chips.some((c) => !c.hidden)) {
        submitMessage(text);
        return;
      }
      return;
    }
    const text = input.value.trim();
    if (!text && state.chips.every((c) => c.hidden)) return;
    submitMessage(text);
  }

  /** Stop button: cancel the in-flight turn only (never posts a follow-up). */
  function stopGeneration() {
    if (!state.busy || state.busyLocked) return;
    // Do NOT clear state.busy here — that happens when the cancelled turn
    // actually ends (agentEnd / agentError), so the button stays "Stop" until
    // the CLI confirms.
    vscode.postMessage({ type: "cancel" });
  }

  // ---------- voice control ----------

  // The mic button records in the extension host (webviews can't reach the mic)
  // and transcribes via xAI Speech-to-Text. We optimistically flip to
  // "listening" on click for instant feedback; the host confirms or, on any
  // setup failure (no API key, ffmpeg missing), sends "voiceError" to reset us.
  function renderMic() {
    if (!micBtn) return;
    micBtn.classList.toggle("listening", state.mic === "listening");
    micBtn.classList.toggle("transcribing", state.mic === "transcribing");
    micBtn.classList.toggle("connecting", state.mic === "connecting");
    if (state.mic === "listening") {
      micBtn.innerHTML = ICON.micWaves;
      micBtn.title = "Listening — say 'grok send' to submit, or click to stop";
      micBtn.disabled = false;
    } else if (state.mic === "connecting") {
      micBtn.innerHTML = ICON.spinner;
      micBtn.title = "Starting mic… wait for the waves before speaking";
      micBtn.disabled = false; // clickable to cancel
    } else if (state.mic === "transcribing") {
      micBtn.innerHTML = ICON.spinner;
      micBtn.title = "Transcribing…";
      micBtn.disabled = true;
    } else {
      micBtn.innerHTML = ICON.mic;
      micBtn.title = state.voiceConfigured
        ? "Voice control"
        : "Voice control — click to set up (needs an xAI API key)";
      micBtn.disabled = false;
    }
    // "needs setup" dot only when idle and no key is configured.
    micBtn.classList.toggle("needs-setup", state.mic === "idle" && !state.voiceConfigured);
  }

  function setMic(event) {
    state.mic = nextMicState(state.mic, event);
    renderMic();
  }

  function toggleMic() {
    if (state.mic === "idle") {
      // Skip the optimistic "listening" flash when we know no key is set — the
      // host will pop the setup guidance instead of recording. Still send
      // voiceStart so the host (the authority on the key) makes the call.
      if (state.voiceConfigured) {
        // Remember what's already typed; live partials replace only the tail.
        state.voiceBase = input.value;
        state.voiceLive = false;
        state.voiceQueue = [];
        setMic("start");
      }
      vscode.postMessage({ type: "voiceStart" });
    } else if (state.mic === "listening" || state.mic === "connecting") {
      setMic("stop");
      vscode.postMessage({ type: "voiceStop" });
    }
    // "transcribing": ignore clicks until the transcript or an error arrives.
  }

  // Append a transcript to whatever's typed (batch mode — one-shot result).
  function insertTranscript(text) {
    const t = (text || "").trim();
    if (!t) return;
    const cur = input.value;
    const sep = cur && !/\s$/.test(cur) ? " " : "";
    input.value = cur + sep + t;
    input.focus();
    updateSlash();
    renderInputHighlight();
  }

  // base + live transcript, with a separating space unless base already ends in
  // whitespace (or the tail is empty). Used for streaming partials/final.
  function composeVoiceTail(base, text) {
    const t = text || "";
    if (!base) return t;
    if (!t || /\s$/.test(base)) return base + t;
    return base + " " + t;
  }

  // Mirror the composer text onto the backdrop, wrapping a trailing send command
  // ("grok send") in an accent pill. Call whenever the input value changes.
  function renderInputHighlight() {
    if (!inputHighlight) return;
    const text = input.value;
    const range = trailingSendPhrase(text, state.voiceSendPhrase);
    if (!range) {
      inputHighlight.textContent = "";
    } else {
      const before = text.slice(0, range.index);
      const cmd = text.slice(range.index, range.index + range.length);
      inputHighlight.innerHTML = escapeHtml(before) + '<span class="cmd-token">' + escapeHtml(cmd) + "</span>";
    }
    inputHighlight.scrollTop = input.scrollTop;
    inputHighlight.scrollLeft = input.scrollLeft;
  }

  // Submit a voice-dictated message (continuous "grok send"). Mirrors sendOrStop's
  // send path but takes explicit text (the composer is cleared separately so the
  // mic can keep listening for the next utterance).
  function submitVoiceMessage(text) {
    const t = (text || "").trim();
    if (!t) return;
    // Same path as typed send — including mid-turn follow-ups (host queues).
    submitMessage(t);
  }

  // Send the next message dictated while Grok was busy (so you can keep talking
  // through Grok's responses without waiting).
  function flushVoiceQueue() {
    if (state.busy || !state.voiceQueue.length) return;
    submitVoiceMessage(state.voiceQueue.shift());
  }

  // ---------- inbound ----------

  // Mid-turn events the agent emits while producing output. After each one we
  // re-assert that some progress indicator is visible (ensureActivityIndicator).
  // promptComplete is deliberately omitted — it's the turn-end boundary.
  const TURN_PROGRESS_MSGS = new Set([
    "agentStart", "thoughtChunk", "messageChunk", "toolCall", "toolCallUpdate", "media",
  ]);

  window.addEventListener("message", (e) => {
    const msg = e.data;
    switch (msg.type) {
      case "initialState":
        state.useCtrlEnter = msg.useCtrlEnter;
        state.effort = msg.effort || "";
        state.cwd = msg.cwd || "";
        state.extVersion = msg.extVersion || "";
        if (typeof msg.showThinking === "boolean") state.showThinking = msg.showThinking;
        if (typeof msg.compactActivity === "boolean") state.compactActivity = msg.compactActivity;
        applyThinkingVisibility();
        updateModelLabel(); // effort is now known
        updateComposerPlaceholder(); // send-key hint follows useCtrlEnter
        // grok.showCapabilities isn't known at "ready" time — initialState is
        // posted AFTER ready (postPanelConfig replies to it) — so the capability
        // browser is requested from HERE, gated on the freshly-delivered flag,
        // not from the ready handler. initialState is re-posted on every reveal
        // of a torn-down hidden panel, so this also refreshes the list on reveal.
        if (typeof msg.showCapabilities === "boolean") {
          state.showCapabilities = msg.showCapabilities;
          // The Skills top-bar button itself must be hidden too — otherwise it
          // sits there doing nothing (clicking it is separately guarded above,
          // but a button that visibly does nothing is its own bug).
          if (capabilitiesBtn) capabilitiesBtn.hidden = !state.showCapabilities;
          if (state.showCapabilities) {
            vscode.postMessage({ type: "listCapabilities" });
          } else {
            hideCapabilitiesPanel();
            if (capabilitiesPopover) capabilitiesPopover.hidden = true;
          }
        }
        if (msg.actionsScope === "all" || msg.actionsScope === "workflow") {
          state.actionsScope = msg.actionsScope;
        }
        break;
      case "seedComposer":
        // Host-driven seed (activity-bar document-type icon). Applied after
        // ready/replay so it isn't wiped by clearMessages.
        insertComposerPrompt(msg.text);
        break;
      case "workspaceDocs":
        state.workspaceDocs = {
          entries: Array.isArray(msg.entries) ? msg.entries : [],
          loading: false,
          error: msg.error || null,
          total: typeof msg.total === "number" ? msg.total : (msg.entries || []).length,
          capped: !!msg.capped,
        };
        if (docsPopover && !docsPopover.hidden) renderDocsPopover();
        break;
      case "capabilities":
        // Transient, per-panel reply to listCapabilities (never buffered — see
        // docs/plans/capability-surfacing-and-history-ux.md § Message contract).
        // Stashed in state so renderCapabilitiesPanel() can render it once the
        // priming-window gate clears, without a second request (see setBusy).
        state.capabilities = {
          backend: msg.backend,
          groups: Array.isArray(msg.groups) ? msg.groups : [],
          scannedRoots: typeof msg.scannedRoots === "number" ? msg.scannedRoots : 0,
          truncated: !!msg.truncated,
          error: msg.error || null,
        };
        if (typeof msg.mcpServerCount === "number") state.mcpServerCount = msg.mcpServerCount;
        if (msg.actionsScope === "all" || msg.actionsScope === "workflow") {
          state.actionsScope = msg.actionsScope;
        }
        renderCapabilitiesPanel();
        if (capabilitiesPopover && !capabilitiesPopover.hidden) renderCapabilitiesPopoverBody();
        break;
      case "capabilityDetail": {
        // Lazy how-it-works body for Actions Details (postTo only, not buffered).
        const pending = state.pendingCapabilityDetail;
        const body = pending && pending.name === msg.name ? pending.body : null;
        if (!body) break;
        body.hidden = false;
        body.textContent = "";
        if (msg.error) {
          body.textContent = msg.error === "not-a-suite-skill"
            ? "No guide for this item."
            : msg.error === "too-large"
              ? "Guide is too large to show here — use Open in editor."
              : "Could not load the guide.";
          break;
        }
        const md = typeof msg.markdown === "string" ? msg.markdown : "";
        // Reuse the chat markdown pipeline (escapes untrusted markup in inline()).
        try {
          body.innerHTML = renderMarkdown(md);
        } catch {
          body.textContent = md;
        }
        break;
      }
      case "workspaceFileHits":
        // @-mention autocomplete results (Phase B). Ignore stale replies.
        if (state.atQuery == null) break;
        if (typeof msg.query === "string" && msg.query !== state.atQuery) break;
        state.atHits = Array.isArray(msg.files) ? msg.files : [];
        state.atActive = 0;
        renderAtHits();
        break;
      case "showCapabilities":
        // Live toggle (grok.showCapabilities). Off hides both mounts (and the
        // Skills button itself); on re-requests, mirroring the initialState
        // gate above.
        state.showCapabilities = !!msg.value;
        if (capabilitiesBtn) capabilitiesBtn.hidden = !state.showCapabilities;
        if (state.showCapabilities) {
          vscode.postMessage({ type: "listCapabilities" });
        } else {
          hideCapabilitiesPanel();
          if (capabilitiesPopover) capabilitiesPopover.hidden = true;
        }
        break;
      case "showThinking":
        // Live toggle (grok.showThinking). Initial value also arrives via
        // initialState + is baked into the <body class> by the host to avoid a flash.
        state.showThinking = !!msg.value;
        applyThinkingVisibility();
        if (state.gearView === "config") renderConfigDebugPanel(); // keep the switch in sync
        break;
      case "compactActivity":
        // Live toggle (grok.compactActivity). Applies to NEW turns; flipping it
        // off mid-turn freezes the live block so nothing keeps collecting into it.
        state.compactActivity = !!msg.value;
        if (!state.compactActivity) finalizeActivity();
        if (state.gearView === "config") renderConfigDebugPanel(); // keep the switch in sync
        break;
      case "fontScale":
        // Live chat-only zoom (grok.chatFontScale). Initial value is baked into
        // <body style="--chat-zoom:…"> by the host; this just applies later edits.
        // The CSS derives both `zoom` and the viewport-height compensation from
        // this one variable, so the composer stays pinned to the bottom.
        document.body.style.setProperty("--chat-zoom", String(msg.value || 1));
        break;
      case "grokUpdateStatus":
        // Reply to the About panel's checkGrokUpdate. The check also reports the
        // CLI's current version — adopt it, since the ACP handshake doesn't always
        // give us one (native Windows build) and otherwise the panel would show a
        // bare "—" right next to a confident "CLI is up to date".
        state.grokUpdate = {
          current: msg.current, latest: msg.latest,
          updateAvailable: !!msg.updateAvailable, error: msg.error || null,
          policy: msg.policy || null,
        };
        if (msg.current) state.cliVersion = msg.current;
        if (!gearPopover.hidden && state.gearView === "about") renderAboutPanel(false);
        break;
      case "initialized": {
        // The ACP handshake is done; the hidden primer may still be in flight.
        // Stash the CLI version for gear → About. Canvas renders locked until
        // setBusy:false (docs/plans/session-tab-ux-overhaul.md § Approach C).
        state.cliVersion = msg.info.version || "";
        const onb = $("welcome-onboarding");
        if (onb) onb.innerHTML = "";
        // Render locked, not hidden — the canvas is populated from the first
        // frame instead of blank for the whole spawn+primer window.
        renderSessionSetupCard();
        renderCapabilitiesPanel();
        break;
      }
      case "cliUpdating": {
        // Host may fire this while the silent `grok update` runs before spawn.
        // Welcome chrome no longer shows a status line; composer busy remains.
        break;
      }
      case "session": {
        state.currentModelId = msg.currentModelId;
        state.availableModels = msg.models || [];
        const m = state.availableModels.find((x) => x.modelId === msg.currentModelId);
        if (m?.totalContextTokens) state.contextWindow = m.totalContextTokens;
        updateDonut(0);
        // The host stamps its own session.backend on this event (not read back
        // from state.backend here) — a backend flip's fresh "session" can arrive
        // before its own backendChanged catches state.backend up, so relying on
        // state.backend would risk persisting the OLD backend below.
        if (msg.backend) { state.backend = msg.backend; updateBackendLabel(); }
        updateModelLabel(); // model is now known — reveal the composer chip
        refreshSessionSettingsMounts();
        // Stash the session id (+ backend) for the panel serializer: after a
        // window reload the host re-binds this tab to its session and respawns
        // the right agent from this state (docs/plans/claude-code-backend.md § WP5).
        if (msg.sessionId) vscode.setState({ id: msg.sessionId, backend: state.backend });
        break;
      }
      case "modelChanged": {
        state.currentModelId = msg.modelId;
        // The context window is model-specific (grok-build 512K vs Composer 200K).
        // The initial `session` event carries grok's *default* model, so when we
        // switch (e.g. to the configured default) recompute the max — otherwise the
        // donut keeps showing the wrong ceiling and an inflated percentage.
        const m = state.availableModels.find((x) => x.modelId === msg.modelId);
        if (m && m.totalContextTokens) { state.contextWindow = m.totalContextTokens; updateDonut(); }
        updateModelLabel();
        refreshSessionSettingsMounts();
        break;
      }
      case "modeChanged":
        state.currentModeId = msg.modeId;
        updateModeBtn(msg.modeId);
        refreshSessionSettingsMounts();
        // The Actions popover's auto-accept switch reads state.currentModeId —
        // this is what flips it when the mode changes from any OTHER surface.
        if (capabilitiesPopover && !capabilitiesPopover.hidden) renderCapabilitiesPopoverBody();
        break;
      case "backendChanged": {
        // Agent flip (Session Setup / backend chip) restarts the session on the
        // SAME panel — no webview ready/initialState — so wiping capabilities here
        // permanently hid Grokbit Actions until the user left and reselected the
        // tab. Default Actions are the shared suite (agent-independent); keep the
        // retained payload so tiles stay visible, re-request only on a true
        // backend id change, then re-render. Same-backend backendChanged (e.g.
        // replayInto after reveal) must not clear and must not spam listCapabilities.
        const prevBackend = state.backend;
        state.backend = msg.backend || "grok";
        state.backendLabel = msg.label || "";
        state.claudeAccount = msg.account || null;
        updateBackendLabel();
        updateComposerPlaceholder(); // "Ask Grok…" vs "Ask Claude…" follows the tab's own backend
        // The gear popover's effort-dots row only applies to a backend with an
        // effort axis (Claude has none — see CLAUDE_EFFORT_LEVELS); re-render if
        // it's open so a flip mid-session doesn't leave a stale row.
        if (!gearPopover.hidden && state.gearView === "main") renderGearMain();
        // Same reasoning for the setup card + quick-settings popover (WP7) —
        // the Thinking row must disappear/reappear immediately on a flip.
        refreshSessionSettingsMounts();
        if (state.showCapabilities && state.backend !== prevBackend) {
          vscode.postMessage({ type: "listCapabilities" });
        }
        renderCapabilitiesPanel();
        if (capabilitiesPopover && !capabilitiesPopover.hidden) renderCapabilitiesPopoverBody();
        break;
      }
      case "openModePopover":
        openModePopover();
        break;
      case "voiceState":
        // Host confirms a transition (e.g. recording actually started). Only
        // accept the known states; ignore anything unexpected.
        if (msg.status === "listening" || msg.status === "transcribing") {
          state.mic = msg.status;
          renderMic();
        } else if (msg.status === "idle") {
          // Hard reset — the host stopped voice (e.g. session switch). Clear the
          // live flag and any queued messages too, not just the button.
          state.mic = "idle";
          state.voiceLive = false;
          state.voiceQueue = [];
          renderMic();
        }
        break;
      case "voiceConfigured":
        state.voiceConfigured = !!msg.value;
        if (typeof msg.sendPhrase === "string") state.voiceSendPhrase = msg.sendPhrase;
        renderMic();
        renderInputHighlight();
        break;
      case "voicePartial":
        // Live streaming update: replace the tail after the pre-dictation base.
        state.voiceLive = true;
        input.value = composeVoiceTail(state.voiceBase, msg.text || "");
        renderInputHighlight();
        break;
      case "voiceSubmit": {
        // Continuous "grok send": submit now (host queues mid-turn with immediate
        // ack — no interrupted flash), clear the composer, keep mic listening.
        const t = (msg.text || "").trim();
        state.voiceBase = "";
        state.voiceLive = false;
        input.value = "";
        renderInputHighlight();
        if (t) submitVoiceMessage(t);
        break;
      }
      case "voiceTranscript":
        // Final result. Streaming replaces the live tail; batch appends.
        if (state.voiceLive) {
          input.value = composeVoiceTail(state.voiceBase, (msg.text || "").trim());
          input.focus();
          updateSlash();
          renderInputHighlight();
        } else {
          insertTranscript(msg.text);
        }
        state.voiceLive = false;
        setMic("transcript");
        // "grok send" detected: submit hands-free. Mid-turn follow-ups post
        // send (host queues); Stop is the send-button only, not this path.
        if (msg.send) sendOrStop();
        break;
      case "voiceError":
        // Setup/record/transcribe failed (the host already showed the reason).
        state.voiceLive = false;
        setMic("error");
        break;
      case "chips":
        state.chips = msg.chips;
        renderChips();
        break;
      case "commandsUpdate":
        state.commands = msg.commands || [];
        break;
      case "userMessage":
        // Live send or deferred mid-turn-queue ack (or verdict-feedback bubble):
        // render and bump the counter so any plan history for this position drains.
        // Seal any in-flight agent bubble first so a chained follow-up lands
        // *below* the completed prior reply instead of looking interrupted.
        if (state.activeAgentEl || state.activeThoughtEl || state.activeToolGroupEl || state.activeActivityEl) {
          commitAgentTurn();
        }
        clearChangedFiles(); // a new turn starts — the strip shows only its own edits
        drainPlanHistory(state.userMsgCount);
        drainPermissionHistory(state.userMsgCount);
        state.userMsgCount += 1;
        addMessage("user", msg.text, msg.chips || []);
        // Keep busy across chained turns (host skips agentEnd while queue has work).
        state.busy = true;
        state.busyLocked = false;
        updateSendButton();
        forceScrollToBottom(); // jump back to the bottom on the user's own send (#16)
        // If the indicator is showing and a NEW (live-send) user message comes
        // in, hide it. (When the host posts a userMessage as part of the verdict
        // flow, it then immediately posts planProcessing, which re-shows it
        // after we hide here — the net effect is correct: indicator below.)
        hidePlanProcessing();
        break;
      case "agentStart":
        // A user-initiated turn just began (live send, deferred queue drain, or
        // plan-verdict follow-up). Show "Grokking…" until the first real content
        // replaces it. The silent primer never emits agentStart, so it never
        // shows here. Seal any residual active stream so this turn is fresh.
        if (state.activeAgentEl || state.activeThoughtEl || state.activeToolGroupEl || state.activeActivityEl) {
          commitAgentTurn();
        }
        state.busy = true;
        state.busyLocked = false;
        updateSendButton();
        showGrokking();
        break;
      case "thoughtChunk":
        appendThought(msg.text);
        break;
      case "messageChunk":
        appendAgent(msg.text);
        break;
      case "media":
        addGeneratedMedia(msg);
        break;
      case "document":
        addDocumentCard(msg);
        break;
      case "userMessageChunk":
        appendUserChunk(msg.text);
        break;
      case "historyReplay":
        if (msg.active) {
          state.replaying = true;
          state.suppressReplayTurn = false; // fresh replay starts unsuppressed
        } else {
          commitAgentTurn(); // finalize the last turn while still flagged as replay
          state.replaying = false;
          state.suppressReplayTurn = false; // replay over → no longer suppressing
          // Anything left in the queue is either legacy (no afterUserMessage)
          // or was resolved after the final user message of the session. Render
          // it now at the bottom so we don't silently drop those plans.
          flushPlanHistory();
          flushPermissionHistory();
        }
        break;
      case "permissionHistoryQueue":
        // Answered permission cards from the resumed session, interleaved inline
        // exactly like the plan queue. Does NOT reset userMsgCount — planHistoryQueue
        // owns that (and is posted right after this on resume).
        state.permissionHistoryQueue = (msg.permissions || []).slice();
        break;
      case "planHistoryQueue":
        // Sent by the host right before replay starts. Drives inline placement
        // of historical plan cards from appendUserChunk / live userMessage.
        state.planHistoryQueue = (msg.plans || []).slice();
        state.userMsgCount = 0;
        break;
      case "planProcessing":
        showPlanProcessing();
        break;
      case "toolCall":
        if (state.suppressReplayTurn) break; // tool calls inside the primer turn (unlikely but defensive)
        if (isQuestionTool(msg.call)) {
          // No generic tool chip — the question card stands in for it.
          if (state.replaying) {
            // Resume: render the read-only card NOW from the tool_call (the
            // questions are always present); the answer rides on this snapshot or
            // arrives in a later update keyed by the same toolCallId.
            const el = addRestoredQuestionCard(questionsFromCall(msg.call) || [], toolUpdateText(msg.call));
            if (msg.call.toolCallId) state.restoredCardsByToolCallId.set(msg.call.toolCallId, el);
          } else {
            // Live: the interactive card comes from `questionRequest`; just stash
            // so the matching update is recognized (and the chip stays suppressed).
            state.questionToolCalls.set(msg.call.toolCallId, { questions: questionsFromCall(msg.call) || [] });
          }
          break;
        }
        if (isSubagentToolCall(msg.call)) {
          addSubagentCard(msg.call);
          break;
        }
        addToToolGroup(msg.call);
        // On session/load a completed edit replays as a single `tool_call` that
        // already carries its diff (no follow-up update) — attach the preview here
        // or the restored edit has no "open diff →" (#30).
        applyToolDiffs(msg.call);
        applyToolOutput(msg.call); // command scrollback, if this replay carries it
        // Resume: if this tool was permission-gated, drop the restored (collapsed)
        // card right here — exactly where it was answered — instead of at the turn
        // boundary.
        renderRestoredPermissionForTool(msg.call.toolCallId, msg.call.title);
        break;
      case "toolCallUpdate": {
        if (state.suppressReplayTurn) break;
        // Resume: anchor a restored permission card here — the update carries the
        // tool's real title (the tool_call is often a generic "Shell"/"Grep"), so
        // a card saved without a toolCallId still matches by title.
        renderRestoredPermissionForTool(msg.call?.toolCallId, msg.call?.title);
        // Resume: fill the answer into the matching restored card when it lands.
        const restoredEl = state.restoredCardsByToolCallId.get(msg.call?.toolCallId);
        if (restoredEl) {
          fillRestoredAnswer(restoredEl, toolUpdateText(msg.call));
          break;
        }
        // Live: the interactive card already handled the answer; drop the stash so
        // the chip stays suppressed and we don't fall through to the diff path.
        if (state.questionToolCalls.has(msg.call?.toolCallId)) {
          if (toolUpdateText(msg.call) || String(msg.call?.status).toLowerCase() === "completed") {
            state.questionToolCalls.delete(msg.call.toolCallId);
          }
          break;
        }
        // Fallback: a replayed answer update with no matching card (tool_call
        // missing/unmatched). Rebuild a card from the result text rather than
        // leaving the resumed turn blank.
        if (state.replaying) {
          const t = toolUpdateText(msg.call);
          if (/answered your questions|questions responses/i.test(t)) {
            addRestoredQuestionCard([], t);
            break;
          }
        }
        // A failed tool (e.g. `image_to_video failed: image reference not readable`)
        // — surface the reason on its row instead of silently dropping it.
        const failure = toolFailureText(msg.call);
        if (failure) {
          markToolFailed(msg.call?.toolCallId, failure);
          break;
        }
        applyToolDiffs(msg.call);
        applyToolOutput(msg.call); // command stdout/stderr → "show output" toggle
        break;
      }
      case "permissionRequest":
        addPermissionCard(msg.req);
        break;
      case "permissionResolved": {
        // Replayed (on re-focus) right after the buffered permissionRequest, or
        // live right after the user answers — collapse the matching card if it's
        // still active. Idempotent: a live click already collapsed it.
        const cards = [...messagesEl.querySelectorAll(".card.permission")];
        const el = cards.find((c) => c.dataset.permReqId === String(msg.requestId) && !c.classList.contains("perm-resolved"));
        if (el) {
          const opt = (el._permOptions || []).find((o) => o.optionId === msg.optionId);
          collapsePermissionCard(el, opt && opt.kind, el._permTitle);
        }
        break;
      }
      case "exitPlanRequest":
        addPlanCard(msg.req);
        break;
      case "questionRequest":
        addQuestionCard(msg.req);
        break;
      case "planHistory":
        addPlanHistoryCard(msg.text, msg.verdict, msg.planPath, msg.planName);
        break;
      case "planNotice":
        addPlanNotice(msg.text);
        break;
      case "planBlocked":
        addPlanNotice(
          msg.kind === "terminal"
            ? `Plan first blocked a command: ${msg.target}`
            : msg.kind === "bind"
              ? `Blocked: mutation did not match the approved permission (${msg.target})`
              : `Plan first blocked a write to ${msg.target}`,
        );
        break;
      case "promptComplete":
        // Finalize the Thinking block — but DO NOT clear busy here. agentEnd
        // is now the single authoritative "user can send again" signal, so
        // that the verdict → afterTurn flow can keep busy=true across two
        // consecutive client.prompt() calls (the original turn ends emitting
        // promptComplete; afterTurn's follow-up turn then runs and emits its
        // own agentEnd at the end, which clears busy).
        commitAgentTurn();
        break;
      case "tokenUsage":
        // The sole donut channel. The host pairs it with every promptComplete
        // that carries tokens, and it alone survives suppressed turns (the
        // hidden primer) and session resume (recovered from grok's on-disk
        // signals.json — session/load itself carries no token meta). A genuine
        // zero must pass (the donut can fall back to 0); only absent is dropped.
        if (typeof msg.totalTokens === "number") updateDonut(msg.totalTokens);
        break;
      case "agentReset": {
        hidePlanProcessing(); // turn is being reset, indicator no longer applies
        hideGrokking();
        hideThinkingIndicator();
        finalizeActivity(); // freeze the live block — the turn it tracked is over
        clearChangedFiles(); // the suppressed turn's edits are being discarded
        // Drop the in-flight agent bubble entirely. Used when the host wants to
        // suppress the rest of the current turn (e.g. after Reject, where
        // grok's false "approved" response would otherwise leak through).
        if (state.activeAgentEl) {
          const wrapper = state.activeAgentEl.closest(".msg-wrapper") ?? state.activeAgentEl.parentElement;
          (wrapper ?? state.activeAgentEl).remove();
        }
        state.activeAgentEl = null;
        state.activeAgentRaw = "";
        state.activeThoughtEl = null;
        state.activeThoughtHdrEl = null;
        state.thoughtStartTime = null;
        // Also clear the rAF-scheduled flag so the next messageChunk arms its
        // own rAF instead of relying on the stale one that might fire on a
        // detached element.
        state.agentRenderScheduled = false;
        break;
      }
      case "agentError":
        hideGrokking(); // turn ended (possibly before any content)
        hideThinkingIndicator();
        addError(msg.text);
        state.busy = false;
        updateSendButton();
        flushVoiceQueue(); // don't strand messages dictated during this turn
        break;
      case "agentEnd":
        hideGrokking(); // turn ended (defensive — content normally clears it first)
        hideThinkingIndicator();
        state.busy = false;
        updateSendButton();
        flushVoiceQueue(); // send anything dictated while Grok was responding
        break;
      case "exit":
        hideGrokking();
        addError(`Grok exited (code ${msg.code}). Click the new session button to restart.`);
        state.busy = false;
        state.voiceQueue = []; // session is dead — drop anything queued for it
        updateSendButton();
        break;
      case "setBusy":
        // Host-driven busy state for flows where there's no natural agentEnd
        // (e.g. session-start priming). When `locked` is true the button shows
        // a spinner and is disabled (no interrupt option); when false (or
        // omitted) the button shows a stop icon and clicks cancel the in-flight
        // CLI work.
        state.busy = !!msg.value;
        state.busyLocked = !!msg.locked;
        updateSendButton();
        if (!state.busy) {
          // When a non-turn busy window clears (e.g. session-start priming), send
          // anything dictated during it — priming has no agentEnd to flush on.
          flushVoiceQueue();
        }
        // Refresh the gear popover's model/effort lock state if it's open.
        if (!gearPopover.hidden) renderGearMain();
        // Same for the setup card + quick-settings popover (WP7) — every busy
        // transition (incl. a mid-restart re-lock) must reflect immediately,
        // not just the moment the session first goes idle.
        refreshSessionSettingsMounts();
        // Every busy transition re-renders the capability rows too — this is
        // what flips them between locked (mid-priming/restart) and clickable
        // once state.busy clears, from whatever state.capabilities payload
        // already arrived, with no second listCapabilities request.
        renderCapabilitiesPanel();
        if (capabilitiesPopover && !capabilitiesPopover.hidden) renderCapabilitiesPopoverBody();
        break;
      case "summarizing": {
        clearWelcome();
        const si = document.createElement("div");
        si.id = "summarizing-indicator";
        si.className = "session-context-banner loading-dots";
        si.textContent = "Summarizing";
        messagesEl.appendChild(si);
        scrollToBottom();
        break;
      }
      case "sessionContext":
        addSessionContextBanner();
        break;
      case "beginPanelReplay":
        // Host posts this BEFORE clearMessages on every ready-driven rebuild.
        beginPanelReplay(msg.restore !== undefined ? msg.restore : null);
        break;
      case "endPanelReplay":
        endPanelReplay();
        break;
      case "clearMessages":
        resetForNewSession();
        break;
      case "onboarding":
        showOnboarding(msg.state, { platform: msg.platform, backend: msg.backend });
        break;
      case "error":
        addError(msg.text);
        break;
      case "xaiNotification":
        break;
      case "sessions": {
        const entries = msg.entries || [];
        const offset = msg.offset || 0;
        const open = !historyPopover.hidden;
        // Sticky search: a host-driven refresh (rename/delete/new session) posts an
        // unfiltered first page. If the user has a search active, re-request with it
        // rather than clobbering their filtered view with the full list.
        if (open && offset === 0 && (msg.query || "") !== state.sessionSearch) {
          requestSessions(0);
          break;
        }
        if (offset > 0) {
          // Load-more: append the next page, de-duped by id. A page whose query no
          // longer matches the loaded list is stale (the user changed the search after
          // the request went out) — drop it; the newer request's page will arrive.
          if ((msg.query || "") !== state.sessionQuery) {
            state.sessionLoading = false;
            break;
          }
          const seen = new Set(state.sessions.map((s) => s.id));
          for (const e of entries) if (!seen.has(e.id)) state.sessions.push(e);
        } else {
          // Fresh list or new search result: replace.
          state.sessions = entries;
          state.sessionQuery = msg.query || "";
        }
        if (msg.activeId !== undefined) state.activeSessionId = msg.activeId || null;
        // Merge (not replace) so dots from earlier pages survive a load-more, which
        // only carries dots for the new page.
        state.dots = Object.assign({}, state.dots, msg.dots || {});
        if (msg.total !== undefined) state.sessionTotal = msg.total;
        if (msg.nextOffset !== undefined) state.sessionNextOffset = msg.nextOffset;
        state.sessionHasMore = !!msg.hasMore;
        state.sessionLoading = false;
        if (open) renderSessionRows();
        break;
      }
      case "sessionDot":
        if (msg.dot && msg.dot !== "none") state.dots[msg.id] = msg.dot;
        else delete state.dots[msg.id];
        if (!historyPopover.hidden) patchSessionDot(msg.id);
        break;
    }
    // After any step grok takes mid-turn, make sure the chat still shows it's
    // working — never a dead frame while a turn is unfinished (esp. with thinking
    // traces hidden). The turn-end boundary (promptComplete) is excluded so the
    // stand-in doesn't flash between it and agentEnd.
    if (TURN_PROGRESS_MSGS.has(msg.type)) ensureActivityIndicator();
  });

  // ---------- wire ----------

  // While busy the button is Stop (cancel only). Enter with text still sends a
  // follow-up via sendOrStop — that path must not share this click handler or a
  // Stop click would also try to submit leftover composer text.
  sendBtn.onclick = () => {
    if (state.busy) stopGeneration();
    else sendOrStop();
  };
  updateSendButton();
  if (micBtn) {
    micBtn.onclick = (e) => { e.stopPropagation(); toggleMic(); };
    renderMic();
  }
  newBtn.onclick = () => {
    // Opens a NEW editor tab (host-side); this panel keeps its own chat, so
    // nothing here is reset.
    vscode.postMessage({ type: "newSession" });
  };
  modeBtn.onclick = (e) => { e.stopPropagation(); if (state.busy) return; openModePopover(); };
  gearBtn.onclick = (e) => { e.stopPropagation(); openGearPopover(); };
  // The composer model/effort chip opens the compact quick-settings popover —
  // the SAME four controls (Agent/Model/Thinking/Mode) as the new-tab setup
  // card, built from the same sessionSetupModel() — rather than the gear's
  // full main menu (docs/plans/claude-code-backend.md § WP7).
  if (modelLabel) modelLabel.onclick = (e) => {
    e.stopPropagation();
    openSessionSettingsPopover(modelLabel);
  };
  if (sessionSettingsPopover) sessionSettingsPopover.addEventListener("click", (e) => e.stopPropagation());
  // The backend chip keeps its own small single-purpose popover (Grok Build /
  // Claude Code only) — unchanged; the Agent row above is a second, equivalent
  // way to flip backend from the consolidated popover/card.
  if (backendLabelBtn) backendLabelBtn.onclick = (e) => { e.stopPropagation(); openBackendPopover(); };
  if (backendPopover) backendPopover.addEventListener("click", (e) => e.stopPropagation());

  // Welcome screen's "about" link → open the gear popover's Version & about panel.
  const welcomeAboutLink = $("welcome-about-link");
  if (welcomeAboutLink) welcomeAboutLink.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openAboutPanel(); };
  addBtn.onclick = (e) => { e.stopPropagation(); openAddPopover(); };
  historyBtn.onclick = (e) => { e.stopPropagation(); openHistoryPopover(); };
  if (docsBtn) docsBtn.onclick = (e) => { e.stopPropagation(); openDocsPopover(); };
  if (capabilitiesBtn) capabilitiesBtn.onclick = (e) => { e.stopPropagation(); openCapabilitiesPopover(); };
  modePopover.addEventListener("click", (e) => e.stopPropagation());
  gearPopover.addEventListener("click", (e) => e.stopPropagation());
  addPopover.addEventListener("click", (e) => e.stopPropagation());
  historyPopover.addEventListener("click", (e) => e.stopPropagation());
  if (docsPopover) docsPopover.addEventListener("click", (e) => e.stopPropagation());
  if (capabilitiesPopover) capabilitiesPopover.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => {
    // Math / mermaid export actions (Copy source, Download as PNG/SVG, Open as PNG).
    const exprBtn = e.target.closest(".expr-btn");
    if (exprBtn) {
      e.preventDefault();
      e.stopPropagation();
      const host = exprBtn.closest(".math-export, .mermaid-block");
      if (host) {
        const act = exprBtn.getAttribute("data-expr-act");
        if (act === "copy") copyExprSource(host.getAttribute("data-export-src"), exprBtn);
        else if (act === "download" || act === "open") void exportExpr(host, act);
      }
      return;
    }
    const copyBtn = e.target.closest(".code-copy-btn");
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const codeEl = copyBtn.parentElement && copyBtn.parentElement.querySelector("pre code");
      // innerText (not textContent) so diff blocks, whose lines are block-level
      // spans with no literal newlines, still copy as one line per row.
      const text = codeEl ? codeEl.innerText : "";
      navigator.clipboard.writeText(text).then(() => {
        const label = copyBtn.querySelector(".code-copy-label");
        const glyph = copyBtn.querySelector(".code-copy-glyph");
        const prevLabel = label ? label.textContent : "";
        const prevGlyph = glyph ? glyph.innerHTML : "";
        if (label) label.textContent = "Copied";
        if (glyph) glyph.innerHTML = ICON.check;
        copyBtn.classList.add("copied");
        setTimeout(() => {
          if (label) label.textContent = prevLabel;
          if (glyph) glyph.innerHTML = prevGlyph;
          copyBtn.classList.remove("copied");
        }, 1500);
      });
      return;
    }
    const onbAction = e.target.closest(".onb-action");
    if (onbAction) {
      e.preventDefault();
      e.stopPropagation();
      const act = onbAction.dataset.act;
      if (act === "runInstall") vscode.postMessage({ type: "runInstallCmd" });
      else if (act === "runLogin") vscode.postMessage({ type: "runGrokLogin" });
      else if (act === "installClaude") vscode.postMessage({ type: "installClaudeAdapter" });
      else if (act === "runClaudeLogin") vscode.postMessage({ type: "runClaudeLogin" });
      else if (act === "recheck") {
        // Re-open on the SAME backend the failing card was for (Claude's
        // missing-adapter/auth-required cards set this; grok's cards leave it
        // empty, which the host treats as "use grok.defaultBackend").
        const msg = { type: "recheckConnection" };
        if (state.onboardingBackend) msg.backend = state.onboardingBackend;
        vscode.postMessage(msg);
      }
      return;
    }
    const onbCopy = e.target.closest(".onb-copy");
    if (onbCopy) {
      e.preventDefault();
      e.stopPropagation();
      const cmd = onbCopy.dataset.cmd || "";
      navigator.clipboard.writeText(cmd).then(() => {
        const prevHtml = onbCopy.innerHTML;
        onbCopy.innerHTML = ICON.check;
        onbCopy.classList.add("copied");
        setTimeout(() => {
          onbCopy.innerHTML = prevHtml;
          onbCopy.classList.remove("copied");
        }, 1500);
      });
      return;
    }
    const msgCopyBtn = e.target.closest(".msg-copy-btn");
    if (msgCopyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const msgEl = msgCopyBtn.closest(".msg");
      const text = (msgEl && msgEl._copyText) || "";
      navigator.clipboard.writeText(text).then(() => {
        const glyph = msgCopyBtn.querySelector(".msg-action-glyph");
        const prevGlyph = glyph ? glyph.innerHTML : "";
        if (glyph) glyph.innerHTML = ICON.check;
        msgCopyBtn.classList.add("copied");
        setTimeout(() => {
          if (glyph) glyph.innerHTML = prevGlyph;
          msgCopyBtn.classList.remove("copied");
        }, 1500);
      });
      return;
    }
    closePopovers();
    const a = e.target.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      vscode.postMessage({ type: "openUrl", url: href });
    } else if (/^[a-zA-Z]:[\\/]/.test(href) || href.startsWith("\\\\") || !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      vscode.postMessage({ type: "openFile", path: href });
    }
  });

  input.addEventListener("input", () => { updateSlash(); renderInputHighlight(); });
  input.addEventListener("scroll", () => {
    if (!inputHighlight) return;
    inputHighlight.scrollTop = input.scrollTop;
    inputHighlight.scrollLeft = input.scrollLeft;
  });
  renderInputHighlight();
  input.addEventListener("keydown", (e) => {
    if (!slashPopover.hidden && state.slashFiltered.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        state.slashActive = (state.slashActive + 1) % state.slashFiltered.length;
        renderSlash(); return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        state.slashActive = (state.slashActive - 1 + state.slashFiltered.length) % state.slashFiltered.length;
        renderSlash(); return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        pickSlash(state.slashFiltered[state.slashActive]); return;
      }
      if (e.key === "Escape") { slashPopover.hidden = true; return; }
    }
    if (!slashPopover.hidden && state.atHits.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        state.atActive = (state.atActive + 1) % state.atHits.length;
        renderAtHits(); return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        state.atActive = (state.atActive - 1 + state.atHits.length) % state.atHits.length;
        renderAtHits(); return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        pickAtFile(state.atHits[state.atActive]); return;
      }
      if (e.key === "Escape") { slashPopover.hidden = true; state.atHits = []; return; }
    }
    const sendKey = state.useCtrlEnter
      ? e.key === "Enter" && (e.metaKey || e.ctrlKey)
      : e.key === "Enter" && !e.shiftKey;
    if (sendKey) { e.preventDefault(); sendOrStop(); }
  });

  document.addEventListener("dragenter", (e) => { e.preventDefault(); document.body.classList.add("dragging"); });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("dragleave", () => document.body.classList.remove("dragging"));
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    document.body.classList.remove("dragging");
    const data = e.dataTransfer?.getData("text/uri-list");
    if (!data) return;
    const uris = data.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
    for (const uri of uris) {
      const m = uri.match(/^file:\/\/(.+)$/);
      if (!m) continue;
      vscode.postMessage({ type: "dropFile", path: decodeURIComponent(m[1]), shift: e.shiftKey });
    }
  });

  // Keep the open history popover correctly placed + sized as the panel resizes. Its
  // right-align and width cap depend on the panel width, so a resize while it's open would
  // otherwise leave it stale until close+reopen. Only the history dropdown is panel-width
  // dependent (the composer popovers are bottom-anchored), so just re-run its positioning.
  window.addEventListener("resize", () => {
    if (!historyPopover.hidden) positionDropdownPopover(historyPopover, historyBtn);
  });

  // A resize can also happen while Grok is hidden (another panel tab / extension focused),
  // where the webview gets no resize event and so can't re-measure. Close any open popover
  // when the view is hidden, so the history dropdown never reappears stale on refocus —
  // reopening it re-measures against the current panel width.
  // Also flush scroll metrics immediately so a fast tab switch doesn't lose the last
  // mid-scroll position to the debounce (host memory for restore on reveal).
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      closePopovers();
      postScrollState(true);
    }
  });

  initMermaid();
  initMathJax();
  vscode.postMessage({ type: "ready" });
})();
