// DOM-level test for the capability browser (slash commands, skills, agents) —
// two mounts (welcome canvas + top-bar Actions popover) rendered from ONE pure
// builder (capabilityGroupsView, test/webview-helpers.test.ts). Drives the REAL
// shipped media/chat.js in a happy-dom window. See
// docs/plans/capability-surfacing-and-history-ux.md and
// docs/plans/session-tab-ux-overhaul.md § Test strategy → WP2 — cases marked
// [R] are regression tests for defects a prior review found.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootWebview, dispatch, click } from "./webview-harness";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

// Grokbit Actions only renders CAPABILITY_VISIBLE_KINDS (["grokbit"]). Fixtures
// that must appear on either mount use kind: "grokbit". A skill/agent/command
// fixture is only useful for asserting it is filtered out.
const GROUPS = [
  {
    kind: "grokbit",
    title: "Grokbit workflow",
    total: 3,
    items: [
      { kind: "grokbit", name: "plan", description: "Draft an implementation plan.", invoke: "/plan ", path: "/ws/.grok/skills/plan/SKILL.md", source: "Project (.grok)", origin: "disk" },
      { kind: "grokbit", name: "new", description: "Start a new session.", invoke: "/new ", source: "Built in", origin: "acp" },
      { kind: "grokbit", name: "explore", description: "Read-only exploration of the codebase.", source: "Built in", origin: "acp" },
    ],
  },
];

// Host still may send these; the filter must drop them so both mounts stay empty
// of Skills/Agents/Commands when the suite is absent.
const NON_GROKBIT_GROUPS = [
  {
    kind: "agent",
    title: "Agents",
    total: 1,
    items: [
      { kind: "agent", name: "explore", description: "Read-only exploration of the codebase.", source: "Built in", origin: "acp" },
    ],
  },
  {
    kind: "command",
    title: "Commands",
    total: 1,
    items: [
      { kind: "command", name: "new", description: "Start a new session.", invoke: "/new ", source: "Built in", origin: "acp" },
    ],
  },
  {
    kind: "skill",
    title: "Skills",
    total: 1,
    items: [
      { kind: "skill", name: "plan", description: "Draft an implementation plan.", invoke: "/plan ", path: "/ws/.grok/skills/plan/SKILL.md", source: "Project (.grok)", origin: "disk" },
    ],
  },
];

function panelOf(doc: Document) {
  return doc.getElementById("capabilities-panel") as HTMLElement;
}
function popoverOf(doc: Document) {
  return doc.getElementById("capabilities-popover") as HTMLElement;
}
function sendCapabilities(window: any, groups: unknown[], extra: Record<string, unknown> = {}) {
  dispatch(window, { type: "capabilities", backend: "grok", groups, scannedRoots: 5, truncated: false, ...extra });
}

// The bundled suite (docs/plans/grokbit-actions-and-bundled-skill-suite.md).
// The host sends it as an ordinary group of the new "grokbit" kind — the
// renderer iterates `groups` as given and never branches on kind strings, so
// these cases are really asserting that the standing rule still holds for a
// kind that did not exist when the renderer was written.
describe("Grokbit Actions — the bundled workflow group", () => {
  const SUITE_GROUP = {
    kind: "grokbit",
    title: "Grokbit workflow",
    total: 4,
    featuredCount: 4,
    items: [
      { kind: "grokbit", name: "grokbit-plan", description: "Plan first.", invoke: "/grokbit-plan ", path: "/home/u/.grok/skills/grokbit-plan/SKILL.md", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "grokbit-implement", description: "Verify or revert.", invoke: "/grokbit-implement ", path: "/home/u/.grok/skills/grokbit-implement/SKILL.md", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "grokbit-test", description: "Baseline, then verify.", invoke: "/grokbit-test ", path: "/home/u/.grok/skills/grokbit-test/SKILL.md", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "grokbit-document", description: "Derive, then check.", invoke: "/grokbit-document ", path: "/home/u/.grok/skills/grokbit-document/SKILL.md", source: "Grokbit", origin: "disk" },
    ],
  };

  function headings(container: HTMLElement) {
    return [...container.querySelectorAll(".capability-group-title")].map((el) => el.textContent);
  }

  it("leads both mounts, ahead of the user's own skills and the CLI's commands", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, [SUITE_GROUP, ...GROUPS]);
    expect(headings(panelOf(doc))[0]).toBe("Grokbit workflow");
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    // The popover's own Session controls group is prepended at render time and
    // stays first; the suite leads everything the HOST sent.
    expect(headings(popoverOf(doc)).filter((h) => h !== "Session controls")[0]).toBe("Grokbit workflow");
  });

  // [R] Every member is featured, so the group must render whole. A "Show all"
  // link here would hide the last steps of a four-step pipeline.
  it("[R] renders all four steps with no expand link", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, [SUITE_GROUP]);
    const panel = panelOf(doc);
    const names = [...panel.querySelectorAll(".capability-row-name")].map((el) => el.textContent);
    expect(names).toEqual(["grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document"]);
    expect(panel.querySelector(".capability-expand")).toBeNull();
  });

  it("a row seeds the composer with its slash form and sends nothing", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, [SUITE_GROUP]);
    posted.length = 0;
    click(window, panelOf(doc).querySelector(".capability-row") as HTMLElement);
    expect((doc.getElementById("input") as HTMLTextAreaElement).value).toBe("/grokbit-plan ");
    expect(posted.some((m) => m.type === "send")).toBe(false);
  });

  // Provisioning off, or a failed copy: host may still send Skills/Agents/
  // Commands, but the visible-kinds filter drops them — honest empty state,
  // not a heading with no rows and not a vanished panel.
  it("[R] suite absent (only non-grokbit groups) → honest empty state, not Skills/Agents/Commands", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, NON_GROKBIT_GROUPS);
    expect(headings(panelOf(doc))).toEqual([]);
    expect(panelOf(doc).hidden).toBe(false);
    expect(panelOf(doc).textContent).toMatch(/no skills installed yet/i);
    expect(panelOf(doc).textContent).not.toMatch(/Skills|Agents|Commands/);
  });
});

