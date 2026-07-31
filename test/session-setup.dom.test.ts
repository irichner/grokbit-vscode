// DOM-level test for the new-tab "Session setup" welcome card (Agent / Model /
// Thinking / Mode — docs/plans/claude-code-backend.md § WP7). Rendered from the
// SAME sessionSetupModel() builder as the composer quick-settings popover
// (test/model-chip.dom.test.ts); the builder itself is unit-tested in
// test/webview-helpers.test.ts. Drives the REAL shipped media/chat.js in a
// happy-dom window.
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
  h.posted.length = 0;
  return h;
}
const card = (doc: Document) => doc.getElementById("session-setup-card") as HTMLElement;

describe("new-tab Session setup card", () => {
  it("stays hidden until the session is ready", () => {
    const { doc } = bootWebview({ ready: false }); // busy: true (startup spinner)
    expect(card(doc).hidden).toBe(true);
  });

  it("renders once the session is ready, above the onboarding slot", () => {
    const h = bootReady("grok");
    expect(card(h.doc).hidden).toBe(false);
    const labels = [...card(h.doc).querySelectorAll(".session-settings-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Agent", "Model", "Thinking", "Mode"]);
    const setup = card(h.doc);
    const onboarding = h.doc.getElementById("welcome-onboarding") as HTMLElement;
    const DOCUMENT_POSITION_FOLLOWING = 4; // standard DOM constant (happy-dom has no global Node here)
    expect(setup.compareDocumentPosition(onboarding) & DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("omits Thinking for a Claude session — no effort axis", () => {
    const h = bootReady("claude");
    const labels = [...card(h.doc).querySelectorAll(".session-settings-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Agent", "Model", "Mode"]);
  });

  it("explains the change is free — no restart — right on the card", () => {
    const h = bootReady("grok");
    const footer = card(h.doc).querySelector(".session-setup-footer");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toMatch(/free|restart/i);
  });

  it("Agent row posts switchBackend", () => {
    const h = bootReady("grok");
    const claudeBtn = [...card(h.doc).querySelectorAll(".segmented-btn")]
      .find((b) => b.textContent === "Claude Code") as HTMLElement;
    click(h.window, claudeBtn);
    expect(h.posted).toContainEqual({ type: "switchBackend", backend: "claude" });
  });

  it("Model row posts setModel", () => {
    const h = bootReady("grok");
    const select = card(h.doc).querySelector(".session-settings-select") as HTMLSelectElement;
    select.value = "grok-code";
    select.dispatchEvent(new (h.window as any).Event("change", { bubbles: true }));
    expect(h.posted).toContainEqual({ type: "setModel", modelId: "grok-code" });
  });

  it("Thinking row posts setEffort", () => {
    const h = bootReady("grok");
    const dots = [...card(h.doc).querySelectorAll(".effort-dot")];
    click(h.window, dots[0]); // "none"
    expect(h.posted).toContainEqual({ type: "setEffort", level: "none" });
  });

  it("Mode row posts setMode", () => {
    const h = bootReady("grok");
    const yoloBtn = [...card(h.doc).querySelectorAll(".segmented-btn")]
      .find((b) => b.textContent === "Auto accept") as HTMLElement;
    click(h.window, yoloBtn);
    expect(h.posted).toContainEqual({ type: "setMode", modeId: "yolo" });
  });

  it("locks every control while busy (mid-restart re-lock), matching the gear's settingsLocked behaviour", () => {
    const h = bootReady("grok");
    dispatch(h.window, { type: "setBusy", value: true, locked: true });
    const buttonsAndSelects = [
      ...card(h.doc).querySelectorAll(".segmented-btn"),
      ...card(h.doc).querySelectorAll(".session-settings-select"),
    ] as (HTMLButtonElement | HTMLSelectElement)[];
    expect(buttonsAndSelects.length).toBeGreaterThan(0);
    for (const c of buttonsAndSelects) expect(c.disabled).toBe(true);
    // The card stays visible (still a new/empty tab) but reflects the lock —
    // it must not disappear just because a settings change is restarting it.
    expect(card(h.doc).hidden).toBe(false);
  });

  it("disappears with the rest of the welcome screen on first send (clearWelcome)", () => {
    const h = bootReady("grok");
    expect(card(h.doc).hidden).toBe(false);
    dispatch(h.window, { type: "userMessage", text: "let's start", chips: [] });
    expect(card(h.doc).hidden).toBe(true);
    expect(card(h.doc).innerHTML).toBe("");
  });

  it("hides during onboarding and restores when cleared", () => {
    const h = bootReady("grok");
    dispatch(h.window, { type: "onboarding", state: "auth-required" });
    expect(card(h.doc).hidden).toBe(true);

    dispatch(h.window, { type: "onboarding", state: "ready" });
    expect(card(h.doc).hidden).toBe(false);
  });

  // [R] docs/plans/session-tab-ux-overhaul.md § WP3 — the card used to hide
  // entirely for the whole spawn+primer window (a blank canvas for seconds);
  // it now renders LOCKED instead, so the canvas is populated from the first
  // frame. `state.busy` (already true through a real restart's own
  // setBusy:true,locked:true right before "initialized") is what
  // currentSessionSetupModel() keys `locked` off — setBusy:false is what
  // unlocks, not the priming window's own hide/show.
  it("[R] renders locked (not hidden) while the session is priming (startingPhase), and unlocks at setBusy:false", () => {
    const h = bootReady("grok");
    dispatch(h.window, { type: "setBusy", value: true, locked: true });
    dispatch(h.window, { type: "initialized", info: { version: "0.2.91" } });
    expect(card(h.doc).hidden).toBe(false);
    const lockedControls = [
      ...card(h.doc).querySelectorAll(".segmented-btn"),
      ...card(h.doc).querySelectorAll(".session-settings-select"),
    ] as (HTMLButtonElement | HTMLSelectElement)[];
    expect(lockedControls.length).toBeGreaterThan(0);
    for (const c of lockedControls) {
      expect(c.disabled).toBe(true);
      // Matches the gear popover's own lock tooltip (renderGearMain).
      expect(c.title).toBe("Available once the session is ready");
    }

    dispatch(h.window, { type: "setBusy", value: false });
    expect(card(h.doc).hidden).toBe(false);
    const unlockedControls = [
      ...card(h.doc).querySelectorAll(".segmented-btn"),
      ...card(h.doc).querySelectorAll(".session-settings-select"),
    ] as (HTMLButtonElement | HTMLSelectElement)[];
    for (const c of unlockedControls) expect(c.disabled).toBe(false);
  });

  it("resets on a new session (resetForNewSession) so a stale card never lingers", () => {
    const h = bootReady("grok");
    dispatch(h.window, { type: "userMessage", text: "go", chips: [] });
    expect(card(h.doc).hidden).toBe(true);
    dispatch(h.window, { type: "clearMessages" });
    expect(card(h.doc).hidden).toBe(true); // hidden again until the new session goes ready
    expect(card(h.doc).innerHTML).toBe("");
  });
});
