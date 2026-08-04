// BASELINE CHARACTERIZATION — workflow-details-inspector
//
// Captured BEFORE implementation, at commit 7d5e5a4, against a green tree
// (78 files / 1603 tests). Plan: `.grokbit/plans/workflow-details-inspector/`.
//
// These tests record what the extension does TODAY, not what it should do.
// Where current behavior is arguably wrong — see B1.4, the detail-body click
// that clobbers the composer — the wrong behavior is asserted exactly as
// observed. This file is an instrument for detecting change, not a statement
// that the change would be bad.
//
// Deliberately `*.baseline.ts`, not `*.test.ts`: the default vitest config
// matches only `test/**/*.test.ts`, so `npm test` and CI never run these.
// Several of them are EXPECTED to go red once the plan lands (the plan says so
// in writing), and a baseline that blocks every implement task's `npm test`
// verify would be an instrument that breaks the machine it measures. Run with
// `npm run test:baseline`; the verify phase replays it and classifies each
// difference as INTENDED / REGRESSION / UNKNOWN.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CapabilityItem, capabilityFromWorkflowFile } from "../src/capabilities";
import {
  SUITE_SKILL_NAMES,
  attachSuiteHowItWorks,
  resolveSuiteHowItWorksPath,
  suiteHowItWorksPath,
} from "../src/skill-suite";
import { bootWebview, dispatch, click } from "./webview-harness";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const repoFile = (rel: string) => fileURLToPath(new URL("../" + rel, import.meta.url));

const panelOf = (doc: Document) => doc.getElementById("capabilities-panel") as HTMLElement;
const popoverOf = (doc: Document) => doc.getElementById("capabilities-popover") as HTMLElement;
const inputOf = (doc: Document) => doc.getElementById("input") as HTMLTextAreaElement;

/**
 * Row lookup by its rendered display label. Required, not convenience: the
 * workflow group is rendered with a synthetic "Create Workflow" tile PREPENDED
 * (see B4.3), so `querySelector(".capability-row")` on a workflow group returns
 * the Create tile, never the user's own workflow.
 */
function rowByLabel(mount: HTMLElement, label: string): HTMLElement {
  const rows = Array.from(mount.querySelectorAll(".capability-row")) as HTMLElement[];
  const hit = rows.find((r) => r.querySelector(".capability-row-name")?.textContent === label);
  if (!hit) throw new Error(`no capability row labelled "${label}" (saw: ${rows.map((r) => r.querySelector(".capability-row-name")?.textContent).join(" | ")})`);
  return hit;
}

function sendCapabilities(window: any, groups: unknown[]) {
  dispatch(window, {
    type: "capabilities",
    backend: "grok",
    groups,
    scannedRoots: 5,
    truncated: false,
  });
}

/** A suite tile as the host stamps it today: hasDetail + a bundle guide path. */
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
        hasDetail: true,
        detailPath: "/ext/resources/skills/grokbit-explore/references/how-it-works.md",
        source: "Grokbit",
        origin: "disk",
      },
    ],
  },
];

/** A User Workflow tile as the host builds it today: no detail fields at all. */
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
        source: "Project (.grok)",
        origin: "disk",
      },
    ],
  },
];

function openSuiteDetails() {
  const h = bootWebview();
  sendCapabilities(h.window, SUITE_GROUP);
  const btn = panelOf(h.doc).querySelector(".capability-row-details") as HTMLElement;
  click(h.window, btn);
  const body = panelOf(h.doc).querySelector(".capability-row-detail-body") as HTMLElement;
  return { ...h, btn, body };
}

// ─── B1 — capability-row click behavior (plan T5 baseline) ────────────────────

