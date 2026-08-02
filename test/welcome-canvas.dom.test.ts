// New-tab welcome canvas — simplified chrome (plan: welcome-chrome-simplify).
// Only "Grokbit" above Session Setup / Grokbit Actions; no logo, tagline,
// version line, or guide strip. Setup card + capabilities lifecycle still
// live in session-setup.dom.test.ts / capabilities.dom.test.ts.
// Drives the REAL shipped media/chat.js + media/webview-helpers.js via harness.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview, dispatch } from "./webview-harness";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("welcome canvas chrome (simplified)", () => {
  it("has only Grokbit above #welcome-grid — no logo, tagline, version, or guide", () => {
    const { doc } = bootWebview();
    const welcome = doc.getElementById("welcome") as HTMLElement;
    expect(welcome).toBeTruthy();
    expect(doc.querySelector(".welcome-mark")).toBeNull();
    expect(doc.querySelector(".welcome-tagline")).toBeNull();
    expect(doc.getElementById("welcome-version")).toBeNull();
    expect(doc.getElementById("welcome-guide")).toBeNull();

    const h2 = welcome.querySelector("h2");
    expect(h2?.textContent).toBe("Grokbit");
    const grid = doc.getElementById("welcome-grid");
    expect(grid).toBeTruthy();
    const DOCUMENT_POSITION_FOLLOWING = 4;
    expect(h2!.compareDocumentPosition(grid!) & DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("still mounts session-setup and capabilities under #welcome-grid", () => {
    const { doc } = bootWebview();
    const grid = doc.getElementById("welcome-grid")!;
    expect(grid.querySelector("#session-setup-card")).toBeTruthy();
    expect(grid.querySelector("#capabilities-panel")).toBeTruthy();
  });

  it("keeps About byline below the cards", () => {
    const { doc } = bootWebview();
    expect(doc.getElementById("welcome-about-link")).toBeTruthy();
  });

  // The 74e923a removal of the starter cards / task chips stays removed.
  it("[R] uses neither #welcome-starters nor .welcome-starter/.welcome-task-chip", () => {
    const { doc } = bootWebview();
    expect(doc.getElementById("welcome-starters")).toBeNull();
    expect(doc.querySelectorAll(".welcome-starter")).toHaveLength(0);
    expect(doc.querySelectorAll(".welcome-task-chip")).toHaveLength(0);
  });

  it("[R] CSS no longer defines .welcome-mark, .welcome-tagline, or .welcome-guide", () => {
    const css = read("../media/chat.css");
    expect(css).not.toMatch(/\.welcome-mark\s*\{/);
    expect(css).not.toMatch(/\.welcome-tagline\s*\{/);
    expect(css).not.toMatch(/\.welcome-guide\s*\{/);
    expect(css).not.toMatch(/\.welcome-guide-row\s*\{/);
  });

  it("onboarding still hides setup/capabilities and shows a card", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "onboarding", state: "auth-required" });
    const onb = doc.getElementById("welcome-onboarding")!;
    expect(onb.textContent).toMatch(/Sign in/i);
    const setup = doc.getElementById("session-setup-card") as HTMLElement;
    const caps = doc.getElementById("capabilities-panel") as HTMLElement;
    expect(setup.hidden || !setup.innerHTML).toBeTruthy();
    expect(caps.hidden || !caps.innerHTML).toBeTruthy();
  });

  // plan: remove-about-after-prompt — author display:flex must not beat [hidden]
  it("[R] CSS defines .welcome[hidden] { display: none }", () => {
    const css = read("../media/chat.css");
    expect(css).toMatch(/\.welcome\[hidden\]\s*\{\s*display:\s*none\s*;?\s*\}/);
  });

  it("hides the whole welcome (About + title) on first user message", () => {
    // happy-dom does not load media/chat.css (see chat-turn-containers /
    // chat-layout); shipped paint hide is proven by the CSS source rule above.
    // This case proves clearWelcome still sets the hidden attribute that rule keys off.
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "session",
      sessionId: "s1",
      currentModelId: "grok-build",
      models: [{ modelId: "grok-build", name: "Grok Build" }],
      backend: "grok",
    });

    const welcome = doc.getElementById("welcome") as HTMLElement;
    expect(welcome.hidden).toBe(false);
    expect(doc.getElementById("welcome-about-link")).toBeTruthy();
    expect(welcome.querySelector("h2")?.textContent).toBe("Grokbit");

    dispatch(window, { type: "userMessage", text: "hello", chips: [] });

    expect(welcome.hidden).toBe(true);
    // About + title remain under #welcome — they must not paint when [hidden] is set.
    expect(welcome.contains(doc.getElementById("welcome-about-link")!)).toBe(true);
    expect(welcome.querySelector("h2")?.textContent).toBe("Grokbit");
  });
});
