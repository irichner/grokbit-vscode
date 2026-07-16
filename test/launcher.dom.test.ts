// DOM: activity-bar launcher — recent-history cap + document-type starters.
// Drives the real media/launcher.js + media/webview-helpers.js in happy-dom.
import { describe, it, expect } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const helperSrc = read("../media/webview-helpers.js");
const launcherSrc = read("../media/launcher.js");

const BODY = `
  <div class="launcher">
    <div class="launcher-head">
      <div id="launcher-meta" class="launcher-meta" hidden></div>
      <button id="launcher-new" class="onb-action launcher-new-btn" type="button">New session</button>
    </div>
    <div id="launcher-studio" class="launcher-studio">
      <div id="launcher-docs" class="launcher-docs launcher-section"></div>
      <div class="launcher-section-bar" role="separator" aria-hidden="true"></div>
      <div id="launcher-templates" class="launcher-templates launcher-section expanded"></div>
    </div>
    <div id="launcher-onboarding" class="launcher-onboarding" hidden></div>
    <div class="launcher-history launcher-section expanded">
      <button id="launcher-history-toggle" class="launcher-section-toggle" type="button" aria-expanded="true" aria-controls="launcher-history-body"></button>
      <div id="launcher-history-body" class="launcher-section-body launcher-history-body">
        <div id="launcher-list" class="history-list launcher-list"></div>
        <div id="launcher-footer" class="history-footer" hidden>
          <button id="launcher-clear-all" class="history-clear-all" type="button"></button>
        </div>
      </div>
    </div>
  </div>`;

type Posted = { type: string; [k: string]: unknown };

function bootLauncher(opts?: {
  getState?: () => unknown;
  setState?: (s: unknown) => void;
}): { window: Window; posted: Posted[]; doc: Document; webviewState: { current: unknown } } {
  const window = new Window({ url: "https://localhost/" });
  const posted: Posted[] = [];
  const webviewState = { current: undefined as unknown };
  (window as any).acquireVsCodeApi = () => ({
    postMessage: (m: Posted) => posted.push(m),
    setState: (s: unknown) => {
      webviewState.current = s;
      if (opts?.setState) opts.setState(s);
    },
    getState: () => (opts?.getState ? opts.getState() : webviewState.current),
  });
  const doc = (window as any).document as Document;
  doc.body.innerHTML = BODY;
  (window as any).eval(helperSrc);
  (window as any).eval(launcherSrc);
  return { window, posted, doc, webviewState };
}

function dispatch(window: Window, data: Posted): void {
  (window as any).dispatchEvent(new (window as any).MessageEvent("message", { data }));
}

function click(window: Window, el: Element): void {
  el.dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, cancelable: true }));
}

function makeEntries(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    displayName: `Session ${i}`,
    updatedAt: Date.now() - i * 1000,
    numMessages: 1,
  }));
}

describe("launcher recent history (cap 7)", () => {
  it("posts ready on boot and renders at most 7 rows when host sends more", () => {
    const { window, posted, doc } = bootLauncher();
    expect(posted.some((m) => m.type === "ready")).toBe(true);

    dispatch(window, {
      type: "sessions",
      entries: makeEntries(12),
      activeId: "s0",
      dots: {},
      offset: 0,
      total: 12,
      hasMore: true,
      query: "",
    });

    const rows = doc.querySelectorAll("#launcher-list .history-row");
    expect(rows).toHaveLength(7);
    expect(doc.querySelector(".history-more")).toBeNull();
  });

  it("has no session-history search and never posts listSessions (host pushes the list)", () => {
    const { window, posted, doc } = bootLauncher();
    expect(doc.getElementById("launcher-search")).toBeNull();
    // Template search is fine; history itself has no search box.
    expect(doc.querySelector(".launcher-history .history-search")).toBeNull();
    expect(doc.querySelector(".launcher-history .launcher-templates-search")).toBeNull();

    posted.length = 0;
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(3),
      activeId: null,
      dots: {},
      offset: 0,
      total: 3,
      hasMore: false,
      query: "ignored",
    });
    expect(posted.filter((m) => m.type === "listSessions")).toHaveLength(0);
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(3);
  });

  it("shows empty state when the host sends no sessions", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [],
      activeId: null,
      dots: {},
      offset: 0,
      total: 0,
      hasMore: false,
      query: "",
    });
    const empty = doc.querySelector("#launcher-list .history-empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("No sessions yet.");
  });
});

