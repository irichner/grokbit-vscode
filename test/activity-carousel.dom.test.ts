// DOM tests for the activity carousel — the compact per-turn block that rolls
// tool groups, thinking, and step narration into ONE strip row so long agentic
// turns stop scrolling the chat. Drives the REAL media/chat.js via the shared
// harness. Covers: live strip label/counter, ‹ › peek nav, finalize-to-summary,
// single-item unwrap (simple turns look classic), segment breaks around cards/
// deliverables, failure tinting, replay boundaries, the indicator guarantee,
// and the grok.compactActivity off-switch (classic mode).
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const tc = (call: any) => ({ type: "toolCall", call });
const read = (id: string, path: string) => tc({ toolCallId: id, kind: "read", rawInput: { path } });
const run = (id: string, command: string) => tc({ toolCallId: id, kind: "execute", rawInput: { command } });

const strip = (doc: Document) => doc.querySelector(".activity-carousel .activity-strip");
const label = (doc: Document) => doc.querySelector(".activity-carousel .activity-label")?.textContent ?? null;
const pos = (doc: Document) => doc.querySelector(".activity-carousel .activity-pos")?.textContent ?? null;
const body = (doc: Document) => doc.querySelector(".activity-carousel .activity-body") as HTMLElement | null;
const transcript = (doc: Document) =>
  (Array.from(doc.getElementById("messages")!.children) as HTMLElement[]).filter((c) => c.id !== "welcome");

describe("live strip", () => {
  it("collects tool calls into one block; the strip follows the newest action with a step counter", () => {
    const { window, doc } = bootWebview();
    dispatch(window, read("1", "/a.ts"));
    expect(doc.querySelectorAll(".activity-carousel").length).toBe(1);
    expect(doc.querySelector(".activity-carousel")!.classList.contains("live")).toBe(true);
    expect(label(doc)).toBe("Reading a.ts");
    expect(pos(doc)).toBe("1");
    dispatch(window, run("2", "npm test"));
    expect(label(doc)).toBe("Running command");
    expect(pos(doc)).toBe("2");
    // Still ONE transcript row — the whole point.
    expect(transcript(doc).length).toBe(1);
    // The group DOM lives inside the block body, hidden until expanded.
    expect(body(doc)!.hidden).toBe(true);
    expect(body(doc)!.querySelectorAll(".tool-item").length).toBe(2);
  });

  it("a streaming thought creates the block and the strip stands in as the thinking indicator", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "thoughtChunk", text: "weighing options…" } as any);
    expect(label(doc)).toBe("Thinking");
    // No standalone stand-in row — the strip carries the signal now.
    expect(doc.querySelector(".thinking-indicator")).toBeNull();
    // The real reasoning block still exists (CSS-hidden by thinking-hidden).
    expect(body(doc)!.querySelector(".msg.thinking")).not.toBeNull();
  });

  it("narration folds into the block as a step when its tool batch starts", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "Reading the files first." } as any);
    // While streaming, the (possible) answer stays a normal transcript bubble.
    expect(doc.querySelector("#messages > .msg.agent")).not.toBeNull();
    dispatch(window, read("1", "/a.ts"));
    // The bubble moved inside the block and became a step.
    expect(doc.querySelector("#messages > .msg.agent")).toBeNull();
    expect(body(doc)!.querySelector(".msg.agent .body")!.textContent).toBe("Reading the files first.");
    expect(pos(doc)).toBe("2"); // narration + the read
  });

  it("clicking the strip expands the bounded detail body", () => {
    const { window, doc } = bootWebview();
    dispatch(window, read("1", "/a.ts"));
    expect(body(doc)!.hidden).toBe(true);
    click(window, strip(doc)!);
    expect(body(doc)!.hidden).toBe(false);
    expect(doc.querySelector(".activity-carousel")!.classList.contains("expanded")).toBe(true);
  });

  it("starts expanded when thinking traces are shown (opt-in streams visibly)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "showThinking", value: true } as any);
    dispatch(window, { type: "thoughtChunk", text: "reasoning…" } as any);
    expect(body(doc)!.hidden).toBe(false);
  });
});

