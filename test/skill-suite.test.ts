import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { CapabilityItem, dedupeByPriority } from "../src/capabilities";
import {
  SUITE_SKILL_NAMES,
  SUITE_TILE_META,
  applySuiteKind,
  attachSuiteHowItWorks,
  attachSuiteTileMeta,
  isSuiteSkillName,
  resolveSuiteHowItWorksPath,
  shouldProvision,
  suiteHowItWorksPath,
  suiteTargets,
} from "../src/skill-suite";

const HOME = path.join(path.sep === "\\" ? "C:\\Users" : "/home", "vibe");
const GROK_DIR = path.join(HOME, ".grok", "skills");
const CLAUDE_DIR = path.join(HOME, ".claude", "skills");
const MANAGED = [GROK_DIR, CLAUDE_DIR];

function skill(name: string, filePath: string | undefined, source = "User (~/.grok)"): CapabilityItem {
  return {
    kind: "skill",
    name,
    description: "",
    source,
    origin: "disk",
    invoke: `/${name} `,
    ...(filePath ? { path: filePath } : {}),
  };
}

const suitePath = (name: string, dir = GROK_DIR) => path.join(dir, name, "SKILL.md");

describe("suiteTargets", () => {
  it("targets both CLIs' home-tier skills directories", () => {
    expect(suiteTargets(HOME)).toEqual([
      { backend: "grok", dir: GROK_DIR },
      { backend: "claude", dir: CLAUDE_DIR },
    ]);
  });

  // Both are written on every run regardless of which CLI is installed: a
  // directory for an absent CLI is inert, and this way the suite is already
  // there if the user installs that CLI later.
  it("[R] never conditions on which backend is installed", () => {
    expect(suiteTargets(HOME).map((t) => t.backend)).toEqual(["grok", "claude"]);
  });
});

describe("shouldProvision", () => {
  it("provisions when no marker exists, or the marker is blank/unreadable", () => {
    expect(shouldProvision(undefined, "3.0.19")).toBe(true);
    expect(shouldProvision("", "3.0.19")).toBe(true);
    expect(shouldProvision("   ", "3.0.19")).toBe(true);
  });

  it("skips when the marker already matches the bundled version", () => {
    expect(shouldProvision("3.0.19", "3.0.19")).toBe(false);
    expect(shouldProvision(" 3.0.19\n", "3.0.19")).toBe(false);
  });

  // [R] The correct suite for an installed extension is the one that shipped
  // with it, so a DOWNGRADE must re-copy too. A "bundled is newer" comparison
  // would silently leave a newer suite paired with older extension code.
  it("[R] provisions on a downgrade, not only on an upgrade", () => {
    expect(shouldProvision("3.0.20", "3.0.19")).toBe(true);
    expect(shouldProvision("3.0.18", "3.0.19")).toBe(true);
  });
});

