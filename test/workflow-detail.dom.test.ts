// DOM tests for the workflow Details inspector — drives the REAL shipped
// media/chat.js in happy-dom via the shared harness.
//
// The first block is a regression guard for a defect the plan's adversarial
// review caught before any code was written: everything inside the detail area
// sits inside a row whose own click handler replaces the composer, so without a
// propagation boundary, reading a detail silently seeds a command.
import { describe, expect, it } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const panelOf = (doc: Document) => doc.getElementById("capabilities-panel") as HTMLElement;
const popoverOf = (doc: Document) => doc.getElementById("capabilities-popover") as HTMLElement;
const inputOf = (doc: Document) => doc.getElementById("input") as HTMLTextAreaElement;

function sendCapabilities(window: any, groups: unknown[]) {
  dispatch(window, {
    type: "capabilities",
    backend: "grok",
    groups,
    scannedRoots: 5,
    truncated: false,
  });
}

/** A workflow tile as the host stamps it once T8 lands. */
const WORKFLOW_GROUP = [
  {
    kind: "workflow",
    title: "User Workflows",
    total: 1,
    items: [
      {
        kind: "workflow",
        name: "review-changes",
        description: "Review a diff across dimensions.",
        invoke: "/workflow review-changes ",
        path: "/ws/.grok/workflows/review-changes.rhai",
        hasDetail: true,
        detailPath: "/ws/.grok/workflows/review-changes.rhai",
        detailKind: "workflow",
        source: "Project (.grok)",
        origin: "disk",
      },
    ],
  },
];

/** A suite tile, whose detail is a bundled markdown guide. */
const SUITE_GROUP = [
  {
    kind: "grokbit",
    title: "Grokbit workflow",
    total: 1,
    items: [
      {
        kind: "grokbit",
        name: "grokbit-explore",
        description: "Map first.",
        invoke: "/grokbit-explore ",
        path: "/home/u/.grok/skills/grokbit-explore/SKILL.md",
        hasDetail: true,
        detailPath: "/ext/resources/skills/grokbit-explore/references/how-it-works.md",
        detailKind: "guide",
        source: "Grokbit",
        origin: "disk",
      },
    ],
  },
];

/**
 * Find a row by its display label OR its slash chip. Both are needed: a
 * `workflow` tile renders Title Case ("Review Changes") while a `grokbit` suite
 * tile renders with the prefix stripped, so neither alone identifies every row —
 * and the workflow group additionally prepends a synthetic Create Workflow tile,
 * so positional lookup is not an option either.
 */
function rowByLabel(mount: HTMLElement, label: string): HTMLElement {
  const rows = Array.from(mount.querySelectorAll(".capability-row")) as HTMLElement[];
  const hit = rows.find(
    (r) =>
      r.querySelector(".capability-row-name")?.textContent === label ||
      r.querySelector(".capability-row-cmd")?.textContent === label,
  );
  if (!hit) {
    const seen = rows.map((r) => r.querySelector(".capability-row-name")?.textContent).join(" | ");
    throw new Error(`no row labelled "${label}" (saw: ${seen})`);
  }
  return hit;
}

function openDetails(groups: unknown[], label: string) {
  const h = bootWebview();
  sendCapabilities(h.window, groups);
  const row = rowByLabel(panelOf(h.doc), label);
  const btn = row.querySelector(".capability-row-details") as HTMLElement;
  click(h.window, btn);
  const body = row.querySelector(".capability-row-detail-body") as HTMLElement;
  const wrap = row.querySelector(".capability-row-detail-wrap") as HTMLElement;
  return { ...h, row, btn, body, wrap };
}

