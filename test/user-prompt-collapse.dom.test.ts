// DOM: long user prompts collapse to one line with Show more / Show less.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview, dispatch, click } from "./webview-harness";

const readSrc = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function ruleBlock(css: string, selectorLineStart: string): string {
  const anchor = `\n${selectorLineStart}`;
  const idx = css.indexOf(anchor);
  expect(idx, `expected to find "${selectorLineStart}" starting a line in chat.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(idx, close + 1);
}

const LONG_MULTI = "First line of a long prompt.\nSecond line with more detail.\nThird line still going.";
const SHORT = "Fix the login bug";
const LONG_ONE_LINE = "x".repeat(130);

describe("user prompt collapse — live", () => {
  it("multi-line userMessage is collapsible with a Show more control", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: LONG_MULTI } as any);
    const msg = doc.querySelector(".turn-prompt .msg.user") as HTMLElement;
    expect(msg).not.toBeNull();
    expect(msg.classList.contains("collapsible")).toBe(true);
    const expand = msg.querySelector(".msg-expand-btn") as HTMLButtonElement;
    expect(expand).not.toBeNull();
    expect(expand.textContent).toBe("Show more");
    expect(expand.hidden).toBe(false);
    // Full text remains in the DOM (clamped by CSS, not stripped).
    expect(msg.querySelector(".body")!.textContent).toContain("Second line");
  });

  it("short single-line prompts have no collapse chrome", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: SHORT } as any);
    const msg = doc.querySelector(".turn-prompt .msg.user") as HTMLElement;
    expect(msg.classList.contains("collapsible")).toBe(false);
    expect(msg.querySelector(".msg-expand-btn")).toBeNull();
    expect(msg.querySelector(".msg-collapse-btn")).toBeNull();
  });

  it("long single-line prompts (over min chars) collapse", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: LONG_ONE_LINE } as any);
    const msg = doc.querySelector(".turn-prompt .msg.user") as HTMLElement;
    expect(msg.classList.contains("collapsible")).toBe(true);
    expect(msg.querySelector(".msg-expand-btn")).not.toBeNull();
  });

  it("Show more expands; Show less collapses again", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: LONG_MULTI } as any);
    const msg = doc.querySelector(".turn-prompt .msg.user") as HTMLElement;
    const expand = msg.querySelector(".msg-expand-btn") as HTMLElement;
    click(window, expand);
    expect(msg.classList.contains("collapsible")).toBe(false);
    expect((expand as HTMLButtonElement).hidden).toBe(true);
    const collapse = msg.querySelector(".msg-collapse-btn") as HTMLElement;
    expect(collapse).not.toBeNull();
    expect(collapse.textContent).toBe("Show less");
    click(window, collapse);
    expect(msg.classList.contains("collapsible")).toBe(true);
    expect(msg.querySelector(".msg-collapse-btn")).toBeNull();
    expect((msg.querySelector(".msg-expand-btn") as HTMLButtonElement).hidden).toBe(false);
  });

  it("does not stack expand buttons on a single bubble", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: LONG_MULTI } as any);
    const msg = doc.querySelector(".turn-prompt .msg.user") as HTMLElement;
    expect(msg.querySelectorAll(".msg-expand-btn").length).toBe(1);
  });
});

describe("user prompt collapse — replay", () => {
  it("historyReplay multi-line chunk is collapsible by default", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "historyReplay", active: true } as any);
    dispatch(window, { type: "userMessageChunk", text: LONG_MULTI } as any);
    dispatch(window, { type: "messageChunk", text: "ok" } as any);
    dispatch(window, { type: "historyReplay", active: false } as any);
    const msg = doc.querySelector(".turn-prompt .msg.user") as HTMLElement;
    expect(msg).not.toBeNull();
    expect(msg.classList.contains("collapsible")).toBe(true);
    expect(msg.querySelector(".msg-expand-btn")).not.toBeNull();
    expect(msg.querySelector(".body")!.textContent).toContain("Second line");
  });
});

describe("user prompt collapse — turn containers still work", () => {
  it("second send still collapses the prior turn", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: LONG_MULTI } as any);
    dispatch(window, { type: "messageChunk", text: "Answer one." } as any);
    dispatch(window, { type: "promptComplete" } as any);
    dispatch(window, { type: "userMessage", text: "second ask" } as any);
    const turns = Array.from(doc.querySelectorAll("#messages > .turn")) as HTMLElement[];
    expect(turns.length).toBe(2);
    expect(turns[0].classList.contains("collapsed")).toBe(true);
    expect(turns[1].classList.contains("active")).toBe(true);
  });
});

describe("user prompt collapse — CSS contract", () => {
  it("uses one-line line-clamp, not max-height 48px", () => {
    const css = readSrc("../media/chat.css");
    const block = ruleBlock(css, ".msg.user.collapsible .body {");
    expect(block).toMatch(/-webkit-line-clamp\s*:\s*1|line-clamp\s*:\s*1/);
    expect(block).not.toMatch(/max-height\s*:\s*48px/);
  });

  it("does not hide expand behind hover-only display:none", () => {
    const css = readSrc("../media/chat.css");
    // The old rule was: .msg.user.collapsible:hover .msg-expand-btn { display: block; }
    // with base display:none — that must not be the sole discoverability path.
    expect(css).not.toMatch(/\.msg\.user\.collapsible:hover\s+\.msg-expand-btn\s*\{[^}]*display\s*:\s*block/);
    const expandBlock = ruleBlock(css, ".msg-expand-btn,");
    // Flow layout: not absolute bottom/right overlay
    expect(expandBlock + ruleBlock(css, ".msg-expand-btn[hidden] {")).not.toMatch(/position\s*:\s*absolute/);
  });
});
