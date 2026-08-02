// DOM tests for turn containers — sticky user prompt, ephemeral activity,
// clean final answer, and collapsible prior turns.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview, dispatch, click } from "./webview-harness";

const tc = (call: any) => ({ type: "toolCall", call });
const read = (id: string, path: string) => tc({ toolCallId: id, kind: "read", rawInput: { path } });
const run = (id: string, command: string) => tc({ toolCallId: id, kind: "execute", rawInput: { command } });
const readSrc = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const turns = (doc: Document) =>
  Array.from(doc.querySelectorAll("#messages > .turn")) as HTMLElement[];

/** Slice a single top-level CSS rule; happy-dom does not load chat.css. */
function ruleBlock(css: string, selectorLineStart: string): string {
  const anchor = `\n${selectorLineStart}`;
  const idx = css.indexOf(anchor);
  expect(idx, `expected to find "${selectorLineStart}" starting a line in chat.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(idx, close + 1);
}

describe("turn shell + sticky prompt", () => {
  it("userMessage opens a .turn with prompt container and sticky active class", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "Fix the login bug" } as any);
    const list = turns(doc);
    expect(list.length).toBe(1);
    expect(list[0].classList.contains("active")).toBe(true);
    expect(list[0].querySelector(".turn-prompt .msg.user .body")!.textContent).toContain("Fix the login bug");
    // Exactly one full user bubble (the sticky prompt surface).
    expect(list[0].querySelectorAll(".turn-prompt .msg.user").length).toBe(1);
    // Summary stays in the DOM for collapse, but CSS hides the header while active
    // so the user does not see a second card with the same prompt.
    expect(list[0].querySelector(".turn-summary")!.textContent).toContain("Fix the login bug");
    const prompt = list[0].querySelector(".turn-prompt") as HTMLElement;
    // Sticky is declared in CSS for .turn.active .turn-prompt — class contract.
    expect(list[0].classList.contains("active")).toBe(true);
    expect(prompt).not.toBeNull();
  });

  it("active turn hides the header card (CSS contract — no dual prompt)", () => {
    // happy-dom has no stylesheet engine for chat.css; assert the shipped rule.
    const css = readSrc("../media/chat.css");
    const block = ruleBlock(css, ".turn.active .turn-header {");
    expect(block).toMatch(/display\s*:\s*none/);
    // Structural: one user bubble under the active turn after send.
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "only once" } as any);
    const turn = turns(doc)[0];
    expect(turn.classList.contains("active")).toBe(true);
    expect(turn.querySelectorAll(".msg.user").length).toBe(1);
    expect(turn.querySelector(".turn-header")).not.toBeNull(); // kept for collapse
    expect(turn.querySelector(".turn-prompt .msg.user .body")!.textContent).toContain("only once");
  });

  it("sending a second prompt collapses the previous turn", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "first ask" } as any);
    dispatch(window, { type: "messageChunk", text: "First answer." } as any);
    dispatch(window, { type: "promptComplete" } as any);
    dispatch(window, { type: "userMessage", text: "second ask" } as any);

    const list = turns(doc);
    expect(list.length).toBe(2);
    expect(list[0].classList.contains("collapsed")).toBe(true);
    expect(list[0].classList.contains("active")).toBe(false);
    // Prior turn is no longer active → header is the visible collapse chrome
    // (CSS no longer applies display:none; body is hidden).
    expect(list[0].querySelector(".turn-header")).not.toBeNull();
    expect(list[0].querySelector(".turn-summary")!.textContent).toContain("first ask");
    expect(list[0].querySelector(".turn-body")!.hasAttribute("hidden") ||
      getComputedStyle(list[0].querySelector(".turn-body")!).display === "none" ||
      list[0].classList.contains("collapsed")).toBe(true);
    expect(list[1].classList.contains("active")).toBe(true);
    expect(list[1].querySelector(".turn-summary")!.textContent).toContain("second ask");
    // New active turn still has exactly one user bubble.
    expect(list[1].querySelectorAll(".turn-prompt .msg.user").length).toBe(1);
  });
});

describe("live activity under the turn", () => {
  it("tools render as a single-line carousel under the active turn", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "explore" } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, run("2", "npm test"));

    const turn = turns(doc)[0];
    const carousel = turn.querySelector(".turn-activity .activity-carousel.live");
    expect(carousel).not.toBeNull();
    expect(turn.querySelector(".activity-label")!.textContent).toBe("Running command");
    // One carousel block, not free-floating under #messages.
    expect(doc.querySelectorAll("#messages > .activity-carousel").length).toBe(0);
  });
});

describe("seal: intermediate disappears, answer remains", () => {
  it("promptComplete leaves prompt + final answer only", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "what is 2+2" } as any);
    dispatch(window, { type: "messageChunk", text: "Looking it up." } as any);
    dispatch(window, read("1", "/math.ts"));
    dispatch(window, { type: "messageChunk", text: "The answer is 4." } as any);
    dispatch(window, { type: "promptComplete" } as any);

    const turn = turns(doc)[0];
    expect(turn.querySelector(".activity-carousel")).toBeNull();
    expect(turn.querySelector(".tool-group")).toBeNull();
    expect(turn.querySelector(".turn-activity")!.children.length).toBe(0);
    expect(turn.querySelector(".turn-prompt .msg.user")).not.toBeNull();
    expect(turn.querySelector(".turn-answer .msg.agent .body")!.textContent).toContain("The answer is 4.");
  });

  it("late toolCallUpdate after seal is a no-op (maps cleared)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "run tests" } as any);
    dispatch(window, run("c1", "npm test"));
    dispatch(window, run("c2", "npm run lint"));
    dispatch(window, { type: "promptComplete" } as any);
    dispatch(window, {
      type: "toolCallUpdate",
      call: {
        toolCallId: "c1",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "47 passing" } }],
      },
    } as any);
    const turn = turns(doc)[0];
    expect(turn.querySelector(".tool-output-toggle")).toBeNull();
    expect(turn.querySelector(".activity-carousel")).toBeNull();
  });
});

describe("expand / collapse prior turns", () => {
  it("clicking a collapsed turn header expands it to show the prior answer", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "first" } as any);
    dispatch(window, { type: "messageChunk", text: "Answer A" } as any);
    dispatch(window, { type: "promptComplete" } as any);
    dispatch(window, { type: "userMessage", text: "second" } as any);
    dispatch(window, { type: "messageChunk", text: "Answer B" } as any);
    dispatch(window, { type: "promptComplete" } as any);

    const list = turns(doc);
    expect(list[0].classList.contains("collapsed")).toBe(true);
    click(window, list[0].querySelector(".turn-header")!);
    expect(list[0].classList.contains("collapsed")).toBe(false);
    expect(list[0].querySelector(".turn-answer .msg.agent .body")!.textContent).toContain("Answer A");
    // Intermediate tools never come back.
    expect(list[0].querySelector(".tool-group")).toBeNull();
  });

  it("three completed turns form a collapsible stack", () => {
    const { window, doc } = bootWebview();
    for (const [q, a] of [
      ["one", "A"],
      ["two", "B"],
      ["three", "C"],
    ] as const) {
      dispatch(window, { type: "userMessage", text: q } as any);
      dispatch(window, { type: "messageChunk", text: a } as any);
      dispatch(window, { type: "promptComplete" } as any);
    }
    const list = turns(doc);
    expect(list.length).toBe(3);
    expect(list[0].classList.contains("collapsed")).toBe(true);
    expect(list[1].classList.contains("collapsed")).toBe(true);
    // Last completed turn stays active until another send; still no tools.
    expect(list[2].querySelector(".activity-carousel")).toBeNull();
    expect(list[2].querySelector(".turn-answer .msg.agent .body")!.textContent).toBe("C");
  });
});

describe("replay parity", () => {
  it("historyReplay builds turn containers without permanent activity", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "historyReplay", active: true } as any);
    dispatch(window, { type: "userMessageChunk", text: "first ask" } as any);
    dispatch(window, { type: "messageChunk", text: "Looking." } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, { type: "userMessageChunk", text: "second ask" } as any);
    dispatch(window, run("2", "npm test"));
    // Final answer lands AFTER tools — pre-tool text is narration and is ephemeral.
    dispatch(window, { type: "messageChunk", text: "Done." } as any);
    dispatch(window, { type: "historyReplay", active: false } as any);

    expect(doc.querySelector(".activity-carousel.live")).toBeNull();
    expect(doc.querySelector(".activity-carousel.done")).toBeNull();
    const list = turns(doc);
    expect(list.length).toBe(2);
    expect(list[0].classList.contains("collapsed")).toBe(true);
    expect(list[1].querySelector(".turn-answer .msg.agent .body")!.textContent).toContain("Done.");
  });
});

describe("interactive cards", () => {
  it("permission card mounts under the active turn and stays until answered", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "edit file" } as any);
    dispatch(window, read("1", "/a.ts"));
    dispatch(window, {
      type: "permissionRequest",
      req: {
        id: "p1",
        toolCall: { toolCallId: "t1", title: "Edit a.ts", kind: "edit" },
        options: [
          { optionId: "allow", kind: "allow_once", name: "Allow" },
          { optionId: "reject", kind: "reject_once", name: "Reject" },
        ],
      },
    } as any);

    const turn = turns(doc)[0];
    expect(turn.querySelector(".card.permission")).not.toBeNull();
    // Activity strip destroyed at the segment break.
    expect(turn.querySelector(".activity-carousel.live")).toBeNull();
  });
});
