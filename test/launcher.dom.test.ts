// DOM: activity-bar launcher — recent-history cap + collapsible Recent.
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
    <div class="launcher-history launcher-section collapsed">
      <button id="launcher-history-toggle" class="launcher-section-toggle" type="button" aria-expanded="false" aria-controls="launcher-history-body"></button>
      <div id="launcher-history-body" class="launcher-section-body launcher-history-body">
        <div id="launcher-list" class="history-list launcher-list"></div>
        <div id="launcher-footer" class="history-footer" hidden>
          <button id="launcher-clear-all" class="history-clear-all" type="button"></button>
        </div>
      </div>
    </div>
    <div id="launcher-onboarding" class="launcher-onboarding" hidden></div>
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
    expect(doc.querySelector(".launcher-history .history-search")).toBeNull();

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

describe("launcher layout (no Create a document / Templates)", () => {
  it("is New session + Recent only — no doc types or templates chrome", () => {
    const { doc } = bootLauncher();
    const launcher = doc.querySelector(".launcher") as HTMLElement;
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    const onboarding = doc.getElementById("launcher-onboarding") as HTMLElement;
    const list = doc.getElementById("launcher-list") as HTMLElement;
    const footer = doc.getElementById("launcher-footer") as HTMLElement;
    expect(history).not.toBeNull();
    expect(history.contains(list)).toBe(true);
    expect(history.contains(footer)).toBe(true);
    expect(doc.getElementById("launcher-docs")).toBeNull();
    expect(doc.getElementById("launcher-templates")).toBeNull();
    expect(doc.getElementById("launcher-studio")).toBeNull();
    expect(doc.querySelector(".launcher-section-bar")).toBeNull();
    expect(doc.querySelectorAll(".welcome-doc-type")).toHaveLength(0);
    expect(doc.querySelectorAll(".launcher-template-row")).toHaveLength(0);
    // DOM order: head → history → onboarding.
    const kids = [...launcher.children] as HTMLElement[];
    const head = doc.querySelector(".launcher-head") as HTMLElement;
    expect(kids.indexOf(head)).toBeLessThan(kids.indexOf(history));
    expect(kids.indexOf(history)).toBeLessThan(kids.indexOf(onboarding));
  });
});

describe("launcher collapsible sections", () => {
  it("starts with Recent collapsed", () => {
    const { doc } = bootLauncher();
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(history.classList.contains("collapsed")).toBe(true);
    expect(history.classList.contains("expanded")).toBe(false);
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands Recent history on header click and persists", () => {
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
    expect(history.classList.contains("expanded")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect((webviewState.current as { historyOpen?: boolean })?.historyOpen).toBe(true);
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(3);
  });

  it("restores expanded prefs from webview state on boot", () => {
    const { doc } = bootLauncher({
      getState: () => ({ historyOpen: true }),
    });
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(history.classList.contains("expanded")).toBe(true);
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("restores collapsed prefs from webview state on boot", () => {
    const { doc } = bootLauncher({
      getState: () => ({ historyOpen: false }),
    });
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(history.classList.contains("collapsed")).toBe(true);
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("false");
  });
});
