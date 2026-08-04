import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  decideProtectPaths,
  decideStop,
  extractGateCommands,
  extractPtcRows,
  isPlaceholderCommand,
  matchedProtectedPattern,
  normalizeHookPath,
} from "../src/grok-hooks-policy";
import {
  pickLatestPlanSlug,
  planArtifactsDir,
  releaseReadinessPath,
} from "../src/plan-artifacts";

describe("protect_paths decisions", () => {
  it.each([
    ".env",
    ".env.production",
    "config/.env",
    "id.pem",
    "private.key",
    "secrets/api-key.txt",
    ".git/config",
    ".ssh/config",
    "id_rsa",
    ".grok/hooks/verify_on_stop.py",
    ".grok/settings.json",
    "AGENTS.md",
  ])("blocks protected path %s", (file_path) => {
    const r = decideProtectPaths({ toolInput: { file_path } });
    expect(r.code).toBe(2);
    expect(r.deny).toBe(true);
  });

  it("allows unrelated source path", () => {
    const r = decideProtectPaths({ toolInput: { file_path: "src/hook-suite.ts" } });
    expect(r.code).toBe(0);
    expect(r.deny).toBe(false);
  });

  it("blocks normalization and case bypasses", () => {
    for (const file_path of [
      ".grok/Hooks/verify_on_stop.py",
      ".grok/./hooks/settings.json",
      ".grok//hooks/settings.json",
      ".ENV",
      "sub/../.grok/hooks/x.py",
    ]) {
      expect(decideProtectPaths({ toolInput: { file_path } }).deny).toBe(true);
    }
  });

  it("normalizes backslashes and dots", () => {
    expect(normalizeHookPath(".grok/./hooks/x.py")).toBe(".grok/hooks/x.py");
    expect(normalizeHookPath("a\\b\\.git\\config")).toBe("a/b/.git/config");
    expect(matchedProtectedPattern("C:\\proj\\.git\\config")).toBeTruthy();
  });

  it("[R] fail-open without file_path", () => {
    expect(decideProtectPaths({}).deny).toBe(false);
    expect(decideProtectPaths({ toolInput: {} }).deny).toBe(false);
  });
});

describe("verify_on_stop PTC + decide_stop", () => {
  const AGENTS = `
<!-- BEGIN PROJECT_TEST_COMMANDS -->
- **Build:** \`npm run build\`
- **Unit tests:** \`npm test\`
- **Lint:** \`NONE — no tool in repo\`
<!-- END PROJECT_TEST_COMMANDS -->
`;

  it("extracts real unit cmd and skips NONE lint", () => {
    const rows = extractPtcRows(AGENTS);
    expect(rows["Unit tests"]).toContain("npm test");
    const cmds = extractGateCommands(rows);
    expect(cmds).toEqual([{ label: "Unit tests", command: "npm test" }]);
  });

  // [R] JS `split(sep, limit)` truncates the array where Python's
  // `split(sep, maxsplit)` keeps the remainder, so the original port silently
  // disagreed with the Python whenever a marker appeared more than once.
  it("[R] matches Python split semantics when a marker repeats", () => {
    const doubled = `${AGENTS}\n<!-- BEGIN PROJECT_TEST_COMMANDS -->\n- **Lint:** \`ruff\`\n<!-- END PROJECT_TEST_COMMANDS -->\n`;
    const rows = extractPtcRows(doubled);
    expect(rows["Unit tests"]).toContain("npm test");
  });

  it("returns no rows when a marker is missing", () => {
    expect(extractPtcRows("- **Unit tests:** `npm test`")).toEqual({});
    expect(extractPtcRows("<!-- BEGIN PROJECT_TEST_COMMANDS -->\n- **Lint:** `x`")).toEqual({});
  });

  it("skips TODO/NONE placeholders", () => {
    expect(isPlaceholderCommand("NONE — no tool in repo")).toBe(true);
    expect(isPlaceholderCommand("TODO — user must fill")).toBe(true);
    expect(isPlaceholderCommand("npm test")).toBe(false);
    expect(
      extractGateCommands({
        Lint: "`TODO — user must fill`",
        "Unit tests": "`NONE — no tool in repo`",
      }),
    ).toEqual([]);
  });

  it("allows stop when no file change marker", () => {
    const d = decideStop({ changed: false, results: null, currentCount: 0 });
    expect(d.action).toBe("allow");
    expect(d.exitCode).toBe(0);
  });

  it("[R] blocks on red unit command", () => {
    const d = decideStop({
      changed: true,
      results: [{ label: "Unit tests", command: "npm test", passed: false, output: "FAIL" }],
      currentCount: 0,
    });
    expect(d.action).toBe("block");
    expect(d.exitCode).toBe(2);
    expect(d.counterAction).toBe("increment");
  });

  it("allows when no change marker even if results red", () => {
    const d = decideStop({
      changed: false,
      results: [{ label: "Unit tests", command: "npm test", passed: false, output: "FAIL" }],
      currentCount: 0,
    });
    expect(d.action).toBe("allow");
  });

  it("fail-open with note when changed but zero commands", () => {
    const d = decideStop({ changed: true, results: [], currentCount: 0 });
    expect(d.action).toBe("allow");
    expect(d.stderrNote).toMatch(/zero Lint\/Unit/i);
  });

  it("releases after max blocks", () => {
    const d = decideStop({
      changed: true,
      results: [{ label: "Unit tests", command: "npm test", passed: false, output: "x" }],
      currentCount: 2,
      maxBlocks: 3,
    });
    expect(d.action).toBe("release");
    expect(d.exitCode).toBe(0);
  });

  it("allows when all commands pass", () => {
    const d = decideStop({
      changed: true,
      results: [{ label: "Unit tests", command: "npm test", passed: true, output: "ok" }],
      currentCount: 1,
    });
    expect(d.action).toBe("allow");
    expect(d.clearChanged).toBe(true);
  });
});

describe("plan artifact helpers", () => {
  it("picks latest plan slug by mtime", () => {
    expect(
      pickLatestPlanSlug([
        { name: "old", mtimeMs: 1, isDirectory: true },
        { name: "new", mtimeMs: 99, isDirectory: true },
        { name: "file.md", mtimeMs: 1000, isDirectory: false },
      ]),
    ).toBe("new");
    expect(pickLatestPlanSlug([])).toBeNull();
  });

  it("builds plan and release-readiness paths", () => {
    const root = path.join(path.sep === "\\" ? "C:\\ws" : "/ws", "proj");
    expect(planArtifactsDir(root, "my-slug")).toBe(
      path.join(root, ".grokbit", "plans", "my-slug"),
    );
    expect(releaseReadinessPath(root)).toBe(path.join(root, "test", "release-readiness.md"));
  });
});
