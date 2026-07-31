// Studio 3.0.0 DOM: docs popover + insert policy.
// Create a document / Templates launcher chrome removed (see launcher.dom.test.ts);
// welcome starter cards + business task chips removed (see friendly-ui.dom.test.ts).
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

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
