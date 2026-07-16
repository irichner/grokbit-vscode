// Studio 3.0.0 DOM: task chips, insert policy, docs popover.
// Templates moved to the activity-bar launcher (see launcher.dom.test.ts).
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";
import { taskQuickActions } from "../media/webview-helpers.js";

describe("E1 task chips (welcome)", () => {
  it("renders business task chips on welcome when ready", () => {
    const { doc } = bootWebview();
    const chips = [...doc.querySelectorAll(".welcome-task-chip")] as HTMLButtonElement[];
    expect(chips.length).toBeGreaterThanOrEqual(5);
    const ids = chips.map((c) => c.dataset.taskId);
    expect(ids).toContain("invoice");
    expect(ids).toContain("pitch");
    // Format icons still not on welcome
    expect(doc.querySelectorAll(".welcome-doc-type")).toHaveLength(0);
  });

  it("task chip seeds composer and does not send", () => {
    const { window, doc, posted } = bootWebview();
    posted.length = 0;
    const invoice = doc.querySelector('.welcome-task-chip[data-task-id="invoice"]') as HTMLButtonElement;
    click(window, invoice);
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value.toLowerCase()).toMatch(/invoice/);
    expect(posted.some((m) => m.type === "send")).toBe(false);
  });

  it("appends when composer already has text", () => {
    const { window, doc } = bootWebview();
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "Hello first";
    const pitch = doc.querySelector('.welcome-task-chip[data-task-id="pitch"]') as HTMLButtonElement;
    click(window, pitch);
    expect(input.value.startsWith("Hello first\n")).toBe(true);
    expect(input.value.toLowerCase()).toMatch(/pitch|pptx|powerpoint/);
  });

  it("hides task chips after a user message clears welcome", () => {
    const { window, doc } = bootWebview();
    expect(doc.querySelectorAll(".welcome-task-chip").length).toBeGreaterThan(0);
    dispatch(window, { type: "userMessage", text: "hi", chips: [] });
    expect(doc.getElementById("welcome")?.hidden).toBe(true);
    expect(doc.querySelectorAll(".welcome-task-chip").length).toBe(0);
  });
});

describe("E2 documents popover", () => {
  it("requests listWorkspaceDocs and shows empty state", () => {
    const { window, doc, posted } = bootWebview();
    posted.length = 0;
    const btn = doc.getElementById("docs-btn") as HTMLButtonElement;
    click(window, btn);
    expect(posted).toContainEqual({ type: "listWorkspaceDocs" });
    const pop = doc.getElementById("docs-popover") as HTMLElement;
    expect(pop.hidden).toBe(false);
    dispatch(window, {
      type: "workspaceDocs",
      entries: [],
      total: 0,
      capped: false,
    });
    expect(pop.textContent).toMatch(/No business documents/i);
  });

  it("renders rows with Open/Reveal/Attach/Use actions", () => {
    const { window, doc, posted } = bootWebview();
    click(window, doc.getElementById("docs-btn") as HTMLButtonElement);
    dispatch(window, {
      type: "workspaceDocs",
      entries: [{ path: "/ws/report.docx", name: "report.docx", kind: "word" }],
      total: 1,
      capped: false,
    });
    const pop = doc.getElementById("docs-popover") as HTMLElement;
    expect(pop.textContent).toContain("report.docx");
    posted.length = 0;
    const attach = [...pop.querySelectorAll(".studio-doc-act")].find(
      (b) => b.textContent === "Attach",
    ) as HTMLButtonElement;
    click(window, attach);
    expect(posted).toContainEqual({
      type: "dropFile",
      path: "/ws/report.docx",
      shift: false,
    });
  });

  it("Use seeds composer with path and does not send", () => {
    const { window, doc, posted } = bootWebview();
    click(window, doc.getElementById("docs-btn") as HTMLButtonElement);
    dispatch(window, {
      type: "workspaceDocs",
      entries: [{ path: "C:\\docs\\a.xlsx", name: "a.xlsx", kind: "excel" }],
      total: 1,
      capped: false,
    });
    posted.length = 0;
    const use = [...doc.querySelectorAll(".studio-doc-act")].find(
      (b) => b.textContent === "Use",
    ) as HTMLButtonElement;
    click(window, use);
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value).toContain("a.xlsx");
    expect(posted.some((m) => m.type === "send")).toBe(false);
  });
});

describe("E4 templates moved off chat top bar", () => {
  it("no longer exposes Templates button or popover in the chat webview", () => {
    const { doc } = bootWebview();
    expect(doc.getElementById("templates-btn")).toBeNull();
    expect(doc.getElementById("templates-popover")).toBeNull();
  });
});

describe("catalog freeze cross-check", () => {
  it("task catalog length matches DOM chip count on welcome", () => {
    const { doc } = bootWebview();
    const pure = (taskQuickActions() as unknown[]).length;
    expect(doc.querySelectorAll(".welcome-task-chip").length).toBe(pure);
  });
});
