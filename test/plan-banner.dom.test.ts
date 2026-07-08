// DOM-level tests for two discoverability affordances, both driving the REAL
// shipped media/chat.js in a happy-dom window:
//
//  1. The plan-mode banner — a full-width, unmissable indicator that writes and
//     commands are gated, driven by the same modeChanged signal that tints the
//     mode button (which was easy to miss on its own).
//  2. The keyboard-shortcuts panel + composer placeholder hint — the commands and
//     keybindings already existed in package.json, but nothing advertised them.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

function banner(doc: Document): HTMLElement {
  return doc.getElementById("plan-banner") as HTMLElement;
}

describe("plan-mode banner", () => {
  it("is hidden outside plan mode", () => {
    const { window, doc } = bootWebview();
    expect(banner(doc).hidden).toBe(true);

    dispatch(window, { type: "modeChanged", modeId: "agent" });
    expect(banner(doc).hidden).toBe(true);
  });

  it("appears when the session enters plan mode and hides again on exit", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "modeChanged", modeId: "plan" });
    expect(banner(doc).hidden).toBe(false);

    dispatch(window, { type: "modeChanged", modeId: "agent" });
    expect(banner(doc).hidden).toBe(true);
  });

  it("stays hidden in auto-accept (yolo) mode", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "modeChanged", modeId: "yolo" });
    expect(banner(doc).hidden).toBe(true);
  });
});

describe("keyboard-shortcut discoverability", () => {
  function openShortcuts(window: any, doc: Document): HTMLElement {
    click(window, doc.getElementById("gear-btn")!);
    const items = [...doc.querySelectorAll("#gear-popover .toolbar-popover-item")] as HTMLElement[];
    const entry = items.find((el) => el.textContent?.includes("Keyboard shortcuts"))!;
    expect(entry).toBeDefined();
    click(window, entry);
    return doc.getElementById("gear-popover") as HTMLElement;
  }

  it("lists Enter / Shift+Enter when Enter sends (the default)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "initialState", useCtrlEnter: false, effort: "" });

    const gear = openShortcuts(window, doc);
    const text = gear.textContent || "";
    expect(text).toContain("Send message");
    expect(text).toContain("New line");
    expect(text).toContain("Shift+Enter");
    expect(text).toContain("Open Grokbit");
    expect(text).toContain("Alt+G");
  });

  it("swaps the send/newline keys when Ctrl+Enter sends", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "initialState", useCtrlEnter: true, effort: "" });

    const gear = openShortcuts(window, doc);
    const kbds = [...gear.querySelectorAll(".popover-kbd")].map((el) => el.textContent);
    // First row is "Send message" → must be the modified key, not bare Enter.
    expect(kbds[0]).toMatch(/\+Enter$/);
    expect(kbds[1]).toBe("Enter"); // newline is now bare Enter
  });

  it("teaches the send key in the composer placeholder, tracking the setting", () => {
    const { window, doc } = bootWebview();
    const input = doc.getElementById("input") as HTMLTextAreaElement;

    dispatch(window, { type: "initialState", useCtrlEnter: false, effort: "" });
    expect(input.placeholder).toContain("Enter to send");
    expect(input.placeholder).toContain("Shift+Enter");

    dispatch(window, { type: "initialState", useCtrlEnter: true, effort: "" });
    expect(input.placeholder).toMatch(/\+Enter to send/);
    expect(input.placeholder).not.toContain("Shift+Enter");
  });
});