describe("detail area — propagation boundary (regression guard)", () => {
  it("a click on the opened body does not seed the composer", () => {
    const { window, doc, body } = openDetails(WORKFLOW_GROUP, "Review Changes");
    dispatch(window, {
      type: "capabilityDetail",
      name: "review-changes",
      path: "/ws/.grok/workflows/review-changes.rhai",
      workflow: {
        phases: [],
        agents: [],
        agentCallSites: 0,
        opaqueAgentCalls: 0,
        overflowAgentCalls: 0,
        truncated: false,
      },
    });
    click(window, body);
    expect(inputOf(doc).value).toBe("");
  });

  it("a click on the wrap padding does not seed the composer either", () => {
    const { window, doc, wrap } = openDetails(WORKFLOW_GROUP, "Review Changes");
    click(window, wrap);
    expect(inputOf(doc).value).toBe("");
  });

  it("in the Actions popover, a body click leaves the popover open", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, WORKFLOW_GROUP);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    const pop = popoverOf(doc);
    expect(pop.hidden).toBe(false);
    const row = rowByLabel(pop, "Review Changes");
    click(window, row.querySelector(".capability-row-details") as HTMLElement);
    click(window, row.querySelector(".capability-row-detail-body") as HTMLElement);
    expect(pop.hidden).toBe(false);
    expect(inputOf(doc).value).toBe("");
  });

  it("the same boundary protects a suite guide body — the shipped read-the-guide-lose-your-composer bug", () => {
    // Declared behavior change: before this, clicking the rendered guide text
    // seeded /grokbit-explore and closed the popover.
    const { window, doc, body } = openDetails(SUITE_GROUP, "/grokbit-explore");
    dispatch(window, {
      type: "capabilityDetail",
      name: "grokbit-explore",
      markdown: "## Purpose\n\nRead-only orientation.",
    });
    click(window, body);
    expect(inputOf(doc).value).toBe("");
  });

  it("the row head still seeds the invoke — the boundary did not disarm the row", () => {
    const { window, doc, row } = openDetails(WORKFLOW_GROUP, "Review Changes");
    const head = row.querySelector(".capability-row-head") as HTMLElement;
    click(window, head);
    expect(inputOf(doc).value).toBe("/workflow review-changes ");
  });

  it("the description still seeds the invoke", () => {
    const h = bootWebview();
    sendCapabilities(h.window, WORKFLOW_GROUP);
    const row = rowByLabel(panelOf(h.doc), "Review Changes");
    click(h.window, row.querySelector(".capability-row-desc") as HTMLElement);
    expect(inputOf(h.doc).value).toBe("/workflow review-changes ");
  });
});

describe("detail request echo", () => {
  it("a workflow row sends its detailKind and path", () => {
    const h = bootWebview();
    sendCapabilities(h.window, WORKFLOW_GROUP);
    h.posted.length = 0;
    const row = rowByLabel(panelOf(h.doc), "Review Changes");
    click(h.window, row.querySelector(".capability-row-details") as HTMLElement);
    expect(h.posted).toContainEqual({
      type: "getCapabilityDetail",
      name: "review-changes",
      detailKind: "workflow",
      path: "/ws/.grok/workflows/review-changes.rhai",
    });
  });

  it("a suite row sends its detailKind but NO path — the guide resolves from its name", () => {
    const h = bootWebview();
    sendCapabilities(h.window, SUITE_GROUP);
    h.posted.length = 0;
    const row = rowByLabel(panelOf(h.doc), "/grokbit-explore");
    click(h.window, row.querySelector(".capability-row-details") as HTMLElement);
    const req = h.posted.find((m) => m.type === "getCapabilityDetail")!;
    expect(req).toEqual({
      type: "getCapabilityDetail",
      name: "grokbit-explore",
      detailKind: "guide",
    });
    expect("path" in req).toBe(false);
  });

  it("a row with no detailKind at all still sends a bare request — the pre-change shape", () => {
    const legacy = [
      {
        kind: "grokbit",
        title: "Grokbit workflow",
        total: 1,
        items: [
          {
            kind: "grokbit",
            name: "grokbit-plan",
            description: "Plan first.",
            invoke: "/grokbit-plan ",
            hasDetail: true,
            detailPath: "/ext/x.md",
            source: "Grokbit",
            origin: "disk",
          },
        ],
      },
    ];
    const h = bootWebview();
    sendCapabilities(h.window, legacy);
    h.posted.length = 0;
    const row = rowByLabel(panelOf(h.doc), "/grokbit-plan");
    click(h.window, row.querySelector(".capability-row-details") as HTMLElement);
    expect(h.posted).toContainEqual({ type: "getCapabilityDetail", name: "grokbit-plan" });
  });
});

describe("detail control labelling", () => {
  it("a workflow row describes what it will show", () => {
    const { btn, row } = openDetails(WORKFLOW_GROUP, "Review Changes");
    expect(btn.getAttribute("title")).toBe("What this workflow runs (agents, phases, prompts)");
    const openEd = row.querySelector(".capability-row-details.secondary") as HTMLElement;
    expect(openEd.getAttribute("title")).toBe("Open the workflow script in the editor");
  });

  it("a suite row keeps the guide wording", () => {
    const { btn, row } = openDetails(SUITE_GROUP, "/grokbit-explore");
    expect(btn.getAttribute("title")).toBe("How this workflow works (roles, loops, caps)");
    const openEd = row.querySelector(".capability-row-details.secondary") as HTMLElement;
    expect(openEd.getAttribute("title")).toBe("Open the full how-it-works guide as a file");
  });

  it("Open in editor still posts openFile with the row's detail path", () => {
    const h = bootWebview();
    sendCapabilities(h.window, WORKFLOW_GROUP);
    h.posted.length = 0;
    const openEd = rowByLabel(panelOf(h.doc), "Review Changes").querySelector(
      ".capability-row-details.secondary",
    ) as HTMLElement;
    click(h.window, openEd);
    expect(h.posted).toContainEqual({
      type: "openFile",
      path: "/ws/.grok/workflows/review-changes.rhai",
    });
    expect(inputOf(h.doc).value).toBe("");
  });
});