describe("launcher meta (version + project lifetime tokens)", () => {
  it("renders version · compact tokens and a project-lifetime tooltip", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "launcherMeta",
      extVersion: "2.0.4",
      totalTokens: 16_000,
    });
    const meta = doc.getElementById("launcher-meta") as HTMLElement;
    expect(meta.hidden).toBe(false);
    expect(meta.textContent).toBe("v2.0.4 · 16.0K tokens");
    expect(meta.title).toContain("16,000");
    expect(meta.title).toMatch(/project lifetime estimate/i);
  });

  it("shows version only when the host omits totalTokens", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, { type: "launcherMeta", extVersion: "2.0.4" });
    const meta = doc.getElementById("launcher-meta") as HTMLElement;
    expect(meta.textContent).toBe("v2.0.4");
    expect(meta.title).toBe("Extension v2.0.4");
  });
});

describe("launcher document-type starters", () => {
  it("renders six types under the New session button and posts docTypeStarter on click", () => {
    const { window, posted, doc } = bootLauncher();
    const docs = doc.getElementById("launcher-docs") as HTMLElement;
    expect(docs).not.toBeNull();
    const types = [...docs.querySelectorAll(".welcome-doc-type")] as HTMLButtonElement[];
    expect(types).toHaveLength(6);
    expect(types.map((b) => b.dataset.docType)).toEqual([
      "word", "excel", "powerpoint", "pdf", "csv", "markdown",
    ]);

    posted.length = 0;
    const word = docs.querySelector('.welcome-doc-type[data-doc-type="word"]') as HTMLButtonElement;
    click(window, word);
    expect(posted).toContainEqual({
      type: "docTypeStarter",
      id: "word",
      prompt: "Create Word document: ",
    });
  });

  it("keeps studio strip (docs + templates) above the bottom-pinned history block", () => {
    const { doc } = bootLauncher();
    const launcher = doc.querySelector(".launcher") as HTMLElement;
    const studio = doc.getElementById("launcher-studio") as HTMLElement;
    const docs = doc.getElementById("launcher-docs") as HTMLElement;
    const templates = doc.getElementById("launcher-templates") as HTMLElement;
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    const list = doc.getElementById("launcher-list") as HTMLElement;
    const footer = doc.getElementById("launcher-footer") as HTMLElement;
    expect(history).not.toBeNull();
    expect(studio.contains(docs)).toBe(true);
    expect(studio.contains(templates)).toBe(true);
    expect(history.contains(list)).toBe(true);
    expect(history.contains(footer)).toBe(true);
    // DOM order: head → studio → onboarding → history.
    const kids = [...launcher.children] as HTMLElement[];
    expect(kids.indexOf(studio)).toBeLessThan(kids.indexOf(history));
    // Within studio: docs, bar, templates.
    const studioKids = [...studio.children] as HTMLElement[];
    expect(studioKids.indexOf(docs)).toBeLessThan(studioKids.indexOf(templates));
  });
});

