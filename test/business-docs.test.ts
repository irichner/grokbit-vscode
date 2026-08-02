// Pure helpers for business/office document classification + (disabled) cards
// (docs/plans/business-documents.md; cards off: .grokbit/plans/markdown-document-cards/).
import { describe, it, expect } from "vitest";
import {
  businessDocKindForPath,
  businessDocLabel,
  extractBusinessDocumentPaths,
  isCompletedToolPayload,
  openStrategyForKind,
} from "../src/acp-dispatch";

describe("businessDocKindForPath", () => {
  it("classifies frozen v1 extensions", () => {
    expect(businessDocKindForPath("/tmp/a.docx")).toBe("word");
    expect(businessDocKindForPath("C:\\out\\sheet.XLSX")).toBe("excel");
    expect(businessDocKindForPath("./deck.pptx")).toBe("powerpoint");
    expect(businessDocKindForPath("report.pdf")).toBe("pdf");
    expect(businessDocKindForPath("data.csv")).toBe("csv");
    expect(businessDocKindForPath("notes.md")).toBe("markdown");
    expect(businessDocKindForPath("README.markdown")).toBe("markdown");
    expect(businessDocKindForPath("memo.txt")).toBe("text");
    expect(businessDocKindForPath("letter.rtf")).toBe("text");
  });

  it("rejects non-business extensions (negative)", () => {
    expect(businessDocKindForPath("src/acp.ts")).toBeNull();
    expect(businessDocKindForPath("/img/cat.jpg")).toBeNull();
    expect(businessDocKindForPath("legacy.doc")).toBeNull();
    expect(businessDocKindForPath("old.xls")).toBeNull();
    expect(businessDocKindForPath("")).toBeNull();
  });
});

describe("businessDocLabel + openStrategyForKind", () => {
  it("labels kinds for the card chrome", () => {
    expect(businessDocLabel("word")).toBe("Word");
    expect(businessDocLabel("excel")).toBe("Excel");
    expect(businessDocLabel("powerpoint")).toBe("PowerPoint");
  });

  it("opens text-like docs in-editor and Office/PDF externally", () => {
    expect(openStrategyForKind("markdown")).toBe("text");
    expect(openStrategyForKind("csv")).toBe("text");
    expect(openStrategyForKind("text")).toBe("text");
    expect(openStrategyForKind("word")).toBe("external");
    expect(openStrategyForKind("excel")).toBe("external");
    expect(openStrategyForKind("powerpoint")).toBe("external");
    expect(openStrategyForKind("pdf")).toBe("external");
  });
});

describe("isCompletedToolPayload", () => {
  it("accepts missing status (replayed single tool_call) and completed", () => {
    expect(isCompletedToolPayload({ content: [] })).toBe(true);
    expect(isCompletedToolPayload({ status: "completed" })).toBe(true);
    expect(isCompletedToolPayload({ status: { type: "completed" } })).toBe(true);
  });

  it("rejects in-flight statuses (negative)", () => {
    expect(isCompletedToolPayload({ status: "in_progress" })).toBe(false);
    expect(isCompletedToolPayload({ status: "pending" })).toBe(false);
    expect(isCompletedToolPayload(null)).toBe(false);
  });
});

describe("extractBusinessDocumentPaths (tool-result cards disabled)", () => {
  function withText(text: string) {
    return {
      content: [{ type: "content", content: { type: "text", text } }],
    };
  }

  it("returns no card refs for office JSON paths", () => {
    expect(extractBusinessDocumentPaths(withText(JSON.stringify({
      path: "/home/u/.grok/sessions/s/out/brief.docx",
    })))).toEqual([]);
  });

  it("returns no card refs for output/file/paths JSON keys", () => {
    expect(extractBusinessDocumentPaths(withText(JSON.stringify({
      file: "C:\\Users\\me\\report.xlsx",
    })))).toEqual([]);
    expect(extractBusinessDocumentPaths(withText(JSON.stringify({
      paths: ["/tmp/a.pdf", "/tmp/b.md"],
    })))).toEqual([]);
  });

  it("returns no card refs for absolute prose office paths", () => {
    const prose = String.raw`Document saved to \\?\C:\Users\me\docs\q1.pptx.`;
    expect(extractBusinessDocumentPaths(withText(prose))).toEqual([]);
  });

  it("returns no card refs for markdown prose paths", () => {
    expect(extractBusinessDocumentPaths(withText(
      "Wrote /tmp/workspace/summary.md successfully",
    ))).toEqual([]);
  });

  it("returns empty for multi-block payloads that formerly de-duped", () => {
    const text = JSON.stringify({ path: "/tmp/a.csv" });
    const payload = {
      content: [
        { type: "content", content: { type: "text", text } },
        { type: "content", content: { type: "text", text: "also /tmp/a.csv" } },
      ],
    };
    expect(extractBusinessDocumentPaths(payload)).toEqual([]);
  });

  it("ignores images, source code, and pathless JSON (negative)", () => {
    expect(extractBusinessDocumentPaths(withText(JSON.stringify({ path: "/s/images/1.jpg" })))).toEqual([]);
    expect(extractBusinessDocumentPaths(withText("edited src/main.ts"))).toEqual([]);
    expect(extractBusinessDocumentPaths(withText(JSON.stringify({ ok: true })))).toEqual([]);
    expect(extractBusinessDocumentPaths({ content: [] })).toEqual([]);
    expect(extractBusinessDocumentPaths(null)).toEqual([]);
  });

  it("returns empty for bare filename mentions", () => {
    expect(extractBusinessDocumentPaths(withText("I created README.md for you."))).toEqual([]);
  });
});
