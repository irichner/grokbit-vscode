// Full-canvas layout — WP1 of docs/plans/session-tab-ux-overhaul.md. happy-dom
// has no layout engine, so none of this can assert a computed pixel width;
// verification is source-text assertions on media/chat.css (the codebase
// already uses this technique — see the ".inert" hover-override check in
// test/capabilities.dom.test.ts and the launcher markup-parity test in
// test/launcher.dom.test.ts) plus structural checks through the real booted
// DOM (media/chat.js + media/webview-helpers.js via test/webview-harness.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview } from "./webview-harness";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Slice a single top-level CSS rule (selector list + declaration block) out
 *  of a stylesheet, anchored to the start of a line so a substring match
 *  inside an unrelated rule (e.g. ".welcome-grid > .session-setup-card {"
 *  containing the literal text ".session-setup-card {") can't be mistaken
 *  for the rule itself. */
function ruleBlock(css: string, selectorLineStart: string): string {
  const anchor = `\n${selectorLineStart}`;
  const idx = css.indexOf(anchor);
  expect(idx, `expected to find "${selectorLineStart}" starting a line in chat.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(idx, close + 1);
}

describe("full-canvas layout — no ribbon left (source check)", () => {
  const css = read("../media/chat.css");

  it("[R] .session-setup-card no longer carries max-width: 360px", () => {
    expect(ruleBlock(css, ".session-setup-card {")).not.toContain("360px");
  });

  it("[R] .capabilities-panel no longer carries max-width: 360px", () => {
    expect(ruleBlock(css, ".capabilities-panel {")).not.toContain("360px");
  });

  it("[R] .welcome-tagline no longer carries the 320px cap", () => {
    expect(ruleBlock(css, ".welcome-tagline {")).not.toContain("320px");
  });

  it("[R] .onb no longer carries the 320px cap", () => {
    expect(ruleBlock(css, ".onb {")).not.toContain("320px");
  });

  it("[R] .msg.user no longer carries a bare min-width: 40%", () => {
    const rule = ruleBlock(css, ".msg.user {");
    expect(rule).not.toMatch(/min-width:\s*40%\s*;/);
    expect(rule).not.toMatch(/max-width:\s*80%\s*;/);
    expect(rule).toContain("min-width: min(40%, 32ch)");
    expect(rule).toContain("max-width: min(80%, 95ch)");
  });
});

describe("full-canvas layout — intrinsic grids, overflow-safe (source check)", () => {
  const css = read("../media/chat.css");

  it("[R] .welcome-grid is a wrapping flex row, not two equal 1fr tracks", () => {
    // auto-fit only collapses EMPTY repetitions, so with exactly two children
    // it always produced two equal (W − 10)/2 tracks while the setup card sat
    // capped at 420px — dead space of (W − 10)/2 − 420, opening at W ≈ 850px
    // and growing at half the tab's rate. The two-1fr-track shape IS the
    // defect (docs/plans/actions-panel-layout-and-dynamic-capabilities.md).
    const rule = ruleBlock(css, ".welcome-grid {");
    expect(rule).toContain("display: flex");
    expect(rule).toContain("flex-wrap: wrap");
    expect(rule).not.toContain("repeat(auto-fit");
  });

  it("[R] .welcome-grid stretches its children to a shared height, never the flex default it inherited", () => {
    // Decision A: the two panels form one flush rectangle. `stretch` has to be
    // explicit — reverting to flex-start (or dropping the line, whose default
    // for a flex container happens to be stretch but reads as an accident)
    // loses the equal heights this was asked for.
    const rule = ruleBlock(css, ".welcome-grid {");
    expect(rule).toContain("align-items: stretch");
    expect(rule).not.toContain("align-items: flex-start");
    expect(rule).not.toContain("align-items: start");
  });

  it("[R] the Actions panel is the growable child; the setup card keeps its 420px form measure", () => {
    // The card freezing at its cap is what frees the space; the panel's
    // flex-grow is what absorbs it. Either half alone re-opens the gap.
    const card = ruleBlock(css, ".welcome-grid > .session-setup-card {");
    expect(card).toContain("flex: 1 1");
    expect(card).toContain("max-width: 420px");
    const panel = ruleBlock(css, ".welcome-grid > .capabilities-panel {");
    expect(panel).toContain("flex: 1 1");
    expect(panel).toContain("min-width: 0");
  });

  it("[R] both welcome-grid children clamp their flex-basis with min(100%, …)", () => {
    // Same guard the minmax() form carried: a bare 300px basis overflows a
    // ~250px split-editor tab. Restated for the flex form.
    expect(ruleBlock(css, ".welcome-grid > .session-setup-card {")).toContain("min(100%, 300px)");
    expect(ruleBlock(css, ".welcome-grid > .capabilities-panel {")).toContain("min(100%, 300px)");
  });

  it("[R] .session-setup-card keeps its content top-pinned inside the stretched box", () => {
    // With align-items: stretch the shorter card (normally this one) gains
    // dead space. It belongs BELOW the content — a justify-content here would
    // strand the footer at the bottom of an arbitrarily tall box on a wide,
    // skill-rich canvas. The flex column's own default does the right thing.
    const rule = ruleBlock(css, ".session-setup-card {");
    expect(rule).toContain("flex-direction: column");
    expect(rule).not.toContain("justify-content");
  });

  it("[R] .capability-group-items is an auto-fit grid clamped with min(100%, …) inside minmax()", () => {
    const rule = ruleBlock(css, ".capability-group-items {");
    expect(rule).toContain("repeat(auto-fit, minmax(min(100%, 300px), 1fr))");
    expect(rule).not.toContain("flex");
  });
});

describe("full-canvas layout — no @media queries introduced (source check)", () => {
  it("[R] the @media count in chat.css is unchanged — media queries evaluate the unzoomed viewport and lie under grok.chatFontScale", () => {
    const css = read("../media/chat.css");
    const count = (css.match(/@media/g) ?? []).length;
    // The two pre-existing prefers-reduced-motion queries are untouched;
    // this work uses intrinsic sizing (auto-fit/minmax/min()/ch) exclusively.
    expect(count).toBe(2);
  });
});

describe("full-canvas layout — the residual prose measure is left-aligned, never centred (source check)", () => {
  it("[R] .msg.agent .body prose rule caps width without centring (margin-inline: 0, not auto)", () => {
    const css = read("../media/chat.css");
    const idx = css.indexOf(".msg.agent .body > p,");
    expect(idx, "expected the prose-measure rule to exist").toBeGreaterThan(-1);
    const open = css.indexOf("{", idx);
    const close = css.indexOf("}", open);
    const rule = css.slice(idx, close + 1);
    expect(rule).toContain("max-width: 95ch");
    expect(rule).toContain("margin-inline: 0");
    // A centred cap is precisely the ribbon this work package exists to
    // remove — this assertion is mandatory (docs/plans/session-tab-ux-overhaul.md § R3).
    expect(rule).not.toContain("margin-inline: auto");
    expect(rule).not.toMatch(/margin:\s*0\s+auto/);
  });
});

describe("full-canvas layout — launcher isolation (source check)", () => {
  it("[R] getLauncherHtml renders none of the chat-canvas classes/ids this plan touches", () => {
    // media/launcher.js reuses chat.css, but only the row family
    // (.history-list, .history-row-*, .onb-action, .toolbar-popover) plus its
    // own .launcher-* rules — it never renders .messages/.composer/.welcome/
    // .session-setup-card/.capabilities-panel (CLAUDE.md § History pagination
    // → "Launcher safety"). Cheap standing guard against a future change
    // reusing a chat-canvas class in the 250px activity bar.
    const sidebarSrc = read("../src/sidebar.ts");
    const start = sidebarSrc.indexOf("private getLauncherHtml(");
    expect(start).toBeGreaterThan(-1);
    const methodSrc = sidebarSrc.slice(start, start + 3000);
    for (const forbidden of ["messages", "composer", "welcome-grid", "session-setup-card", "capabilities-panel"]) {
      expect(methodSrc, `getLauncherHtml must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe("full-canvas layout — orphaned duplicate #model-label (source check)", () => {
  it("[R] getHtml emits exactly one id=\"model-label\" element", () => {
    // The duplicate at the old :4704 (.model-label, in .toolbar-right) had no
    // CSS rule and no JS reference — getElementById("model-label") in
    // chat.js always resolved to the FIRST one (.model-label-btn, in
    // .toolbar-left). It shipped as an empty, hoverable, do-nothing button
    // wedged between Mode and Send. Deleted; the live one survives.
    const sidebarSrc = read("../src/sidebar.ts");
    const matches = sidebarSrc.match(/id="model-label"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe("full-canvas layout — welcome-grid parentage (real booted DOM)", () => {
  it("#session-setup-card and #capabilities-panel are children of #welcome-grid", () => {
    const { doc } = bootWebview();
    const grid = doc.getElementById("welcome-grid");
    expect(grid).not.toBeNull();
    const card = doc.getElementById("session-setup-card");
    const panel = doc.getElementById("capabilities-panel");
    expect(card?.parentElement?.id).toBe("welcome-grid");
    expect(panel?.parentElement?.id).toBe("welcome-grid");
    expect(grid?.classList.contains("welcome-grid")).toBe(true);
  });
});