describe("capability browser — welcome panel", () => {
  it("renders group headers and rows in the order the message supplied", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);
    const headers = [...panel.querySelectorAll(".capability-group-title")].map((el) => el.textContent);
    expect(headers).toEqual(["Grokbit workflow"]);
    const names = [...panel.querySelectorAll(".capability-row-name")].map((el) => el.textContent);
    expect(names).toEqual(["plan", "new", "explore"]);
  });

  // [R] The row's primary text is the plain name, with the slash form beside
  // it as a small teaching chip — the inversion this package exists to ship
  // (docs/plans/session-tab-ux-overhaul.md § Approach B bullet 2).
  it("[R] a row renders .capability-row-name = the plain name AND .capability-row-cmd = /name", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const rows = [...panelOf(doc).querySelectorAll(".capability-row")];
    const planRow = rows.find((r) => r.querySelector(".capability-row-name")?.textContent === "plan")!;
    expect(planRow).toBeDefined();
    expect(planRow.querySelector(".capability-row-cmd")?.textContent).toBe("/plan");
  });

  it("a non-invocable row (no invoke) renders no .capability-row-cmd chip", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const rows = [...panelOf(doc).querySelectorAll(".capability-row")];
    const exploreRow = rows.find((r) => r.querySelector(".capability-row-name")?.textContent === "explore")!;
    expect(exploreRow).toBeDefined();
    expect(exploreRow.querySelector(".capability-row-cmd")).toBeNull();
  });

  it("a row with an argument hint renders .capability-row-hint; one without renders none", () => {
    const { window, doc } = bootWebview();
    // Names deliberately avoid CAPABILITY_FEATURED's grokbit list — neither is
    // featured, so both fall back into view
    // (CAPABILITY_FEATURED_FALLBACK = 5 > 2 items) without needing to expand.
    const groups = [{
      kind: "grokbit", title: "Grokbit workflow", total: 2,
      items: [
        { kind: "grokbit", name: "adr", description: "Record an ADR.", invoke: "/adr ", hint: "[short decision title]", source: "Project (.grok)", origin: "disk" },
        { kind: "grokbit", name: "review", description: "Review a change.", invoke: "/review ", source: "Project (.grok)", origin: "disk" },
      ],
    }];
    sendCapabilities(window, groups);
    const rows = [...panelOf(doc).querySelectorAll(".capability-row")];
    const adrRow = rows.find((r) => r.querySelector(".capability-row-name")?.textContent === "adr")!;
    const reviewRow = rows.find((r) => r.querySelector(".capability-row-name")?.textContent === "review")!;
    expect(adrRow.querySelector(".capability-row-hint")?.textContent).toBe("[short decision title]");
    expect(reviewRow.querySelector(".capability-row-hint")).toBeNull();
  });

  it("the panel renders its heading + explainer line exactly once, above the first group", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    const heading = panel.querySelectorAll(".capabilities-heading");
    const explainer = panel.querySelectorAll(".capabilities-explainer");
    expect(heading).toHaveLength(1);
    expect(explainer).toHaveLength(1);
    expect(explainer[0].textContent).toMatch(/nothing is sent until you press send/i);
    const firstGroup = panel.querySelector(".capability-group");
    expect(firstGroup).not.toBeNull();
    // Both the heading and the explainer must precede the first group in
    // document order (compareDocumentPosition: bit 4 = "follows").
    expect(heading[0].compareDocumentPosition(firstGroup!) & 4).toBeTruthy();
    expect(explainer[0].compareDocumentPosition(firstGroup!) & 4).toBeTruthy();
  });

  // [R] B6 — a workspace-tier item's provenance was only ever in the `title`
  // tooltip, indistinguishable at a glance from a builtin — even though
  // dedupeByPriority is workspace-first, so a repo-authored skill can silently
  // shadow a same-named one under the user's home dir.
  it("[R] shows a visible source badge for the workspace-tier (\"Project (.grok)\") row, and none for the Built-in rows", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const rows = [...panelOf(doc).querySelectorAll(".capability-row")];
    const planRow = rows.find((r) => r.textContent?.includes("/plan"))!;
    const badge = planRow.querySelector(".capability-row-source");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Project (.grok)");

    const builtinRows = rows.filter((r) => r !== planRow);
    expect(builtinRows.length).toBeGreaterThan(0);
    for (const r of builtinRows) expect(r.querySelector(".capability-row-source")).toBeNull();
  });

  it("clicking an invocable row seeds the composer and posts no send", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    posted.length = 0;
    const row = [...panelOf(doc).querySelectorAll(".capability-row")]
      .find((r) => r.textContent?.includes("/plan")) as HTMLElement;
    click(window, row);
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value).toBe("/plan ");
    expect(posted.some((m) => m.type === "send")).toBe(false);
    expect(posted.some((m) => m.type === "openFile")).toBe(false);
  });

  it("clicking a non-invocable row with a path posts openFile and leaves the composer untouched", () => {
    const { window, doc, posted } = bootWebview();
    const groups = [{
      kind: "grokbit", title: "Grokbit workflow", total: 1,
      items: [{ kind: "grokbit", name: "internal-notes", description: "Model-only skill.", path: "/ws/.grok/skills/internal-notes/SKILL.md", source: "Project (.grok)", origin: "disk" }],
    }];
    sendCapabilities(window, groups);
    posted.length = 0;
    const row = panelOf(doc).querySelector(".capability-row") as HTMLElement;
    click(window, row);
    expect(posted).toContainEqual({ type: "openFile", path: "/ws/.grok/skills/internal-notes/SKILL.md" });
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value).toBe("");
  });

  it("[R] clicking a non-invocable row without a path posts nothing at all; the row carries the inert class", () => {
    const { window, doc, posted } = bootWebview();
    const groups = [{
      kind: "grokbit", title: "Grokbit workflow", total: 1,
      items: [{ kind: "grokbit", name: "general-purpose", description: "Open-ended research and multi-step tasks.", source: "Built in", origin: "acp" }],
    }];
    sendCapabilities(window, groups);
    posted.length = 0;
    const row = panelOf(doc).querySelector(".capability-row") as HTMLElement;
    expect(row.classList.contains("inert")).toBe(true);
    click(window, row);
    expect(posted.length).toBe(0);
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value).toBe("");
  });

  // [R] docs/plans/session-tab-ux-overhaul.md § WP3 — inverts the prior
  // hides-through-priming behaviour: the panel now renders LOCKED (visible,
  // rows carry .locked, no click handler) the moment a capabilities payload
  // arrives, even while state.busy (startingPhase) is still up, and only
  // UNLOCKS at setBusy:false — it never re-hides and never re-requests.
  it("[R] lifecycle: renders locked as soon as a payload arrives during priming, then unlocks at setBusy:false, with no second request", () => {
    const { window, doc, posted } = bootWebview({ ready: false });
    dispatch(window, { type: "initialState", showCapabilities: true });
    expect(posted).toContainEqual({ type: "listCapabilities" });
    const panel = panelOf(doc);

    dispatch(window, { type: "initialized", info: { version: "1.0.0" } });
    expect(panel.hidden).toBe(true); // no payload yet — nothing to render

    sendCapabilities(window, GROUPS);
    expect(panel.hidden).toBe(false); // visible while still priming — LOCKED, not hidden
    const lockedRows = [...panel.querySelectorAll(".capability-row")];
    expect(lockedRows.length).toBe(3);
    for (const r of lockedRows) expect(r.classList.contains("locked")).toBe(true);
    // Refresh follows the rows' lock state: nothing here is actionable yet.
    expect(panel.querySelector(".capabilities-refresh")).toBeNull();

    posted.length = 0;
    const lockedRow = lockedRows.find((r) => r.textContent?.includes("/plan")) as HTMLElement;
    click(window, lockedRow);
    expect(posted.length).toBe(0); // no click handler installed while locked
    expect((doc.getElementById("input") as HTMLTextAreaElement).value).toBe("");

    dispatch(window, { type: "setBusy", value: false });
    expect(panel.hidden).toBe(false);
    const unlockedRows = [...panel.querySelectorAll(".capability-row")];
    expect(unlockedRows.length).toBe(3);
    for (const r of unlockedRows) expect(r.classList.contains("locked")).toBe(false);
    expect(panel.querySelector(".capabilities-refresh")).not.toBeNull();
    expect(posted.some((m) => m.type === "listCapabilities")).toBe(false); // retained payload, no re-request

    const unlockedRow = unlockedRows.find((r) => r.textContent?.includes("/plan")) as HTMLElement;
    click(window, unlockedRow);
    expect((doc.getElementById("input") as HTMLTextAreaElement).value).toBe("/plan ");
  });

  // [R] Whatever the lock state, onboarding must still be able to hide the
  // panel entirely — the onboarding card is the only thing that belongs on
  // the canvas while it's up.
  it("[R] showOnboarding(\"missing-claude-adapter\") hides the panel entirely, locked or not", () => {
    const { window, doc } = bootWebview({ ready: false });
    dispatch(window, { type: "initialState", showCapabilities: true });
    dispatch(window, { type: "initialized", info: { version: "1.0.0" } });
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false); // locked, but visible
    dispatch(window, { type: "onboarding", state: "missing-claude-adapter", backend: "claude" });
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");
  });

  it("[R] showOnboarding hides the panel — the onboarding card is the only thing on the canvas", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);
    dispatch(window, { type: "onboarding", state: "missing-claude-adapter", backend: "claude" });
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");
  });

  // [R] Zero discoveries on a LIVE session (not priming, not onboarding) is an
  // honest empty state, not a vanished panel — hiding here is what makes the
  // feature look broken to a user with nothing installed yet
  // (docs/plans/session-tab-ux-overhaul.md § Approach C / WP2 checklist).
  it("[R] groups: [] on a live session renders the muted empty line, not a hidden panel", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, []);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toMatch(/no skills installed yet/i);
    expect((doc.getElementById("welcome") as HTMLElement).hidden).toBe(false);
  });

  it("groups: [] while onboarding is active still hides the panel — onboarding wins", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "onboarding", state: "missing-claude-adapter", backend: "claude" });
    sendCapabilities(window, []);
    expect(panelOf(doc).hidden).toBe(true);
  });

  it("error set renders a muted one-line message, no throw", () => {
    const { window, doc } = bootWebview();
    expect(() => sendCapabilities(window, [], { error: "scan-failed" })).not.toThrow();
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toMatch(/couldn't/i);
  });

  it("disappears on first send (clearWelcome) and does not resurrect on a later capabilities message", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);
    dispatch(window, { type: "userMessage", text: "let's start", chips: [] });
    expect(panel.hidden).toBe(true);
    sendCapabilities(window, GROUPS);
    expect(panel.hidden).toBe(true);
  });

  // [R] switchBackend restarts the tab on the other agent; a retained
  // state.capabilities payload belongs to the PREVIOUS backend, so a stray
  // re-render racing ahead of the new scan (e.g. setBusy:false) must not
  // briefly show the wrong agent's skills/commands/agents.
  it("[R] backendChanged clears a retained capabilities payload from the previous backend", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);

    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");

    // Without a fresh capabilities message, a later setBusy:false must not
    // resurrect the OLD (grok) payload.
    dispatch(window, { type: "setBusy", value: false });
    expect(panel.hidden).toBe(true);
  });
});

