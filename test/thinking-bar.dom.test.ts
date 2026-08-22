// Live-turn thinking strip — full-width bar under the top bar (plan-banner slot).
// Drives real media/chat.js. happy-dom cannot assert a running keyframe; visibility
// is the machine check. CSS animation is source-text in chat-layout.dom.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview, dispatch, click } from "./webview-harness";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

function bar(doc: Document): HTMLElement {
  return doc.getElementById("thinking-bar") as HTMLElement;
}

describe("thinking-bar markup", () => {
  it("exists in the harness and in getHtml, immediately under the top bar", () => {
    const { doc } = bootWebview();
    const el = bar(doc);
    expect(el).not.toBeNull();
    expect(el.previousElementSibling?.classList.contains("top-bar") ||
      el.previousElementSibling?.tagName.toLowerCase() === "header").toBe(true);
    const next = el.nextElementSibling as HTMLElement;
    expect(next?.id).toBe("plan-banner");

    const html = read("../src/sidebar.ts");
    expect(html).toMatch(/id="thinking-bar"/);
    const idxBar = html.indexOf('id="thinking-bar"');
    const idxPlan = html.indexOf('id="plan-banner"');
    expect(idxBar).toBeGreaterThan(-1);
    expect(idxPlan).toBeGreaterThan(idxBar);
  });
});

describe("thinking-bar visibility", () => {
  it("stays hidden during locked priming (busy is not thinking)", () => {
    const { doc } = bootWebview({ ready: false });
    expect(bar(doc).hidden).toBe(true);
  });

  it("shows on an unlocked busy turn and hides when the turn ends", () => {
    const { window, doc } = bootWebview();
    expect(bar(doc).hidden).toBe(true);

    dispatch(window, { type: "userMessage", text: "go", chips: [] });
    dispatch(window, { type: "setBusy", value: true });
    expect(bar(doc).hidden).toBe(false);

    dispatch(window, { type: "setBusy", value: false });
    expect(bar(doc).hidden).toBe(true);

    dispatch(window, { type: "userMessage", text: "again", chips: [] });
    dispatch(window, { type: "agentStart" });
    expect(bar(doc).hidden).toBe(false);
    dispatch(window, { type: "agentEnd" });
    expect(bar(doc).hidden).toBe(true);
  });

  it("stays hidden when busy is locked", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "setBusy", value: true, locked: true });
    expect(bar(doc).hidden).toBe(true);
  });

  it("stays hidden during historyReplay even if busy", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "historyReplay", active: true });
    dispatch(window, { type: "userMessage", text: "old", chips: [] });
    dispatch(window, { type: "setBusy", value: true });
    expect(bar(doc).hidden).toBe(true);
    dispatch(window, { type: "historyReplay", active: false });
  });

  it("stays hidden for the whole panel-rebuild window", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "beginPanelReplay" });
    dispatch(window, { type: "userMessage", text: "buffered", chips: [] });
    dispatch(window, { type: "agentStart" });
    expect(bar(doc).hidden).toBe(true);
  });

  it("after endPanelReplay, shows if the reconstructed turn is still in flight", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "beginPanelReplay" });
    dispatch(window, { type: "userMessage", text: "live", chips: [] });
    dispatch(window, { type: "agentStart" });
    expect(bar(doc).hidden).toBe(true);
    dispatch(window, { type: "endPanelReplay" });
    expect(bar(doc).hidden).toBe(false);
  });

  it("after endPanelReplay, stays hidden if the reconstructed turn already ended", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "beginPanelReplay" });
    dispatch(window, { type: "userMessage", text: "done", chips: [] });
    dispatch(window, { type: "agentStart" });
    dispatch(window, { type: "agentEnd" });
    dispatch(window, { type: "endPanelReplay" });
    expect(bar(doc).hidden).toBe(true);
  });

  it("hides while a live permission card is unresolved, then returns when resolved", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "edit", chips: [] });
    dispatch(window, { type: "setBusy", value: true });
    expect(bar(doc).hidden).toBe(false);

    dispatch(window, {
      type: "permissionRequest",
      req: {
        id: 7,
        toolCall: { toolCallId: "t1", kind: "edit", title: "Edit a.ts" },
        options: [
          { optionId: "once", name: "Allow once", kind: "allow_once" },
          { optionId: "rej", name: "Reject", kind: "reject_once" },
        ],
      },
    });
    expect(bar(doc).hidden).toBe(true);

    const allow = [...doc.querySelectorAll(".card.permission .card-actions button")]
      .find((b) => /Allow/i.test(b.textContent || "")) as HTMLButtonElement;
    click(window, allow);
    expect(bar(doc).hidden).toBe(false);
  });

  it("does not treat a restored plan-history card as needs-you", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "planHistory",
      text: "# Restored plan\n- step",
      verdict: "approved",
    });
    expect(doc.querySelector(".card.plan.plan-history")).not.toBeNull();
    dispatch(window, { type: "userMessage", text: "continue", chips: [] });
    dispatch(window, { type: "setBusy", value: true });
    expect(bar(doc).hidden).toBe(false);
  });

  it("can show at the same time as the plan-mode banner", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "modeChanged", modeId: "plan" });
    expect((doc.getElementById("plan-banner") as HTMLElement).hidden).toBe(false);
    dispatch(window, { type: "userMessage", text: "plan work", chips: [] });
    dispatch(window, { type: "setBusy", value: true });
    expect(bar(doc).hidden).toBe(false);
    expect((doc.getElementById("plan-banner") as HTMLElement).hidden).toBe(false);
  });
});
