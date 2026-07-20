// DOM: business document result cards + welcome starter.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const messages = (doc: Document) => doc.getElementById("messages") as HTMLElement;

describe("document result card", () => {
  it("renders kind + filename and posts open/reveal/copy messages", async () => {
    const { window, posted, doc } = bootWebview();
    let copied = "";
    Object.defineProperty((window as any).navigator, "clipboard", {
      value: { writeText: (t: string) => { copied = t; return Promise.resolve(); } },
      configurable: true,
    });

    dispatch(window, {
      type: "document",
      kind: "word",
      path: "C:\\Users\\me\\brief.docx",
      name: "brief.docx",
    });

    const card = messages(doc).querySelector(".document-card") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.getAttribute("role")).toBe("group");
    expect(card.getAttribute("aria-label")).toMatch(/Word/i);
    expect(card.querySelector(".document-card-kind")!.textContent).toBe("Word");
    expect(card.querySelector(".document-card-name")!.textContent).toBe("brief.docx");

    const buttons = [...card.querySelectorAll(".document-card-btn")] as HTMLButtonElement[];
    expect(buttons).toHaveLength(3);

    const byLabel = (name: string) =>
      buttons.find((b) => b.getAttribute("aria-label") === name)!;

    click(window, byLabel("Open document"));
    expect(posted).toContainEqual({ type: "openFile", path: "C:\\Users\\me\\brief.docx" });

    click(window, byLabel("Reveal in file explorer"));
    expect(posted).toContainEqual({ type: "revealInOs", path: "C:\\Users\\me\\brief.docx" });

    click(window, byLabel("Copy path"));
    // clipboard write is async
    await Promise.resolve();
    expect(copied).toBe("C:\\Users\\me\\brief.docx");
  });

  it("labels excel/pdf kinds", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "document", kind: "excel", path: "/tmp/a.xlsx", name: "a.xlsx" });
    expect(messages(doc).querySelector(".document-card-kind")!.textContent).toBe("Excel");
    dispatch(window, { type: "document", kind: "pdf", path: "/tmp/b.pdf", name: "b.pdf" });
    const kinds = [...messages(doc).querySelectorAll(".document-card-kind")].map((n) => n.textContent);
    expect(kinds).toContain("PDF");
  });
});

describe("document-type seedComposer (host message)", () => {
  it("host seedComposer message fills the composer (PowerPoint prompt)", () => {
    const { window, doc } = bootWebview();
    // Generic host→webview seed path (launcher Create-a-document icons removed).
    const starters = doc.getElementById("welcome-starters") as HTMLElement;
    expect(starters.querySelectorAll(".welcome-doc-type")).toHaveLength(0);
    dispatch(window, { type: "seedComposer", text: "Create PowerPoint presentation: " });
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value).toBe("Create PowerPoint presentation: ");
  });
});