describe("capability browser — initialState / showCapabilities gating", () => {
  it("[R] initialState with showCapabilities:false posts no listCapabilities and renders neither mount", () => {
    const { window, doc, posted } = bootWebview();
    posted.length = 0;
    dispatch(window, { type: "initialState", showCapabilities: false });
    expect(posted.some((m) => m.type === "listCapabilities")).toBe(false);
    expect(panelOf(doc).hidden).toBe(true);
    expect(popoverOf(doc).hidden).toBe(true);
  });

  it("[R] initialState with showCapabilities:true posts exactly one listCapabilities", () => {
    const { window, posted } = bootWebview();
    posted.length = 0;
    dispatch(window, { type: "initialState", showCapabilities: true });
    expect(posted.filter((m) => m.type === "listCapabilities").length).toBe(1);
  });

  it("a later showCapabilities:false hides both mounts; :true re-requests", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    const btn = doc.getElementById("capabilities-btn") as HTMLElement;
    click(window, btn); // open the popover so it has something to hide
    expect(popoverOf(doc).hidden).toBe(false);

    dispatch(window, { type: "showCapabilities", value: false });
    expect(panelOf(doc).hidden).toBe(true);
    expect(popoverOf(doc).hidden).toBe(true);

    posted.length = 0;
    dispatch(window, { type: "showCapabilities", value: true });
    expect(posted).toContainEqual({ type: "listCapabilities" });
  });

  // [R] B1 — the code review's blocking finding. `grok.showCapabilities: false`
  // stops the WEBVIEW from requesting the list, but a payload can still arrive
  // regardless (the host's `commandsUpdate` handler used to re-post it
  // unconditionally) — and the panel's own render gate didn't check the flag,
  // so the retained payload rendered anyway the moment `setBusy:false` cleared
  // the priming-window gate. This is the exact failing sequence the review
  // captured: initialState{showCapabilities:false} -> initialized ->
  // capabilities{...} -> setBusy:false.
  it("[R] showCapabilities:false stays off even if a capabilities payload arrives during priming and setBusy:false fires", () => {
    const { window, doc } = bootWebview({ ready: false });
    dispatch(window, { type: "initialState", showCapabilities: false });
    dispatch(window, { type: "initialized", info: { version: "1.0.0" } });
    sendCapabilities(window, GROUPS);
    dispatch(window, { type: "setBusy", value: false });
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe("");
  });

  it("[R] the Skills top-bar button is hidden when showCapabilities is false, from initialState", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "initialState", showCapabilities: false });
    const btn = doc.getElementById("capabilities-btn") as HTMLButtonElement;
    expect(btn.hidden).toBe(true);
  });

  it("[R] the Skills button re-appears when showCapabilities flips back on, and stays hidden while off", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "showCapabilities", value: false });
    const btn = doc.getElementById("capabilities-btn") as HTMLButtonElement;
    expect(btn.hidden).toBe(true);
    dispatch(window, { type: "showCapabilities", value: true });
    expect(btn.hidden).toBe(false);
  });

  it("[R] clicking the Skills button while disabled posts nothing and renders no popover (defense-in-depth beyond hiding it)", () => {
    const { window, doc, posted } = bootWebview();
    dispatch(window, { type: "showCapabilities", value: false });
    posted.length = 0;
    // Programmatic dispatch fires the handler regardless of the `hidden`
    // attribute (unlike a real user click on an invisible element) — this is
    // exactly why openCapabilitiesPopover() has its own guard, not just the
    // button's visibility.
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    expect(posted.some((m) => m.type === "listCapabilities")).toBe(false);
    expect(popoverOf(doc).hidden).toBe(true);
  });
});