describe("launcher templates section", () => {
  it("lists templates under Create a document and posts templateStarter on click", () => {
    const { window, posted, doc } = bootLauncher();
    const templates = doc.getElementById("launcher-templates") as HTMLElement;
    const rows = [...templates.querySelectorAll(".launcher-template-row")] as HTMLButtonElement[];
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(templates.querySelector(".launcher-section-label")?.textContent).toBe("Templates");
    expect(doc.querySelector(".launcher-section-bar")).not.toBeNull();

    posted.length = 0;
    const first = rows[0];
    click(window, first);
    const starter = posted.find((m) => m.type === "templateStarter") as Posted | undefined;
    expect(starter).toBeDefined();
    expect(starter!.id).toBe(first.dataset.templateId);
    expect(String(starter!.prompt || "").length).toBeGreaterThan(10);
  });

  it("search empty state when nothing matches", () => {
    const { window, doc } = bootLauncher();
    const search = doc.querySelector(".launcher-templates-search") as HTMLInputElement;
    expect(search).not.toBeNull();
    search.value = "zzznomatch999";
    search.dispatchEvent(new (window as any).Event("input", { bubbles: true }));
    const templates = doc.getElementById("launcher-templates") as HTMLElement;
    expect(templates.textContent).toMatch(/No templates match/i);
  });
});

describe("launcher collapsible sections", () => {
  it("starts with Create a document, Templates, and Recent expanded", () => {
    const { doc } = bootLauncher();
    const docs = doc.getElementById("launcher-docs") as HTMLElement;
    const templates = doc.getElementById("launcher-templates") as HTMLElement;
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(docs.classList.contains("expanded")).toBe(true);
    expect(docs.classList.contains("collapsed")).toBe(false);
    expect(templates.classList.contains("expanded")).toBe(true);
    expect(history.classList.contains("expanded")).toBe(true);
    expect(doc.getElementById("launcher-docs-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(doc.getElementById("launcher-templates-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(docs.querySelectorAll(".welcome-doc-type")).toHaveLength(6);
  });

  it("collapses Create a document on header click and persists", () => {
    const { window, doc, webviewState } = bootLauncher();
    const docs = doc.getElementById("launcher-docs") as HTMLElement;
    const toggle = doc.getElementById("launcher-docs-toggle") as HTMLButtonElement;
    click(window, toggle);
    expect(docs.classList.contains("collapsed")).toBe(true);
    expect(docs.classList.contains("expanded")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((webviewState.current as { docsOpen?: boolean })?.docsOpen).toBe(false);
    expect(docs.querySelectorAll(".welcome-doc-type")).toHaveLength(6);
  });

  it("collapses Templates on header click and persists", () => {
    const { window, doc, webviewState } = bootLauncher();
    const templates = doc.getElementById("launcher-templates") as HTMLElement;
    const toggle = doc.getElementById("launcher-templates-toggle") as HTMLButtonElement;
    click(window, toggle);
    expect(templates.classList.contains("collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((webviewState.current as { templatesOpen?: boolean })?.templatesOpen).toBe(false);
  });

  it("collapses Recent history on header click", () => {
    const { window, doc, webviewState } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(3),
      activeId: null,
      dots: {},
      offset: 0,
      total: 3,
      hasMore: false,
      query: "",
    });
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    const toggle = doc.getElementById("launcher-history-toggle") as HTMLButtonElement;
    click(window, toggle);
    expect(history.classList.contains("collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((webviewState.current as { historyOpen?: boolean })?.historyOpen).toBe(false);
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(3);
  });

  it("restores collapsed prefs from webview state on boot", () => {
    const { doc } = bootLauncher({
      getState: () => ({ docsOpen: false, templatesOpen: false, historyOpen: false }),
    });
    const docs = doc.getElementById("launcher-docs") as HTMLElement;
    const templates = doc.getElementById("launcher-templates") as HTMLElement;
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(docs.classList.contains("collapsed")).toBe(true);
    expect(templates.classList.contains("collapsed")).toBe(true);
    expect(history.classList.contains("collapsed")).toBe(true);
    expect(doc.getElementById("launcher-docs-toggle")?.getAttribute("aria-expanded")).toBe("false");
    expect(doc.getElementById("launcher-templates-toggle")?.getAttribute("aria-expanded")).toBe("false");
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("false");
  });
});
