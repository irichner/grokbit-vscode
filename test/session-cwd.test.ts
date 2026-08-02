import { describe, it, expect } from "vitest";
import { resolveSessionCwd } from "../src/session-cwd";

describe("resolveSessionCwd", () => {
  it("prefers session override (worktree)", () => {
    expect(resolveSessionCwd("/wt/feat", "/repo", "/proc")).toBe("/wt/feat");
  });

  it("falls back to workspace root", () => {
    expect(resolveSessionCwd(undefined, "/repo", "/proc")).toBe("/repo");
    expect(resolveSessionCwd("  ", "/repo", "/proc")).toBe("/repo");
  });

  it("falls back to process cwd", () => {
    expect(resolveSessionCwd(undefined, undefined, "/proc")).toBe("/proc");
  });
});
