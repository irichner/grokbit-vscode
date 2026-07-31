import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { CapabilityItem, dedupeByPriority } from "../src/capabilities";
import {
  SUITE_SKILL_NAMES,
  applySuiteKind,
  shouldProvision,
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
