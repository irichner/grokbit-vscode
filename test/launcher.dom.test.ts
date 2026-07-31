// DOM: activity-bar launcher — windowed/paged Recent history + collapsible
// section. Drives the real media/launcher.js + media/webview-helpers.js in
// happy-dom. See docs/plans/capability-surfacing-and-history-ux.md § Thread 3
// (30-day window, paging, sticky-window refresh) and § Thread 4 (backend badges).
import { describe, it, expect } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const helperSrc = read("../media/webview-helpers.js");
const launcherSrc = read("../media/launcher.js");

// Mirrors getLauncherHtml's history section — Recent is EXPANDED by default
// (Resolved decision 3: the 30-day window fully replaced the old 7-row cap, so
// an always-collapsed section would hide the list the setting asks for). See
// the "launcher markup parity" describe block below for the drift guard.
const BODY = `
  <div class="launcher">
    <div class="launcher-head">
      <div id="launcher-meta" class="launcher-meta" hidden></div>
      <div class="launcher-new-split">
        <button id="launcher-new" class="onb-action launcher-new-btn" type="button">New session</button>
        <button id="launcher-new-caret" class="launcher-new-caret" type="button" aria-haspopup="true" aria-expanded="false"></button>
        <div id="launcher-new-menu" class="toolbar-popover launcher-new-menu" hidden></div>
      </div>
    </div>
    <div class="launcher-history launcher-section expanded">
      <button id="launcher-history-toggle" class="launcher-section-toggle" type="button" aria-expanded="true" aria-controls="launcher-history-body"></button>
      <div id="launcher-history-body" class="launcher-section-body launcher-history-body">
        <div id="launcher-list" class="history-list launcher-list"></div>
        <div id="launcher-footer" class="history-footer" hidden>
          <button id="launcher-clear-all" class="history-clear-all" type="button"></button>
        </div>
      </div>
    </div>
    <div id="launcher-onboarding" class="launcher-onboarding" hidden></div>
  </div>`;

type Posted = { type: string; [k: string]: unknown };

function bootLauncher(opts?: {
  getState?: () => unknown;
  setState?: (s: unknown) => void;
}): { window: Window; posted: Posted[]; doc: Document; webviewState: { current: unknown } } {
  const window = new Window({ url: "https://localhost/" });
  const posted: Posted[] = [];
  const webviewState = { current: undefined as unknown };
  (window as any).acquireVsCodeApi = () => ({
    postMessage: (m: Posted) => posted.push(m),
    setState: (s: unknown) => {
      webviewState.current = s;
      if (opts?.setState) opts.setState(s);
    },
    getState: () => (opts?.getState ? opts.getState() : webviewState.current),
  });
  const doc = (window as any).document as Document;
  doc.body.innerHTML = BODY;
  (window as any).eval(helperSrc);
  (window as any).eval(launcherSrc);
  return { window, posted, doc, webviewState };
}

function dispatch(window: Window, data: Posted): void {
  (window as any).dispatchEvent(new (window as any).MessageEvent("message", { data }));
}

function click(window: Window, el: Element): void {
  el.dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** `start` lets a test generate a second page's worth of entries with ids that
 *  don't collide with an earlier `makeEntries` call (id `s<start+i>`). */
function makeEntries(n: number, start = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${start + i}`,
    displayName: `Session ${start + i}`,
    updatedAt: Date.now() - (start + i) * 1000,
    numMessages: 1,
  }));
}

/** Simulate scrolling `#launcher-list` near its bottom edge — happy-dom computes
 *  no real layout, so scrollHeight/clientHeight/scrollTop are stubbed directly. */
function scrollNearBottom(window: Window, el: HTMLElement, top = 700): void {
  Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 300, configurable: true });
  Object.defineProperty(el, "scrollTop", { value: top, configurable: true, writable: true });
  el.dispatchEvent(new (window as any).Event("scroll"));
}