describe("applySuiteKind", () => {
  it("re-keys a provisioned suite member and marks its source", () => {
    const items = [skill("grokbit-plan", suitePath("grokbit-plan"))];
    const out = applySuiteKind(items, { managedDirs: MANAGED });
    expect(out[0].kind).toBe("grokbit");
    expect(out[0].source).toBe("Grokbit");
    expect(out[0].invoke).toBe("/grokbit-plan ");
  });

  it("re-keys members provisioned under either backend's directory", () => {
    const items = [
      skill("grokbit-plan", suitePath("grokbit-plan", GROK_DIR)),
      skill("grokbit-test", suitePath("grokbit-test", CLAUDE_DIR), "User (~/.claude)"),
    ];
    expect(applySuiteKind(items, { managedDirs: MANAGED }).map((i) => i.kind)).toEqual(["grokbit", "grokbit"]);
  });

  // [R] The security-relevant half of the two-condition rule. Name membership
  // alone would let any repo ship .grok/skills/grokbit-plan/SKILL.md and have
  // it promoted into the group the UI presents as Grokbit's own — and since
  // workspace items win dedupeByPriority, the impostor would be the ONLY row.
  it("[R] leaves a suite-named item alone when it lives outside a managed directory", () => {
    const impostor = skill("grokbit-plan", path.join("/ws", ".grok", "skills", "grokbit-plan", "SKILL.md"), "Project (.grok)");
    const out = applySuiteKind([impostor], { managedDirs: MANAGED });
    expect(out[0].kind).toBe("skill");
    expect(out[0].source).toBe("Project (.grok)");
  });

  it("leaves a non-suite name in a managed directory alone", () => {
    const own = skill("my-own-skill", suitePath("my-own-skill"));
    expect(applySuiteKind([own], { managedDirs: MANAGED })[0].kind).toBe("skill");
  });

  it("ignores items that carry no path, and non-skill kinds", () => {
    const noPath = skill("grokbit-plan", undefined);
    const agent: CapabilityItem = {
      kind: "agent", name: "grokbit-plan", description: "", source: "Built in", origin: "acp",
    };
    const out = applySuiteKind([noPath, agent], { managedDirs: MANAGED });
    expect(out.map((i) => i.kind)).toEqual(["skill", "agent"]);
  });

  it("passes everything through unchanged when there are no managed directories", () => {
    const items = [skill("grokbit-plan", suitePath("grokbit-plan"))];
    expect(applySuiteKind(items, { managedDirs: [] })[0].kind).toBe("skill");
  });

  it("returns a new array and never mutates the caller's items", () => {
    const items = [skill("grokbit-plan", suitePath("grokbit-plan"))];
    const out = applySuiteKind(items, { managedDirs: MANAGED });
    expect(out).not.toBe(items);
    expect(items[0].kind).toBe("skill");
  });

  it("covers every declared suite skill", () => {
    const items = SUITE_SKILL_NAMES.map((n) => skill(n, suitePath(n)));
    expect(applySuiteKind(items, { managedDirs: MANAGED }).every((i) => i.kind === "grokbit")).toBe(true);
  });

  it("matches names case-insensitively", () => {
    const items = [skill("Grokbit-Plan", suitePath("Grokbit-Plan"))];
    expect(applySuiteKind(items, { managedDirs: MANAGED })[0].kind).toBe("grokbit");
  });
});

// [R] The ordering rule from docs/plans/grokbit-actions-and-bundled-skill-suite.md
// § D3, made executable. dedupeByPriority keys on `kind|name`, so the two passes
// are NOT commutative: a workspace override and the provisioned copy collapse
// only while both are still `kind: "skill"`.
describe("[R] applySuiteKind runs after dedupeByPriority, never before", () => {
  // Workspace first — dedupeByPriority requires highest-priority-first input.
  const both = [
    skill("grokbit-plan", path.join("/ws", ".grok", "skills", "grokbit-plan", "SKILL.md"), "Project (.grok)"),
    skill("grokbit-plan", suitePath("grokbit-plan")),
  ];

  it("dedupe → reclassify collapses the pair to one row", () => {
    const out = applySuiteKind(dedupeByPriority(both), { managedDirs: MANAGED });
    expect(out).toHaveLength(1);
    // The workspace copy won dedupe and is outside a managed dir, so it stays
    // an ordinary skill — visible and invocable, simply not badged as ours.
    expect(out[0].kind).toBe("skill");
  });

  it("reclassify → dedupe would render the same skill twice, once per group", () => {
    const wrong = dedupeByPriority(applySuiteKind(both, { managedDirs: MANAGED }));
    expect(wrong).toHaveLength(2);
    expect(wrong.map((i) => i.kind).sort()).toEqual(["grokbit", "skill"]);
  });
});

