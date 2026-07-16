// Grokbit launcher — the activity-bar view. Session list with status dots,
// New button, rename/delete row actions, search, clear-all, document-type
// starters, and the signed-out / missing-CLI onboarding states. No composer,
// no chat rendering. Rows mirror the chat panel's history-popover markup so
// chat.css styles both. History is hard-capped (full history lives in the
// chat panel's history popover).
(function () {
  const vscode = acquireVsCodeApi();
  const helpers = globalThis.GrokWebviewHelpers || {};
  const { formatRelativeTime, formatLauncherMeta, businessDocTypeStarters, docTypeIcons } = helpers;

  /** Hard cap for the activity-bar recent list (chat popover keeps full history). */
  const HISTORY_LIMIT = 7;

  const $ = (id) => document.getElementById(id);
  const listEl = $("launcher-list");
  const footerEl = $("launcher-footer");
  const clearAllBtn = $("launcher-clear-all");
  const newBtn = $("launcher-new");
  const searchEl = $("launcher-search");
  const onboardingEl = $("launcher-onboarding");
  const metaEl = $("launcher-meta");
  const docsEl = $("launcher-docs");

  const ICON = {
    pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  };

  // Shared with chat history popover (GrokWebviewHelpers.SESSION_DOT_LABELS) so
  // launcher + chat never show different wording for the same dots.
  const DOT_LABEL = (helpers.SESSION_DOT_LABELS) || {
    working: "Working on it",
    "needs-you": "Needs your OK",
    unread: "Done — not opened yet",
    error: "Finished with an error — not opened yet",
  };

  const state = {
    sessions: [],
    dots: {},
    activeId: null,
    search: "",
    query: "",
    total: 0,
    loading: false,
    renamingId: null,
    extVersion: "",
    totalTokens: undefined,
  };
  let searchTimer = null;

  function renderMeta() {
    if (!metaEl) return;
    const text = formatLauncherMeta({
      extVersion: state.extVersion,
      totalTokens: state.totalTokens,
    });
    metaEl.textContent = text;
    metaEl.hidden = !text;
    if (typeof state.totalTokens === "number") {
      metaEl.title =
        (state.extVersion ? "Extension v" + state.extVersion + " · " : "") +
        state.totalTokens.toLocaleString() +
        " tokens used (project lifetime estimate)";
    } else if (state.extVersion) {
      metaEl.title = "Extension v" + state.extVersion;
    } else {
      metaEl.title = "";
    }
  }

  function requestSessions(offset) {
    state.loading = true;
    // Always request only the short cap; no load-more in the activity bar.
    vscode.postMessage({
      type: "listSessions",
      offset: 0,
      limit: HISTORY_LIMIT,
      query: state.search,
    });
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
    }
    updateFooter();
  }

  function updateFooter() {
    // Show clear-all when any non-active session exists on disk (even beyond the
    // 7 visible rows) or among the loaded rows.
    const loadedClearable = state.sessions.some((s) => s.id !== state.activeId);
    const moreUnloaded = state.total > state.sessions.length;
    footerEl.hidden = !(loadedClearable || moreUnloaded);
  }

  function patchDot(id) {
    const sel = '[data-session-dot="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
    const dot = listEl.querySelector(sel);
    if (dot) applyDot(dot, state.dots[id]);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Document-type starters below the recent list (moved from the chat welcome). */
  function renderDocTypes() {
    if (!docsEl || typeof businessDocTypeStarters !== "function") return;
    const types = businessDocTypeStarters();
    const icons = typeof docTypeIcons === "function" ? docTypeIcons() : {};
    docsEl.innerHTML = "";
    if (!types.length) {
      docsEl.hidden = true;
      return;
    }
    docsEl.hidden = false;
    const heading = document.createElement("p");
    heading.className = "launcher-docs-heading";
    heading.textContent = "Create a document";
    docsEl.appendChild(heading);
    const row = document.createElement("div");
    row.className = "launcher-docs-row welcome-doc-types-row";
    row.setAttribute("role", "list");
    row.setAttribute("aria-label", "Document types");
    for (const t of types) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "welcome-doc-type launcher-doc-type";
      btn.setAttribute("role", "listitem");
      btn.dataset.docType = t.id;
      btn.setAttribute("aria-label", "Create " + t.label);
      btn.title = "Create " + t.label;
      btn.innerHTML =
        '<span class="welcome-doc-type-icon">' + (icons[t.id] || icons.word || "") + "</span>" +
        '<span class="welcome-doc-type-label">' + escapeHtml(t.label) + "</span>";
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        vscode.postMessage({ type: "docTypeStarter", id: t.id, prompt: t.prompt });
      };
      row.appendChild(btn);
    }
    docsEl.appendChild(row);
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

  // No infinite-scroll load-more: the launcher is a short recent list only.

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
        // Host may still send a larger page (e.g. pre-cap broadcast); hard-cap here.
        // Ignore load-more pages — the launcher never requests offset > 0.
        if (offset > 0) {
          state.loading = false;
          break;
        }
        state.sessions = entries.slice(0, HISTORY_LIMIT);
        state.query = msg.query || "";
        if (msg.activeId !== undefined) state.activeId = msg.activeId || null;
        state.dots = Object.assign({}, state.dots, msg.dots || {});
        if (msg.total !== undefined) state.total = msg.total;
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
      case "launcherMeta":
        state.extVersion = msg.extVersion || "";
        state.totalTokens =
          typeof msg.totalTokens === "number" ? msg.totalTokens : undefined;
        renderMeta();
        break;
      // Chat-panel broadcasts (fontScale, cliUpdating, …) don't apply here.
    }
  });

  renderDocTypes();
  vscode.postMessage({ type: "ready" });
})();