// [R] B8 — an inert row (no invoke, no path) must show no hover affordance at
// all; happy-dom has no CSS engine to assert computed styles against, so this
// is a source-text check (the same technique the launcher markup-parity test
// already uses for drift nothing else catches).
describe("capability browser — inert row has no hover affordance (source check)", () => {
  it("[R] .capability-row.inert overrides the base hover background", () => {
    const css = read("../media/chat.css");
    const hoverIdx = css.indexOf(".capability-row:hover");
    const inertHoverIdx = css.indexOf(".capability-row.inert:hover");
    expect(hoverIdx).toBeGreaterThan(-1);
    expect(inertHoverIdx).toBeGreaterThan(hoverIdx); // must come AFTER to win the cascade
    const rule = css.slice(inertHoverIdx, inertHoverIdx + 80);
    expect(rule).toMatch(/background:\s*none/);
  });
});

describe("capability browser — Skills top-bar popover", () => {
  it("[R] the opening click's stopPropagation keeps the popover visible after the click finishes", () => {
    const { window, doc } = bootWebview();
    const btn = doc.getElementById("capabilities-btn") as HTMLElement;
    click(window, btn);
    expect(popoverOf(doc).hidden).toBe(false);
  });

  it("[R] the popover's own guard keeps it open on a click inside its body", () => {
    const { window, doc } = bootWebview();
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    const pop = popoverOf(doc);
    const head = pop.querySelector(".studio-popover-head") as HTMLElement;
    click(window, head);
    expect(pop.hidden).toBe(false);
  });

  it("opening the popover posts listCapabilities; the popover renders the same rows as the panel", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    posted.length = 0;
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    expect(posted).toContainEqual({ type: "listCapabilities" });
    // Discovered rows only: the popover additionally carries the session-toggle
    // group, which the welcome canvas deliberately does not (decision B —
    // the Session Setup card's Mode row is the canvas's mode control).
    const discovered = (el: HTMLElement) =>
      [...el.querySelectorAll(".capability-row")].filter((r) => !r.classList.contains("capability-row-toggle")).length;
    const panelRows = discovered(panelOf(doc));
    const popoverRows = discovered(popoverOf(doc));
    expect(popoverRows).toBe(panelRows);
    expect(popoverRows).toBeGreaterThan(0);
  });
});