describe("‹ › peek navigation", () => {
  it("peeks back through earlier step labels and returns to live", () => {
    const { window, doc } = bootWebview();
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, run("2", "npm test"));
    expect(label(doc)).toBe("Running command");
    click(window, doc.querySelector(".activity-prev")!);
    expect(label(doc)).toBe("Reading a.ts");
    expect(pos(doc)).toBe("1/2");
    expect(doc.querySelector(".activity-carousel")!.classList.contains("peeking")).toBe(true);
    click(window, doc.querySelector(".activity-next")!);
    expect(label(doc)).toBe("Running command");
    expect(pos(doc)).toBe("2"); // live again
    expect(doc.querySelector(".activity-carousel")!.classList.contains("peeking")).toBe(false);
  });

  it("while peeking, new steps bump the counter but don't yank the label", () => {
    const { window, doc } = bootWebview();
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, read("2", "/b.ts"));
    click(window, doc.querySelector(".activity-prev")!);
    expect(label(doc)).toBe("Reading a.ts");
    dispatch(window, run("3", "npm test"));
    expect(label(doc)).toBe("Reading a.ts"); // still the peeked step
    expect(pos(doc)).toBe("1/3");
  });
});

describe("finalize at the turn boundary", () => {
  it("promptComplete destroys intermediate activity — only the final answer remains", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "Exploring." } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, read("2", "/b.ts"));
    dispatch(window, { type: "messageChunk", text: "Now the build." } as any);
    dispatch(window, run("3", "npm run build"));
    dispatch(window, { type: "messageChunk", text: "All done." } as any);
    dispatch(window, { type: "promptComplete" } as any);

    expect(doc.querySelector(".activity-carousel")).toBeNull();
    expect(doc.querySelector(".tool-group")).toBeNull();
    // Final agent answer survives (last bubble not folded into destroyed activity).
    expect(doc.querySelector(".msg.agent .body")!.textContent).toContain("All done.");
  });

  it("a single-batch turn destroys tools on seal — no permanent tool row", () => {
    const { window, doc } = bootWebview();
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, read("2", "/b.ts"));
    dispatch(window, { type: "promptComplete" } as any);
    expect(doc.querySelector(".activity-carousel")).toBeNull();
    expect(doc.querySelector(".tool-group")).toBeNull();
  });

  it("thinking is destroyed on seal; the final answer bubble remains", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "thoughtChunk", text: "hmm" } as any);
    dispatch(window, { type: "messageChunk", text: "Answer." } as any);
    dispatch(window, { type: "promptComplete" } as any);
    expect(doc.querySelector(".activity-carousel")).toBeNull();
    expect(doc.querySelector(".msg.thinking")).toBeNull();
    expect(doc.querySelector(".msg.agent .body")!.textContent).toBe("Answer.");
  });

  // Intermediate rows are gone after seal — late tool updates must no-op safely.
  it("a late toolCallUpdate after seal is a no-op", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "Running the tests." } as any);
    dispatch(window, run("c1", "npm test"));
    dispatch(window, run("c2", "npm run lint"));
    dispatch(window, { type: "promptComplete" } as any);
    expect(doc.querySelector(".activity-carousel")).toBeNull();
    dispatch(window, {
      type: "toolCallUpdate",
      call: {
        toolCallId: "c1", status: "completed",
        content: [{ type: "content", content: { type: "text", text: "47 passing" } }],
      },
    } as any);
    expect(doc.querySelector(".tool-output-toggle")).toBeNull();
  });

  it("a late diff after seal is a no-op", () => {
    const { window, doc } = bootWebview();
    dispatch(window, tc({ toolCallId: "e1", kind: "edit", rawInput: { path: "/a.ts" } }));
    dispatch(window, { type: "promptComplete" } as any);
    expect(doc.querySelector(".activity-carousel")).toBeNull();
    dispatch(window, {
      type: "toolCallUpdate",
      call: {
        toolCallId: "e1",
        content: [{ type: "diff", path: "/a.ts", oldText: "a\n", newText: "b\n" }],
      },
    } as any);
    expect(doc.querySelector(".tool-group")).toBeNull();
    expect(doc.querySelector(".preview-link")).toBeNull();
  });

  it("a late failure after seal is a no-op", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "Cleaning up." } as any);
    dispatch(window, run("x1", "rm /tmp/a"));
    dispatch(window, run("x2", "rm /tmp/b"));
    dispatch(window, { type: "promptComplete" } as any);
    dispatch(window, {
      type: "toolCallUpdate",
      call: {
        toolCallId: "x1", status: "failed",
        content: [{ type: "content", content: { type: "text", text: "permission denied" } }],
        rawOutput: { error: "tool_execution_failed", message: "permission denied" },
      },
    } as any);
    expect(doc.querySelector(".tool-item.tool-failed")).toBeNull();
    expect(doc.querySelector(".activity-carousel")).toBeNull();
  });

  it("a failed tool tints the live block; seal removes the block entirely", () => {
    const { window, doc } = bootWebview();
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, run("2", "bad-cmd"));
    dispatch(window, {
      type: "toolCallUpdate",
      call: {
        toolCallId: "2", status: "failed",
        content: [{ type: "content", content: { type: "text", text: "command not found" } }],
        rawOutput: { error: "tool_execution_failed", message: "command not found" },
      },
    } as any);
    expect(doc.querySelector(".activity-carousel")!.classList.contains("has-error")).toBe(true);
    dispatch(window, { type: "messageChunk", text: "step 2" } as any);
    dispatch(window, read("3", "/c.ts"));
    dispatch(window, { type: "promptComplete" } as any);
    expect(doc.querySelector(".activity-carousel")).toBeNull();
  });
});

