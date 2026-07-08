// DOM-level tests for the context-usage donut. tokenUsage is the sole donut
// channel: the host pairs it with every live promptComplete that carries
// tokens, and it alone survives suppressed turns (hidden primer) and session
// resume (session/load carries no token meta — the host recovers usage from
// grok's on-disk signals.json). Drives the REAL shipped media/chat.js in a
// happy-dom window.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch } from "./webview-harness";

const MODELS = [
  { modelId: "grok-build", name: "Grok Build", totalContextTokens: 512_000 },
  { modelId: "composer-1", name: "Composer", totalContextTokens: 200_000 },
];

function boot() {
  const ctx = bootWebview();
  dispatch(ctx.window, { type: "session", sessionId: "s1", currentModelId: "grok-build", models: MODELS });
  const label = ctx.doc.getElementById("donut-label") as HTMLElement;
  return { ...ctx, label };
}

describe("context donut", () => {
  it("starts at zero once the model's context window is known", () => {
    const { label } = boot();
    expect(label.textContent).toBe("0K/512K");
  });

  it("updates on a live turn (the host pairs promptComplete with tokenUsage)", () => {
    const { window, label } = boot();
    dispatch(window, { type: "userMessage", text: "hi", chips: [] });
    dispatch(window, { type: "agentStart" });
    dispatch(window, { type: "messageChunk", text: "hello" });
    dispatch(window, { type: "promptComplete" });
    dispatch(window, { type: "tokenUsage", totalTokens: 11_536 });
    expect(label.textContent).toBe("12K/512K");
  });

  it("updates on tokenUsage (primer turn / resume recovery)", () => {
    const { window, label } = boot();
    dispatch(window, { type: "tokenUsage", totalTokens: 11_947 });
    expect(label.textContent).toBe("12K/512K");
    // The title is built with toLocaleString(), so compute the expected string
    // the same way — the group separator is machine-locale-dependent.
    expect(label.title).toContain((11_947).toLocaleString());
  });

  it("ignores promptComplete meta — tokenUsage is the sole donut channel", () => {
    const { window, label } = boot();
    dispatch(window, { type: "promptComplete", meta: { totalTokens: 99_000 } });
    expect(label.textContent).toBe("0K/512K");
  });

  it("keeps the recovered usage when a model change rescales the window", () => {
    const { window, label } = boot();
    dispatch(window, { type: "tokenUsage", totalTokens: 11_947 });
    dispatch(window, { type: "modelChanged", modelId: "composer-1" });
    expect(label.textContent).toBe("12K/200K");
  });

  it("returns to zero when a turn reports zero usage", () => {
    const { window, label } = boot();
    dispatch(window, { type: "tokenUsage", totalTokens: 11_947 });
    dispatch(window, { type: "tokenUsage", totalTokens: 0 });
    expect(label.textContent).toBe("0K/512K");
  });

  it("ignores a tokenUsage with no count", () => {
    const { window, label } = boot();
    dispatch(window, { type: "tokenUsage" });
    expect(label.textContent).toBe("0K/512K");
  });
});
