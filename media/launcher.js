// Grokbit launcher — the activity-bar view. New session + collapsible Recent
// history. Status dots / rename / delete / clear-all. Signed-out / missing-CLI
// onboarding. No composer, no chat rendering. Recent history is windowed by
// last activity (grok.launcherHistoryDays, default 30) and paged into this
// scroll container — full, unwindowed history + search still live only in the
// chat history popover. Rows mirror the chat panel's history-popover markup so
// chat.css styles both.
(function () {
  const vscode = acquireVsCodeApi();
  const helpers = globalThis.GrokWebviewHelpers || {};
  const {
    formatRelativeTime,
    formatLauncherMeta,
    formatLauncherMetaTooltip,
    backendBadgeLabel,
  } = helpers;

  /** Hard render/auto-load ceiling for the Recent list — mirrors the host's own
   *  LAUNCHER_MAX_ROWS (src/sidebar.ts). Stops unbounded DOM growth without a
   *  virtualization layer; past this the list shows a muted notice pointing at
   *  the chat history popover instead of loading further. */
  const LAUNCHER_MAX_ROWS = 500;
  /** One page of disk rows — mirrors the host's own LAUNCHER_PAGE_SIZE
   *  (src/sidebar.ts). Used only to decide whether "more than one page" is
   *  loaded (the sticky-window refresh's trigger, below) — the load-more
   *  request itself always uses the host's own authoritative nextOffset. */
  const LAUNCHER_PAGE_SIZE = 50;

  const $ = (id) => document.getElementById(id);
  const listEl = $("launcher-list");
  const footerEl = $("launcher-footer");
  const clearAllBtn = $("launcher-clear-all");
  const newBtn = $("launcher-new");
  const newCaretBtn = $("launcher-new-caret");
  const newMenuEl = $("launcher-new-menu");
  const onboardingEl = $("launcher-onboarding");
  const metaEl = $("launcher-meta");
  const historyEl = document.querySelector(".launcher-history");
  const historyToggle = $("launcher-history-toggle");

  const ICON = {
    pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    chevron: '<svg class="launcher-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    caret: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  };

  // New-session split menu: the primary button uses whatever `grok.defaultBackend`
  // resolves to (host-side); the caret always offers an explicit choice of BOTH
  // backends regardless of the default (docs/plans/claude-code-backend.md § WP3).
  const NEW_SESSION_BACKENDS = [
    { id: "grok", label: "New Grok session" },
    { id: "claude", label: "New Claude session" },
  ];

  function closeNewMenu() {
    if (!newMenuEl) return;
    newMenuEl.hidden = true;
    if (newCaretBtn) newCaretBtn.setAttribute("aria-expanded", "false");
  }

  function openNewMenu() {
    if (!newMenuEl) return;
    newMenuEl.innerHTML = "";
    for (const b of NEW_SESSION_BACKENDS) {
      const item = document.createElement("div");
      item.className = "toolbar-popover-item";
      item.textContent = b.label;
      item.onclick = (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: "newSession", backend: b.id });
        closeNewMenu();
      };
      newMenuEl.appendChild(item);
    }
    newMenuEl.hidden = false;
    if (newCaretBtn) newCaretBtn.setAttribute("aria-expanded", "true");
  }

  // Shared with chat history popover (GrokWebviewHelpers.SESSION_DOT_LABELS) so
  // launcher + chat never show different wording for the same dots.
  const DOT_LABEL = (helpers.SESSION_DOT_LABELS) || {
    working: "Working on it",
    "needs-you": "Needs your OK",
    unread: "Done — not opened yet",
    error: "Finished with an error — not opened yet",
  };

  // Collapse prefs survive webview reloads via setState. Defaults: Recent expanded
  // (the 30-day-default window replaced the old hard 7-row cap, so an
  // always-collapsed section would hide the very list the setting asks for).
  const saved = (typeof vscode.getState === "function" && vscode.getState()) || {};
  const state = {
    sessions: [],
    dots: {},
    activeId: null,
    // Windowed count (post grok.launcherHistoryDays) — drives paging/hasMore/the
    // ceiling notice. totalAll is the UNWINDOWED count — drives ONLY the Clear-all
    // footer (clearAllSessions deletes every session, not just in-window ones).
    // Never swap the two: a footer keyed off `total` would hide a destructive
    // action that still works; a ceiling notice keyed off `totalAll` would state a
    // number the windowed list can never reach.
    total: 0,
    totalAll: 0,
    windowDays: 30,
    // Authoritative load-more cursor from the host — NOT state.sessions.length,
    // which the host's own synthesized/pinned rows would make overshoot and
    // permanently skip a real session at every page boundary (see
    // docs/plans/capability-surfacing-and-history-ux.md § Thread 3).
    nextOffset: 0,
    hasMore: false,
    loading: false,
    // Set right before re-requesting the whole loaded window (sticky-window
    // refresh, below) and cleared on the next `sessions` message — without this
    // guard the re-request's own reply (also offset 0) would re-trigger itself
    // forever.
    pendingWindowRefresh: false,
    renamingId: null,
    extVersion: "",
    // Grokbit's own development cost — a build-time constant the host reads
    // from src/token-metrics.ts. Never the viewer's usage, and never computed
    // here or on the host; see GrokSidebar.postLauncherMeta.
    totalTokens: undefined,
    tokensGeneratedAt: "",
    historyOpen: saved.historyOpen !== false,
    onboardingBackend: "",
  };

  function persistUi() {
    if (typeof vscode.setState !== "function") return;
    const prev = (typeof vscode.getState === "function" && vscode.getState()) || {};
    vscode.setState(Object.assign({}, prev, {
      historyOpen: state.historyOpen,
    }));
  }

  /** Apply expanded/collapsed chrome to a section root + its toggle button. */
  function applySectionOpen(sectionEl, toggleEl, open) {
    if (sectionEl) sectionEl.classList.toggle("expanded", !!open);
    if (sectionEl) sectionEl.classList.toggle("collapsed", !open);
    if (toggleEl) {
      toggleEl.setAttribute("aria-expanded", open ? "true" : "false");
      toggleEl.title = open ? "Collapse section" : "Expand section";
    }
  }

  function setHistoryOpen(open) {
    state.historyOpen = !!open;
    applySectionOpen(historyEl, historyToggle, state.historyOpen);
    persistUi();
  }

  function renderMeta() {
    if (!metaEl) return;
    const meta = {
      extVersion: state.extVersion,
      totalTokens: state.totalTokens,
      generatedAt: state.tokensGeneratedAt,
    };
    const text = formatLauncherMeta(meta);
    metaEl.textContent = text;
    metaEl.hidden = !text;
    metaEl.title = formatLauncherMetaTooltip(meta);
  }

  function applyDot(el, value) {
    const v = DOT_LABEL[value] ? value : "none";
    el.className = "history-row-dot dot-" + v;
    el.title = DOT_LABEL[value] || "";
  }

  function renderRow(s) {
    const row = document.createElement("div");
    const active = s.id === state.activeId;
    row.className = "history-row" + (active ? " active" : "");

    const dot = document.createElement("span");
    dot.setAttribute("data-session-dot", s.id);
    applyDot(dot, state.dots[s.id]);
    row.appendChild(dot);

    const main = document.createElement("div");
    main.className = "history-row-main";

    if (state.renamingId === s.id) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "history-rename";
      inp.value = s.displayName;
      inp.onclick = (e) => e.stopPropagation();
      inp.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          vscode.postMessage({ type: "renameSession", id: s.id, name: inp.value });
          state.renamingId = null;
        } else if (e.key === "Escape") {
          state.renamingId = null;
          renderRows();
        }
      };
      inp.onblur = () => {
        if (state.renamingId === s.id) {
          vscode.postMessage({ type: "renameSession", id: s.id, name: inp.value });
          state.renamingId = null;
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
      if (s.numMessages) parts.push(s.numMessages + " msg");
      parts.push(formatRelativeTime(s.updatedAt));
      meta.textContent = parts.join(" · ");
      main.appendChild(meta);

      // Row click opens/reveals that session's editor tab (the host dedupes
      // racing opens). The action buttons stopPropagation. Carry the row's own
      // backend so the host starts the right agent (docs/plans/claude-code-backend.md § WP5)
      // — omitted for a legacy/grok row, mirroring the delete button below.
      row.onclick = () => {
        const msg = { type: "resumeSession", id: s.id };
        if (s.backend) msg.backend = s.backend;
        vscode.postMessage(msg);
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
      state.renamingId = s.id;
      renderRows();
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

  /** Empty-state copy — distinguishes "nothing at all" from "nothing in the
   *  window" so a narrow grok.launcherHistoryDays doesn't read as data loss. */
  function emptyStateText() {
    if (!state.totalAll) return "No sessions yet.";
    return "No sessions in the last " + state.windowDays + " days. Use the chat history for older sessions.";
  }

  /** Muted notice shown once the hard render ceiling is hit — points at the chat
   *  history popover (the surface with search + full, unwindowed pagination).
   *  Deliberately keyed off the WINDOWED `total`, never `totalAll` — the windowed
   *  list can never reach `totalAll`, so a notice stating that number would be a
   *  count nobody scrolling this list will ever see satisfied. */
  function ceilingNoticeText() {
    const windowPart = state.windowDays > 0 ? " in the last " + state.windowDays + " days" : "";
    return "Showing the first " + LAUNCHER_MAX_ROWS + " of " + state.total + windowPart +
      ". Use the chat history for the full list.";
  }

  function renderRows() {
    listEl.innerHTML = "";
    if (state.sessions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = emptyStateText();
      listEl.appendChild(empty);
    } else {
      for (const s of state.sessions) listEl.appendChild(renderRow(s));
      if (state.sessions.length >= LAUNCHER_MAX_ROWS) {
        const notice = document.createElement("div");
        notice.className = "launcher-list-notice";
        notice.textContent = ceilingNoticeText();
        listEl.appendChild(notice);
      }
    }
    updateFooter();
  }

  function updateFooter() {
    // Show clear-all when any non-active session exists on disk (even beyond what's
    // loaded/rendered) — keyed off the UNWINDOWED totalAll, since clearAllSessions
    // removes every session for the workspace, not just the in-window ones. (state.totalAll
    // defaults to 0 and is only ever assigned a defined number, so it's never
    // null/undefined — there's no host reply this would ever need to fall back from.)
    const totalKnown = state.totalAll;
    const loadedClearable = state.sessions.some((s) => s.id !== state.activeId);
    const moreUnloaded = totalKnown > state.sessions.length;
    footerEl.hidden = !(loadedClearable || moreUnloaded);
  }

  function patchDot(id) {
    const sel = '[data-session-dot="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
    const dot = listEl.querySelector(sel);
    if (dot) applyDot(dot, state.dots[id]);
  }

  // Signed-out / missing-CLI / missing-Claude-adapter states. Sessions stay
  // listed while signed out — clicking a row opens a tab that shows the full
  // onboarding for that row's own backend.
  function showOnboarding(mode, info) {
    info = info || {};
    // Recheck reopens on the SAME backend the failing card was for — grok's
    // cards carry no `backend` (recheckConnection then falls back to
    // grok.defaultBackend on the host).
    state.onboardingBackend = info.backend || "";
    if (mode === "missing-cli") {
      const installCmd = info.platform === "win32"
        ? "irm https://x.ai/cli/install.ps1 | iex"
        : "curl -fsSL https://x.ai/cli/install.sh | bash";
      onboardingEl.innerHTML =
        '<div class="onb">' +
          '<p class="onb-heading">Install the Grok CLI</p>' +
          '<div class="onb-cmd"><code>' + installCmd + "</code></div>" +
          '<button class="onb-action" type="button" data-act="runInstall">Open terminal &amp; run</button>' +
          '<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>' +
        "</div>";
      onboardingEl.hidden = false;
    } else if (mode === "auth-required") {
      onboardingEl.innerHTML =
        '<div class="onb">' +
          '<p class="onb-heading">Signed out</p>' +
          '<p class="onb-desc">Sign in to continue. Your session history below is untouched — open one after signing in to pick up where you left off.</p>' +
          '<button class="onb-action" type="button" data-act="runLogin">Open terminal &amp; run <code>grok /login</code></button>' +
          '<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>' +
        "</div>";
      onboardingEl.hidden = false;
    } else if (mode === "missing-claude-adapter") {
      onboardingEl.innerHTML =
        '<div class="onb">' +
          '<p class="onb-heading">Install the Claude Code adapter</p>' +
          '<p class="onb-desc">A one-time ~120&nbsp;MB download. VS Code may be briefly unresponsive while it installs.</p>' +
          '<button class="onb-action" type="button" data-act="installClaude">Install adapter</button>' +
          '<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>' +
        "</div>";
      onboardingEl.hidden = false;
    } else if (mode === "claude-auth-required") {
      onboardingEl.innerHTML =
        '<div class="onb">' +
          '<p class="onb-heading">Sign in to Claude Code</p>' +
          '<p class="onb-desc">Uses your existing Claude subscription — no separate billing.</p>' +
          '<button class="onb-action" type="button" data-act="runClaudeLogin">Open terminal &amp; run <code>claude auth login</code></button>' +
          '<button class="onb-action onb-secondary" type="button" data-act="recheck">Re-check connection</button>' +
        "</div>";
      onboardingEl.hidden = false;
    } else {
      onboardingEl.innerHTML = "";
      onboardingEl.hidden = true;
    }
  }

  onboardingEl.onclick = (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "runInstall") vscode.postMessage({ type: "runInstallCmd" });
    else if (act === "runLogin") vscode.postMessage({ type: "runGrokLogin" });
    else if (act === "installClaude") vscode.postMessage({ type: "installClaudeAdapter" });
    else if (act === "runClaudeLogin") vscode.postMessage({ type: "runClaudeLogin" });
    else if (act === "recheck") {
      const msg = { type: "recheckConnection" };
      if (state.onboardingBackend) msg.backend = state.onboardingBackend;
      vscode.postMessage(msg);
    }
  };

  newBtn.onclick = () => { closeNewMenu(); vscode.postMessage({ type: "newSession" }); };
  if (newCaretBtn) {
    newCaretBtn.innerHTML = ICON.caret;
    newCaretBtn.onclick = (e) => {
      e.stopPropagation();
      if (newMenuEl && !newMenuEl.hidden) closeNewMenu();
      else openNewMenu();
    };
  }
  if (newMenuEl) newMenuEl.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => closeNewMenu());
  clearAllBtn.innerHTML = ICON.trash + "<span>Clear all history</span>";
  clearAllBtn.title = "Delete all sessions in this workspace's history (open tabs are kept)";
  clearAllBtn.onclick = () => vscode.postMessage({ type: "clearAllSessions" });

  if (historyToggle) {
    historyToggle.innerHTML =
      ICON.chevron +
      '<span class="launcher-section-label">Recent</span>';
    historyToggle.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setHistoryOpen(!state.historyOpen);
    };
  }
  if (historyEl) historyEl.classList.add("launcher-section");
  applySectionOpen(historyEl, historyToggle, state.historyOpen);

  // No search box here (still a non-goal — full history + search live in the chat
  // history popover); the Recent list itself is a windowed, paged, scrollable list
  // (grok.launcherHistoryDays) rather than a short fixed cap.

  /** Ask the host for a page of the launcher's windowed history. `offset` is
   *  ALWAYS a value the host itself supplied (state.nextOffset from the last
   *  `sessions` message, or 0 for a fresh/initial load) — never a client-side
   *  computation over the rendered row count, which the host's injected live/
   *  synthetic rows would make overshoot. */
  function requestSessions(offset, limit) {
    state.loading = true;
    const msg = { type: "listSessions", offset };
    if (limit !== undefined) msg.limit = limit;
    vscode.postMessage(msg);
  }

  // Auto-load the next page as the user nears the bottom of the Recent list. The
  // hasMore/loading/pendingWindowRefresh guards keep it to one request per page
  // boundary; the ceiling stops auto-loading once LAUNCHER_MAX_ROWS is reached
  // (the rendered notice explains why and points at the chat history popover).
  listEl.onscroll = () => {
    if (!state.hasMore || state.loading || state.pendingWindowRefresh) return;
    if (state.sessions.length >= LAUNCHER_MAX_ROWS) return;
    if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 48) {
      requestSessions(state.nextOffset);
    }
  };

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "sessions": {
        const entries = msg.entries || [];
        const offset = msg.offset || 0;

        // Sticky window: broadcastSessionsList pushes an unfiltered offset-0 page
        // (at most one page, LAUNCHER_PAGE_SIZE rows) on every
        // send/rename/delete/tab-open-or-close. Once MORE THAN ONE page is
        // loaded (the user scrolled past page 1), rendering that single-page
        // push as-is would collapse the list back down and jump to the top —
        // re-request the WHOLE loaded window instead. Gated on the host's own
        // authoritative disk cursor (state.nextOffset from the LAST reply, not
        // yet overwritten by this one), not on comparing entries.length against
        // what's currently rendered: that comparison fires on ANY shrink,
        // including a plain delete while only one page is loaded (a redundant
        // round trip — the deleted row would otherwise linger until the sticky
        // reply arrives), and its re-request limit (state.sessions.length) can
        // include host-injected live/synthetic rows that aren't real disk
        // pagination, so the "loaded window" would creep upward every refresh
        // while one of those rows is present. Guarded by pendingWindowRefresh,
        // since the re-request's own reply is ALSO offset 0 with
        // state.nextOffset staying above LAUNCHER_PAGE_SIZE, which would
        // otherwise re-satisfy this same check and recurse forever.
        if (offset === 0 && !state.pendingWindowRefresh && state.nextOffset > LAUNCHER_PAGE_SIZE) {
          state.pendingWindowRefresh = true;
          requestSessions(0, state.nextOffset);
          break;
        }
        state.pendingWindowRefresh = false;

        if (offset > 0) {
          const seen = new Set(state.sessions.map((s) => s.id));
          for (const e of entries) if (!seen.has(e.id)) state.sessions.push(e);
        } else {
          state.sessions = entries;
        }
        if (msg.activeId !== undefined) state.activeId = msg.activeId || null;
        state.dots = Object.assign({}, state.dots, msg.dots || {});
        if (msg.total !== undefined) state.total = msg.total;
        if (msg.totalAll !== undefined) state.totalAll = msg.totalAll;
        if (msg.windowDays !== undefined) state.windowDays = msg.windowDays;
        if (msg.nextOffset !== undefined) state.nextOffset = msg.nextOffset;
        state.hasMore = !!msg.hasMore;
        state.loading = false;
        renderRows();
        break;
      }
      case "sessionDot":
        if (msg.dot && msg.dot !== "none") state.dots[msg.id] = msg.dot;
        else delete state.dots[msg.id];
        patchDot(msg.id);
        break;
      case "onboarding":
        showOnboarding(msg.state, { platform: msg.platform, backend: msg.backend });
        break;
      case "launcherMeta":
        state.extVersion = msg.extVersion || "";
        state.totalTokens =
          typeof msg.totalTokens === "number" ? msg.totalTokens : undefined;
        state.tokensGeneratedAt = msg.generatedAt || "";
        renderMeta();
        break;
      // Chat-panel broadcasts (fontScale, cliUpdating, …) don't apply here.
    }
  });

  vscode.postMessage({ type: "ready" });
})();
