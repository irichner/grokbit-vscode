// Session setup no longer renders a welcome-canvas tile — Agent / Model /
// Thinking / Mode live on the top-bar #session-setup-chip and composer
// #model-label → shared #session-settings-popover (see
// test/session-setup-chip.dom.test.ts and test/model-chip.dom.test.ts).
// This file only guards against the tile coming back.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch } from "./webview-harness";

describe("Session setup welcome tile (removed)", () => {
  it("[R] #session-setup-card is not in the DOM", () => {
    const { doc } = bootWebview();
    expect(doc.getElementById("session-setup-card")).toBeNull();
  });

  it("[R] session-ready welcome still shows Actions only — no setup tile", () => {
    const h = bootWebview();
    dispatch(h.window, {
      type: "session",
      sessionId: "s1",
      currentModelId: "grok-build",
      models: [{ modelId: "grok-build", name: "Grok Build" }],
      backend: "grok",
    });
    expect(h.doc.getElementById("session-setup-card")).toBeNull();
    expect(h.doc.getElementById("session-setup-chip")?.hidden).toBe(false);
    expect(h.doc.getElementById("capabilities-panel")).toBeTruthy();
  });
});
