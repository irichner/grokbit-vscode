/**
 * Minimal client for Fixture E practice. States: empty, loading, error, list, disabled/pending submit.
 */
(function () {
  const els = {
    list: document.getElementById("task-list"),
    empty: document.getElementById("state-empty"),
    loading: document.getElementById("state-loading"),
    error: document.getElementById("state-error"),
    form: document.getElementById("add-form"),
    title: document.getElementById("title-input"),
    submit: document.getElementById("submit-btn"),
    submitLabel: document.querySelector("#submit-btn .btn__label"),
    submitPending: document.querySelector("#submit-btn .btn__pending"),
    refresh: document.getElementById("refresh-btn"),
    retry: document.getElementById("retry-btn"),
    tag: document.getElementById("tag-filter"),
  };

  /** @type {{ id: string, title: string, tags: string[] }[]} */
  let tasks = [
    { id: "1", title: "Write plan", tags: ["process"] },
    { id: "2", title: "Run targeted tests", tags: ["qa"] },
  ];
  let failNext = false;

  function setSubmitPending(pending) {
    els.submit.disabled = pending;
    els.submitLabel.hidden = pending;
    els.submitPending.hidden = !pending;
  }

  function showState(kind) {
    els.empty.hidden = kind !== "empty";
    els.loading.hidden = kind !== "loading";
    els.error.hidden = kind !== "error";
    els.list.hidden = kind !== "list";
  }

  function filtered() {
    const needle = (els.tag.value || "").trim().toLowerCase();
    if (!needle) return tasks.slice();
    return tasks.filter((t) => t.tags.some((tag) => tag.includes(needle)));
  }

  function renderList() {
    const rows = filtered();
    els.list.innerHTML = "";
    if (rows.length === 0) {
      showState("empty");
      return;
    }
    showState("list");
    for (const t of rows) {
      const li = document.createElement("li");
      li.className = "task-list__item";
      li.textContent = t.title + (t.tags.length ? ` [${t.tags.join(", ")}]` : "");
      els.list.appendChild(li);
    }
  }

  function load() {
    showState("loading");
    window.setTimeout(function () {
      if (failNext) {
        failNext = false;
        showState("error");
        return;
      }
      renderList();
    }, 200);
  }

  els.form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    const title = (els.title.value || "").trim();
    if (!title) {
      els.title.focus();
      return;
    }
    setSubmitPending(true);
    window.setTimeout(function () {
      tasks.push({
        id: String(Date.now()),
        title: title,
        tags: [],
      });
      els.title.value = "";
      setSubmitPending(false);
      renderList();
    }, 250);
  });

  els.refresh.addEventListener("click", load);
  els.retry.addEventListener("click", load);
  els.tag.addEventListener("input", renderList);

  // Demo helper: window.__seedError = true before refresh to force error state
  Object.defineProperty(window, "__seedError", {
    set: function (v) {
      failNext = Boolean(v);
    },
    get: function () {
      return failNext;
    },
  });

  load();
})();