describe("launcher Recent history (windowed + paged, WP3)", () => {
  it("posts ready on boot and renders every row of a full page (the old hard 7-row cap is gone)", () => {
    const { window, posted, doc } = bootLauncher();
    expect(posted.some((m) => m.type === "ready")).toBe(true);

    dispatch(window, {
      type: "sessions",
      entries: makeEntries(50),
      activeId: "s0",
      dots: {},
      offset: 0,
      total: 200,
      totalAll: 200,
      windowDays: 30,
      nextOffset: 50,
      hasMore: true,
      query: "",
    });

    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(50);
  });

  it("still has no session-history search box (full history + search stay in the chat popover)", () => {
    const { doc } = bootLauncher();
    expect(doc.getElementById("launcher-search")).toBeNull();
    expect(doc.querySelector(".launcher-history .history-search")).toBeNull();
  });

  // [R] docs/plans/capability-surfacing-and-history-ux.md § Thread 3 — the load-more
  // cursor must be the host's authoritative nextOffset, not the rendered row count.
  // Here the host has prepended one pinned/synthetic row ahead of 50 real disk rows
  // (entries.length === 51), so a client computing its own next offset from
  // state.sessions.length would request 51 and permanently skip disk row #51.
  it("[R] scroll-near-bottom requests the host's nextOffset, not entries.length", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(51),
      activeId: null,
      dots: {},
      offset: 0,
      total: 200,
      nextOffset: 50,
      hasMore: true,
      query: "",
    });
    posted.length = 0;
    scrollNearBottom(window, doc.getElementById("launcher-list") as HTMLElement);
    expect(posted).toContainEqual({ type: "listSessions", offset: 50 });
  });

  it("a second scroll before the reply arrives does not post again (loading guard)", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions", entries: makeEntries(50), activeId: null, dots: {},
      offset: 0, total: 200, nextOffset: 50, hasMore: true, query: "",
    });
    const list = doc.getElementById("launcher-list") as HTMLElement;
    scrollNearBottom(window, list);
    posted.length = 0;
    scrollNearBottom(window, list, 701);
    expect(posted.filter((m) => m.type === "listSessions")).toHaveLength(0);
  });

  it("offset > 0 appends and de-dupes by id", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions", entries: makeEntries(50), activeId: null, dots: {},
      offset: 0, total: 100, nextOffset: 50, hasMore: true, query: "",
    });
    const overlap = [{ ...makeEntries(1, 49)[0] }, ...makeEntries(10, 50)]; // s49 already loaded + 10 new
    dispatch(window, {
      type: "sessions", entries: overlap, activeId: null, dots: {},
      offset: 50, total: 100, nextOffset: 60, hasMore: false, query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(60); // 50 + 10, dup dropped
  });

  it("offset === 0 replaces when the fresh page isn't smaller than what's loaded", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions", entries: makeEntries(3), activeId: null, dots: {},
      offset: 0, total: 3, nextOffset: 3, hasMore: false, query: "",
    });
    dispatch(window, {
      type: "sessions", entries: makeEntries(5, 100), activeId: null, dots: {},
      offset: 0, total: 5, nextOffset: 5, hasMore: false, query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(5);
  });

  // [R] docs/plans/capability-surfacing-and-history-ux.md § Thread 3 — a host
  // mutation (send/rename/delete/tab open-close) pushes an unfiltered offset-0
  // page via broadcastSessionsList on every one of those events. Without the
  // sticky-window guard, a user scrolled to 150 loaded rows watches the list
  // collapse to 50 and jump to the top on every message.
  it("[R] sticky window: an unsolicited offset-0 push while more than one page is loaded re-requests the whole window instead of shrinking it, and the loop guard stops it recursing", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions", entries: makeEntries(50, 0), activeId: null, dots: {},
      offset: 0, total: 500, nextOffset: 50, hasMore: true, query: "",
    });
    dispatch(window, {
      type: "sessions", entries: makeEntries(50, 50), activeId: null, dots: {},
      offset: 50, total: 500, nextOffset: 100, hasMore: true, query: "",
    });
    dispatch(window, {
      type: "sessions", entries: makeEntries(50, 100), activeId: null, dots: {},
      offset: 100, total: 500, nextOffset: 150, hasMore: true, query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(150);

    posted.length = 0;
    // Unsolicited — a single truncated page, not what's already loaded.
    dispatch(window, {
      type: "sessions", entries: makeEntries(50, 0), activeId: null, dots: {},
      offset: 0, total: 500, nextOffset: 50, hasMore: true, query: "",
    });
    expect(posted).toContainEqual({ type: "listSessions", offset: 0, limit: 150 });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(150); // did NOT shrink

    posted.length = 0;
    // The re-request's own reply — offset 0, entries.length === loadedCount. Must
    // render it and NOT loop (pendingWindowRefresh guard).
    dispatch(window, {
      type: "sessions", entries: makeEntries(150, 0), activeId: null, dots: {},
      offset: 0, total: 500, nextOffset: 150, hasMore: true, query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(150);
    expect(posted.filter((m) => m.type === "listSessions")).toHaveLength(0);
  });

  // [R] The sticky-window trigger was keyed off ANY shrink (state.sessions.length
  // > entries.length), not "more than one page loaded" as specified — with only
  // ONE page loaded, deleting a session shrank the incoming push by one row and
  // fired a needless round trip, so the deleted row lingered on screen until the
  // (redundant) reply arrived.
  it("[R] with only ONE page loaded, an unsolicited smaller push (e.g. a delete) renders immediately — no sticky round trip", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions", entries: makeEntries(20, 0), activeId: null, dots: {},
      offset: 0, total: 20, nextOffset: 20, hasMore: false, query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(20);

    posted.length = 0;
    // One row deleted — an unsolicited offset-0 push carrying one fewer row.
    dispatch(window, {
      type: "sessions", entries: makeEntries(19, 0), activeId: null, dots: {},
      offset: 0, total: 19, nextOffset: 19, hasMore: false, query: "",
    });
    expect(posted.filter((m) => m.type === "listSessions")).toHaveLength(0);
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(19);
  });

  // [R] The sticky-window re-request's own `limit` used state.sessions.length,
  // which can include host-injected live/synthetic rows that aren't real disk
  // pagination — using it would creep the "loaded window" upward on every
  // refresh while such a row is present. It must use the host's own disk
  // cursor (state.nextOffset) instead.
  it("[R] the sticky-window re-request's limit is the host's disk cursor (nextOffset), not the rendered row count", () => {
    const { window, posted, doc } = bootLauncher();
    // Page 1: one pinned/synthetic row prepended ahead of 50 real disk rows.
    dispatch(window, {
      type: "sessions", entries: [{ id: "live-1", displayName: "Unflushed", updatedAt: Date.now() }, ...makeEntries(50, 0)],
      activeId: null, dots: {}, offset: 0, total: 500, nextOffset: 50, hasMore: true, query: "",
    });
    // Page 2 (scroll): 50 more real disk rows.
    dispatch(window, {
      type: "sessions", entries: makeEntries(50, 50), activeId: null, dots: {},
      offset: 50, total: 500, nextOffset: 100, hasMore: true, query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(101); // 51 + 50

    posted.length = 0;
    dispatch(window, {
      type: "sessions", entries: makeEntries(50, 0), activeId: null, dots: {},
      offset: 0, total: 500, nextOffset: 50, hasMore: true, query: "",
    });
    // 100 (the disk cursor), NOT 101 (the rendered row count including the
    // injected live row).
    expect(posted).toContainEqual({ type: "listSessions", offset: 0, limit: 100 });
  });

  // [R] the ceiling notice must use the WINDOWED total, never totalAll — a notice
  // stating totalAll would name a count the windowed list can never reach.
  it("[R] ceiling: at LAUNCHER_MAX_ROWS rows a further scroll posts nothing, and the notice names the windowed total, never totalAll", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(500, 0),
      activeId: null,
      dots: {},
      offset: 0,
      total: 620,
      totalAll: 3000,
      windowDays: 30,
      nextOffset: 500,
      hasMore: true,
      query: "",
    });
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(500);
    const notice = doc.querySelector(".launcher-list-notice");
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain("620");
    expect(notice!.textContent).not.toContain("3000");

    posted.length = 0;
    scrollNearBottom(window, doc.getElementById("launcher-list") as HTMLElement);
    expect(posted.filter((m) => m.type === "listSessions")).toHaveLength(0);
  });

  // [R] the footer must key off totalAll, not the windowed total — the mirror of
  // the ceiling case above, so the two totals cannot be conflated.
  it("[R] footer stays keyed off totalAll — shown even when the windowed total is 0", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [],
      activeId: null,
      dots: {},
      offset: 0,
      total: 0,
      totalAll: 120,
      windowDays: 30,
      nextOffset: 0,
      hasMore: false,
      query: "",
    });
    expect((doc.getElementById("launcher-footer") as any).hidden).toBe(false);
  });

  it("shows the plain empty state when there is nothing anywhere (windowed and unwindowed both empty)", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [],
      activeId: null,
      dots: {},
      offset: 0,
      total: 0,
      totalAll: 0,
      windowDays: 30,
      nextOffset: 0,
      hasMore: false,
      query: "",
    });
    const empty = doc.querySelector("#launcher-list .history-empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("No sessions yet.");
  });

  it("shows the windowed empty copy (pointing at the chat history) when sessions exist outside the window", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [],
      activeId: null,
      dots: {},
      offset: 0,
      total: 0,
      totalAll: 120,
      windowDays: 30,
      nextOffset: 0,
      hasMore: false,
      query: "",
    });
    const empty = doc.querySelector("#launcher-list .history-empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("30 days");
    expect(empty!.textContent!.toLowerCase()).toContain("chat history");
  });

  // [R] Pre-fix, a live session outside the window was neither windowed in nor
  // synthesized — the row (and its status dot, the only ambient "needs you"
  // signal for a background tab) vanished entirely. Here the host has already
  // pinned it back in (session-store.test.ts covers that pure logic); this proves
  // the launcher renders whatever the host sends rather than dropping it itself.
  it("[R] a live out-of-window (pinned) row still renders with its status dot", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [{ id: "old-live", displayName: "Stale but live", updatedAt: Date.now() - 90 * 24 * 60 * 60 * 1000 }],
      activeId: null,
      dots: { "old-live": "needs-you" },
      offset: 0,
      total: 1,
      totalAll: 1,
      windowDays: 30,
      nextOffset: 1,
      hasMore: false,
      query: "",
    });
    const dot = doc.querySelector('[data-session-dot="old-live"]');
    expect(dot).not.toBeNull();
    expect(dot!.className).toContain("dot-needs-you");
  });
});

