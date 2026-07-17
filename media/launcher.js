// Grokbit launcher — the activity-bar view. New session + collapsible
// Create a document + Templates + Recent (stacked under Templates in studio).
// Status dots / rename / delete / clear-all. Signed-out / missing-CLI
// onboarding. No composer, no chat rendering. History is hard-capped (full
// history + search live in the chat history popover). Rows mirror the chat
// panel's history-popover markup so chat.css styles both.
(function () {
  const vscode = acquireVsCodeApi();
  const helpers = globalThis.GrokWebviewHelpers || {};
  const {
    formatRelativeTime,
    formatLauncherMeta,
    businessDocTypeStarters,
    docTypeIcons,
    businessTemplates,
    filterTemplates,
  } = helpers;

  /** Hard cap for the activity-bar recent list (chat popover keeps full history). */
  const HISTORY_LIMIT = 7;

  const $ = (id) => document.getElementById(id);
  const listEl = $("launcher-list");
  const footerEl = $("launcher-footer");
  const clearAllBtn = $("launcher-clear-all");
  const newBtn = $("launcher-new");
  const onboardingEl = $("launcher-onboarding");
  const metaEl = $("launcher-meta");
  const docsEl = $("launcher-docs");
  const templatesEl = $("launcher-templates");
  const studioEl = $("launcher-studio");
  const historyEl = document.querySelector(".launcher-history");
  const historyToggle = $("launcher-history-toggle");
  const historyBody = $("launcher-history-body");

  const ICON = {
    pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    chevron: '<svg class="launcher-section-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  };

  // Shared with chat history popover (GrokWebviewHelpers.SESSION_DOT_LABELS) so
  // launcher + chat never show different wording for the same dots.
  const DOT_LABEL = (helpers.SESSION_DOT_LABELS) || {
    working: "Working on it",
    "needs-you": "Needs your OK",
    unread: "Done — not opened yet",
    error: "Finished with an error — not opened yet",
  };

  // Collapse prefs survive webview reloads via setState. Defaults: all collapsed.
  const saved = (typeof vscode.getState === "function" && vscode.getState()) || {};
  const state = {
    sessions: [],
    dots: {},
    activeId: null,
    total: 0,
    renamingId: null,
    extVersion: "",
    totalTokens: undefined,
    templateSearch: typeof saved.templateSearch === "string" ? saved.templateSearch : "",
    docsOpen: saved.docsOpen === true,
    templatesOpen: saved.templatesOpen === true,
    historyOpen: saved.historyOpen === true,
  };

  function persistUi() {
    if (typeof vscode.setState !== "function") return;
    const prev = (typeof vscode.getState === "function" && vscode.getState()) || {};
    vscode.setState(Object.assign({}, prev, {
      docsOpen: state.docsOpen,
      templatesOpen: state.templatesOpen,
      historyOpen: state.historyOpen,
      templateSearch: state.templateSearch,
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

  function setDocsOpen(open) {
    state.docsOpen = !!open;
    applySectionOpen(docsEl, docsEl && docsEl.querySelector(".launcher-section-toggle"), state.docsOpen);
    persistUi();
  }

  function setTemplatesOpen(open) {
    state.templatesOpen = !!open;
    applySectionOpen(
      templatesEl,
      templatesEl && templatesEl.querySelector(".launcher-section-toggle"),
      state.templatesOpen,
    );
    persistUi();
  }

  function setHistoryOpen(open) {
    state.historyOpen = !!open;
    applySectionOpen(historyEl, historyToggle, state.historyOpen);
    persistUi();
  }

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
      empty.textContent = "No sessions yet.";
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

  /** Create a document type chips (collapsible). */
  function renderDocTypes() {
    if (!docsEl || typeof businessDocTypeStarters !== "function") return;
    const types = businessDocTypeStarters();
    const icons = typeof docTypeIcons === "function" ? docTypeIcons() : {};
    docsEl.innerHTML = "";
    docsEl.classList.add("launcher-section");
    if (!types.length) {
      docsEl.hidden = true;
      return;
    }
    docsEl.hidden = false;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "launcher-section-toggle";
    toggle.id = "launcher-docs-toggle";
    toggle.innerHTML =
      ICON.chevron +
      '<span class="launcher-section-label">Create a document</span>';
    toggle.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDocsOpen(!state.docsOpen);
    };
    docsEl.appendChild(toggle);

    const body = document.createElement("div");
    body.className = "launcher-section-body launcher-docs-body";
    body.id = "launcher-docs-body";
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
    body.appendChild(row);
    docsEl.appendChild(body);
    applySectionOpen(docsEl, toggle, state.docsOpen);
  }

  /**
   * Templates gallery (collapsible). Flex-grows in .launcher-studio so the
   * list fills the space between Create a document and Recent (sibling below).
   * Click seeds the composer via host templateStarter (no auto-send).
   */
  function renderTemplates(opts) {
    opts = opts || {};
    if (!templatesEl) return;
    const all = typeof businessTemplates === "function" ? businessTemplates() : [];
    templatesEl.innerHTML = "";
    templatesEl.classList.add("launcher-section");
    if (!all.length) {
      templatesEl.hidden = true;
      if (studioEl) {
        const bar = studioEl.querySelector(".launcher-section-bar");
        if (bar) bar.hidden = true;
      }
      return;
    }
    templatesEl.hidden = false;
    if (studioEl) {
      const bar = studioEl.querySelector(".launcher-section-bar");
      if (bar) bar.hidden = !!(docsEl && docsEl.hidden);
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "launcher-section-toggle";
    toggle.id = "launcher-templates-toggle";
    toggle.innerHTML =
      ICON.chevron +
      '<span class="launcher-section-label">Templates</span>';
    toggle.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTemplatesOpen(!state.templatesOpen);
    };
    templatesEl.appendChild(toggle);

    const body = document.createElement("div");
    body.className = "launcher-section-body launcher-templates-body";
    body.id = "launcher-templates-body";

    const searchWrap = document.createElement("div");
    searchWrap.className = "launcher-templates-search-wrap";
    const search = document.createElement("input");
    search.type = "search";
    search.className = "launcher-templates-search";
    search.placeholder = "Search…";
    search.value = state.templateSearch || "";
    search.setAttribute("aria-label", "Search templates");
    search.oninput = () => {
      state.templateSearch = search.value;
      persistUi();
      renderTemplates({ focusSearch: true });
    };
    search.onkeydown = (e) => e.stopPropagation();
    search.onclick = (e) => e.stopPropagation();
    searchWrap.appendChild(search);
    body.appendChild(searchWrap);

    const list = document.createElement("div");
    list.className = "launcher-templates-list";
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", "Business templates");
    const filtered =
      typeof filterTemplates === "function"
        ? filterTemplates(all, state.templateSearch)
        : all;
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "launcher-templates-empty muted";
      empty.textContent = "No templates match.";
      list.appendChild(empty);
    } else {
      for (const t of filtered) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "launcher-template-row";
        row.setAttribute("role", "listitem");
        row.dataset.templateId = t.id;
        row.title = t.prompt ? String(t.prompt).trim() : (t.title || t.id);
        row.setAttribute("aria-label", "Use template " + (t.title || t.id));
        const title = document.createElement("span");
        title.className = "launcher-template-title";
        title.textContent = t.title || t.id;
        row.appendChild(title);
        if (t.tags && t.tags.length) {
          const tags = document.createElement("span");
          tags.className = "launcher-template-tags muted";
          tags.textContent = (Array.isArray(t.tags) ? t.tags : []).join(" · ");
          row.appendChild(tags);
        }
        row.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (t.prompt) {
            vscode.postMessage({ type: "templateStarter", id: t.id, prompt: t.prompt });
          }
        };
        list.appendChild(row);
      }
    }
    body.appendChild(list);
    templatesEl.appendChild(body);
    applySectionOpen(templatesEl, toggle, state.templatesOpen);

    if (opts.focusSearch) {
      requestAnimationFrame(() => {
        const again = templatesEl.querySelector(".launcher-templates-search");
        if (again) {
          again.focus();
          try {
            again.setSelectionRange(again.value.length, again.value.length);
          } catch { /* */ }
        }
      });
    }
  }

  function renderStudio() {
    renderDocTypes();
    renderTemplates();
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

  // No search / load-more: the launcher is a short recent list only. Host pushes
  // the capped list on ready and after list mutations (broadcastSessionsList).

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "sessions": {
        const entries = msg.entries || [];
        const offset = msg.offset || 0;
        // Host may still send a larger page (e.g. pre-cap broadcast); hard-cap here.
        // Ignore load-more pages — the launcher never requests offset > 0.
        if (offset > 0) break;
        state.sessions = entries.slice(0, HISTORY_LIMIT);
        if (msg.activeId !== undefined) state.activeId = msg.activeId || null;
        state.dots = Object.assign({}, state.dots, msg.dots || {});
        if (msg.total !== undefined) state.total = msg.total;
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

  renderStudio();
  vscode.postMessage({ type: "ready" });
})();
