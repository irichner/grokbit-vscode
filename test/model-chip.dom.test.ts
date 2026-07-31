// DOM-level test for the composer model + effort chip. It surfaces the current
// model / effort (otherwise two clicks deep in the gear menu) always-visible in
// the composer toolbar, and opens the compact quick-settings popover (Agent /
// Model / Thinking / Mode — docs/plans/claude-code-backend.md § WP7) on click.
// Drives the REAL shipped media/chat.js in a happy-dom window.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const MODELS = [
  { modelId: "grok-build", name: "Grok Build", totalContextTokens: 512_000 },
  { modelId: "grok-code", name: "Grok Code", totalContextTokens: 256_000 },
];

describe("composer model + effort chip", () => {
  it("stays hidden until a model is known, then shows the model name", () => {
    const { window, doc } = bootWebview();
    const chip = doc.getElementById("model-label") as HTMLButtonElement;
    expect(chip.hidden).toBe(true);

    dispatch(window, { type: "session", sessionId: "s1", currentModelId: "grok-build", models: MODELS });
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("Grok Build");
  });

  it("appends the effort as a short suffix when set", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "initialState", effort: "medium", useCtrlEnter: false });
    dispatch(window, { type: "session", sessionId: "s1", currentModelId: "grok-build", models: MODELS });

    const chip = doc.getElementById("model-label") as HTMLButtonElement;
    expect(chip.textContent).toContain("Grok Build");
    expect(chip.textContent).toContain("med"); // shortEffort(medium)
    expect(chip.title).toContain("Medium effort");
  });

  it("updates when the model switches", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "session", sessionId: "s1", currentModelId: "grok-build", models: MODELS });
    const chip = doc.getElementById("model-label") as HTMLButtonElement;
    expect(chip.textContent).toContain("Grok Build");

    dispatch(window, { type: "modelChanged", modelId: "grok-code" });
    expect(chip.textContent).toContain("Grok Code");
  });

  it("opens the compact quick-settings popover on click, not the gear's full menu", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "session", sessionId: "s1", currentModelId: "grok-build", models: MODELS });

    const chip = doc.getElementById("model-label") as HTMLButtonElement;
    const gear = doc.getElementById("gear-popover") as HTMLElement;
    const popover = doc.getElementById("session-settings-popover") as HTMLElement;
    expect(popover.hidden).toBe(true);

    click(window, chip);
    expect(popover.hidden).toBe(false);
    expect(gear.hidden).toBe(true); // the old full gear menu no longer opens from this chip

    click(window, chip); // toggles closed
    expect(popover.hidden).toBe(true);
  });
});

