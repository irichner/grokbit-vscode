// New-tab welcome canvas — WP3 of docs/plans/session-tab-ux-overhaul.md:
// - the #welcome-guide three-line strip (built by the pure welcomeGuide() in
//   media/webview-helpers.js, unit-tested in test/webview-helpers.test.ts)
// - the "render locked, not hidden" lifecycle inversion for the setup card /
//   capabilities panel is covered where those mounts already live
//   (test/session-setup.dom.test.ts, test/capabilities.dom.test.ts) — this
//   file owns the guide strip's own mount + its four lifecycle anchors.
// Drives the REAL shipped media/chat.js + media/webview-helpers.js in a
// happy-dom window via test/webview-harness.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview, dispatch } from "./webview-harness";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const guide = (doc: Document) => doc.getElementById("welcome-guide") as HTMLElement;
const guideLines = (doc: Document) =>
  [...guide(doc).querySelectorAll(".welcome-guide-row")].map((r) => r.textContent || "");

describe("welcome-guide strip", () => {
  it("renders three rows on a ready session, above #welcome-grid", () => {
    const { doc } = bootWebview();
    const el = guide(doc);
    expect(el.hidden).toBe(false);
    expect(guideLines(doc)).toHaveLength(3);
    const grid = doc.getElementById("welcome-grid");
    const DOCUMENT_POSITION_FOLLOWING = 4; // standard DOM constant (happy-dom has no global Node here)
    expect(el.compareDocumentPosition(grid!) & DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the plan-mode line differs between agent, plan and yolo", () => {
    const { window, doc } = bootWebview();
    const agentLines = guideLines(doc);

    dispatch(window, { type: "modeChanged", modeId: "plan" });
    const planLines = guideLines(doc);
    expect(planLines).not.toEqual(agentLines);
    expect(planLines.join(" ")).toMatch(/plan/i);

    dispatch(window, { type: "modeChanged", modeId: "yolo" });
    const yoloLines = guideLines(doc);
    expect(yoloLines).not.toEqual(agentLines);
    expect(yoloLines).not.toEqual(planLines);

    // [R] The Auto-accept variant must not claim files are protected — a
    // materially false safety statement to exactly the non-technical user
    // this strip exists for.
    const yoloText = yoloLines.join(" ").toLowerCase();
    expect(yoloText).toMatch(/without asking/);
    expect(yoloText).not.toMatch(/protect|safe|nothing changes/);
  });

  it("is backend-accurate: names the tab's own agent", () => {
    const { window, doc } = bootWebview();
    const grokText = guideLines(doc).join(" ");
    expect(grokText).toMatch(/\bGrok\b/);

    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });
    const claudeText = guideLines(doc).join(" ");
    expect(claudeText).toMatch(/\bClaude\b/);
    expect(claudeText).not.toBe(grokText);
  });

  // The 74e923a removal of the starter cards / task chips stays removed —
  // this is UI copy describing shipped behaviour, not a resurrected prompt
  // catalogue (docs/plans/session-tab-ux-overhaul.md § Non-goals). Asserted
  // directly here too, alongside the guide strip's own code, not only in
  // test/friendly-ui.dom.test.ts (which must stay green unmodified).
  it("[R] uses neither #welcome-starters nor .welcome-starter/.welcome-task-chip", () => {
    const { doc } = bootWebview();
    expect(doc.getElementById("welcome-starters")).toBeNull();
    expect(doc.querySelectorAll(".welcome-starter")).toHaveLength(0);
    expect(doc.querySelectorAll(".welcome-task-chip")).toHaveLength(0);
  });

  it("[R] .welcome-guide is an auto-fit grid clamped with min(100%, …) inside minmax() (source check)", () => {
    const css = read("../media/chat.css");
    const idx = css.indexOf("\n.welcome-guide {");
    expect(idx, 'expected to find ".welcome-guide {" starting a line in chat.css').toBeGreaterThan(-1);
    const open = css.indexOf("{", idx);
    const close = css.indexOf("}", open);
    const rule = css.slice(idx, close + 1);
    expect(rule).toContain("repeat(auto-fit, minmax(min(100%, 240px), 1fr))");
  });

  it("hides on first send (clearWelcome) and does not resurrect on a later capabilities message", () => {
    const { window, doc } = bootWebview();
    expect(guide(doc).hidden).toBe(false);
    dispatch(window, { type: "userMessage", text: "let's start", chips: [] });
    expect(guide(doc).hidden).toBe(true);
    expect(guide(doc).innerHTML).toBe("");
    dispatch(window, { type: "capabilities", backend: "grok", groups: [], scannedRoots: 0, truncated: false });
    expect(guide(doc).hidden).toBe(true);
  });

  it("hides on resetForNewSession (clearMessages) so a stale strip never lingers", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "userMessage", text: "go", chips: [] });
    expect(guide(doc).hidden).toBe(true);
    dispatch(window, { type: "clearMessages" });
    expect(guide(doc).hidden).toBe(true); // hidden again until the new session goes ready
    expect(guide(doc).innerHTML).toBe("");
  });

  for (const onboardingState of ["missing-cli", "auth-required", "missing-claude-adapter", "claude-auth-required"]) {
    it(`hides during onboarding (${onboardingState})`, () => {
      const { window, doc } = bootWebview();
      expect(guide(doc).hidden).toBe(false);
      dispatch(window, { type: "onboarding", state: onboardingState, platform: "linux", backend: "claude" });
      expect(guide(doc).hidden).toBe(true);
      expect(guide(doc).innerHTML).toBe("");
    });
  }

  it("restores once onboarding clears", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "onboarding", state: "auth-required" });
    expect(guide(doc).hidden).toBe(true);
    dispatch(window, { type: "onboarding", state: "" });
    dispatch(window, { type: "setBusy", value: false });
    expect(guide(doc).hidden).toBe(false);
  });
});
