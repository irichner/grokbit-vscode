// Panel reveal scroll restore — mid-scroll survives hide→rebuild; pin stays pinned.
// Drives REAL media/chat.js via the shared harness.
import { describe, it, expect, vi, afterEach } from "vitest";
import { bootWebview, dispatch, Posted } from "./webview-harness";

const $ = (doc: Document, id: string) => doc.getElementById(id) as HTMLElement;

function setMetrics(list: HTMLElement, top: number, height: number, client: number) {
  Object.defineProperty(list, "scrollHeight", { value: height, configurable: true });
  Object.defineProperty(list, "clientHeight", { value: client, configurable: true });
  Object.defineProperty(list, "scrollTop", { value: top, configurable: true, writable: true });
}

function fillTall(doc: Document) {
  const list = $(doc, "messages");
  for (let i = 0; i < 20; i++) {
    const d = doc.createElement("div");
    d.className = "msg agent";
    d.textContent = `line ${i}`;
    list.appendChild(d);
  }
  return list;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tab scroll restore (panel reveal)", () => {
  it("restores mid-scroll after begin/clear/content/end", () => {
    const { window, doc } = bootWebview();
    const list = fillTall(doc);
    setMetrics(list, 0, 2000, 400);

    dispatch(window, {
      type: "beginPanelReplay",
      restore: { stickToBottom: false, scrollTop: 600 },
    });
    dispatch(window, { type: "clearMessages" });
    fillTall(doc);
    setMetrics(list, 0, 2000, 400);
    dispatch(window, { type: "endPanelReplay" });

    expect(list.scrollTop).toBe(600);
    const btn = $(doc, "scroll-bottom-btn");
    expect(btn.classList.contains("visible")).toBe(true);
  });

  it("pin/null restore ends at bottom", () => {
    const { window, doc } = bootWebview();
    const list = fillTall(doc);
    setMetrics(list, 0, 2000, 400);

    dispatch(window, { type: "beginPanelReplay", restore: null });
    dispatch(window, { type: "clearMessages" });
    fillTall(doc);
    setMetrics(list, 0, 2000, 400);
    // Writable scrollTop so end can set scrollHeight
    let top = 0;
    Object.defineProperty(list, "scrollTop", {
      get: () => top,
      set: (v) => { top = v; },
      configurable: true,
    });
    dispatch(window, { type: "endPanelReplay" });

    expect(top).toBe(2000);
    expect($(doc, "scroll-bottom-btn").classList.contains("visible")).toBe(false);
  });

  it("during panelReplaying, scrollToBottom and forceScrollToBottom no-op", () => {
    const { window, doc } = bootWebview();
    const list = fillTall(doc);
    let top = 100;
    Object.defineProperty(list, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(list, "scrollTop", {
      get: () => top,
      set: (v) => { top = v; },
      configurable: true,
    });

    dispatch(window, {
      type: "beginPanelReplay",
      restore: { stickToBottom: false, scrollTop: 100 },
    });
    // userMessage normally force-scrolls; during panel replay it must not.
    dispatch(window, { type: "userMessage", text: "hello" });
    expect(top).toBe(100);

    dispatch(window, { type: "messageChunk", text: "stream" });
    expect(top).toBe(100);
  });

  it("after end, forceScrollToBottom pins again (live path)", () => {
    const { window, doc } = bootWebview();
    const list = fillTall(doc);
    let top = 50;
    Object.defineProperty(list, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(list, "scrollTop", {
      get: () => top,
      set: (v) => { top = v; },
      configurable: true,
    });

    dispatch(window, {
      type: "beginPanelReplay",
      restore: { stickToBottom: false, scrollTop: 50 },
    });
    dispatch(window, { type: "clearMessages" });
    fillTall(doc);
    Object.defineProperty(list, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 400, configurable: true });
    dispatch(window, { type: "endPanelReplay" });
    expect(top).toBe(50);

    // Live user send force-scrolls.
    dispatch(window, { type: "userMessage", text: "next" });
    expect(top).toBe(2000);
  });

  it("does not post scrollState while panelReplaying", () => {
    const { window, posted, doc } = bootWebview();
    const list = fillTall(doc);
    setMetrics(list, 100, 2000, 400);
    posted.length = 0;

    dispatch(window, {
      type: "beginPanelReplay",
      restore: { stickToBottom: false, scrollTop: 100 },
    });
    list.dispatchEvent(new (window as any).Event("scroll"));
    dispatch(window, { type: "userMessage", text: "x" });
    // No debounced/immediate scrollState during rebuild.
    expect(posted.filter((p: Posted) => p.type === "scrollState")).toHaveLength(0);

    dispatch(window, { type: "endPanelReplay" });
    const after = posted.filter((p: Posted) => p.type === "scrollState");
    expect(after.length).toBeGreaterThanOrEqual(1);
  });

  it("visibility hidden flushes scrollState immediately", () => {
    const { window, posted, doc } = bootWebview();
    const list = fillTall(doc);
    setMetrics(list, 250, 2000, 400);
    // Establish unpinned stick via scroll listener path
    list.dispatchEvent(new (window as any).Event("scroll"));
    posted.length = 0;

    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    doc.dispatchEvent(new (window as any).Event("visibilitychange"));

    const flush = posted.filter((p: Posted) => p.type === "scrollState");
    expect(flush.length).toBeGreaterThanOrEqual(1);
    expect(flush[flush.length - 1]).toMatchObject({ type: "scrollState" });
  });
});
