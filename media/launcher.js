// Grokbit launcher — the activity-bar view. Session list with status dots,
// New button, rename/delete row actions, search, load-more, clear-all, and the
// signed-out / missing-CLI onboarding states. No composer, no chat rendering.
// Rows mirror the chat panel's history-popover markup so chat.css styles both.
(function () {
  const vscode = acquireVsCodeApi();
  const { formatRelativeTime } = globalThis.GrokWebviewHelpers;

  const $ = (id) => document.getElementById(id);
  const listEl = $("launcher-list");
  const footerEl = $("launcher-footer");
  const clearAllBtn = $("launcher-clear-all");
  const newBtn = $("launcher-new");
  const searchEl = $("launcher-search");
  const onboardingEl = $("launcher-onboarding");

  const ICON = {
    pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  };

  const DOT_LABEL = {
    working: "Working",
    "needs-you": "Needs you",
    unread: "Finished — unopened",
    error: "Finished with an error — unopened",
  };

  const state = {
    sessions: [],
    dots: {},
    activeId: null,
    search: "",
    query: "",
    total: 0,
    hasMore: false,
    loading: false,
    renamingId: null,
  };
  let searchTimer = null;

  function requestSessions(offset) {
    state.loading = true;
    vscode.postMessage({ type: "listSessions", offset, query: state.search });
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
      const name = document.createElement("div");
      name.className = "history-row-name";
      name.textContent = s.displayName || "Untitled";
      name.title = s.rawSummary || s.displayName || "";
      main.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "history-row-meta";
      const parts = [];
      if (s.numMessages) parts.push(s.numMessages + " msg");
      parts.push(formatRelativeTime(s.updatedAt));
      meta.textContent = parts.join(" · ");
      main.appendChild(meta);

      // Row click opens/reveals that session's editor tab (the host dedupes
      // racing opens). The action buttons stopPropagation.
      row.onclick = () => vscode.postMessage({ type: "resumeSession", id: s.id });
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
        vscode.postMessage({ type: "deleteSession", id: s.id, name: s.displayName });
      };
      actions.appendChild(delBtn);
    }
    row.appendChild(actions);
    return row;
  }

  function renderRows() {
    listEl.innerHTML = "";
    if (state.sessions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = state.search.trim() ? "No matches." : "No sessions yet.";
      listEl.appendChild(empty);
    } else {
      for (const s of state.sessions) listEl.appendChild(renderRow(s));
      if (state.hasMore) {
        const more = document.createElement("div");
        more.className = "history-more";
        more.textContent = state.loading ? "Loading…" : "Scroll for more";
        listEl.appendChild(more);
      }
    }
    updateFooter();
  }

  function updateFooter() {
    const loadedClearable = state.sessions.some((s) => s.id !== state.activeId);
    const moreUnloaded = state.total > state.sessions.length;
    footerEl.hidden = !(loadedClearable || moreUnloaded);
  }

  function patchDot(id) {
    const sel = '[data-session-dot="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
    const dot = listEl.querySelector(sel);
    if (dot) applyDot(dot, state.dots[id]);
  }

  // Signed-out / missing-CLI states. Sessions stay listed while signed out —
  // clicking a row opens a tab that shows the full auth onboarding.
  function showOnboarding(mode, info) {
    info = info || {};
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
    else if (act === "recheck") vscode.postMessage({ type: "recheckConnection" });
  };

  newBtn.onclick = () => vscode.postMessage({ type: "newSession" });
  clearAllBtn.innerHTML = ICON.trash + "<span>Clear all history</span>";
  clearAllBtn.title = "Delete all sessions in this workspace's history (open tabs are kept)";
  clearAllBtn.onclick = () => vscode.postMessage({ type: "clearAllSessions" });

  searchEl.oninput = () => {
    state.search = searchEl.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => requestSessions(0), 180);
  };

  listEl.onscroll = () => {
    if (!state.hasMore || state.loading) return;
    if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 48) {
      requestSessions(state.sessions.length);
    }
  };

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "sessions": {
        const entries = msg.entries || [];
        const offset = msg.offset || 0;
        // Sticky search: a host-driven refresh (open/close/rename/delete) posts
        // an unfiltered first page; re-request with the active filter instead of
        // clobbering the filtered view.
        if (offset === 0 && (msg.query || "") !== state.search) {
          requestSessions(0);
          break;
        }
        if (offset > 0) {
          if ((msg.query || "") !== state.query) { state.loading = false; break; }
          const seen = new Set(state.sessions.map((s) => s.id));
          for (const e of entries) if (!seen.has(e.id)) state.sessions.push(e);
        } else {
          state.sessions = entries;
          state.query = msg.query || "";
        }
        if (msg.activeId !== undefined) state.activeId = msg.activeId || null;
        state.dots = Object.assign({}, state.dots, msg.dots || {});
        if (msg.total !== undefined) state.total = msg.total;
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
        showOnboarding(msg.state, { platform: msg.platform });
        break;
      // Chat-panel broadcasts (fontScale, cliUpdating, …) don't apply here.
    }
  });

  vscode.postMessage({ type: "ready" });
})();