// Toggle-shaped actions — session state flipped in place rather than dropped
// into the composer. Mount policy is POPOVER ONLY (decision B of
// docs/plans/actions-panel-layout-and-dynamic-capabilities.md): on the welcome
// canvas the Session Setup card's Mode row sits directly beside the Actions
// panel, so a switch there would be two controls for one piece of state on one
// screen.
describe("capability browser — session toggles (auto-accept)", () => {
  function openPopover(doc: Document, window: any) {
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    return popoverOf(doc);
  }
  const switchOf = (el: HTMLElement) =>
    el.querySelector(".capability-row-toggle .popover-switch") as HTMLElement;

  it("renders the toggle group first, above the discovered groups", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const pop = openPopover(doc, window);
    const titles = [...pop.querySelectorAll(".capability-group-title")].map((el) => el.textContent);
    expect(titles[0]).toBe("Session controls");
    expect(titles).toContain("Grokbit workflow");
    expect(titles).not.toContain("Skills");
  });

  it("clicking the switch in agent mode posts exactly setMode:yolo and nothing else", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    const pop = openPopover(doc, window);
    posted.length = 0;
    click(window, switchOf(pop));
    expect(posted).toEqual([{ type: "setMode", modeId: "yolo" }]);
  });

  it("clicking it while on posts setMode:agent — the OFF target is explicit, not a guess", () => {
    const { window, doc, posted } = bootWebview();
    dispatch(window, { type: "modeChanged", modeId: "yolo" });
    sendCapabilities(window, GROUPS);
    const pop = openPopover(doc, window);
    expect(switchOf(pop).classList.contains("on")).toBe(true);
    posted.length = 0;
    click(window, switchOf(pop));
    expect(posted).toEqual([{ type: "setMode", modeId: "agent" }]);
  });

  it("[R] a modeChanged from any other surface flips the switch with no click and no re-request", () => {
    // The single-source-of-truth guarantee: the row reads state.currentModeId
    // and holds nothing of its own, so it cannot drift from the mode button,
    // the Session Setup card's Mode row, or the quick-settings popover.
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    const pop = openPopover(doc, window);
    expect(switchOf(pop).classList.contains("on")).toBe(false);
    posted.length = 0;
    dispatch(window, { type: "modeChanged", modeId: "yolo" });
    expect(switchOf(pop).classList.contains("on")).toBe(true);
    expect(switchOf(pop).getAttribute("aria-checked")).toBe("true");
    expect(posted.some((m) => m.type === "listCapabilities")).toBe(false);
  });

  it("[R] renders while busy with no click handler at all, then becomes clickable at setBusy:false", () => {
    const { window, doc, posted } = bootWebview();
    dispatch(window, { type: "setBusy", value: true });
    sendCapabilities(window, GROUPS);
    const pop = openPopover(doc, window);
    const lockedRow = pop.querySelector(".capability-row-toggle") as HTMLElement;
    expect(lockedRow.classList.contains("locked")).toBe(true);
    posted.length = 0;
    click(window, switchOf(pop));
    expect(posted.length).toBe(0);

    dispatch(window, { type: "setBusy", value: false });
    expect((pop.querySelector(".capability-row-toggle") as HTMLElement).classList.contains("locked")).toBe(false);
    click(window, switchOf(pop));
    expect(posted).toEqual([{ type: "setMode", modeId: "yolo" }]);
  });

  // Each of these three paths returns early in renderCapabilitiesPopoverBody;
  // the toggle group is built from the webview's own state, so none of them
  // may suppress it.
  it("renders when discovery has not arrived yet (\"Scanning…\")", () => {
    const { window, doc } = bootWebview();
    const pop = openPopover(doc, window);
    expect(pop.textContent).toContain("Scanning…");
    expect(switchOf(pop)).not.toBeNull();
  });

  it("renders when the scan errored", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, [], { error: "boom" });
    const pop = openPopover(doc, window);
    expect(pop.textContent).toContain("Couldn't load skills & commands.");
    expect(switchOf(pop)).not.toBeNull();
  });

  it("renders when nothing at all was discovered", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, []);
    const pop = openPopover(doc, window);
    expect(pop.textContent).toContain("No skills, commands, or agents found.");
    expect(switchOf(pop)).not.toBeNull();
  });

  it("[R] the welcome-canvas panel renders no switch — one mode control per screen", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector(".popover-switch")).toBeNull();
    expect(panel.querySelector(".capability-row-toggle")).toBeNull();
    // ...and the Session Setup card's Mode row is still the canvas's control.
    expect(doc.getElementById("session-setup-card")?.textContent).toContain("Auto accept");
  });
});