describe("launcher meta (version + Grokbit development cost)", () => {
  it("renders version · compact tokens and a development-cost tooltip", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "launcherMeta",
      extVersion: "2.0.4",
      totalTokens: 42_700_000,
      generatedAt: "2026-07-30T12:34:56Z",
    });
    const meta = doc.getElementById("launcher-meta") as HTMLElement;
    expect(meta.hidden).toBe(false);
    expect(meta.textContent).toBe("v2.0.4 · 42.7M tokens");
    expect(meta.title).toContain("42,700,000");
    expect(meta.title).toContain("developing this extension");
    expect(meta.title).toContain("all maintainers, all sessions");
    expect(meta.title).toContain("as of 2026-07-30");
    // The one thing this tooltip exists to prevent: reading it as your own usage.
    expect(meta.title).toContain("not your usage");
  });

  it("drops the as-of clause when the host sends no generatedAt", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, { type: "launcherMeta", extVersion: "2.0.4", totalTokens: 16_000 });
    const meta = doc.getElementById("launcher-meta") as HTMLElement;
    expect(meta.textContent).toBe("v2.0.4 · 16.0K tokens");
    expect(meta.title).toContain("16,000");
    expect(meta.title).not.toContain("as of");
    expect(meta.title).toContain("not your usage");
  });

  it("shows version only when the host omits totalTokens", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, { type: "launcherMeta", extVersion: "2.0.4" });
    const meta = doc.getElementById("launcher-meta") as HTMLElement;
    expect(meta.textContent).toBe("v2.0.4");
    expect(meta.title).toBe("Extension v2.0.4");
  });
});

