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
    <div id="launcher-onboarding" class="launcher-onboarding" hidden></div>
    <div class="history-search-wrap"><input id="launcher-search" class="history-search" type="text" /></div>
    <div id="launcher-list" class="history-list launcher-list"></div>
    <div id="launcher-footer" class="history-footer" hidden>
      <button id="launcher-clear-all" class="history-clear-all" type="button"></button>
    </div>
    <div id="launcher-docs" class="launcher-docs"></div>
  </div>`;

type Posted = { type: string; [k: string]: unknown };

function bootLauncher(): { window: Window; posted: Posted[]; doc: Document } {
  const window = new Window({ url: "https://localhost/" });
  const posted: Posted[] = [];
  (window as any).acquireVsCodeApi = () => ({
    postMessage: (m: Posted) => posted.push(m),
    setState: () => {},
    getState: () => undefined,
  });
  const doc = (window as any).document as Document;
  doc.body.innerHTML = BODY;
  (window as any).eval(helperSrc);
  (window as any).eval(launcherSrc);
  return { window, posted, doc };
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

  it("search requests listSessions with limit 7 and offset 0", () => {
    const { window, posted, doc } = bootLauncher();
    posted.length = 0;
    const search = doc.getElementById("launcher-search") as HTMLInputElement;
    search.value = "foo";
    search.dispatchEvent(new (window as any).Event("input", { bubbles: true }));
    // Debounced 180ms — advance timers if available, else call path via message.
    // happy-dom may not implement timers the same way; fire a host sessions reply
    // with a mismatched query so sticky-search re-requests immediately.
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(3),
      activeId: null,
      dots: {},
      offset: 0,
      total: 3,
      hasMore: false,
      query: "", // host unfiltered while search box has "foo"
    });
    const list = posted.filter((m) => m.type === "listSessions");
    expect(list.length).toBeGreaterThanOrEqual(1);
    const last = list[list.length - 1]!;
    expect(last.limit).toBe(7);
    expect(last.offset).toBe(0);
    expect(last.query).toBe("foo");
  });
});

describe("launcher document-type starters", () => {
  it("renders six types under the list and posts docTypeStarter on click", () => {
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
});