// Discovery already re-scans the user's own disk on every request; what was
// missing is a way to ASK from a canvas that is already on screen. A skill the
// user (or the agent, via fs/write_text_file — which fires no editor save
// event) writes mid-session was otherwise invisible until a tab switch.
describe("capability browser — Refresh affordance", () => {
  it("clicking Refresh on the welcome panel posts exactly one listCapabilities and keeps the rendered rows", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    const panel = panelOf(doc);
    const before = panel.querySelectorAll(".capability-row").length;
    expect(before).toBe(3);

    posted.length = 0;
    click(window, panel.querySelector(".capabilities-refresh") as HTMLElement);
    expect(posted).toEqual([{ type: "listCapabilities" }]);
    // The panel renders from the retained payload; a refresh must not blank it
    // while the new one is in flight.
    expect(panel.querySelectorAll(".capability-row").length).toBe(before);
    expect(panel.hidden).toBe(false);
  });

  it("[R] clicking Refresh inside the popover posts listCapabilities and leaves the popover open", () => {
    const { window, doc, posted } = bootWebview();
    sendCapabilities(window, GROUPS);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    const pop = popoverOf(doc);
    expect(pop.hidden).toBe(false);

    posted.length = 0;
    click(window, pop.querySelector(".capabilities-refresh") as HTMLElement);
    expect(posted).toEqual([{ type: "listCapabilities" }]);
    // Without stopPropagation the click reaches the document-level
    // closePopovers() and hides the popover it was just used in — the exact
    // bug class this file already regression-tests twice.
    expect(pop.hidden).toBe(false);
  });

  it("[R] showCapabilities:false renders no Refresh button on either mount and posts nothing", () => {
    const { window, doc, posted } = bootWebview();
    dispatch(window, { type: "initialState", showCapabilities: false });
    sendCapabilities(window, GROUPS);
    posted.length = 0;
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    expect(panelOf(doc).querySelector(".capabilities-refresh")).toBeNull();
    expect(popoverOf(doc).querySelector(".capabilities-refresh")).toBeNull();
    expect(posted.some((m) => m.type === "listCapabilities")).toBe(false);
  });
});

// A second, plainly-labelled door back to the capability browser once the
// welcome screen (and its own door) is gone — docs/plans/
// session-tab-ux-overhaul.md § Approach B bullet 5.
describe("capability browser — Browse door in the #add-btn popover", () => {
  it("shows the \"Browse Grokbit Actions…\" item; clicking it opens the capabilities popover and posts listCapabilities", () => {
    const { window, doc, posted } = bootWebview();
    const addBtn = doc.getElementById("add-btn") as HTMLElement;
    click(window, addBtn);
    const addPopover = doc.getElementById("add-popover") as HTMLElement;
    expect(addPopover.hidden).toBe(false);
    const browseItem = [...addPopover.querySelectorAll(".toolbar-popover-item")]
      .find((el) => el.textContent?.includes("Browse Grokbit Actions")) as HTMLElement;
    expect(browseItem).toBeDefined();

    posted.length = 0;
    click(window, browseItem);
    // The same two stopPropagation guards every sibling popover has — the
    // opening click's own stopPropagation, plus the popover's own — must keep
    // #capabilities-popover open after the click finishes.
    expect(posted).toContainEqual({ type: "listCapabilities" });
    expect(popoverOf(doc).hidden).toBe(false);
    expect(addPopover.hidden).toBe(true);
  });

  it("[R] omits the Browse door when grok.showCapabilities is off — no dead-end click target", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "showCapabilities", value: false });
    const addBtn = doc.getElementById("add-btn") as HTMLElement;
    click(window, addBtn);
    const addPopover = doc.getElementById("add-popover") as HTMLElement;
    const items = [...addPopover.querySelectorAll(".toolbar-popover-item")];
    expect(items.some((el) => el.textContent?.includes("Browse Grokbit Actions"))).toBe(false);
    // The unrelated "Upload from computer" item is still there.
    expect(items.some((el) => el.textContent?.includes("Upload from computer"))).toBe(true);
  });
});

describe("composer placeholder is backend-aware", () => {
  it("a backendChanged to claude renames the placeholder; back to grok restores it", () => {
    const { window, doc } = bootWebview();
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });
    expect(input.placeholder).toMatch(/ask claude/i);
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    expect(input.placeholder).toMatch(/ask grok/i);
  });
});