describe("segment breaks", () => {
  it("a deliverable destroys the live block; later work starts a fresh live strip", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "Building the report." } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, { type: "document", kind: "word", path: "/out/report.docx", name: "report.docx" } as any);
    // First block is gone after the deliverable segment break.
    expect(doc.querySelector(".activity-carousel.live")).toBeNull();
    expect(doc.querySelector(".document-card")).not.toBeNull();
    dispatch(window, { type: "messageChunk", text: "Verifying." } as any);
    dispatch(window, read("2", "/b.ts"));
    expect(doc.querySelector(".activity-carousel.live")).not.toBeNull();
    dispatch(window, { type: "promptComplete" } as any);
    // Seal destroys the second live strip; document card remains.
    expect(doc.querySelector(".activity-carousel")).toBeNull();
    expect(doc.querySelector(".document-card")).not.toBeNull();
  });

  it("agentReset destroys the live block (suppressed turn leaves no live strip)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "working" } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, { type: "agentReset" } as any);
    expect(doc.querySelector(".activity-carousel.live")).toBeNull();
  });
});

describe("replay destroys intermediate activity per turn", () => {
  it("finalizes each replayed turn without leaving permanent activity rows", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "historyReplay", active: true } as any);
    dispatch(window, { type: "userMessageChunk", text: "first ask" } as any);
    dispatch(window, { type: "messageChunk", text: "Looking." } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, { type: "userMessageChunk", text: "second ask" } as any);
    dispatch(window, { type: "messageChunk", text: "Running." } as any);
    dispatch(window, run("2", "npm test"));
    dispatch(window, { type: "historyReplay", active: false } as any);

    expect(doc.querySelector(".activity-carousel.live")).toBeNull();
    expect(doc.querySelector(".activity-carousel.done")).toBeNull();
    expect(doc.querySelectorAll("#messages > .turn").length).toBe(2);
  });
});

describe("classic mode (grok.compactActivity off)", () => {
  it("initialState can turn the carousel off — tools render as direct rows", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "initialState", useCtrlEnter: false, compactActivity: false } as any);
    dispatch(window, read("1", "/a.ts"));
    expect(doc.querySelector(".activity-carousel")).toBeNull();
    expect(doc.querySelector(".tool-group")).not.toBeNull();
  });

  it("flipping it off mid-turn destroys the live block; next tools are classic", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "messageChunk", text: "working" } as any);
    dispatch(window, read("1", "/a.ts"));
    expect(doc.querySelector(".activity-carousel.live")).not.toBeNull();
    dispatch(window, { type: "compactActivity", value: false } as any);
    expect(doc.querySelector(".activity-carousel.live")).toBeNull();
    dispatch(window, read("2", "/b.ts")); // next batch renders classic
    expect(doc.querySelector(".tool-group")).not.toBeNull();
  });

  it("the gear → Config & debug switch posts setCompactActivity", () => {
    const { window, posted, doc } = bootWebview();
    click(window, doc.getElementById("gear-btn")!);
    const cfg = [...doc.querySelectorAll("#gear-popover .toolbar-popover-item")].find(
      (el) => el.textContent?.includes("Config & debug"),
    ) as HTMLElement;
    click(window, cfg);
    const toggle = [...doc.querySelectorAll("#gear-popover .toolbar-popover-item")].find(
      (el) => el.textContent?.includes("Compact activity view"),
    ) as HTMLElement;
    expect(toggle).toBeTruthy();
    expect(toggle.querySelector(".popover-switch.on")).not.toBeNull(); // on by default
    click(window, toggle);
    expect(posted.some((p) => p.type === "setCompactActivity" && p.value === false)).toBe(true);
  });
});