// docs/plans/claude-code-backend.md § WP7 — the SAME four controls (Agent /
// Model / Thinking / Mode) power both this popover and the new-tab "Session
// setup" welcome card, rendered from the one sessionSetupModel() builder
// (test/webview-helpers.test.ts covers the builder itself; the welcome card
// mount is covered separately in test/session-setup.dom.test.ts).
describe("composer quick-settings popover (Agent / Model / Thinking / Mode)", () => {
  function bootReady(backend: "grok" | "claude" = "grok") {
    const h = bootWebview();
    dispatch(h.window, {
      type: "backendChanged", backend, label: backend === "claude" ? "Claude Code" : "Grok Build",
    });
    dispatch(h.window, {
      type: "session", sessionId: "s1",
      currentModelId: backend === "claude" ? "sonnet" : "grok-build",
      models: backend === "claude" ? [{ modelId: "sonnet", name: "Sonnet" }] : MODELS,
      backend,
    });
    h.posted.length = 0;
    return h;
  }
  const popover = (doc: Document) => doc.getElementById("session-settings-popover") as HTMLElement;
  const openPopover = (h: ReturnType<typeof bootReady>) =>
    click(h.window, h.doc.getElementById("model-label") as HTMLButtonElement);

  it("renders Agent, Model, Thinking, and Mode for a grok session", () => {
    const h = bootReady("grok");
    openPopover(h);
    const labels = [...popover(h.doc).querySelectorAll(".session-settings-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Agent", "Model", "Thinking", "Mode"]);
  });

  it("omits Thinking for a Claude session — no effort axis", () => {
    const h = bootReady("claude");
    openPopover(h);
    const labels = [...popover(h.doc).querySelectorAll(".session-settings-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Agent", "Model", "Mode"]);
  });

  it("Agent row posts switchBackend for the other option and leaves the popover open", () => {
    const h = bootReady("grok");
    openPopover(h);
    const claudeBtn = [...popover(h.doc).querySelectorAll(".segmented-btn")]
      .find((b) => b.textContent === "Claude Code") as HTMLElement;
    click(h.window, claudeBtn);
    expect(h.posted).toContainEqual({ type: "switchBackend", backend: "claude" });
    expect(popover(h.doc).hidden).toBe(false);
  });

  it("Agent row does nothing when the already-active backend is clicked again", () => {
    const h = bootReady("grok");
    openPopover(h);
    const grokBtn = [...popover(h.doc).querySelectorAll(".segmented-btn")]
      .find((b) => b.textContent === "Grok Build") as HTMLElement;
    click(h.window, grokBtn);
    expect(h.posted.filter((m: any) => m.type === "switchBackend")).toHaveLength(0);
  });

  it("Model row posts setModel when a different model is picked", () => {
    const h = bootReady("grok");
    openPopover(h);
    const select = popover(h.doc).querySelector(".session-settings-select") as HTMLSelectElement;
    select.value = "grok-code";
    select.dispatchEvent(new (h.window as any).Event("change", { bubbles: true }));
    expect(h.posted).toContainEqual({ type: "setModel", modelId: "grok-code" });
  });

  it("Thinking row posts setEffort and updates the composer chip immediately (no host ack)", () => {
    const h = bootReady("grok");
    openPopover(h);
    const dots = [...popover(h.doc).querySelectorAll(".effort-dot")];
    click(h.window, dots[3]); // none, minimal, low, [medium], high, xhigh
    expect(h.posted).toContainEqual({ type: "setEffort", level: "medium" });
    const chip = h.doc.getElementById("model-label") as HTMLButtonElement;
    expect(chip.textContent).toContain("med");
  });

  it("Mode row posts setMode", () => {
    const h = bootReady("grok");
    openPopover(h);
    const planBtn = [...popover(h.doc).querySelectorAll(".segmented-btn")]
      .find((b) => b.textContent === "Plan") as HTMLElement;
    click(h.window, planBtn);
    expect(h.posted).toContainEqual({ type: "setMode", modeId: "plan" });
  });

  it("locks every control (with a tooltip) while busy, matching the gear's settingsLocked behaviour", () => {
    const h = bootReady("grok");
    openPopover(h);
    dispatch(h.window, { type: "setBusy", value: true, locked: true });
    const buttonsAndSelects = [
      ...popover(h.doc).querySelectorAll(".segmented-btn"),
      ...popover(h.doc).querySelectorAll(".session-settings-select"),
    ] as (HTMLButtonElement | HTMLSelectElement)[];
    const dots = [...popover(h.doc).querySelectorAll(".effort-dot")] as HTMLElement[];
    expect(buttonsAndSelects.length).toBeGreaterThan(0);
    expect(dots.length).toBeGreaterThan(0);
    for (const c of buttonsAndSelects) {
      expect(c.disabled).toBe(true);
      expect(c.title).toBe("Available once the session is ready");
    }
    // .effort-dot is a <span> — the codebase's existing lock idiom (see
    // renderGearMain) is a "disabled" class + tooltip, not a real disabled attribute.
    for (const d of dots) {
      expect(d.className).toContain("disabled");
      expect(d.title).toBe("Available once the session is ready");
    }
  });

  it("unlocks again once busy clears", () => {
    const h = bootReady("grok");
    openPopover(h);
    dispatch(h.window, { type: "setBusy", value: true, locked: true });
    dispatch(h.window, { type: "setBusy", value: false });
    const select = popover(h.doc).querySelector(".session-settings-select") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });

  it("clicking elsewhere closes the popover", () => {
    const h = bootReady("grok");
    openPopover(h);
    expect(popover(h.doc).hidden).toBe(false);
    click(h.window, h.doc.body);
    expect(popover(h.doc).hidden).toBe(true);
  });
});