describe("suite how-it-works paths", () => {
  const EXT = path.join(path.sep === "\\" ? "C:\\ext" : "/ext", "grokbit");

  it("suiteHowItWorksPath joins resources/skills/<name>/references/how-it-works.md", () => {
    expect(suiteHowItWorksPath(EXT, "grokbit-plan")).toBe(
      path.join(EXT, "resources", "skills", "grokbit-plan", "references", "how-it-works.md"),
    );
  });

  it("isSuiteSkillName is case-insensitive; rejects outsiders", () => {
    expect(isSuiteSkillName("grokbit-plan")).toBe(true);
    expect(isSuiteSkillName("Grokbit-Plan")).toBe(true);
    expect(isSuiteSkillName("evil")).toBe(false);
  });

  it("resolveSuiteHowItWorksPath allowlists suite names only", () => {
    expect(resolveSuiteHowItWorksPath(EXT, "not-a-skill")).toEqual({
      ok: false,
      error: "not-a-suite-skill",
    });
    const ok = resolveSuiteHowItWorksPath(EXT, "grokbit-test");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.name).toBe("grokbit-test");
      expect(ok.path).toBe(suiteHowItWorksPath(EXT, "grokbit-test"));
    }
  });

  it("attachSuiteHowItWorks stamps hasDetail only when the guide exists", () => {
    const items: CapabilityItem[] = [
      {
        kind: "grokbit",
        name: "grokbit-plan",
        description: "plan",
        source: "Grokbit",
        origin: "disk",
        invoke: "/grokbit-plan ",
        path: suitePath("grokbit-plan"),
      },
      {
        kind: "grokbit",
        name: "grokbit-explore",
        description: "explore",
        source: "Grokbit",
        origin: "disk",
        invoke: "/grokbit-explore ",
        path: suitePath("grokbit-explore"),
      },
      {
        kind: "skill",
        name: "other",
        description: "",
        source: "User",
        origin: "disk",
      },
    ];
    const planGuide = suiteHowItWorksPath(EXT, "grokbit-plan");
    const out = attachSuiteHowItWorks(items, {
      extensionRoot: EXT,
      fileExists: (p) => p === planGuide,
    });
    expect(out[0].hasDetail).toBe(true);
    expect(out[0].detailPath).toBe(planGuide);
    expect(out[1].hasDetail).toBeUndefined();
    expect(out[2].hasDetail).toBeUndefined();
  });
});

describe("attachSuiteTileMeta", () => {
  const suiteItem = (name: string): CapabilityItem => ({
    kind: "grokbit",
    name,
    description: "",
    source: "Grokbit",
    origin: "disk",
    invoke: `/${name} `,
    path: suitePath(name),
  });

  it("stamps Agents + Reviews on every suite member", () => {
    const out = attachSuiteTileMeta(SUITE_SKILL_NAMES.map((n) => suiteItem(n)));
    expect(out).toHaveLength(SUITE_SKILL_NAMES.length);
    for (const item of out) {
      expect(item.meta?.map((m) => m.label)).toEqual(["Agents", "Reviews"]);
      for (const m of item.meta ?? []) expect(m.value.trim()).not.toBe("");
    }
  });

  it("joins the roster with a middot", () => {
    const [plan] = attachSuiteTileMeta([suiteItem("grokbit-plan")]);
    expect(plan.meta?.[0].value).toBe(
      "Business Analyst · Systems Analyst · Solutions Architect · Plan Reviewer",
    );
  });

  it("uses agentsNote for a phase with no roster of its own", () => {
    const [ship] = attachSuiteTileMeta([suiteItem("grokbit-ship")]);
    expect(SUITE_TILE_META["grokbit-ship"].agents).toEqual([]);
    expect(ship.meta?.[0]).toEqual({ label: "Agents", value: "Runs each phase's own roster" });
  });

  it("[R] leaves a workspace fork alone — it stays kind:skill and claims no roster", () => {
    const fork: CapabilityItem = {
      kind: "skill",
      name: "grokbit-plan",
      description: "",
      source: "Project (.grok)",
      origin: "disk",
      path: suitePath("grokbit-plan", path.join("C:", "repo", ".grok", "skills")),
    };
    expect(attachSuiteTileMeta([fork])[0].meta).toBeUndefined();
  });

  it("ignores a grokbit item with no manifest entry, and never mutates in place", () => {
    const stranger = { ...suiteItem("grokbit-plan"), name: "grokbit-unknown" };
    const items = [stranger, suiteItem("grokbit-test")];
    const out = attachSuiteTileMeta(items);
    expect(out[0].meta).toBeUndefined();
    expect(items[1].meta).toBeUndefined();
    expect(out[1].meta).toBeDefined();
  });

  it("drops a labelled blank rather than rendering an empty line", () => {
    const out = attachSuiteTileMeta([suiteItem("grokbit-plan")], {
      meta: { "grokbit-plan": { agents: [], reviews: "2 rounds" } },
    });
    expect(out[0].meta).toEqual([{ label: "Reviews", value: "2 rounds" }]);
  });
});
