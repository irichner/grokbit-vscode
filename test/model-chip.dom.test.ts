// DOM-level test for the composer model + effort chip. It surfaces the current
// model / effort (otherwise two clicks deep in the gear menu) always-visible in
// the composer toolbar, and opens the gear's model + effort controls on click.
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

  it("opens the gear's model + effort controls on click", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "session", sessionId: "s1", currentModelId: "grok-build", models: MODELS });

    const chip = doc.getElementById("model-label") as HTMLButtonElement;
    const gear = doc.getElementById("gear-popover") as HTMLElement;
    expect(gear.hidden).toBe(true);

    click(window, chip);
    expect(gear.hidden).toBe(false);
    // The main gear view leads with the model + effort row.
    expect(gear.querySelector(".model-effort-row")).not.toBeNull();
    expect(gear.querySelector(".model-name-btn")).not.toBeNull();

    click(window, chip); // toggles closed
    expect(gear.hidden).toBe(true);
  });
});