describe("B1 — capability-row click behavior", () => {
  it("B1.1 the Details control renders inside .capability-row-detail-wrap with today's suite-specific title", () => {
    const { doc } = openSuiteDetails();
    const wrap = panelOf(doc).querySelector(".capability-row-detail-wrap") as HTMLElement;
    const btn = wrap.querySelector("button.capability-row-details") as HTMLElement;
    expect(btn.textContent).toBe("Details");
    // Suite-specific copy on every row that has a Details button, including
    // (once workflows are stamped) rows that are not suite workflows at all.
    expect(btn.getAttribute("title")).toBe("How this workflow works (roles, loops, caps)");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("B1.2 the Details request carries ONLY {type,name} — no path, no detailKind", () => {
    const h = bootWebview();
    sendCapabilities(h.window, SUITE_GROUP);
    h.posted.length = 0;
    click(h.window, panelOf(h.doc).querySelector(".capability-row-details") as HTMLElement);
    const req = h.posted.find((m) => m.type === "getCapabilityDetail");
    expect(req).toEqual({ type: "getCapabilityDetail", name: "grokbit-explore" });
    expect(Object.keys(req as object).sort()).toEqual(["name", "type"]);
  });

  it("B1.3 clicking Details does not seed the composer (button stopPropagation holds)", () => {
    const { doc } = openSuiteDetails();
    expect(inputOf(doc).value).toBe("");
  });

  it("B1.4 clicking INSIDE the opened detail body seeds the composer — the click escapes to the row", () => {
    // Recorded as observed. There is no stopPropagation boundary on the wrap or
    // the body, so a click anywhere in the rendered guide bubbles to
    // row.onclick (media/chat.js:922-926) and replaces the composer contents.
    const { window, doc, body } = openSuiteDetails();
    dispatch(window, {
      type: "capabilityDetail",
      name: "grokbit-explore",
      markdown: "## Purpose\n\nRead-only orientation.",
    });
    expect(inputOf(doc).value).toBe("");
    click(window, body);
    expect(inputOf(doc).value).toBe("/grokbit-explore ");
  });

  it("B1.5 clicking inside the detail body in the Actions popover also closes the popover", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, SUITE_GROUP);
    click(window, doc.getElementById("capabilities-btn") as HTMLElement);
    const pop = popoverOf(doc);
    expect(pop.hidden).toBe(false);
    const btn = pop.querySelector(".capability-row-details") as HTMLElement;
    click(window, btn);
    const body = pop.querySelector(".capability-row-detail-body") as HTMLElement;
    dispatch(window, { type: "capabilityDetail", name: "grokbit-explore", markdown: "Body text." });
    click(window, body);
    expect(pop.hidden).toBe(true);
  });

  it("B1.6 Open in editor posts openFile with detailPath and does not seed the composer", () => {
    const h = bootWebview();
    sendCapabilities(h.window, SUITE_GROUP);
    const openEd = panelOf(h.doc).querySelector(".capability-row-details.secondary") as HTMLElement;
    expect(openEd.textContent).toBe("Open in editor");
    expect(openEd.getAttribute("title")).toBe("Open the full how-it-works guide as a file");
    h.posted.length = 0;
    click(h.window, openEd);
    expect(h.posted).toContainEqual({
      type: "openFile",
      path: "/ext/resources/skills/grokbit-explore/references/how-it-works.md",
    });
    expect(inputOf(h.doc).value).toBe("");
  });

  it("B1.7 while locked the Details button is disabled and Open in editor is not rendered", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, SUITE_GROUP);
    dispatch(window, { type: "setBusy", value: true });
    const row = panelOf(doc).querySelector(".capability-row") as HTMLElement;
    expect(row.className).toContain("locked");
    const btn = panelOf(doc).querySelector(".capability-row-details") as HTMLElement;
    expect((btn as any).disabled).toBe(true);
    expect(panelOf(doc).querySelector(".capability-row-details.secondary")).toBeNull();
  });
});

// ─── B2 — suite Details markdown render (plan T6 baseline) ────────────────────

