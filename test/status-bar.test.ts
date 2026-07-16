// Unit tests for the pure status-bar HUD builder (roadmap #2). Framework-free —
// the impure GrokSidebar gathers live state and feeds it into computeStatusBar.
import { describe, it, expect } from "vitest";
import { computeStatusBar } from "../src/status-bar";

describe("computeStatusBar — the native status-bar HUD", () => {
  it("hides entirely when nothing is active and nobody is waiting", () => {
    const v = computeStatusBar({ hasActive: false });
    expect(v.show).toBe(false);
    expect(v.warning).toBe(false);
  });

  it("renders model · effort · mode · ctx% for an active session", () => {
    const v = computeStatusBar({
      hasActive: true,
      modelName: "Grok Build",
      effort: "medium",
      mode: "agent",
      usedTokens: 210_000,
      contextWindow: 512_000,
    });
    expect(v.show).toBe(true);
    expect(v.text).toContain("Grok Build");
    expect(v.text).toContain("Medium"); // effort capitalized
    expect(v.text).toContain("Agent");
    expect(v.text).toContain("41%"); // 210000/512000 ≈ 41%
    expect(v.text).toContain("$(sparkle)"); // at-rest lead glyph
  });

  it("uses a spinner lead glyph while the active session is working", () => {
    const v = computeStatusBar({ hasActive: true, modelName: "Grok", working: true });
    expect(v.text).toContain("$(loading~spin)");
    expect(v.text).not.toContain("$(sparkle)");
  });

  it("omits effort when it's the CLI default (empty)", () => {
    const v = computeStatusBar({ hasActive: true, modelName: "Grok", effort: "", mode: "agent" });
    expect(v.text).toContain("Grok");
    expect(v.text).toContain("Agent");
    expect(v.tooltip).toContain("Effort: CLI default");
  });

  it("omits the context segment when token data is missing", () => {
    const v = computeStatusBar({ hasActive: true, modelName: "Grok", mode: "agent" });
    expect(v.text).not.toContain("%");
    expect(v.tooltip).not.toContain("Context:");
  });

  it("labels the modes as Agent / Plan first / Auto", () => {
    expect(computeStatusBar({ hasActive: true, modelName: "G", mode: "agent" }).text).toContain("Agent");
    expect(computeStatusBar({ hasActive: true, modelName: "G", mode: "plan" }).text).toContain("Plan first");
    expect(computeStatusBar({ hasActive: true, modelName: "G", mode: "yolo" }).text).toContain("Auto");
  });

  it("appends a needs-you badge and warning background when sessions are waiting", () => {
    const v = computeStatusBar({ hasActive: true, modelName: "Grok", mode: "agent", needsYouCount: 2 });
    expect(v.warning).toBe(true);
    expect(v.text).toContain("$(bell) 2");
    expect(v.tooltip).toContain("2 sessions waiting for you");
  });

  it("shows a standalone alert when a background session needs you but no chat is active", () => {
    const v = computeStatusBar({ hasActive: false, needsYouCount: 1 });
    expect(v.show).toBe(true);
    expect(v.warning).toBe(true);
    expect(v.text).toContain("$(bell)");
    expect(v.text).toContain("1 waiting");
  });

  it("clamps the context percentage at 100 and never goes negative on bad input", () => {
    const over = computeStatusBar({ hasActive: true, modelName: "G", usedTokens: 999_999, contextWindow: 1000 });
    expect(over.text).toContain("100%");
    const neg = computeStatusBar({ hasActive: true, modelName: "G", needsYouCount: -5 });
    expect(neg.warning).toBe(false);
  });

  it("shows 0% for a known zero count but hides the % when the count is unknown", () => {
    const zero = computeStatusBar({ hasActive: true, modelName: "G", usedTokens: 0, contextWindow: 512_000 });
    expect(zero.text).toContain("0%");
    const unknown = computeStatusBar({ hasActive: true, modelName: "G", contextWindow: 512_000 });
    expect(unknown.text).not.toContain("%");
  });

  it("falls back to a neutral model label when the name is blank", () => {
    const v = computeStatusBar({ hasActive: true, modelName: "", mode: "agent" });
    expect(v.text).toContain("Grok");
  });
});
