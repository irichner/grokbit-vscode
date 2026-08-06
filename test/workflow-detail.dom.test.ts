// DOM tests for the workflow Details inspector — drives the REAL shipped
// media/chat.js in happy-dom via the shared harness.
//
// The first block is a regression guard for a defect the plan's adversarial
// review caught before any code was written: everything inside the detail area
// sits inside a row whose own click handler replaces the composer, so without a
// propagation boundary, reading a detail silently seeds a command.
import { describe, expect, it } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";
// @ts-expect-error — plain JS module, no types
import { SHOW_USER_WORKFLOWS } from "../media/webview-helpers.js";

/** User Workflows UI is temporarily hidden — re-enable with SHOW_USER_WORKFLOWS. */
const itUW = SHOW_USER_WORKFLOWS ? it : it.skip;

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
  itUW("a click on the opened body does not seed the composer", () => {
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

  itUW("a click on the wrap padding does not seed the composer either", () => {
    const { window, doc, wrap } = openDetails(WORKFLOW_GROUP, "Review Changes");
    click(window, wrap);
    expect(inputOf(doc).value).toBe("");
  });

  itUW("in the Actions popover, a body click leaves the popover open", () => {
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

  itUW("the row head still seeds the invoke — the boundary did not disarm the row", () => {
    const { window, doc, row } = openDetails(WORKFLOW_GROUP, "Review Changes");
    const head = row.querySelector(".capability-row-head") as HTMLElement;
    click(window, head);
    expect(inputOf(doc).value).toBe("/workflow review-changes ");
  });

  itUW("the description still seeds the invoke", () => {
    const h = bootWebview();
    sendCapabilities(h.window, WORKFLOW_GROUP);
    const row = rowByLabel(panelOf(h.doc), "Review Changes");
    click(h.window, row.querySelector(".capability-row-desc") as HTMLElement);
    expect(inputOf(h.doc).value).toBe("/workflow review-changes ");
  });
});

describe("detail request echo", () => {
  itUW("a workflow row sends its detailKind and path", () => {
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

const DETAIL = {
  name: "review-changes",
  description: "Review changed files across dimensions",
  phases: [{ title: "Review", detail: "one agent per dimension" }, { title: "Verify" }],
  agents: [
    {
      index: 1,
      promptKind: "literal",
      prompt: "Review the working diff for correctness bugs.",
      label: "review:correctness",
      inferredPhase: "Review",
      model: "sonnet",
      effort: "high",
      hasSchema: true,
    },
    {
      index: 2,
      promptKind: "dynamic",
      prompt: "`Review the ${lens} lens`",
      phase: "Verify",
      hasSchema: false,
    },
  ],
  agentCallSites: 2,
  opaqueAgentCalls: 0,
  overflowAgentCalls: 0,
  truncated: false,
};

function openWorkflowDetail(workflow: Record<string, unknown>) {
  const h = openDetails(WORKFLOW_GROUP, "Review Changes");
  dispatch(h.window, {
    type: "capabilityDetail",
    name: "review-changes",
    path: "/ws/.grok/workflows/review-changes.rhai",
    workflow,
  });
  return h;
}

describe("workflow detail render", () => {
  itUW("shows the description, one chip per phase, and one collapsed block per agent", () => {
    const { body } = openWorkflowDetail(DETAIL);
    expect(body.classList.contains("workflow-detail")).toBe(true);
    expect(body.querySelector(".workflow-detail-desc")?.textContent).toBe(
      "Review changed files across dimensions",
    );
    const chips = Array.from(body.querySelectorAll(".workflow-detail-phase")).map(
      (c) => c.textContent,
    );
    expect(chips).toEqual(["Review", "Verify"]);
    const blocks = body.querySelectorAll(".workflow-agent");
    expect(blocks).toHaveLength(2);
    for (const b of Array.from(blocks)) {
      expect((b.querySelector(".workflow-agent-body") as HTMLElement).hidden).toBe(true);
      expect(b.querySelector(".workflow-agent-summary")!.getAttribute("aria-expanded")).toBe("false");
    }
  });

  itUW("summarises each agent on one line", () => {
    const { body } = openWorkflowDetail(DETAIL);
    const summaries = Array.from(body.querySelectorAll(".workflow-agent-summary-text")).map(
      (s) => s.textContent,
    );
    expect(summaries[0]).toBe("review:correctness · Review · sonnet · high · schema ✓");
    // No label in the script, so it falls back to its position.
    expect(summaries[1]).toBe("agent 2 · Verify");
  });

  itUW("expands and collapses an agent, revealing its prompt and settings", () => {
    const { window, body } = openWorkflowDetail(DETAIL);
    const block = body.querySelector(".workflow-agent") as HTMLElement;
    const summary = block.querySelector(".workflow-agent-summary") as HTMLElement;
    const agentBody = block.querySelector(".workflow-agent-body") as HTMLElement;

    click(window, summary);
    expect(agentBody.hidden).toBe(false);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(block.classList.contains("expanded")).toBe(true);
    expect(block.querySelector(".workflow-agent-prompt")?.textContent).toBe(
      "Review the working diff for correctness bugs.",
    );
    const settings = Array.from(block.querySelectorAll(".workflow-agent-settings dt")).map(
      (d) => d.textContent,
    );
    expect(settings).toContain("Model");
    expect(settings).toContain("Structured output");

    click(window, summary);
    expect(agentBody.hidden).toBe(true);
    expect(summary.getAttribute("aria-expanded")).toBe("false");
  });

  itUW("labels a computed prompt as built at run time", () => {
    const { window, body } = openWorkflowDetail(DETAIL);
    const second = body.querySelectorAll(".workflow-agent")[1] as HTMLElement;
    click(window, second.querySelector(".workflow-agent-summary") as HTMLElement);
    expect(second.querySelector(".workflow-agent-prompt-label")?.textContent).toBe(
      "Prompt (built at run time — showing the script's own text)",
    );
    expect(second.querySelector(".workflow-agent-prompt")?.classList.contains("dynamic")).toBe(true);
  });

  itUW("renders a prompt containing markup as inert text, never as markup", () => {
    const nasty = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const { window, body } = openWorkflowDetail({
      ...DETAIL,
      agents: [{ index: 1, promptKind: "literal", prompt: nasty, hasSchema: false }],
      agentCallSites: 1,
    });
    click(window, body.querySelector(".workflow-agent-summary") as HTMLElement);
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("img")).toBeNull();
    expect(body.querySelector(".workflow-agent-prompt")?.textContent).toBe(nasty);
  });

  itUW("says a workflow builds its steps at run time when there are genuinely no agent calls", () => {
    const { body } = openWorkflowDetail({
      ...DETAIL,
      agents: [],
      agentCallSites: 0,
    });
    expect(body.querySelector(".workflow-detail-note")?.textContent).toBe(
      "No agent calls found — this workflow may build its steps as it runs.",
    );
  });

  itUW("says it could not read them when calls were found but none parsed", () => {
    const { body } = openWorkflowDetail({
      ...DETAIL,
      agents: [],
      agentCallSites: 3,
      opaqueAgentCalls: 3,
    });
    const notes = Array.from(body.querySelectorAll(".workflow-detail-note")).map((n) => n.textContent);
    expect(notes).toContain("Couldn't read this workflow's 3 agent calls.");
    // Not both — one problem, one line.
    expect(notes).toHaveLength(1);
  });

  itUW("distinguishes unreadable calls from calls past the cap, and flags a truncated read", () => {
    const { body } = openWorkflowDetail({
      ...DETAIL,
      opaqueAgentCalls: 1,
      overflowAgentCalls: 4,
      truncated: true,
    });
    const notes = Array.from(body.querySelectorAll(".workflow-detail-note")).map((n) => n.textContent);
    expect(notes).toEqual([
      "1 agent call couldn't be read.",
      "4 more agent calls not shown.",
      "This file was longer than we read — later agents may be missing.",
    ]);
  });

  itUW("renders a host error as one muted line in workflow wording", () => {
    const h = openDetails(WORKFLOW_GROUP, "Review Changes");
    dispatch(h.window, {
      type: "capabilityDetail",
      name: "review-changes",
      error: "not-a-workflow-path",
    });
    expect(h.body.textContent).toBe("That file isn't a workflow this session can open.");
    dispatch(h.window, { type: "capabilityDetail", name: "review-changes", error: "read-failed" });
    expect(h.body.textContent).toBe("Couldn't read this workflow file.");
  });

  it("leaves the suite markdown path and its error wording untouched", () => {
    const h = openDetails(SUITE_GROUP, "/grokbit-explore");
    dispatch(h.window, {
      type: "capabilityDetail",
      name: "grokbit-explore",
      markdown: "## Purpose\n\nRead-only orientation.",
    });
    expect(h.body.classList.contains("workflow-detail")).toBe(false);
    expect(h.body.textContent).toContain("Purpose");
    expect(h.body.innerHTML).not.toContain("## Purpose");

    const h2 = openDetails(SUITE_GROUP, "/grokbit-explore");
    dispatch(h2.window, { type: "capabilityDetail", name: "grokbit-explore", error: "too-large" });
    expect(h2.body.textContent).toBe("Guide is too large to show here — use Open in editor.");
  });
});

describe("detail control labelling", () => {
  itUW("a workflow row describes what it will show", () => {
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

  itUW("Open in editor still posts openFile with the row's detail path", () => {
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
