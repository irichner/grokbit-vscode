// DOM-level test for the command-output expander: an execute/command tool row
// gets a lazy "show output" toggle (+ copy) revealing a scrollable scrollback,
// closing the "I approved the command — what did it print?" gap. Drives the REAL
// shipped media/chat.js in a happy-dom window.
//
// Only command rows get output — a read's completion content is its file, an
// edit gets a diff. The category is stamped from the tool_call (which carries
// kind/title); the tool_call_update usually has neither, so we must NOT
// re-categorize the update (it would default everything to "command").
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const CMD_CALL = { toolCallId: "c1", kind: "execute", title: "Shell npm test" };
// grok's real content shape: [{ type:"content", content:{ type:"text", text } }].
const outUpdate = (id: string, text: string) => ({
  toolCallId: id,
  content: [{ type: "content", content: { type: "text", text } }],
});

function outputToggle(scope: Element): HTMLButtonElement | null {
  return scope.querySelector(".tool-output-toggle");
}

describe("command output expander", () => {
  it("attaches a 'show output' toggle to a command row and reveals the scrollback", () => {
    const { window, doc } = bootWebview();

    // Two commands so the group stays a group regardless of the lone-flatten rule.
    dispatch(window, { type: "toolCall", call: CMD_CALL });
    dispatch(window, { type: "toolCall", call: { toolCallId: "c2", kind: "execute", title: "Shell ls" } });
    dispatch(window, { type: "toolCallUpdate", call: outUpdate("c1", "PASS 42 tests\nDone") });
    dispatch(window, { type: "promptComplete", meta: {} });

    const item = doc.querySelector('.tool-item[data-tool-category="command"]') as HTMLElement;
    expect(item).not.toBeNull();
    const toggle = outputToggle(item)!;
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toBe("show output");
    expect(item.querySelector(".tool-output")).toBeNull(); // built lazily

    click(window, toggle);
    const pre = item.querySelector(".tool-output") as HTMLElement;
    expect(pre).not.toBeNull();
    expect(pre.textContent).toContain("PASS 42 tests");
    expect(pre.hidden).toBe(false);
    expect(toggle.textContent).toBe("hide output");
    expect((item.querySelector(".tool-output-copy") as HTMLElement).hidden).toBe(false);

    click(window, toggle); // toggle back off
    expect(pre.hidden).toBe(true);
    expect(toggle.textContent).toBe("show output");
  });

  it("keeps a LONE command with output expandable (not flattened), so the toggle survives", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "toolCall", call: CMD_CALL });
    dispatch(window, { type: "toolCallUpdate", call: outUpdate("c1", "hello from stdout") });
    dispatch(window, { type: "promptComplete", meta: {} }); // closeToolGroup

    // A group survives (chevron + body), not a bare .tool-flat that drops the item.
    expect(doc.querySelector(".tool-group")).not.toBeNull();
    expect(doc.querySelector(".tool-flat")).toBeNull();
    const toggle = outputToggle(doc.querySelector(".tool-group")!)!;
    expect(toggle).not.toBeNull();
    click(window, toggle);
    expect(doc.querySelector(".tool-output")!.textContent).toContain("hello from stdout");
  });

  it("a lone command with NO output still flattens to a clean single row", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "toolCall", call: CMD_CALL });
    dispatch(window, { type: "promptComplete", meta: {} });

    expect(doc.querySelector(".tool-flat")).not.toBeNull();
    expect(doc.querySelector(".tool-output-toggle")).toBeNull();
  });

  it("does NOT attach output to a read row even when its update carries text", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "toolCall", call: { toolCallId: "r1", kind: "read", title: "Read src/foo.ts" } });
    dispatch(window, { type: "toolCall", call: { toolCallId: "r2", kind: "read", title: "Read src/bar.ts" } });
    // A completion update with file content but no kind — must not be treated as command output.
    dispatch(window, { type: "toolCallUpdate", call: outUpdate("r1", "export const x = 1;") });
    dispatch(window, { type: "promptComplete", meta: {} });

    expect(doc.querySelector(".tool-output-toggle")).toBeNull();
  });

  it("copies the full (untruncated) output to the clipboard", async () => {
    const { window, doc } = bootWebview();
    let copied = "";
    Object.defineProperty((window as any).navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t: string) => { copied = t; return Promise.resolve(); } },
    });

    dispatch(window, { type: "toolCall", call: CMD_CALL });
    dispatch(window, { type: "toolCall", call: { toolCallId: "c2", kind: "execute", title: "Shell ls" } });
    dispatch(window, { type: "toolCallUpdate", call: outUpdate("c1", "line one\nline two") });
    dispatch(window, { type: "promptComplete", meta: {} });

    const item = doc.querySelector('.tool-item[data-tool-category="command"]') as HTMLElement;
    click(window, outputToggle(item)!); // reveal → copy button appears
    click(window, item.querySelector(".tool-output-copy") as HTMLButtonElement);
    expect(copied).toBe("line one\nline two");
  });

  it("restores command output from a single completed tool_call on session load", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "historyReplay", active: true });
    // On replay a completed command folds into one tool_call carrying its content.
    dispatch(window, {
      type: "toolCall",
      call: { ...CMD_CALL, status: "completed", content: [{ type: "content", content: { type: "text", text: "restored stdout" } }] },
    });
    dispatch(window, { type: "toolCall", call: { toolCallId: "c2", kind: "execute", title: "Shell ls" } });
    dispatch(window, { type: "historyReplay", active: false });

    const item = doc.querySelector('.tool-item[data-tool-category="command"]') as HTMLElement;
    const toggle = outputToggle(item)!;
    expect(toggle).not.toBeNull();
    click(window, toggle);
    expect(item.querySelector(".tool-output")!.textContent).toContain("restored stdout");
  });
});