describe("launcher layout (no Create a document / Templates)", () => {
  it("is New session + Recent only — no doc types or templates chrome", () => {
    const { doc } = bootLauncher();
    const launcher = doc.querySelector(".launcher") as HTMLElement;
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    const onboarding = doc.getElementById("launcher-onboarding") as HTMLElement;
    const list = doc.getElementById("launcher-list") as HTMLElement;
    const footer = doc.getElementById("launcher-footer") as HTMLElement;
    expect(history).not.toBeNull();
    expect(history.contains(list)).toBe(true);
    expect(history.contains(footer)).toBe(true);
    expect(doc.getElementById("launcher-docs")).toBeNull();
    expect(doc.getElementById("launcher-templates")).toBeNull();
    expect(doc.getElementById("launcher-studio")).toBeNull();
    expect(doc.querySelector(".launcher-section-bar")).toBeNull();
    expect(doc.querySelectorAll(".welcome-doc-type")).toHaveLength(0);
    expect(doc.querySelectorAll(".launcher-template-row")).toHaveLength(0);
    // DOM order: head → history → onboarding.
    const kids = [...launcher.children] as HTMLElement[];
    const head = doc.querySelector(".launcher-head") as HTMLElement;
    expect(kids.indexOf(head)).toBeLessThan(kids.indexOf(history));
    expect(kids.indexOf(history)).toBeLessThan(kids.indexOf(onboarding));
  });
});

