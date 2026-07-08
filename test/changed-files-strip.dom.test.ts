// DOM-level test for the changed-files strip: a scannable "N files changed" chip
// row above the composer, reflecting the edits grok APPLIED this turn. Drives the
// REAL shipped media/chat.js in a happy-dom window.
//
// Correctness contract pinned here: a file lands on the strip when grok emits its
// edit diff (applyToolDiffs); a plan-gate-blocked write that later fails is
// removed; replayed history never populates it; a new user message clears it.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const diffBlock = (path: string, oldText: string, newText: string) => ({
  type: "diff", path, oldText, newText,
});

function chips(doc: Document): HTMLButtonElement[] {
  return [...doc.querySelectorAll("#changed-files .changed-file-chip")] as HTMLButtonElement[];
}
function strip(doc: Document): HTMLElement {
  return doc.getElementById("changed-files") as HTMLElement;
}

describe("changed-files strip", () => {
  it("shows a chip per applied edit with add/del counts, hidden when empty", () => {
    const { window, doc } = bootWebview();
    expect(strip(doc).hidden).toBe(true);

    dispatch(window, { type: "userMessage", text: "edit stuff", chips: [] });
    dispatch(window, { type: "toolCall", call: { toolCallId: "e1", kind: "edit", title: "Edit src/auth.ts" } });
    dispatch(window, {
      type: "toolCallUpdate",
      call: { toolCallId: "e1", content: [diffBlock("src/auth.ts", "a\nb\nc", "a\nB\nc\nd")] },
    });

    expect(strip(doc).hidden).toBe(false);
    const cs = chips(doc);
    expect(cs).toHaveLength(1);
    expect(cs[0].textContent).toContain("auth.ts");
    expect(cs[0].textContent).toContain("+2"); // "B" and "d" added
    expect(cs[0].textContent).toContain("−1"); // "b" removed
    expect(strip(doc).querySelector(".changed-files-label")!.textContent).toBe("1 file changed");
  });

  it("opens the file when a chip is clicked", () => {
    const { window, doc, posted } = bootWebview();
    dispatch(window, { type: "userMessage", text: "go", chips: [] });
    dispatch(window, { type: "toolCall", call: { toolCallId: "e1", kind: "edit", title: "Edit x" } });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "e1", content: [diffBlock("src/x.ts", "1", "2")] } });

    click(window, chips(doc)[0]);
    const open = posted.find((m: any) => m.type === "openFile") as any;
    expect(open).toBeDefined();
    expect(open.path).toBe("src/x.ts");
  });

  it("counts multiple distinct files and pluralizes the label", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "go", chips: [] });
    dispatch(window, { type: "toolCall", call: { toolCallId: "e1", kind: "edit", title: "Edit a" } });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "e1", content: [diffBlock("a.ts", "x", "y")] } });
    dispatch(window, { type: "toolCall", call: { toolCallId: "e2", kind: "edit", title: "Edit b" } });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "e2", content: [diffBlock("b.ts", "x", "y")] } });

    expect(chips(doc)).toHaveLength(2);
    expect(strip(doc).querySelector(".changed-files-label")!.textContent).toBe("2 files changed");
  });

  it("removes a file whose write was blocked (the tool later fails)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "go", chips: [] });
    dispatch(window, { type: "toolCall", call: { toolCallId: "e1", kind: "edit", title: "Edit blocked.ts" } });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "e1", content: [diffBlock("blocked.ts", "a", "b")] } });
    expect(chips(doc)).toHaveLength(1);

    // A plan-gate-blocked write surfaces as a failed tool.
    dispatch(window, {
      type: "toolCallUpdate",
      call: { toolCallId: "e1", status: "failed", content: [{ text: "write blocked by plan mode" }] },
    });
    expect(strip(doc).hidden).toBe(true);
    expect(chips(doc)).toHaveLength(0);
  });

  it("clears when the next user message starts a new turn", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "turn 1", chips: [] });
    dispatch(window, { type: "toolCall", call: { toolCallId: "e1", kind: "edit", title: "Edit a" } });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "e1", content: [diffBlock("a.ts", "x", "y")] } });
    expect(chips(doc)).toHaveLength(1);

    dispatch(window, { type: "userMessage", text: "turn 2", chips: [] });
    expect(strip(doc).hidden).toBe(true);
    expect(chips(doc)).toHaveLength(0);
  });

  it("does NOT populate from replayed session history", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "historyReplay", active: true });
    dispatch(window, {
      type: "toolCall",
      call: {
        toolCallId: "e1", kind: "edit", status: "completed", title: "Edit old.ts",
        content: [diffBlock("old.ts", "a", "b")],
      },
    });
    dispatch(window, { type: "historyReplay", active: false });

    expect(strip(doc).hidden).toBe(true);
    expect(chips(doc)).toHaveLength(0);
  });
});