// [R] WP2 re-presents the rows; it must not revert WP1's fill-the-canvas grid
// layout underneath them (docs/plans/session-tab-ux-overhaul.md § WP2
// checklist — "Do not revert WP1's .capability-group-items grid").
describe("capability browser — WP1's grid layout survives WP2's row changes (source check)", () => {
  it("[R] .capability-group-items is still the intrinsic auto-fit grid, not a flex column", () => {
    const css = read("../media/chat.css");
    const idx = css.indexOf("\n.capability-group-items {");
    expect(idx).toBeGreaterThan(-1);
    const open = css.indexOf("{", idx);
    // Rule may include nested comments; close at the first top-level `}` after
    // the property block — still works: minmax(...) is on one line.
    const close = css.indexOf("grid-template-columns:", open);
    const lineEnd = css.indexOf(";", close);
    const rule = css.slice(idx, lineEnd + 1);
    expect(rule).toContain("repeat(auto-fit, minmax(min(100%, 300px), 1fr))");
    expect(rule).toContain("min(100%");
    expect(rule).not.toMatch(/display:\s*flex/);
  });

  // T4: tiles wrap descriptions; causes (not layout) are source-checkable.
  it("[R] .capability-row-desc wraps (no nowrap/ellipsis) and tiles exclude the toggle row", () => {
    const css = read("../media/chat.css");
    const descIdx = css.indexOf("\n.capability-row-desc {");
    expect(descIdx).toBeGreaterThan(-1);
    const descOpen = css.indexOf("{", descIdx);
    const descClose = css.indexOf("}", descOpen);
    const descRule = css.slice(descIdx, descClose + 1);
    expect(descRule).not.toContain("white-space: nowrap");
    expect(descRule).not.toContain("text-overflow: ellipsis");
    expect(descRule).toMatch(/white-space:\s*normal/);
    // Property form only — comments must not reintroduce a clamp.
    expect(descRule).not.toMatch(/-webkit-line-clamp\s*:/);
    expect(css).toContain(".capability-row:not(.capability-row-toggle)");
  });
});