describe("B2 — capabilityDetail render", () => {
  it("B2.1 opening shows the Loading placeholder before any reply", () => {
    const { body } = openSuiteDetails();
    expect(body.hidden).toBe(false);
    expect(body.textContent).toBe("Loading…");
  });

  it("B2.2 a markdown reply renders through the chat markdown pipeline", () => {
    const { window, body } = openSuiteDetails();
    dispatch(window, {
      type: "capabilityDetail",
      name: "grokbit-explore",
      markdown: "## Purpose\n\nRead-only orientation.",
    });
    expect(body.hidden).toBe(false);
    expect(body.textContent).toContain("Purpose");
    expect(body.textContent).toContain("Read-only orientation");
    // Rendered as markup, not as escaped source text.
    expect(body.innerHTML).not.toContain("## Purpose");
  });

  it("B2.3 each host error value maps to its user-facing sentence", () => {
    const cases: Array<[string, string]> = [
      ["not-a-suite-skill", "No guide for this item."],
      ["too-large", "Guide is too large to show here — use Open in editor."],
      ["not-found", "Could not load the guide."],
      ["read-failed", "Could not load the guide."],
    ];
    for (const [error, sentence] of cases) {
      const { window, body } = openSuiteDetails();
      dispatch(window, { type: "capabilityDetail", name: "grokbit-explore", error });
      expect(body.textContent).toBe(sentence);
    }
  });

  it("B2.4 a reply whose name does not match the pending request is ignored", () => {
    const { window, body } = openSuiteDetails();
    dispatch(window, { type: "capabilityDetail", name: "grokbit-plan", markdown: "Wrong target." });
    expect(body.textContent).toBe("Loading…");
  });

  it("B2.5 a second Details click collapses and empties the body", () => {
    const { window, btn, body } = openSuiteDetails();
    click(window, btn);
    expect(body.hidden).toBe(true);
    expect(body.textContent).toBe("");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

// ─── B3 — seed-only composer contract (plan T7 baseline) ──────────────────────

describe("B3 — seed-only composer contract", () => {
  const TWO = [
    {
      kind: "workflow",
      title: "User Workflows",
      total: 2,
      items: [
        { kind: "workflow", name: "alpha", description: "A.", invoke: "/workflow alpha ", path: "/ws/.grok/workflows/alpha.rhai", source: "Project (.grok)", origin: "disk" },
        { kind: "workflow", name: "beta", description: "B.", invoke: "/workflow beta ", path: "/ws/.grok/workflows/beta.rhai", source: "Project (.grok)", origin: "disk" },
      ],
    },
  ];

  it("B3.1 a row click seeds the composer and posts nothing at all", () => {
    const h = bootWebview();
    sendCapabilities(h.window, WORKFLOW_GROUP);
    h.posted.length = 0;
    click(h.window, rowByLabel(panelOf(h.doc), "Review Changes"));
    expect(inputOf(h.doc).value).toBe("/workflow review-changes ");
    expect(h.posted).toEqual([]);
  });

  it("B3.2 a second row click REPLACES the first seed rather than appending", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, TWO);
    click(window, rowByLabel(panelOf(doc), "Alpha"));
    expect(inputOf(doc).value).toBe("/workflow alpha ");
    click(window, rowByLabel(panelOf(doc), "Beta"));
    expect(inputOf(doc).value).toBe("/workflow beta ");
  });
});

// ─── B4 — User Workflow tiles have no Details today (plan T8 baseline) ────────

describe("B4 — workflow items carry no detail affordance", () => {
  const RHAI = [
    'let meta = #{',
    '    name: "review-changes",',
    '    description: "Review a diff across dimensions",',
    '    phases: [ #{ title: "Review" } ],',
    '};',
    'phase("Review");',
    'let out = agent("Review the diff for correctness", #{ label: "correctness" });',
  ].join("\n");

  it("B4.1 capabilityFromWorkflowFile stamps no hasDetail/detailPath, and drops phases entirely", () => {
    const item = capabilityFromWorkflowFile({
      rawText: RHAI,
      filePath: "/ws/.grok/workflows/review-changes.rhai",
      source: "Project (.grok)",
      format: "rhai",
    });
    expect(item).not.toBeNull();
    expect(item!.kind).toBe("workflow");
    expect(item!.name).toBe("review-changes");
    expect(item!.description).toBe("Review a diff across dimensions");
    expect(item!.invoke).toBe("/workflow review-changes ");
    expect(item!.path).toBe("/ws/.grok/workflows/review-changes.rhai");
    expect(item!.hasDetail).toBeUndefined();
    expect(item!.detailPath).toBeUndefined();
    // Today's payload carries no structural data about the script at all: the
    // meta block's `phases` array and the `agent(...)` call are both parsed past.
    expect(Object.keys(item as object).sort()).toEqual(
      ["description", "invoke", "kind", "name", "origin", "path", "source"],
    );
  });

  it("B4.2 a workflow tile renders no Details button", () => {
    const { window, doc } = bootWebview();
    sendCapabilities(window, WORKFLOW_GROUP);
    const row = rowByLabel(panelOf(doc), "Review Changes");
    expect(row.dataset.kind).toBe("workflow");
    // Title Case display label, slash form as the teaching chip beside it.
    expect(row.querySelector(".capability-row-cmd")?.textContent).toBe("/workflow");
    expect(row.querySelector(".capability-row-details")).toBeNull();
    expect(row.querySelector(".capability-row-detail-wrap")).toBeNull();
  });

  it("B4.3 the workflow group is rendered with a synthetic Create Workflow tile PREPENDED", () => {
    // Adjacent behavior found while capturing B3 (Loop T1 step 4). It matters
    // to this change because it is the first `.capability-row` in the group and
    // is NOT a file-backed workflow — a Details affordance stamped onto every
    // workflow row must not attach to it.
    const h = bootWebview();
    sendCapabilities(h.window, WORKFLOW_GROUP);
    const labels = Array.from(panelOf(h.doc).querySelectorAll(".capability-row-name")).map(
      (n) => n.textContent,
    );
    expect(labels).toEqual(["Create Workflow", "Review Changes"]);
    h.posted.length = 0;
    click(h.window, rowByLabel(panelOf(h.doc), "Create Workflow"));
    // Opens the Builder overlay; seeds nothing, posts nothing.
    expect(h.doc.getElementById("workflow-builder")).not.toBeNull();
    expect(inputOf(h.doc).value).toBe("");
    expect(h.posted).toEqual([]);
  });
});

// ─── B5 — bundled guide inventory on disk (plan T9 baseline) ──────────────────

describe("B5 — which suite skills ship a how-it-works guide", () => {
  it("B5.1 five of the six ship one; grokbit-ship is the only member without", () => {
    const missing = SUITE_SKILL_NAMES.filter(
      (n) => !existsSync(repoFile(`resources/skills/${n}/references/how-it-works.md`)),
    );
    expect(missing).toEqual(["grokbit-ship"]);
  });

  it("B5.2 attachSuiteHowItWorks against the real bundle stamps five items, not six", () => {
    const items: CapabilityItem[] = SUITE_SKILL_NAMES.map((name) => ({
      kind: "grokbit",
      name,
      description: "",
      source: "Grokbit",
      origin: "disk",
      path: `/home/u/.grok/skills/${name}/SKILL.md`,
    }));
    const out = attachSuiteHowItWorks(items, {
      extensionRoot: REPO_ROOT,
      fileExists: (p) => existsSync(p),
    });
    const stamped = out.filter((i) => i.hasDetail).map((i) => i.name);
    expect(stamped).toEqual([
      "grokbit-explore",
      "grokbit-plan",
      "grokbit-implement",
      "grokbit-test",
      "grokbit-document",
    ]);
    expect(out.find((i) => i.name === "grokbit-ship")!.hasDetail).toBeUndefined();
  });
});

// ─── B6 — host-side detail resolution (plan T4b baseline) ─────────────────────

describe("B6 — resolveSuiteHowItWorksPath is the only detail resolver today", () => {
  const EXT = "/ext";

  it("B6.1 refuses a file path — the endpoint structurally cannot serve a workflow script", () => {
    for (const p of [
      "/ws/.grok/workflows/review-changes.rhai",
      "C:\\ws\\.claude\\workflows\\spot.js",
      "../../etc/passwd",
    ]) {
      expect(resolveSuiteHowItWorksPath(EXT, p)).toEqual({ ok: false, error: "not-a-suite-skill" });
    }
  });

  it("B6.2 resolves every suite name — including grokbit-ship, whose guide file does not exist", () => {
    for (const name of SUITE_SKILL_NAMES) {
      const r = resolveSuiteHowItWorksPath(EXT, name);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.name).toBe(name);
        expect(r.path).toBe(suiteHowItWorksPath(EXT, name));
      }
    }
    // Resolution succeeding says nothing about the file existing: a
    // getCapabilityDetail("grokbit-ship") would resolve, then fail at statSync
    // and reply error "not-found". Unreachable today only because B5.1 means
    // the tile never renders a Details button to click.
    expect(existsSync(repoFile("resources/skills/grokbit-ship/references/how-it-works.md"))).toBe(false);
  });
});