describe("launcher collapsible sections", () => {
  // [R] Resolved decision 3 — the 30-day window fully replaced the old 7-row
  // cap, and Recent now defaults to EXPANDED: an always-collapsed section would
  // hide the very list the setting asks for.
  it("[R] is expanded by default when no state is persisted", () => {
    const { doc } = bootLauncher();
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(history.classList.contains("expanded")).toBe(true);
    expect(history.classList.contains("collapsed")).toBe(false);
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("[R] persisted historyOpen: false still collapses it", () => {
    const { doc } = bootLauncher({
      getState: () => ({ historyOpen: false }),
    });
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(history.classList.contains("collapsed")).toBe(true);
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("collapses Recent history on header click (from the expanded default) and persists", () => {
    const { window, doc, webviewState } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(3),
      activeId: null,
      dots: {},
      offset: 0,
      total: 3,
      nextOffset: 3,
      hasMore: false,
      query: "",
    });
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    const toggle = doc.getElementById("launcher-history-toggle") as HTMLButtonElement;
    click(window, toggle);
    expect(history.classList.contains("collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((webviewState.current as { historyOpen?: boolean })?.historyOpen).toBe(false);
    // Collapsing hides the body via CSS only — the rows stay rendered underneath.
    expect(doc.querySelectorAll("#launcher-list .history-row")).toHaveLength(3);
  });

  it("restores expanded prefs from webview state on boot", () => {
    const { doc } = bootLauncher({
      getState: () => ({ historyOpen: true }),
    });
    const history = doc.querySelector(".launcher-history") as HTMLElement;
    expect(history.classList.contains("expanded")).toBe(true);
    expect(doc.getElementById("launcher-history-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });
});

// [R] docs/plans/capability-surfacing-and-history-ux.md — the review found the
// expanded-by-default change was easy to scope to launcher.js alone while
// getLauncherHtml's SERVER-RENDERED markup still hardcoded collapsed — a visible
// collapse-then-expand flash on every load, invisible to a DOM-fixture test since
// the fixture itself hardcodes the same (now-corrected) markup. This is
// deliberately a source-text assertion: nothing else catches drift between the
// fixture and the shipped HTML.
describe("launcher markup parity (getLauncherHtml vs. the DOM fixture)", () => {
  it("[R] getLauncherHtml's history section and the fixture BODY agree on expanded / aria-expanded=\"true\"", () => {
    const sidebarSrc = read("../src/sidebar.ts");
    const start = sidebarSrc.indexOf("private getLauncherHtml(");
    expect(start).toBeGreaterThan(-1);
    const methodSrc = sidebarSrc.slice(start, start + 3000);
    expect(methodSrc).toContain("launcher-history launcher-section expanded");
    expect(methodSrc).toContain('aria-expanded="true"');
    expect(methodSrc).not.toContain("launcher-section collapsed");

    expect(BODY).toContain("launcher-history launcher-section expanded");
    expect(BODY).toContain('aria-expanded="true"');
  });
});

// [R] LAUNCHER_MAX_ROWS and LAUNCHER_PAGE_SIZE are each duplicated (one copy in
// src/sidebar.ts driving the host's own paging/cap behavior, one in
// media/launcher.js driving the client's ceiling notice + sticky-window
// trigger) with nothing catching drift between the two copies. Source-text
// assertion, mirroring the markup-parity technique above.
describe("launcher constant parity (LAUNCHER_MAX_ROWS / LAUNCHER_PAGE_SIZE, sidebar.ts vs. launcher.js)", () => {
  function constValue(src: string, name: string): number {
    const m = src.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)`));
    expect(m, `expected to find "const ${name} = <number>" in the source`).not.toBeNull();
    return Number(m![1]);
  }

  it("[R] LAUNCHER_MAX_ROWS matches between src/sidebar.ts and media/launcher.js", () => {
    const sidebarSrc = read("../src/sidebar.ts");
    expect(constValue(launcherSrc, "LAUNCHER_MAX_ROWS")).toBe(constValue(sidebarSrc, "LAUNCHER_MAX_ROWS"));
  });

  it("[R] LAUNCHER_PAGE_SIZE matches between src/sidebar.ts and media/launcher.js", () => {
    const sidebarSrc = read("../src/sidebar.ts");
    expect(constValue(launcherSrc, "LAUNCHER_PAGE_SIZE")).toBe(constValue(sidebarSrc, "LAUNCHER_PAGE_SIZE"));
  });
});

describe("launcher backend badges (merged grok + Claude history; both-labeled since capability-surfacing-and-history-ux.md § Thread 4)", () => {
  it("badges both a grok row and a Claude row", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [
        { id: "g1", displayName: "Grok session", updatedAt: Date.now(), backend: "grok" },
        { id: "c1", displayName: "Claude session", updatedAt: Date.now(), backend: "claude" },
      ],
      activeId: null,
      dots: {},
      offset: 0,
      total: 2,
      hasMore: false,
      query: "",
    });
    const rows = doc.querySelectorAll("#launcher-list .history-row");
    const grokBadge = rows[0].querySelector(".history-row-backend");
    expect(grokBadge).not.toBeNull();
    expect(grokBadge!.textContent).toBe("Grok");
    const claudeBadge = rows[1].querySelector(".history-row-backend");
    expect(claudeBadge).not.toBeNull();
    expect(claudeBadge!.textContent).toBe("Claude");
    // .history-row-name still carries the ellipsis structure alongside the badge.
    expect(rows[0].querySelector(".history-row-name")).not.toBeNull();
    expect(rows[1].querySelector(".history-row-name")).not.toBeNull();
  });

  it("a row with no backend field (legacy) badges Grok — legacy rows predate the field", () => {
    const { window, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: makeEntries(1),
      activeId: null,
      dots: {},
      offset: 0,
      total: 1,
      hasMore: false,
      query: "",
    });
    const badge = doc.querySelector("#launcher-list .history-row-backend");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Grok");
  });

  it("delete posts the row's backend along with the id", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [{ id: "c1", displayName: "Claude session", updatedAt: Date.now(), backend: "claude" }],
      activeId: null,
      dots: {},
      offset: 0,
      total: 1,
      hasMore: false,
      query: "",
    });
    const delBtn = doc.querySelector("#launcher-list .history-action-danger") as HTMLElement;
    delBtn.dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(posted).toContainEqual({ type: "deleteSession", id: "c1", name: "Claude session", backend: "claude" });
  });

  // docs/plans/claude-code-backend.md § WP5 — a Claude row must resume a
  // Claude session, not a grok one; the row's own backend rides along.
  it("resume (row click) posts the row's backend along with the id", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [
        { id: "g1", displayName: "Grok session", updatedAt: Date.now(), backend: "grok" },
        { id: "c1", displayName: "Claude session", updatedAt: Date.now(), backend: "claude" },
      ],
      activeId: null,
      dots: {},
      offset: 0,
      total: 2,
      hasMore: false,
      query: "",
    });
    const rows = doc.querySelectorAll("#launcher-list .history-row");
    rows[1].dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(posted).toContainEqual({ type: "resumeSession", id: "c1", backend: "claude" });
  });

  it("resume for a legacy row (no backend field) posts no backend field", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, {
      type: "sessions",
      entries: [{ id: "s1", displayName: "Old session", updatedAt: Date.now() }],
      activeId: null,
      dots: {},
      offset: 0,
      total: 1,
      hasMore: false,
      query: "",
    });
    const row = doc.querySelector("#launcher-list .history-row") as HTMLElement;
    row.dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(posted).toContainEqual({ type: "resumeSession", id: "s1" });
  });
});

describe("launcher New split button (docs/plans/claude-code-backend.md § WP3)", () => {
  it("the primary button posts newSession with no explicit backend (host default)", () => {
    const { window, posted, doc } = bootLauncher();
    posted.length = 0;
    click(window, doc.getElementById("launcher-new") as HTMLButtonElement);
    expect(posted).toContainEqual({ type: "newSession" });
  });

  it("the caret opens a menu offering both backends explicitly", () => {
    const { window, doc } = bootLauncher();
    const caret = doc.getElementById("launcher-new-caret") as HTMLButtonElement;
    const menu = doc.getElementById("launcher-new-menu") as HTMLElement;
    expect(menu.hidden).toBe(true);

    click(window, caret);
    expect(menu.hidden).toBe(false);
    expect(caret.getAttribute("aria-expanded")).toBe("true");
    const items = [...menu.querySelectorAll(".toolbar-popover-item")];
    expect(items.map((i) => i.textContent)).toEqual(["New Grok session", "New Claude session"]);
  });

  it("picking a menu item posts newSession with that explicit backend and closes the menu", () => {
    const { window, posted, doc } = bootLauncher();
    click(window, doc.getElementById("launcher-new-caret") as HTMLButtonElement);
    const menu = doc.getElementById("launcher-new-menu") as HTMLElement;
    const claudeItem = [...menu.querySelectorAll(".toolbar-popover-item")].find(
      (i) => i.textContent === "New Claude session",
    ) as HTMLElement;
    posted.length = 0;
    click(window, claudeItem);
    expect(posted).toContainEqual({ type: "newSession", backend: "claude" });
    expect(menu.hidden).toBe(true);
  });

  it("clicking the caret again toggles the menu closed", () => {
    const { window, doc } = bootLauncher();
    const caret = doc.getElementById("launcher-new-caret") as HTMLButtonElement;
    const menu = doc.getElementById("launcher-new-menu") as HTMLElement;
    click(window, caret);
    expect(menu.hidden).toBe(false);
    click(window, caret);
    expect(menu.hidden).toBe(true);
  });
});

describe("launcher missing-Claude-adapter / claude-auth-required onboarding", () => {
  it("offers Install + re-check for a missing adapter, backend-tagged", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, { type: "onboarding", state: "missing-claude-adapter", backend: "claude" });
    const onb = doc.getElementById("launcher-onboarding") as HTMLElement;
    expect(onb.hidden).toBe(false);
    expect(onb.textContent).toContain("Install the Claude Code adapter");

    const install = onb.querySelector('[data-act="installClaude"]') as HTMLElement;
    click(window, install);
    expect(posted).toContainEqual({ type: "installClaudeAdapter" });

    const recheck = onb.querySelector('[data-act="recheck"]') as HTMLElement;
    click(window, recheck);
    expect(posted).toContainEqual({ type: "recheckConnection", backend: "claude" });
  });

  it("offers a Claude sign-in action, backend-tagged on recheck", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, { type: "onboarding", state: "claude-auth-required", backend: "claude" });
    const onb = doc.getElementById("launcher-onboarding") as HTMLElement;
    expect(onb.textContent).toContain("Sign in to Claude Code");

    const login = onb.querySelector('[data-act="runClaudeLogin"]') as HTMLElement;
    click(window, login);
    expect(posted).toContainEqual({ type: "runClaudeLogin" });

    const recheck = onb.querySelector('[data-act="recheck"]') as HTMLElement;
    click(window, recheck);
    expect(posted).toContainEqual({ type: "recheckConnection", backend: "claude" });
  });

  it("grok's onboarding cards recheck with no backend field (host falls back to grok.defaultBackend)", () => {
    const { window, posted, doc } = bootLauncher();
    dispatch(window, { type: "onboarding", state: "missing-cli", platform: "linux" });
    const recheck = doc.querySelector('#launcher-onboarding [data-act="recheck"]') as HTMLElement;
    click(window, recheck);
    const msg = posted.find((m) => m.type === "recheckConnection");
    expect(msg).toEqual({ type: "recheckConnection" });
  });
});
