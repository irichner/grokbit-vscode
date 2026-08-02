/**
 * Mid-turn queue visibility + steer shortcuts (vibe-coder-wave-1).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bootWebview, type Harness } from "./webview-harness";

let h: Harness;

beforeEach(() => {
  h = bootWebview({ ready: true });
  h.window.dispatchEvent(
    new h.window.MessageEvent("message", {
      data: { type: "setBusy", value: false, locked: false },
    }),
  );
});

afterEach(() => {
  h.window.close();
});

function dispatchHost(data: Record<string, unknown>) {
  h.window.dispatchEvent(new h.window.MessageEvent("message", { data }));
}

describe("mid-turn queue UI", () => {
  it("renders a Queued badge on userMessage with queued:true", () => {
    dispatchHost({
      type: "userMessage",
      text: "follow up please",
      chips: [],
      queued: true,
      queueId: "q-abc",
    });
    const msg = h.doc.querySelector('.msg.user[data-queue-id="q-abc"]');
    expect(msg).toBeTruthy();
    expect(msg?.getAttribute("data-queued")).toBe("true");
    const badge = msg?.querySelector(".msg-queued-badge");
    expect(badge?.textContent).toBe("Queued");
  });

  it("userMessageDequeued removes the badge without removing the bubble", () => {
    dispatchHost({
      type: "userMessage",
      text: "queued text",
      chips: [],
      queued: true,
      queueId: "q-1",
    });
    dispatchHost({ type: "userMessageDequeued", queueId: "q-1" });
    const msg = h.doc.querySelector('.msg.user[data-queue-id="q-1"]');
    expect(msg).toBeTruthy();
    expect(msg?.querySelector(".msg-queued-badge")).toBeNull();
    expect(msg?.getAttribute("data-queued")).toBeNull();
    expect(msg?.textContent || "").toMatch(/queued text/);
  });

  it("userQueueCleared removes all still-queued bubbles", () => {
    dispatchHost({
      type: "userMessage",
      text: "a",
      chips: [],
      queued: true,
      queueId: "q-a",
    });
    dispatchHost({
      type: "userMessage",
      text: "b",
      chips: [],
      queued: true,
      queueId: "q-b",
    });
    dispatchHost({ type: "userQueueCleared" });
    expect(h.doc.querySelectorAll('.msg.user[data-queued="true"]').length).toBe(0);
    expect(h.doc.querySelectorAll(".msg.user").length).toBe(0);
  });

  it("mid-turn Enter posts send without steer", () => {
    dispatchHost({ type: "setBusy", value: true, locked: false });
    h.posted.length = 0;
    const input = h.doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "queue me";
    input.dispatchEvent(
      new h.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    const send = h.posted.find((p) => p.type === "send");
    expect(send).toBeTruthy();
    expect(send?.steer).toBeFalsy();
    expect(send?.text).toBe("queue me");
  });

  it("mid-turn Ctrl+Enter posts send with steer when useCtrlEnter is false", () => {
    dispatchHost({ type: "setBusy", value: true, locked: false });
    // default useCtrlEnter is false
    h.posted.length = 0;
    const input = h.doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "steer me";
    input.dispatchEvent(
      new h.window.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        ctrlKey: true,
      }),
    );
    const send = h.posted.find((p) => p.type === "send");
    expect(send).toBeTruthy();
    expect(send?.steer).toBe(true);
    expect(send?.text).toBe("steer me");
  });

  it("mid-turn Ctrl+Shift+Enter posts steer when useCtrlEnter is true", () => {
    dispatchHost({ type: "initialState", useCtrlEnter: true } as any);
    // initialState may not set useCtrlEnter alone — also try the dedicated path
    dispatchHost({ type: "setBusy", value: false, locked: false });
    // Force via a config message if the webview listens — mirror gear path:
    // chat.js sets state.useCtrlEnter from initialState / config messages.
    // If only set via initialState field name differs, set state through known handler.
    const win = h.window as any;
    // Prefer sending the same field the host posts on ready.
    dispatchHost({ type: "initialState", useCtrlEnter: true, showThinking: false } as any);
    // Fallback: if still false, the test below may fail and we fix handler.
    dispatchHost({ type: "setBusy", value: true, locked: false });
    h.posted.length = 0;
    const input = h.doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "steer ctrlenter mode";
    input.dispatchEvent(
      new h.window.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        ctrlKey: true,
        shiftKey: true,
      }),
    );
    const send = h.posted.find((p) => p.type === "send");
    expect(send).toBeTruthy();
    expect(send?.steer).toBe(true);
  });
});
