// Unit tests for the pure status-bar HUD builder (roadmap #2). Framework-free —
// the impure GrokSidebar gathers live state and feeds it into computeStatusBar.
import { describe, it, expect } from "vitest";
import { computeStatusBar } from "../src/status-bar";
import { Session } from "../src/session";

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

  // The bug this fixes: effort used to come from the shared `grok.defaultEffort`
  // config, so every tab's HUD showed the same value. sidebar.ts's updateStatusBar
  // now reads the focused session's own `effort` field (session.ts) instead —
  // simulate two focused tabs by feeding each session's own field straight in.
  it("reflects the focused session's own effort, not a value shared across tabs", () => {
    const sessionA = new Session();
    sessionA.effort = "high";
    const sessionB = new Session();
    sessionB.effort = "low";
    expect(sessionA.effort).not.toBe(sessionB.effort);

    const viewA = computeStatusBar({ hasActive: true, modelName: "Grok", effort: sessionA.effort, mode: "agent" });
    const viewB = computeStatusBar({ hasActive: true, modelName: "Grok", effort: sessionB.effort, mode: "agent" });
    expect(viewA.text).toContain("High");
    expect(viewA.text).not.toContain("Low");
    expect(viewB.text).toContain("Low");
    expect(viewB.text).not.toContain("High");
  });

  it("shows CLI default for a session that never had an explicit effort", () => {
    const session = new Session();
    const v = computeStatusBar({ hasActive: true, modelName: "Grok", effort: session.effort ?? "", mode: "agent" });
    expect(v.tooltip).toContain("Effort: CLI default");
  });

  it("Session.backend defaults to grok — grok is the default backend for every new tab", () => {
    expect(new Session().backend).toBe("grok");
  });

  // Claude Code is the second backend (docs/plans/claude-code-backend.md § WP3) —
  // the default `backend` (undefined) behaves exactly like grok, so every test
  // above is unaffected; these cover the explicit "claude" field.
  describe("backend field (Claude Code)", () => {
    it("defaults to the grok label when backend is undefined (every pre-WP3 caller)", () => {
      const v = computeStatusBar({ hasActive: true, modelName: "", mode: "agent" });
      expect(v.text).toContain("Grok");
      expect(v.text).not.toContain("Claude");
    });

    it("calls out Claude explicitly — grok stays the quiet default", () => {
      const v = computeStatusBar({ hasActive: true, backend: "claude", modelName: "Sonnet 4.5", mode: "agent" });
      expect(v.text).toContain("Claude");
      expect(v.text).toContain("Sonnet 4.5");
      expect(v.tooltip).toContain("Backend: Claude Code");
    });

    it("falls back to a neutral Claude label when the model name is blank", () => {
      const v = computeStatusBar({ hasActive: true, backend: "claude", modelName: "", mode: "agent" });
      expect(v.text).toContain("Claude");
    });

    it("omits the whole effort segment/tooltip line for Claude (it has no effort axis at all)", () => {
      const v = computeStatusBar({ hasActive: true, backend: "claude", modelName: "Sonnet", effort: "", mode: "agent" });
      expect(v.text).not.toContain("·  ·"); // no dangling empty segment
      expect(v.text.split(" · ").every((p) => p.trim().length > 0)).toBe(true);
      expect(v.tooltip).not.toContain("Effort:");
    });

    it("still shows effort for grok when explicitly backend:'grok'", () => {
      const v = computeStatusBar({ hasActive: true, backend: "grok", modelName: "Grok Build", effort: "medium", mode: "agent" });
      expect(v.text).toContain("Medium");
      expect(v.tooltip).toContain("Effort: Medium");
    });
  });
});
