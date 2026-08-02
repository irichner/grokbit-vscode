// DOM tests for the top-bar Session setup chip (session-setup-top-bar).
// Chip opens the shared #session-settings-popover via dual-anchor placement;
// the welcome Session setup tile is gone — settings only via chip/composer.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const MODELS = [
  { modelId: "grok-build", name: "Grok Build", totalContextTokens: 512_000 },
  { modelId: "grok-code", name: "Grok Code", totalContextTokens: 256_000 },
];

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
  if (backend === "grok") {
    dispatch(h.window, { type: "initialState", effort: "medium", useCtrlEnter: false });
  }
  h.posted.length = 0;
  return h;
}

const chip = (doc: Document) => doc.getElementById("session-setup-chip") as HTMLButtonElement;
const popover = (doc: Document) => doc.getElementById("session-settings-popover") as HTMLElement;
const topBar = (doc: Document) => doc.querySelector(".top-bar") as HTMLElement;
const modelLabel = (doc: Document) => doc.getElementById("model-label") as HTMLButtonElement;

describe("top-bar Session setup chip", () => {
  it("stays hidden until a model is known", () => {
    const { doc } = bootWebview();
    expect(chip(doc).hidden).toBe(true);
  });

  it("shows a summary label once the session is ready", () => {
    const h = bootReady("grok");
    expect(chip(h.doc).hidden).toBe(false);
    expect(chip(h.doc).textContent).toMatch(/Grok/);
    expect(chip(h.doc).textContent).toMatch(/Grok Build|Build/);
    expect(chip(h.doc).getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("reads as a clickable button: type=button, pill class, chevron, click title", () => {
    const h = bootReady("grok");
    const el = chip(h.doc);
    expect(el.tagName).toBe("BUTTON");
    expect(el.type).toBe("button");
    expect(el.classList.contains("session-setup-chip")).toBe(true);
    expect(el.classList.contains("toolbar-btn")).toBe(true);
    expect(el.querySelector(".session-setup-chip-chevron")).toBeTruthy();
    expect(el.querySelector(".session-setup-chip-chevron svg")).toBeTruthy();
    expect(el.title).toMatch(/click to change/i);
  });

  it("chevron is present while popover is open (aria-expanded true)", () => {
    const h = bootReady("grok");
    click(h.window, chip(h.doc));
    expect(chip(h.doc).getAttribute("aria-expanded")).toBe("true");
    expect(chip(h.doc).querySelector(".session-setup-chip-chevron")).toBeTruthy();
  });

  it("after first send: chip stays visible (settings remain reachable from top bar)", () => {
    const h = bootReady("grok");
    expect(chip(h.doc).hidden).toBe(false);
    dispatch(h.window, { type: "userMessage", text: "let's start", chips: [] });
    expect(chip(h.doc).hidden).toBe(false);
    expect(h.doc.getElementById("session-setup-card")).toBeNull();
  });

  it("click opens session-settings popover with four rows (Grok), not the gear menu", () => {
    const h = bootReady("grok");
    dispatch(h.window, { type: "userMessage", text: "go", chips: [] });
    const gear = h.doc.getElementById("gear-popover") as HTMLElement;
    expect(popover(h.doc).hidden).toBe(true);
    click(h.window, chip(h.doc));
    expect(popover(h.doc).hidden).toBe(false);
    expect(gear.hidden).toBe(true);
    const labels = [...popover(h.doc).querySelectorAll(".session-settings-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Agent", "Model", "Thinking", "Mode"]);
    expect(chip(h.doc).getAttribute("aria-expanded")).toBe("true");
  });

  it("dual-anchor: top chip re-parents popover under .top-bar", () => {
    const h = bootReady("grok");
    click(h.window, chip(h.doc));
    expect(popover(h.doc).hidden).toBe(false);
    expect(topBar(h.doc).contains(popover(h.doc))).toBe(true);
  });

  it("dual-anchor: bottom model-label re-parents popover under composer", () => {
    const h = bootReady("grok");
    click(h.window, modelLabel(h.doc));
    expect(popover(h.doc).hidden).toBe(false);
    const composer = h.doc.querySelector("footer.composer") || h.doc.querySelector(".composer");
    expect(composer && composer.contains(popover(h.doc))).toBe(true);
  });

  it("setBusy:true locks rows inside the popover; chip stays visible", () => {
    const h = bootReady("grok");
    expect(chip(h.doc).hidden).toBe(false);
    dispatch(h.window, { type: "setBusy", value: true, locked: true });
    expect(chip(h.doc).hidden).toBe(false);
    click(h.window, chip(h.doc));
    const controls = [
      ...popover(h.doc).querySelectorAll(".segmented-btn"),
      ...popover(h.doc).querySelectorAll(".session-settings-select"),
    ] as (HTMLButtonElement | HTMLSelectElement)[];
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) expect(c.disabled).toBe(true);
  });

  it("Claude: chip omits effort segment; popover omits Thinking", () => {
    const h = bootReady("claude");
    expect(chip(h.doc).hidden).toBe(false);
    expect(chip(h.doc).textContent).toMatch(/Claude/);
    expect(chip(h.doc).textContent).not.toMatch(/med|min|hig|xhi|none/);
    click(h.window, chip(h.doc));
    const labels = [...popover(h.doc).querySelectorAll(".session-settings-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Agent", "Model", "Mode"]);
  });

  it("onboarding hides the chip", () => {
    const h = bootReady("grok");
    expect(chip(h.doc).hidden).toBe(false);
    dispatch(h.window, { type: "onboarding", state: "auth-required" });
    expect(chip(h.doc).hidden).toBe(true);
  });

  it("Agent row from top-chip popover still posts switchBackend", () => {
    const h = bootReady("grok");
    click(h.window, chip(h.doc));
    const claudeBtn = [...popover(h.doc).querySelectorAll(".segmented-btn")]
      .find((b) => b.textContent === "Claude Code") as HTMLElement;
    click(h.window, claudeBtn);
    expect(h.posted).toContainEqual({ type: "switchBackend", backend: "claude" });
  });
});