// Featured subset + per-group expand (docs/plans/actions-panel-featured-
// capabilities.md). CAPABILITY_FEATURED.grokbit lists the four suite steps;
// an oversized grokbit group keeps the expand/+N more machinery covered
// (LEAVE, not REPLACE) after Skills groups are filtered out of the UI.
describe("capability browser — featured partition + expand", () => {
  const MANY_WORKFLOWS = [{
    kind: "grokbit",
    title: "Grokbit workflow",
    total: 5,
    items: [
      { kind: "grokbit", name: "grokbit-plan", description: "Plan first.", invoke: "/grokbit-plan ", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "grokbit-implement", description: "Verify or revert.", invoke: "/grokbit-implement ", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "grokbit-test", description: "Baseline, then verify.", invoke: "/grokbit-test ", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "grokbit-document", description: "Derive, then check.", invoke: "/grokbit-document ", source: "Grokbit", origin: "disk" },
      { kind: "grokbit", name: "alpha", description: "Extra workflow.", invoke: "/alpha ", source: "Grokbit", origin: "disk" },
    ],
  }];
  const FEATURED_FOUR = ["grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document"];
  const ALL_FIVE = [...FEATURED_FOUR, "alpha"];

  // Excludes the session-toggle row's own .capability-row-name (it shares the
  // class but is not part of the discovered-groups list under test here).
  function rowNames(container: HTMLElement) {
    return [...container.querySelectorAll(".capability-row:not(.capability-row-toggle) .capability-row-name")]
      .map((el) => el.textContent);
  }

  it("renders only the featured rows by default; the rest are absent from the DOM, not merely hidden", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    const panel = panelOf(doc);
    expect(rowNames(panel)).toEqual(FEATURED_FOUR);
    expect(panel.textContent).not.toContain("alpha");
    const expandBtn = panel.querySelector(".capability-expand") as HTMLElement;
    expect(expandBtn).not.toBeNull();
    expect(expandBtn.textContent).toBe("Show all 5");
  });

  it("a group no bigger than its featured/fallback count renders no expand link at all", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, GROUPS); // each group here has exactly 1 item
    expect(panelOf(doc).querySelector(".capability-expand")).toBeNull();
  });

  it("clicking the expand link reveals the rest; the label flips to Show less and back", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    const expandBtn = panelOf(doc).querySelector(".capability-expand") as HTMLElement;
    click(window, expandBtn);
    expect(rowNames(panelOf(doc))).toEqual(ALL_FIVE);
    const collapseBtn = panelOf(doc).querySelector(".capability-expand") as HTMLElement;
    expect(collapseBtn.textContent).toBe("Show less");
    click(window, collapseBtn);
    expect(rowNames(panelOf(doc))).toEqual(FEATURED_FOUR);
    expect((panelOf(doc).querySelector(".capability-expand") as HTMLElement).textContent).toBe("Show all 5");
  });

  // [R] Executable guard for the constraint that the expand link is appended
  // AFTER .capability-group-items, never inside it (itemsEl is an auto-fit
  // grid — an in-grid link would render as a stray cell).
  it("[R] the expand link is a sibling of .capability-group-items, not a child of it", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    const groupEl = panelOf(doc).querySelector(".capability-group") as HTMLElement;
    expect(groupEl.querySelector(".capability-group-items .capability-expand")).toBeNull();
    const expandBtn = groupEl.querySelector(".capability-expand") as HTMLElement;
    expect(expandBtn).not.toBeNull();
    expect(expandBtn.previousElementSibling?.classList.contains("capability-group-items")).toBe(true);
  });

  it("+N more (host-cap overflow) stays out of the DOM while collapsed and appears only once expanded", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, [{ ...MANY_WORKFLOWS[0], total: 43 }]);
    const panel = panelOf(doc);
    expect(panel.querySelector(".capability-more")).toBeNull();
    click(window, panel.querySelector(".capability-expand") as HTMLElement);
    const more = panelOf(doc).querySelector(".capability-more");
    expect(more).not.toBeNull();
    // total 43 − 5 rendered items = +38 more
    expect(more!.textContent).toBe("+38 more");
  });

  it("expansion state survives a setBusy re-render instead of silently re-collapsing", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    click(window, panelOf(doc).querySelector(".capability-expand") as HTMLElement);
    expect(rowNames(panelOf(doc)).length).toBe(5);
    dispatch(window, { type: "setBusy", value: true });
    dispatch(window, { type: "setBusy", value: false });
    expect(rowNames(panelOf(doc)).length).toBe(5);
  });

  // [R] The other half of the "survives a re-render" invariant: a NEW session
  // must NOT inherit the old one's expansion choice, or resetForNewSession
  // could silently drop this line in a future edit with nothing to catch it.
  it("[R] a session reset (clearMessages) re-collapses an expanded group", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    click(window, panelOf(doc).querySelector(".capability-expand") as HTMLElement);
    expect(rowNames(panelOf(doc)).length).toBe(5);
    dispatch(window, { type: "clearMessages" });
    sendCapabilities(window, MANY_WORKFLOWS);
    expect(rowNames(panelOf(doc))).toEqual(FEATURED_FOUR);
  });

  // [R] Unlike Refresh (a host round-trip) and row clicks (a composer seed),
  // expanding is pure local display — nothing about the priming window makes
  // it a lie (docs/plans/actions-panel-featured-capabilities.md § Decision 5).
  it("[R] expanding works while locked; rows stay locked and no message is posted", () => {
    const { window, doc, posted } = bootWebview({ ready: false });
    dispatch(window, { type: "initialState", showCapabilities: true });
    dispatch(window, { type: "initialized", info: { version: "1.0.0" } });
    sendCapabilities(window, MANY_WORKFLOWS);
    const panel = panelOf(doc);
    expect(rowNames(panel)).toEqual(FEATURED_FOUR);
    expect((panel.querySelector(".capability-row") as HTMLElement).classList.contains("locked")).toBe(true);
    posted.length = 0;
    click(window, panel.querySelector(".capability-expand") as HTMLElement);
    expect(rowNames(panelOf(doc))).toEqual(ALL_FIVE);
    expect(posted.length).toBe(0);
    for (const r of [...panelOf(doc).querySelectorAll(".capability-row")]) {
      expect(r.classList.contains("locked")).toBe(true);
    }
  });

  it("[R] the sessionToggleGroup ('Session controls') gets no expand link", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    const pop = popoverOf(doc);
    const toggleGroupEl = [...pop.querySelectorAll(".capability-group")]
      .find((g) => g.querySelector(".capability-group-title")?.textContent === "Session controls")!;
    expect(toggleGroupEl).toBeDefined();
    expect(toggleGroupEl.querySelector(".capability-expand")).toBeNull();
  });

  // [R] The welcome canvas and the Actions popover can be on screen at once
  // (the popover overlays the canvas) — clicking expand in EITHER mount must
  // update BOTH immediately, or the mount left behind stays collapsed and
  // later pops open on an unrelated setBusy/modeChanged instead.
  it("[R] expanding in the panel updates the popover immediately, with no extra render trigger needed", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement); // open the popover
    expect(rowNames(panelOf(doc))).toEqual(FEATURED_FOUR);
    expect(rowNames(popoverOf(doc))).toEqual(FEATURED_FOUR);

    click(window, panelOf(doc).querySelector(".capability-expand") as HTMLElement);
    expect(rowNames(panelOf(doc))).toEqual(ALL_FIVE);
    expect(rowNames(popoverOf(doc))).toEqual(ALL_FIVE);
  });

  // [R] Expanding from INSIDE the popover is the mount where a bubbling click
  // would otherwise reach the document-level closePopovers() — it only stays
  // open today because of the popover's own stopPropagation guard.
  it("[R] expanding in the popover updates the panel behind it immediately too, and the popover itself stays open", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement); // open the popover
    const pop = popoverOf(doc);
    const expandInPopover = [...pop.querySelectorAll(".capability-expand")]
      .find((el) => el.textContent === "Show all 5") as HTMLElement;
    expect(expandInPopover).toBeDefined();
    click(window, expandInPopover);
    expect(popoverOf(doc).hidden).toBe(false);
    expect(rowNames(popoverOf(doc))).toEqual(ALL_FIVE);
    expect(rowNames(panelOf(doc))).toEqual(ALL_FIVE);
  });

  // The popover is closed for this one — appendCapabilityGroups must not
  // throw or otherwise assume the popover mount is available.
  it("expanding while the popover is closed only updates the panel, without error", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    expect(popoverOf(doc).hidden).toBe(true);
    expect(() => click(window, panelOf(doc).querySelector(".capability-expand") as HTMLElement)).not.toThrow();
    expect(rowNames(panelOf(doc))).toEqual(ALL_FIVE);
  });

  // [R] renderCapabilitiesPopoverBody clears body.innerHTML on every render;
  // .studio-popover-body is a bounded 280px scroll container, so a naive
  // rebuild snaps scrollTop back to 0 and strands the just-revealed rows
  // below the fold. happy-dom computes no real layout/scrollHeight, so this
  // asserts the mechanism directly: scrollTop is preserved across the click's
  // own rebuild rather than being reset to 0.
  it("[R] expanding in the popover preserves its scroll position across the rebuild", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, MANY_WORKFLOWS);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    const body = popoverOf(doc).querySelector(".studio-popover-body") as HTMLElement;
    Object.defineProperty(body, "scrollTop", { value: 42, writable: true, configurable: true });
    click(window, popoverOf(doc).querySelector(".capability-expand") as HTMLElement);
    expect(body.scrollTop).toBe(42);
  });
});
